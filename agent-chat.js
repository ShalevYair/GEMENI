import { AGENTS } from './agents-config.js';
import { getStorytellerPrompt } from './storyteller-prompt.js';
import { getArchitectPrompt } from './architect-prompt.js';
import { getPlatformArchitectPrompt } from './platform-architect-prompt.js';

const STORAGE_KEY       = 'gemini_api_key';
const MODEL_CHAIN       = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
const MAX_FILE_MB       = 10;
const MAX_OUTPUT_TOKENS = 65000;
const CHUNK_SIZE        = 50000;  // chars per input chunk for large text files
const DOWNLOAD_THRESHOLD = 3000; // responses longer than this are auto-downloaded

// ── State ─────────────────────────────────────────────────────────────────
let apiKey          = localStorage.getItem(STORAGE_KEY) || '';
let chatHistory     = [];
let isLoading       = false;
let lastFailed      = null;
let retryTimer      = null;
let typingCounter   = 0;
let pendingFile     = null;
let modelIdx        = 0; // current position in MODEL_CHAIN

// ── Bootstrap ─────────────────────────────────────────────────────────────
const agentId = new URLSearchParams(location.search).get('id');
const agent   = AGENTS[agentId];

document.addEventListener('DOMContentLoaded', () => {
  if (!agent) { showNotFound(); return; }
  populateHero();
  renderEmptyState();
  if (agentId === 'storyteller') injectBacklogModal();
  if (agentId === 'software-architect') injectArchitectModal();
  if (agentId === 'platform-architect') injectPlatformArchitectModal();
  if (apiKey) showChatReady();
  bindEvents();
});

// ── Page title ────────────────────────────────────────────────────────────
function populateHero() {
  document.title = `${agent.name} — אגם הסוכנים`;
  const titleEl = document.getElementById('site-header-title');
  if (titleEl) titleEl.textContent = `${agent.icon} ${agent.name}`;
}

function showNotFound() {
  document.title = 'סוכן לא נמצא — אגם הסוכנים';
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Heebo,sans-serif;text-align:center;padding:2rem">
      <div>
        <div style="font-size:3rem;margin-bottom:1rem">🤷</div>
        <h2 style="font-size:1.4rem;margin-bottom:.5rem">הסוכן לא נמצא</h2>
        <p style="color:#6b7a99;margin-bottom:1.5rem">מזהה הסוכן "<code>${agentId || ''}</code>" אינו קיים.</p>
        <a href="index.html" style="color:#0070d2">← חזרה לאגם הסוכנים</a>
      </div>
    </div>`;
}

// ── Events ────────────────────────────────────────────────────────────────
function bindEvents() {
  const input    = document.getElementById('chat-input');
  const fileBtn  = document.getElementById('file-btn');
  const fileInput = document.getElementById('file-input');

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => autoResize(input));

  fileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') input.blur();
  });
}

// ── API key ───────────────────────────────────────────────────────────────
window.saveApiKey = function () {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem(STORAGE_KEY, key);
  showChatReady();
  document.getElementById('chat-input').focus();
};

window.changeApiKey = function () {
  apiKey = '';
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById('api-banner').hidden = false;
  document.getElementById('api-key-input').value = '';
  document.getElementById('api-key-input').focus();
  setHeaderActions(false);
};

function showChatReady() {
  document.getElementById('api-banner').hidden = true;
  setHeaderActions(true);
}

function setHeaderActions(show) {
  const slot = document.getElementById('site-header-actions');
  if (!slot) return;
  if (!show) { slot.innerHTML = ''; return; }
  const modelLabel = MODEL_CHAIN[modelIdx] || MODEL_CHAIN[0];
  slot.innerHTML = `
    <span class="site-header-model-tag" title="מודל פעיל">${modelLabel}</span>
    <button class="site-header-btn" onclick="clearChat()" title="נקה שיחה">🗑</button>
    <button class="site-header-btn" onclick="changeApiKey()" title="החלף מפתח API">🔑</button>`;
}

// ── Empty state / suggestions ─────────────────────────────────────────────
function renderEmptyState() {
  const msgs = document.getElementById('chat-messages');
  if (document.getElementById('chat-empty')) return;

  const empty = document.createElement('div');
  empty.id        = 'chat-empty';
  empty.className = 'chat-empty';
  empty.innerHTML = `
    <div class="chat-empty-icon">${agent.icon}</div>
    <h3>שלום, אני ${agent.name}</h3>
    <p>${agent.description}</p>
    <div class="suggestion-chips">
      ${agent.suggestions.map(s =>
        `<button class="chip" onclick="window.sendSuggestion(this)">${s}</button>`
      ).join('')}
      ${agentId === 'storyteller'
        ? `<button class="chip chip--generate" onclick="window.openBacklogModal()">📋 צור EPIC / FEATURES / USER STORIES מקובץ</button>`
        : ''}
      ${agentId === 'software-architect'
        ? `<button class="chip chip--generate" onclick="window.openArchitectModal()">צור אפיון טכני מפורט על בסיס קובץ אפיון עסקי או פונקציונאלי</button>`
        : ''}
      ${agentId === 'platform-architect'
        ? `<button class="chip chip--generate" onclick="window.openPlatformArchitectModal()">צור אפיון פלטפורמה מפורט על בסיס קובץ אפיון עסקי או פונקציונאלי</button>`
        : ''}
    </div>`;
  msgs.appendChild(empty);
}

window.clearChat = function () {
  chatHistory  = [];
  lastFailed   = null;
  pendingFile  = null;
  clearPendingFile();
  document.getElementById('chat-messages').innerHTML = '';
  renderEmptyState();
};

window.sendSuggestion = function (btn) {
  document.getElementById('chat-input').value = btn.textContent;
  sendMessage();
};

// ── File handling ─────────────────────────────────────────────────────────
async function handleFileSelect(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showFileError(`הקובץ גדול מדי (מקסימום ${MAX_FILE_MB}MB)`);
    return;
  }

  try {
    pendingFile = await readFile(file);
    showPendingFile(pendingFile);
  } catch {
    showFileError('שגיאה בקריאת הקובץ');
  }
}

async function readFile(file) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const name = file.name;

  // Word — extract text
  if (ext === 'docx') {
    if (!window.mammoth) throw new Error('mammoth not loaded');
    const buf    = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return { name, mimeType: 'text/plain', isInline: false, text: result.value };
  }

  // Plain text / CSV / JSON / Markdown
  if (['txt','csv','json','md'].includes(ext)) {
    const text = await file.text();
    return { name, mimeType: 'text/plain', isInline: false, text };
  }

  // PDF / images — base64 inline
  const inlineTypes = {
    pdf: 'application/pdf',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp',
  };
  if (inlineTypes[ext]) {
    const base64 = await toBase64(file);
    return { name, mimeType: inlineTypes[ext], isInline: true, base64 };
  }

  throw new Error(`סוג קובץ לא נתמך: .${ext}`);
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function showPendingFile(f) {
  let el = document.getElementById('pending-file-chip');
  if (!el) {
    el = document.createElement('div');
    el.id        = 'pending-file-chip';
    el.className = 'pending-file-chip';
    document.getElementById('chat-input-wrapper').prepend(el);
  }
  el.innerHTML = `
    <span class="pending-file-icon">${fileIcon(f.mimeType)}</span>
    <span class="pending-file-name">${f.name}</span>
    <button class="pending-file-remove" onclick="window.removePendingFile()" title="הסר קובץ">✕</button>`;
}

window.removePendingFile = function () {
  pendingFile = null;
  clearPendingFile();
};

function clearPendingFile() {
  document.getElementById('pending-file-chip')?.remove();
}

function showFileError(msg) {
  const err = document.createElement('div');
  err.className = 'file-error-toast';
  err.textContent = msg;
  document.body.appendChild(err);
  setTimeout(() => err.remove(), 3500);
}

function fileIcon(mimeType) {
  if (mimeType === 'application/pdf')  return '📄';
  if (mimeType.startsWith('image/'))   return '🖼️';
  return '📎';
}

// ── Send ──────────────────────────────────────────────────────────────────
window.sendMessage = async function () {
  if (isLoading) return;
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text && !pendingFile) return;

  if (!apiKey) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  hideEmpty();
  const userText = text;
  const fileCopy = pendingFile;
  input.value   = '';
  autoResize(input);
  pendingFile   = null;
  clearPendingFile();
  lastFailed    = { text: userText, file: fileCopy };

  appendUserMessage(userText, fileCopy);
  const typingId = appendTyping();
  setLoading(true);

  try {
    const reply = await executeCall(userText, fileCopy, typingId);
    removeTyping(typingId);
    appendMessage('assistant', reply);
    lastFailed = null;
  } catch (err) {
    removeTyping(typingId);
    handleError(err);
  } finally {
    setLoading(false);
    input.focus();
  }
};

// ── Gemini API ────────────────────────────────────────────────────────────
async function callGemini(userText, file) {
  const userParts = buildUserParts(userText, file);
  const contents  = [
    ...chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: userParts },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CHAIN[modelIdx]}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: agent.systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  const data  = await res.json();
  const reply = data.candidates[0].content.parts.map(p => p.text).join('');

  // Store in history as text only (avoid giant base64 in history)
  const historyText = file
    ? `[קובץ מצורף: ${file.name}]${userText ? '\n' + userText : ''}`
    : userText;
  chatHistory.push({ role: 'user',  text: historyText });
  chatHistory.push({ role: 'model', text: reply });

  return reply;
}

function buildUserParts(text, file) {
  const parts = [];
  if (!file) {
    parts.push({ text: text || '' });
    return parts;
  }

  if (file.isInline) {
    if (text) parts.push({ text });
    parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
  } else {
    const combined = `תוכן הקובץ "${file.name}":\n\n${file.text}${text ? '\n\n' + text : ''}`;
    parts.push({ text: combined });
  }
  return parts;
}

// ── Single-shot Gemini call (no history, no history update) ───────────────
async function callGeminiOnce(promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CHAIN[modelIdx]}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: agent.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  const candidate = data.candidates[0];
  if (candidate.finishReason === 'MAX_TOKENS') {
    appendMessage('error', `⚠️ חלק נחתך בגלל מגבלת אסימונים — ייתכן שחלק מהתוכן חסר.`);
  }
  return candidate.content.parts.map(p => p.text).join('');
}

async function callGeminiOnceWithFallback(promptText) {
  while (true) {
    try {
      return await callGeminiOnce(promptText);
    } catch (err) {
      if (isQuotaExceeded(err.message) && modelIdx < MODEL_CHAIN.length - 1) {
        const from = MODEL_CHAIN[modelIdx++];
        setHeaderActions(true);
        appendMessage('error', `⚠️ הגעת למגבלת השימוש של ${from}. עובר ל-${MODEL_CHAIN[modelIdx]}... 🔄`);
        await new Promise(r => setTimeout(r, 800));
        continue;
      }
      throw err;
    }
  }
}

// ── Chunked processing for large text files ────────────────────────────────
async function sendChunked(userText, file, typingId) {
  const chunks = [];
  for (let i = 0; i < file.text.length; i += CHUNK_SIZE) {
    chunks.push(file.text.slice(i, i + CHUNK_SIZE));
  }
  const total = chunks.length;
  const partResults = [];

  for (let i = 0; i < total; i++) {
    updateTyping(typingId, `מעבד חלק ${i + 1} מתוך ${total}...`);
    const prompt =
      `תוכן הקובץ "${file.name}" — חלק ${i + 1} מתוך ${total}:\n\n${chunks[i]}\n\n` +
      `הנחיה: עבד את החלק הזה בלבד ופלוט את התוצאה המלאה. אל תוסיף הקדמה, סיכום, או הסבר שזהו חלק X — פשוט פלוט את התוכן הרלוונטי.` +
      (userText ? `\n\nבקשת המשתמש: ${userText}` : '');
    partResults.push(await callGeminiOnceWithFallback(prompt));
  }

  const combined = partResults.join('\n\n---\n\n');

  const histText = `[קובץ מצורף: ${file.name}]${userText ? '\n' + userText : ''}`;
  chatHistory.push({ role: 'user',  text: histText });
  chatHistory.push({ role: 'model', text: combined });
  return combined;
}

async function executeCall(userText, file, typingId) {
  if (file && !file.isInline && file.text && file.text.length > CHUNK_SIZE) {
    return sendChunked(userText, file, typingId);
  }
  return callGemini(userText, file);
}

// ── Error handling ────────────────────────────────────────────────────────
function isQuotaExceeded(msg) {
  return /quota|exceeded your current quota|free_tier|generativelanguage.*requests/i.test(msg);
}

function handleError(err) {
  const msg = err.message || '';
  if (/API_KEY|401|403|INVALID|api key/i.test(msg)) {
    apiKey = '';
    localStorage.removeItem(STORAGE_KEY);
    document.getElementById('api-banner').hidden = false;
    setHeaderActions(false);
    appendMessage('error', 'מפתח ה-API אינו תקף. אנא הזן מפתח חדש.');
  } else if (isQuotaExceeded(msg)) {
    handleQuotaError();
  } else if (/429|overload|high demand|503/i.test(msg)) {
    startRetryCountdown();
  } else {
    appendMessage('error', 'שגיאה: ' + msg);
  }
}

function handleQuotaError() {
  const exhausted = modelIdx >= MODEL_CHAIN.length - 1;
  if (!exhausted) {
    const fromModel = MODEL_CHAIN[modelIdx];
    modelIdx++;
    const toModel = MODEL_CHAIN[modelIdx];
    appendMessage('error',
      `⚠️ הגעת למגבלת השימוש היומית של ${fromModel}.\n` +
      `עובר אוטומטית ל-${toModel}... 🔄`
    );
    switchModelAndRetry();
  } else {
    appendMessage('error',
      `⚠️ הגעת למגבלת השימוש היומית בכל המודלים הזמינים.\n` +
      `ניתן לבדוק את המגבלות ולנסות שוב מחר:\n` +
      `👉 <a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noopener">aistudio.google.com/rate-limit</a>`
    );
  }
}

async function switchModelAndRetry() {
  if (!lastFailed) return;
  setHeaderActions(true);
  await new Promise(r => setTimeout(r, 800));
  const typingId = appendTyping();
  setLoading(true);
  try {
    const reply = await executeCall(lastFailed.text, lastFailed.file, typingId);
    removeTyping(typingId);
    document.getElementById('chat-messages').querySelectorAll('.chat-msg-error').forEach(el => el.remove());
    appendMessage('assistant', reply);
    lastFailed = null;
  } catch (err) {
    removeTyping(typingId);
    handleError(err);
  } finally {
    setLoading(false);
  }
}

function startRetryCountdown() {
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  document.getElementById('chat-messages').querySelectorAll('.chat-msg-error').forEach(el => el.remove());

  const msgs    = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.id        = 'retry-bubble';
  wrapper.className = 'chat-msg chat-msg-error';
  const bubble = document.createElement('div');
  bubble.className  = 'chat-bubble';
  wrapper.appendChild(bubble);
  msgs.appendChild(wrapper);
  msgs.scrollTop = msgs.scrollHeight;

  let secs = 15;
  const render = () => {
    bubble.innerHTML = `⏳ המודל עמוס, מנסה שוב בעוד <strong>${secs}</strong> שניות...
      <br><button class="chat-retry-btn" onclick="window.retryNow()">נסה עכשיו ↺</button>`;
  };
  render();
  retryTimer = setInterval(() => {
    secs--;
    if (secs <= 0) { clearInterval(retryTimer); retryTimer = null; window.retryNow(); }
    else render();
  }, 1000);
}

window.retryNow = async function () {
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  if (!lastFailed) return;
  document.getElementById('chat-messages').querySelectorAll('.chat-msg-error').forEach(el => el.remove());
  const typingId = appendTyping();
  setLoading(true);
  try {
    const reply = await executeCall(lastFailed.text, lastFailed.file, typingId);
    removeTyping(typingId);
    appendMessage('assistant', reply);
    lastFailed = null;
  } catch (err) {
    removeTyping(typingId);
    handleError(err);
  } finally {
    setLoading(false);
    document.getElementById('chat-input').focus();
  }
};

// ── UI helpers ────────────────────────────────────────────────────────────
function appendUserMessage(text, file) {
  const msgs    = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-msg chat-msg-user';

  if (file) {
    const fileBubble = document.createElement('div');
    fileBubble.className = 'chat-file-bubble';
    fileBubble.innerHTML = `${fileIcon(file.mimeType)} <span>${escHtml(file.name)}</span>`;
    wrapper.appendChild(fileBubble);
  }
  if (text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    wrapper.appendChild(bubble);
  }
  msgs.appendChild(wrapper);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendMessage(role, text) {
  const msgs    = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = `chat-msg chat-msg-${role}`;
  const bubble = document.createElement('div');
  bubble.className  = 'chat-bubble';

  if (role === 'assistant' && text.length > DOWNLOAD_THRESHOLD) {
    bubble.innerHTML = '📥 הפלט ארוך — מוריד קובץ אוטומטית...';
    const dlBtn = document.createElement('button');
    dlBtn.className = 'chat-download-btn';
    dlBtn.innerHTML = '⬇ הורד שוב';
    dlBtn.addEventListener('click', () => downloadResponse(text));
    wrapper.appendChild(bubble);
    wrapper.appendChild(dlBtn);
    downloadResponse(text);
  } else {
    bubble.innerHTML = role === 'error' ? text.replace(/\n/g, '<br>') : formatText(text);
    wrapper.appendChild(bubble);
  }

  msgs.appendChild(wrapper);
  msgs.scrollTop = msgs.scrollHeight;
}

function downloadResponse(text) {
  const ts   = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const name = agent ? agent.name.replace(/\s+/g, '-') : 'response';
  const filename = `${name}_${ts}.md`;
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function appendTyping() {
  const id      = 'typing-' + (++typingCounter);
  const msgs    = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.id        = id;
  wrapper.className = 'chat-msg chat-msg-assistant';
  wrapper.innerHTML = '<div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>';
  msgs.appendChild(wrapper);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function updateTyping(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.chat-bubble').textContent = text;
  el.scrollIntoView({ block: 'nearest' });
}

function hideEmpty() {
  document.getElementById('chat-empty')?.remove();
}

function setLoading(val) {
  isLoading = val;
  document.getElementById('send-btn').disabled      = val;
  document.getElementById('chat-input').disabled    = val;
  document.getElementById('file-btn').disabled      = val;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function formatText(text) {
  return escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Backlog Generator (storyteller agent only) ────────────────────────────

function injectBacklogModal() {
  const modal = document.createElement('div');
  modal.id = 'backlog-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:460px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">📋 צור Backlog מקובץ</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך (FSD, PRD, תיאור פיצ'ר) וקבל Epic, Features ו-User Stories מובנים ומלאים.</p>

      <label id="backlog-dropzone" for="backlog-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="backlog-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .csv · .json</span></div>
        <input id="backlog-file-input" type="file" accept=".docx,.txt,.md,.csv,.json" style="display:none;" onchange="window.backlogFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="backlog-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="backlog-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeBacklogModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateBacklog()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור Backlog ⚡</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeBacklogModal(); });
  document.body.appendChild(modal);
}

window.openBacklogModal = function () {
  if (isLoading) return;
  const modal = document.getElementById('backlog-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeBacklogModal = function () {
  const modal = document.getElementById('backlog-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('backlog-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('backlog-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .csv · .json</span>`;
  const dz = document.getElementById('backlog-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.backlogFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('backlog-file-label');
  lbl.innerHTML = `<strong>${escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('backlog-dropzone').style.borderColor = '#0070d2';
};

window.generateBacklog = async function () {
  const fileInput = document.getElementById('backlog-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('backlog-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const lang = document.querySelector('input[name="backlog-lang"]:checked')?.value || 'en';
  window.closeBacklogModal();
  hideEmpty();

  let fileData;
  try {
    fileData = await readFile(file);
  } catch (e) {
    appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline) {
    appendMessage('error', 'ליצירת Backlog נדרש קובץ טקסט (.docx, .txt, .md). קבצי PDF ותמונות אינם נתמכים במצב זה.');
    return;
  }

  if (!apiKey) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  setLoading(true);
  const progressId = appendTyping();
  const results = [];
  let bModelIdx = modelIdx;

  for (let chunk = 1; chunk <= 3; chunk++) {
    updateTyping(progressId, `מייצר חלק ${chunk} מתוך 3... (${['Epic & Features', 'User Stories & AC', 'Prioritization & DoD'][chunk - 1]})`);
    const prompt = getStorytellerPrompt(fileData.text, chunk, lang);

    let done = false;
    while (!done) {
      try {
        results.push(await callGeminiForBacklog(prompt, bModelIdx));
        done = true;
      } catch (err) {
        const quota = isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && bModelIdx < MODEL_CHAIN.length - 1) {
          bModelIdx++;
          appendMessage('error', `⚠️ עובר למודל ${MODEL_CHAIN[bModelIdx]} (חלק ${chunk})... 🔄`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          removeTyping(progressId);
          setLoading(false);
          appendMessage('error', `שגיאה בחלק ${chunk}: ${err.message}`);
          return;
        }
      }
    }
  }

  removeTyping(progressId);
  setLoading(false);

  const header = `<!-- Backlog generated by מספר הסיפורים | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `backlog-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  appendMessage('assistant',
    `✅ הבאקלוג נוצר בהצלחה והורד כ-\`${filename}\`\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · Epic Overview\n` +
    `• 01 · Features\n` +
    `• 02 · User Stories (INVEST)\n` +
    `• 03 · Acceptance Criteria (Given-When-Then)\n` +
    `• 04 · Backlog Prioritization (MoSCoW + WSJF)\n` +
    `• 05 · Definition of Done & Ready\n` +
    `• 06 · Spike Stories`
  );
};

// ── Technical Spec Generator (software-architect agent only) ─────────────

function injectArchitectModal() {
  const modal = document.createElement('div');
  modal.id = 'architect-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:480px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">צור אפיון טכני מקובץ אפיון עסקי</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך אפיון (BRD, FSD, PRD) וקבל מסמך ארכיטקטורה מלא: הקשר מערכת, סגנון ארכיטקטורה, רכיבים, מודל נתונים, API contracts, אינטגרציות, ADRs וניהול סיכונים.</p>

      <label id="architect-dropzone" for="architect-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="architect-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="architect-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.architectFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="architect-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="architect-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeArchitectModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateArchitectSpec()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור אפיון טכני</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeArchitectModal(); });
  document.body.appendChild(modal);
}

window.openArchitectModal = function () {
  if (isLoading) return;
  const modal = document.getElementById('architect-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeArchitectModal = function () {
  const modal = document.getElementById('architect-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('architect-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('architect-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span>`;
  const dz = document.getElementById('architect-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.architectFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('architect-file-label');
  lbl.innerHTML = `<strong>${escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('architect-dropzone').style.borderColor = '#0070d2';
};

window.generateArchitectSpec = async function () {
  const fileInput = document.getElementById('architect-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('architect-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const lang = document.querySelector('input[name="architect-lang"]:checked')?.value || 'en';
  window.closeArchitectModal();
  hideEmpty();

  let fileData;
  try {
    fileData = await readFile(file);
  } catch (e) {
    appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  // Images are not supported; PDFs (isInline=true) are sent as base64 to Gemini
  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    appendMessage('error', 'ליצירת אפיון טכני נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
    return;
  }

  if (!apiKey) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  setLoading(true);
  const progressId = appendTyping();
  const results = [];
  let aModelIdx = modelIdx;

  const chunkLabels = ['System Context & Architecture Style', 'Components & Data Architecture', 'API Contracts & Integration Map', 'ADR Log & NFR + Risks'];

  for (let chunk = 1; chunk <= 4; chunk++) {
    updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const prompt = getArchitectPrompt(fileData.isInline ? '' : fileData.text, chunk, lang);

    let done = false;
    while (!done) {
      try {
        results.push(await callGeminiForArchitectSpec(prompt, aModelIdx, fileData.isInline ? fileData : null));
        done = true;
      } catch (err) {
        const quota = isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && aModelIdx < MODEL_CHAIN.length - 1) {
          aModelIdx++;
          appendMessage('error', `⚠️ עובר למודל ${MODEL_CHAIN[aModelIdx]} (חלק ${chunk})... 🔄`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          removeTyping(progressId);
          setLoading(false);
          appendMessage('error', `שגיאה בחלק ${chunk}: ${err.message}`);
          return;
        }
      }
    }
  }

  removeTyping(progressId);
  setLoading(false);

  const header = `<!-- Architecture Spec generated by ארכיטקט התוכנה | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `architecture-spec-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  appendMessage('assistant',
    `✅ האפיון הטכני נוצר בהצלחה והורד כ-\`${filename}\`\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · System Context (C4 Context Diagram, actors, external systems)\n` +
    `• 01 · Architecture Style (chosen pattern + 3 rejected alternatives + trade-offs)\n` +
    `• 02 · Component Design (HLD, interfaces, failure modes)\n` +
    `• 03 · Data Architecture (entity ownership, DB decisions, consistency model)\n` +
    `• 04 · API Contracts (endpoints, request/response, error codes, async events)\n` +
    `• 05 · Integration Map (external integrations, circuit breakers, error handling)\n` +
    `• 06 · ADR Log (Architecture Decision Records for every major decision)\n` +
    `• 07 · NFR & Risk Register (performance, security, scalability, risks + mitigations)`
  );
};

// ── Platform Architecture Spec Generator (platform-architect agent only) ────

function injectPlatformArchitectModal() {
  const modal = document.createElement('div');
  modal.id = 'platform-architect-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:480px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">צור אפיון פלטפורמה מקובץ אפיון עסקי</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך אפיון (BRD, FSD, PRD) וקבל מסמך ארכיטקטורת פלטפורמה מלא: Make-or-Buy עם TCO, תשתית ואבטחה, אינטגרציות עם circuit breakers, CI/CD Pipeline, ADRs וניהול סיכונים.</p>

      <label id="platform-architect-dropzone" for="platform-architect-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="platform-architect-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="platform-architect-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.platformArchitectFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="platform-architect-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="platform-architect-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closePlatformArchitectModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generatePlatformArchitectSpec()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור אפיון פלטפורמה</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closePlatformArchitectModal(); });
  document.body.appendChild(modal);
}

window.openPlatformArchitectModal = function () {
  if (isLoading) return;
  const modal = document.getElementById('platform-architect-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closePlatformArchitectModal = function () {
  const modal = document.getElementById('platform-architect-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('platform-architect-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('platform-architect-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span>`;
  const dz = document.getElementById('platform-architect-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.platformArchitectFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('platform-architect-file-label');
  lbl.innerHTML = `<strong>${escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('platform-architect-dropzone').style.borderColor = '#0070d2';
};

window.generatePlatformArchitectSpec = async function () {
  const fileInput = document.getElementById('platform-architect-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('platform-architect-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const lang = document.querySelector('input[name="platform-architect-lang"]:checked')?.value || 'en';
  window.closePlatformArchitectModal();
  hideEmpty();

  let fileData;
  try {
    fileData = await readFile(file);
  } catch (e) {
    appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    appendMessage('error', 'ליצירת אפיון פלטפורמה נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
    return;
  }

  if (!apiKey) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  setLoading(true);
  const progressId = appendTyping();
  const results = [];
  let pModelIdx = modelIdx;

  const chunkLabels = ['Platform Decision & Infrastructure Overview', 'Environment Security & Integration Architecture', 'CI/CD Pipeline & Environment Runbook', 'ADR Log & NFR + Risk Register'];

  for (let chunk = 1; chunk <= 4; chunk++) {
    updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const prompt = getPlatformArchitectPrompt(fileData.isInline ? '' : fileData.text, chunk, lang);

    let done = false;
    while (!done) {
      try {
        results.push(await callGeminiForArchitectSpec(prompt, pModelIdx, fileData.isInline ? fileData : null));
        done = true;
      } catch (err) {
        const quota = isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && pModelIdx < MODEL_CHAIN.length - 1) {
          pModelIdx++;
          appendMessage('error', `⚠️ עובר למודל ${MODEL_CHAIN[pModelIdx]} (חלק ${chunk})... 🔄`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          removeTyping(progressId);
          setLoading(false);
          appendMessage('error', `שגיאה בחלק ${chunk}: ${err.message}`);
          return;
        }
      }
    }
  }

  removeTyping(progressId);
  setLoading(false);

  const header = `<!-- Platform Architecture Spec generated by ארכיטקט הפלטפורמות | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `platform-spec-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  appendMessage('assistant',
    `✅ אפיון הפלטפורמה נוצר בהצלחה והורד כ-\`${filename}\`\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · Platform Decision (Make-or-Buy + TCO + lock-in assessment)\n` +
    `• 01 · Infrastructure Overview (topology, environments, IaC strategy)\n` +
    `• 02 · Security Architecture (IAM, network, secrets, compliance)\n` +
    `• 03 · Integration Architecture (API Gateway, integrations + circuit breakers)\n` +
    `• 04 · CI/CD Pipeline (stages, rollback, artifact management)\n` +
    `• 05 · Operations Runbook (observability, alerts, DR, cost management)\n` +
    `• 06 · ADR Log (Architecture Decision Records for every major platform decision)\n` +
    `• 07 · NFR & Risk Register (availability, security, cost, risks + mitigations)`
  );
};

async function callGeminiForArchitectSpec(promptText, mIdx, inlineFile = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CHAIN[mIdx]}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts = [{ text: promptText }];
  if (inlineFile) parts.push({ inlineData: { mimeType: inlineFile.mimeType, data: inlineFile.base64 } });
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const data      = await res.json();
  const candidate = data.candidates[0];
  if (candidate.finishReason === 'MAX_TOKENS') {
    appendMessage('error', '⚠️ חלק נחתך בגלל מגבלת אסימונים — ייתכן שחלק מהתוכן חסר.');
  }
  return candidate.content.parts.map(p => p.text).join('');
}

async function callGeminiForBacklog(promptText, mIdx) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CHAIN[mIdx]}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const data      = await res.json();
  const candidate = data.candidates[0];
  if (candidate.finishReason === 'MAX_TOKENS') {
    appendMessage('error', '⚠️ חלק נחתך בגלל מגבלת אסימונים — ייתכן שחלק מהתוכן חסר.');
  }
  return candidate.content.parts.map(p => p.text).join('');
}
