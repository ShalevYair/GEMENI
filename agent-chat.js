import { AGENTS } from './agents-config.js';
import { getStorytellerPrompt } from './storyteller-prompt.js';
import { getArchitectPrompt } from './architect-prompt.js';
import { getPlatformArchitectPrompt } from './platform-architect-prompt.js';
import { getOutSystemsPrompt } from './outsystems-prompt.js';
import { getDesignQueenPrompt } from './design-queen-prompt.js';
import { getSpecKingClarificationPrompt, getSpecKingChunkPrompt, CHECKLIST_ITEMS } from './spec-king-prompt.js';

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
  if (agentId === 'outsystems') injectOutSystemsModal();
  if (agentId === 'design-queen') injectDesignQueenModal();
  if (agentId === 'spec-king') injectSpecKingModal();
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
      ${agentId === 'outsystems'
        ? `<button class="chip chip--generate" onclick="window.openOutSystemsModal()">צור TSD ב-OutSystems על בסיס קובץ אפיון עסקי או פונקציונאלי</button>`
        : ''}
      ${agentId === 'design-queen'
        ? `<button class="chip chip--generate" onclick="window.openDesignQueenModal()">צור מסכי HTML מאפיון — קבל פרוטוטייפ אינטראקטיבי מלא</button>`
        : ''}
      ${agentId === 'spec-king'
        ? `<button class="chip chip--generate" onclick="window.openSpecKingModal()">👑 צור אפיון / שאלות הבהרה מקבצי דרישות</button>`
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

// ── Design Queen — HTML Mockup Generator (design-queen agent only) ────────

function injectDesignQueenModal() {
  const modal = document.createElement('div');
  modal.id = 'design-queen-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:2rem;max-width:540px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 24px 64px rgba(0,0,0,.28);font-family:Heebo,sans-serif;max-height:90vh;overflow-y:auto;">
      <h3 style="margin:0 0 .35rem;font-size:1.2rem;">צור פרוטוטייפ HTML מאפיון</h3>
      <p style="margin:0 0 1.5rem;color:#6b7a99;font-size:.88rem;line-height:1.5;">העלה כל מסמך אפיון (BRD, FSD, PRD, Word, PDF) וקבל קובץ HTML אינטראקטיבי מלא — כל המסכים, ניווט עובד, נתונים ריאליסטיים.</p>

      <label id="dq-dropzone" for="dq-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:12px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.5rem;transition:all .2s;">
        <div style="font-size:2.2rem;margin-bottom:.4rem;">🎨</div>
        <div id="dq-file-label" style="color:#6b7a99;font-size:.88rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.78rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="dq-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.dqFileSelected(this)">
      </label>

      <div style="margin-bottom:1.5rem;">
        <div style="font-weight:700;font-size:.88rem;margin-bottom:.75rem;color:#374151;">סגנון עיצוב:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="enterprise" checked style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="enterprise" style="border:2px solid #1a56db;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#fff 40%,#dbeafe 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#1e293b;margin-bottom:.2rem;">Clean Enterprise</div>
              <div style="font-size:.74rem;color:#64748b;">לבן · כחול · עסקי</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#1e3a5f;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#1a56db;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#f8fafc;border:1px solid #e2e8f0;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#059669;"></div>
              </div>
            </div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="dark" style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="dark" style="border:2px solid #475569;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#1e293b 40%,#0f172a 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#f1f5f9;margin-bottom:.2rem;">Dark Modern</div>
              <div style="font-size:.74rem;color:#94a3b8;">כהה · אינדיגו · Tech</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#0f172a;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#6366f1;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#1e293b;border:1px solid #334155;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#10b981;"></div>
              </div>
            </div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="salesforce" style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="salesforce" style="border:2px solid #475569;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#f3f2f2 40%,#d8edff 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#032d60;margin-bottom:.2rem;">Salesforce Lightning</div>
              <div style="font-size:.74rem;color:#706e6b;">נייבי · תכלת · CRM</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#032d60;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#0070d2;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#f3f2f2;border:1px solid #dddbda;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#2e844a;"></div>
              </div>
            </div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="auto" style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="auto" style="border:2px solid #475569;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#fefce8 40%,#fdf4ff 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#374151;margin-bottom:.2rem;">נגזר מהאפיון</div>
              <div style="font-size:.74rem;color:#6b7280;">AI בוחר לפי תחום</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#7c3aed;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#0284c7;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#059669;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#d97706;"></div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div style="margin-bottom:1.5rem;">
        <div style="font-weight:700;font-size:.88rem;margin-bottom:.5rem;color:#374151;">שפת הממשק:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="dq-lang" value="he" checked>
          <span><strong>עברית</strong> — <span style="color:#6b7a99;font-size:.82rem;">כל הכיתובים, התוויות והנתונים בעברית (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="dq-lang" value="en">
          <span><strong>English</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeDesignQueenModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.88rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateDesignQueenMockup()" style="padding:.55rem 1.35rem;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);">✨ צור פרוטוטייפ</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeDesignQueenModal(); });
  document.body.appendChild(modal);
}

window.dqFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('dq-file-label');
  lbl.innerHTML = `<strong>${escHtml(file.name)}</strong><br><span style="font-size:.78rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('dq-dropzone').style.borderColor = '#7c3aed';
};

window.dqStyleChanged = function () {
  document.querySelectorAll('.dq-style-card').forEach(card => {
    const radio = document.querySelector(`input[name="dq-style"][value="${card.dataset.value}"]`);
    if (radio && radio.checked) {
      card.style.outline = '3px solid #7c3aed';
      card.style.outlineOffset = '2px';
    } else {
      card.style.outline = 'none';
    }
  });
};

window.openDesignQueenModal = function () {
  if (isLoading) return;
  const modal = document.getElementById('design-queen-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  window.dqStyleChanged();
};

window.closeDesignQueenModal = function () {
  const modal = document.getElementById('design-queen-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('dq-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('dq-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.78rem;">.docx · .txt · .md · .pdf</span>`;
  document.getElementById('dq-dropzone').style.borderColor = '#c8d0e0';
};

window.generateDesignQueenMockup = async function () {
  const fileInput = document.getElementById('dq-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    document.getElementById('dq-dropzone').style.borderColor = '#e53e3e';
    return;
  }

  const style = document.querySelector('input[name="dq-style"]:checked')?.value || 'enterprise';
  const lang  = document.querySelector('input[name="dq-lang"]:checked')?.value || 'he';
  window.closeDesignQueenModal();
  hideEmpty();

  let fileData;
  try {
    fileData = await readFile(file);
  } catch (e) {
    appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    appendMessage('error', 'ליצירת פרוטוטייפ נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
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
  let dqModelIdx = modelIdx;
  const docText = fileData.isInline ? '' : fileData.text;
  const inlineFile = fileData.isInline ? fileData : null;

  const chunkLabels = [
    'Design System + Navigation + מסכים 1–4',
    'מסכים 5–9',
    'מסכים 10+',
    'JavaScript + הרכבת קובץ HTML סופי',
  ];

  for (let chunk = 1; chunk <= 4; chunk++) {
    updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const previousChunks = results.length > 0 ? results.join('\n\n') : null;
    const prompt = getDesignQueenPrompt(docText, chunk, lang, style, previousChunks);

    let done = false;
    while (!done) {
      try {
        results.push(await callGeminiForArchitectSpec(prompt, dqModelIdx, inlineFile));
        done = true;
      } catch (err) {
        const quota = isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && dqModelIdx < MODEL_CHAIN.length - 1) {
          dqModelIdx++;
          appendMessage('error', `⚠️ עובר למודל ${MODEL_CHAIN[dqModelIdx]} (חלק ${chunk})... 🔄`);
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

  // Extract complete HTML from chunk 4 response
  let htmlOutput = results[3];
  const htmlMatch = htmlOutput.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  if (htmlMatch) {
    htmlOutput = htmlMatch[0];
  } else {
    // Strip markdown code fences if model wrapped it
    htmlOutput = htmlOutput.replace(/^```html\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!htmlOutput.toLowerCase().startsWith('<!doctype')) {
      // Fallback: assemble manually from chunks 1–3 + JS from chunk 4
      const cssMatch  = results[0].match(/<!-- CSS_START -->([\s\S]*?)<!-- CSS_END -->/);
      const allScreens = [results[0], results[1], results[2]]
        .map(r => { const m = r.match(/<!-- SCREENS_START -->([\s\S]*?)<!-- SCREENS_END -->/); return m ? m[1] : ''; })
        .join('\n');
      const css    = cssMatch ? cssMatch[1] : '';
      const jsClean = results[3].replace(/^```[\w]*\s*/i, '').replace(/\s*```\s*$/, '').trim();
      htmlOutput = `<!DOCTYPE html>
<html dir="rtl" lang="${lang === 'he' ? 'he' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prototype</title>
  <style>${css}</style>
</head>
<body>
${allScreens}
<script>${jsClean}</script>
</body>
</html>`;
    }
  }

  const baseName  = file.name.replace(/\.[^.]+$/, '');
  const styleSlug = { enterprise: 'enterprise', dark: 'dark', salesforce: 'sf', auto: 'auto' }[style] || style;
  const filename  = `prototype-${styleSlug}-${baseName}.html`;

  const blob = new Blob([htmlOutput], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  appendMessage('assistant',
    `✅ הפרוטוטייפ נוצר והורד כ-\`${filename}\`\n\n` +
    `פתח את הקובץ בדפדפן — תמצא:\n` +
    `• כל המסכים מהאפיון עם ניווט עובד\n` +
    `• נתונים ריאליסטיים בטבלאות\n` +
    `• חיפוש וסינון בטבלאות\n` +
    `• מודאלים, dropdowns, tabs\n` +
    `• Toast notifications\n` +
    `• Responsive — עובד על מובייל\n\n` +
    `אם משהו חסר או דורש שינוי — שאל אותי כאן ואוסיף/אתקן.`
  );
};

// ── OutSystems TSD Generator (outsystems agent only) ─────────────────────

function injectOutSystemsModal() {
  const modal = document.createElement('div');
  modal.id = 'outsystems-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:500px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">צור TSD ב-OutSystems מקובץ אפיון עסקי</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך אפיון (BRD, FSD, PRD) וקבל TSD מלא: ארכיטקטורת מודולים, Domain Model, Service Actions, אינטגרציות, תהליכים, אבטחה ו-Deployment.</p>

      <label id="outsystems-dropzone" for="outsystems-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="outsystems-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="outsystems-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.outsystemsFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">גרסת OutSystems:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="outsystems-version" value="o11" checked>
          <span><strong>O11</strong> — <span style="color:#6b7a99;font-size:.85rem;">4-Layer Canvas, Service Center, LifeTime</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="outsystems-version" value="odc">
          <span><strong>ODC</strong> — <span style="color:#6b7a99;font-size:.85rem;">OutSystems Developer Cloud, Apps & Libraries</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="outsystems-version" value="both">
          <span><strong>שתיהן</strong> — <span style="color:#6b7a99;font-size:.85rem;">השוואה O11 ו-ODC בנפרד</span></span>
        </label>
      </div>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="outsystems-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="outsystems-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeOutSystemsModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateOutSystemsTSD()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור TSD</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeOutSystemsModal(); });
  document.body.appendChild(modal);
}

window.openOutSystemsModal = function () {
  if (isLoading) return;
  const modal = document.getElementById('outsystems-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeOutSystemsModal = function () {
  const modal = document.getElementById('outsystems-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('outsystems-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('outsystems-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span>`;
  const dz = document.getElementById('outsystems-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.outsystemsFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('outsystems-file-label');
  lbl.innerHTML = `<strong>${escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('outsystems-dropzone').style.borderColor = '#0070d2';
};

window.generateOutSystemsTSD = async function () {
  const fileInput = document.getElementById('outsystems-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('outsystems-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const version = document.querySelector('input[name="outsystems-version"]:checked')?.value || 'o11';
  const lang    = document.querySelector('input[name="outsystems-lang"]:checked')?.value || 'en';
  window.closeOutSystemsModal();
  hideEmpty();

  let fileData;
  try {
    fileData = await readFile(file);
  } catch (e) {
    appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    appendMessage('error', 'ליצירת TSD נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
    return;
  }

  if (!apiKey) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  const versionLabel = version === 'o11' ? 'O11' : version === 'odc' ? 'ODC' : 'O11+ODC';
  setLoading(true);
  const progressId = appendTyping();
  const results = [];
  let osModelIdx = modelIdx;

  const chunkLabels = ['Application Context & Module Architecture', 'Domain Model & Process Logic', 'Service Actions & Integration Catalog', 'Processes, Security & Deployment'];

  for (let chunk = 1; chunk <= 4; chunk++) {
    updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const prompt = getOutSystemsPrompt(fileData.isInline ? '' : fileData.text, chunk, lang, version);

    let done = false;
    while (!done) {
      try {
        results.push(await callGeminiForArchitectSpec(prompt, osModelIdx, fileData.isInline ? fileData : null));
        done = true;
      } catch (err) {
        const quota = isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && osModelIdx < MODEL_CHAIN.length - 1) {
          osModelIdx++;
          appendMessage('error', `⚠️ עובר למודל ${MODEL_CHAIN[osModelIdx]} (חלק ${chunk})... 🔄`);
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

  const header = `<!-- OutSystems TSD generated by OutSystems Expert | ${versionLabel} | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `outsystems-tsd-${versionLabel}-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  const versionNote = version === 'both' ? ' (O11 ו-ODC בנפרד)' : ` (${versionLabel})`;
  appendMessage('assistant',
    `✅ ה-TSD נוצר בהצלחה והורד כ-\`${filename}\`${versionNote}\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · Application Context (גרסה, סביבות, personas, NFRs)\n` +
    `• 01 · Module Architecture (4-Layer Canvas / ODC App structure + dependency map)\n` +
    `• 02 · Domain Model (Entities, attributes, indexes, relationships, Site Properties)\n` +
    `• 03 · Screen Logic (screens, Server Actions catalog, business flows)\n` +
    `• 04 · Service Actions (contracts, inputs/outputs, exceptions, versioning)\n` +
    `• 05 · Integration Catalog (timeout, retry, circuit breaker, fallback לכל אינטגרציה)\n` +
    `• 06 · Processes & Timers (BPT / async patterns, email notifications)\n` +
    `• 07 · Security & Deployment (roles, permissions matrix, pipeline, health checklist)`
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

// ═══════════════════════════════════════════════════════════════════════════
// SPEC-KING MODAL
// ═══════════════════════════════════════════════════════════════════════════

const SK_STORAGE_KEY = 'spec-king-checklist-v1';
let specKingFiles = []; // Array of { file, text } objects

function skGetSavedChecked() {
  try {
    const saved = localStorage.getItem(SK_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return CHECKLIST_ITEMS.filter(i => i.defaultOn).map(i => i.id);
}

function skSaveChecked(ids) {
  try { localStorage.setItem(SK_STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

function skGetCheckedIds() {
  return CHECKLIST_ITEMS
    .filter(item => {
      const cb = document.getElementById(`sk-check-${item.id}`);
      return cb && cb.checked;
    })
    .map(item => item.id);
}

function injectSpecKingModal() {
  const savedChecked = skGetSavedChecked();

  const checklistHtml = CHECKLIST_ITEMS.map((item, idx) => {
    const isChecked = savedChecked.includes(item.id);
    const isDefault = item.defaultOn;
    return `
      <label style="display:flex;align-items:center;gap:.45rem;cursor:pointer;padding:.25rem .35rem;border-radius:6px;transition:background .15s;font-size:.82rem;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background=''">
        <input type="checkbox" id="sk-check-${escHtml(item.id)}" ${isChecked ? 'checked' : ''} style="accent-color:#7c3aed;width:14px;height:14px;flex-shrink:0;">
        <span style="color:${isDefault ? '#1e293b' : '#475569'}">${escHtml(item.label)}</span>
      </label>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'spec-king-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:560px;width:100%;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;margin:auto;">
      <h3 style="margin:0 0 .35rem;font-size:1.15rem;display:flex;align-items:center;gap:.5rem;">👑 מלך האיפיונים — יצירת מסמך</h3>
      <p style="margin:0 0 1.35rem;color:#6b7a99;font-size:.88rem;">העלה עד 10 קבצי דרישות, אפיון, פרוטוקולים או הבהרות — וקבל מה שאתה בוחר.</p>

      <!-- ── Multi-file upload ── -->
      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">קבצי מקור (עד 10 קבצים):</div>
        <label id="sk-dropzone" for="sk-file-input"
          style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.25rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
          ondragover="event.preventDefault();this.style.borderColor='#7c3aed';this.style.background='#faf5ff';"
          ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
          ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.skHandleDrop(event);">
          <div style="font-size:1.6rem;margin-bottom:.3rem;">📂</div>
          <div style="color:#6b7a99;font-size:.88rem;">לחץ לבחירת קבצים או גרור לכאן<br><span style="font-size:.78rem;">.docx · .txt · .md · .pdf (מקסימום 10 קבצים, 10MB כל אחד)</span></div>
          <input id="sk-file-input" type="file" accept=".docx,.txt,.md,.pdf" multiple style="display:none;" onchange="window.skFilesSelected(this.files)">
        </label>
        <div id="sk-files-list" style="margin-top:.6rem;display:flex;flex-direction:column;gap:.3rem;"></div>
      </div>

      <!-- ── Mode ── -->
      <div style="margin-bottom:1.1rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">מה תרצה לקבל?</div>
        <label style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;cursor:pointer;">
          <input type="radio" name="sk-mode" value="spec" checked style="margin-top:.2rem;" onchange="window.skModeChanged()">
          <span><strong>אפיון מפורט</strong> <span style="color:#6b7a99;font-size:.82rem;">— מסמך FSD מובנה ומלא (3 חלקים)</span></span>
        </label>
        <label style="display:flex;align-items:flex-start;gap:.5rem;cursor:pointer;">
          <input type="radio" name="sk-mode" value="questions" style="margin-top:.2rem;" onchange="window.skModeChanged()">
          <span><strong>שאלות הבהרה</strong> <span style="color:#6b7a99;font-size:.82rem;">— רשימת שאלות ממוקדות לפני האפיון</span></span>
        </label>
      </div>

      <!-- ── Language (spec mode only) ── -->
      <div id="sk-lang-section" style="margin-bottom:1.1rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="sk-lang" value="en" checked>
          <span><strong>English</strong> <span style="color:#6b7a99;font-size:.82rem;">— מפורט ועמוק יותר (מומלץ, חוסך טוקנים)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="sk-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <!-- ── Checklist (spec mode only) ── -->
      <div id="sk-checklist-section" style="margin-bottom:1.35rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
          <div style="font-weight:600;font-size:.9rem;">מה לכלול באפיון:</div>
          <div style="display:flex;gap:.4rem;">
            <button onclick="window.skSelectAll()" style="font-size:.75rem;padding:.2rem .55rem;border:1px solid #c8d0e0;border-radius:5px;background:#fff;cursor:pointer;">בחר הכל</button>
            <button onclick="window.skSelectDefaults()" style="font-size:.75rem;padding:.2rem .55rem;border:1px solid #c8d0e0;border-radius:5px;background:#fff;cursor:pointer;">ברירת מחדל</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.1rem;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem;">
          ${checklistHtml}
        </div>
        <p style="margin:.5rem 0 0;font-size:.76rem;color:#94a3b8;">פריטים לא מסומנים = הארכיטקטים האחרים. ברירת מחדל = מה שמלך האיפיונים עושה בלעדית.</p>
      </div>

      <!-- ── Buttons ── -->
      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeSpecKingModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button id="sk-generate-btn" onclick="window.generateSpecKing()" style="padding:.55rem 1.35rem;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);">👑 צור מסמך</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeSpecKingModal(); });
  document.body.appendChild(modal);
}

window.openSpecKingModal = function () {
  if (isLoading) return;
  const modal = document.getElementById('spec-king-modal');
  if (!modal) return;
  specKingFiles = [];
  skRenderFilesList();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeSpecKingModal = function () {
  const modal = document.getElementById('spec-king-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  specKingFiles = [];
  const fi = document.getElementById('sk-file-input');
  if (fi) fi.value = '';
};

window.skModeChanged = function () {
  const mode = document.querySelector('input[name="sk-mode"]:checked')?.value;
  const langSection = document.getElementById('sk-lang-section');
  const checkSection = document.getElementById('sk-checklist-section');
  if (langSection) langSection.style.display = mode === 'spec' ? '' : 'none';
  if (checkSection) checkSection.style.display = mode === 'spec' ? '' : 'none';
};

window.skSelectAll = function () {
  CHECKLIST_ITEMS.forEach(item => {
    const cb = document.getElementById(`sk-check-${item.id}`);
    if (cb) cb.checked = true;
  });
};

window.skSelectDefaults = function () {
  CHECKLIST_ITEMS.forEach(item => {
    const cb = document.getElementById(`sk-check-${item.id}`);
    if (cb) cb.checked = item.defaultOn;
  });
};

window.skHandleDrop = function (event) {
  const files = Array.from(event.dataTransfer.files || []);
  skAddFiles(files);
};

window.skFilesSelected = function (fileList) {
  const files = Array.from(fileList || []);
  skAddFiles(files);
  const fi = document.getElementById('sk-file-input');
  if (fi) fi.value = '';
};

function skAddFiles(files) {
  const allowed = ['.docx', '.txt', '.md', '.pdf'];
  for (const f of files) {
    if (specKingFiles.length >= 10) break;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) continue;
    if (f.size > 10 * 1024 * 1024) continue;
    if (specKingFiles.find(x => x.name === f.name)) continue;
    specKingFiles.push(f);
  }
  skRenderFilesList();
}

function skRenderFilesList() {
  const list = document.getElementById('sk-files-list');
  if (!list) return;
  if (specKingFiles.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = specKingFiles.map((f, idx) => `
    <div style="display:flex;align-items:center;gap:.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:.4rem .65rem;font-size:.82rem;">
      <span style="color:#7c3aed;">📄</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(f.name)}</span>
      <span style="color:#94a3b8;white-space:nowrap;">${(f.size / 1024).toFixed(0)} KB</span>
      <button onclick="window.skRemoveFile(${idx})" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.9rem;padding:0 .15rem;line-height:1;" title="הסר">✕</button>
    </div>`).join('');
}

window.skRemoveFile = function (idx) {
  specKingFiles.splice(idx, 1);
  skRenderFilesList();
};

window.generateSpecKing = async function () {
  if (specKingFiles.length === 0) {
    const dz = document.getElementById('sk-dropzone');
    if (dz) { dz.style.borderColor = '#e53e3e'; setTimeout(() => { dz.style.borderColor = '#c8d0e0'; }, 2000); }
    return;
  }
  if (!apiKey) {
    window.closeSpecKingModal();
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  const mode = document.querySelector('input[name="sk-mode"]:checked')?.value || 'spec';
  const lang = document.querySelector('input[name="sk-lang"]:checked')?.value || 'en';
  const checkedIds = mode === 'spec' ? skGetCheckedIds() : [];
  skSaveChecked(checkedIds);

  window.closeSpecKingModal();
  hideEmpty();
  setLoading(true);
  const progressId = appendTyping();

  // Read all files
  let combinedText = '';
  try {
    for (const file of specKingFiles) {
      updateTyping(progressId, `קורא קובץ: ${file.name}…`);
      const fileData = await readFile(file);
      const content = fileData.isInline ? `[קובץ PDF — תוכן נשלח כתמונה ל-AI]` : (fileData.text || '');
      combinedText += `\n\n${'═'.repeat(60)}\nמסמך: ${file.name}\n${'═'.repeat(60)}\n\n${content}`;
    }
  } catch (e) {
    removeTyping(progressId);
    setLoading(false);
    appendMessage('error', 'שגיאה בקריאת קבצים: ' + e.message);
    return;
  }

  const fileNames = specKingFiles.map(f => f.name).join(', ');
  const results = [];
  let skModelIdx = modelIdx;

  if (mode === 'questions') {
    // ── Mode A: single chunk ──
    updateTyping(progressId, 'מנתח את המסמכים ומייצר שאלות הבהרה…');
    const prompt = getSpecKingClarificationPrompt(combinedText);
    let done = false;
    while (!done) {
      try {
        results.push(await callGeminiForArchitectSpec(prompt, skModelIdx));
        done = true;
      } catch (err) {
        const quota = isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && skModelIdx < MODEL_CHAIN.length - 1) {
          skModelIdx++;
          appendMessage('error', `⚠️ עובר למודל ${MODEL_CHAIN[skModelIdx]}… 🔄`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          removeTyping(progressId);
          setLoading(false);
          appendMessage('error', 'שגיאה: ' + err.message);
          return;
        }
      }
    }
  } else {
    // ── Mode B: 3 chunks ──
    const chunkLabels = {
      he: ['מבוא ורקע', 'דרישות פונקציונליות', 'אינטגרציות, החלטות ומונחים'],
      en: ['Introduction & Context', 'Functional Requirements', 'Integrations, Decisions & Glossary'],
    };
    const labels = chunkLabels[lang] || chunkLabels.en;

    for (let chunk = 1; chunk <= 3; chunk++) {
      const prompt = getSpecKingChunkPrompt(combinedText, chunk, lang, checkedIds);
      if (!prompt) continue; // no sections selected for this chunk

      updateTyping(progressId, `מייצר חלק ${chunk} מתוך 3… (${labels[chunk - 1]})`);

      let done = false;
      while (!done) {
        try {
          results.push(await callGeminiForArchitectSpec(prompt, skModelIdx));
          done = true;
        } catch (err) {
          const quota = isQuotaExceeded(err.message);
          const busy  = /503|high demand|overload|temporarily/i.test(err.message);
          if ((quota || busy) && skModelIdx < MODEL_CHAIN.length - 1) {
            skModelIdx++;
            appendMessage('error', `⚠️ עובר למודל ${MODEL_CHAIN[skModelIdx]} (חלק ${chunk})… 🔄`);
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
  }

  removeTyping(progressId);
  setLoading(false);

  if (results.length === 0) {
    appendMessage('error', 'לא נבחרו סעיפים לייצור. אנא סמן לפחות סעיף אחד בצ\'קליסט.');
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const isQuestions = mode === 'questions';
  const header = isQuestions
    ? `<!-- Clarification Questions — מלך האיפיונים | ${timestamp} | Sources: ${fileNames} -->\n\n# שאלות הבהרה לפני כתיבת האפיון\n\n`
    : `<!-- FSD — מלך האיפיונים | ${lang.toUpperCase()} | ${timestamp} | Sources: ${fileNames} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const suffix = isQuestions ? 'clarification-questions' : `fsd-${lang}`;
  const filename = `spec-king-${suffix}-${timestamp}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  const summaryLines = isQuestions
    ? [
        `✅ שאלות ההבהרה נוצרו והורדו כ-\`${filename}\``,
        '',
        `**מסמכי מקור שנותחו (${specKingFiles.length}):** ${fileNames}`,
        '',
        'השאלות מאורגנות לפי קטגוריות ומתועדפות (BLOCKER / IMPORTANT / NICE TO KNOW).',
        'ענה עליהן, הוסף את התשובות לקובץ, והעלה שוב לקבלת האפיון המפורט.',
      ]
    : [
        `✅ האפיון הפונקציונלי נוצר והורד כ-\`${filename}\``,
        '',
        `**שפה:** ${lang === 'en' ? 'English' : 'עברית'} · **מסמכי מקור (${specKingFiles.length}):** ${fileNames}`,
        '',
        `**חלקים שנוצרו:** ${results.length} מתוך 3`,
        '',
        'לאחר עיון ואישור האפיון, ניתן להעביר אותו לסוכן ארכיטקט התוכנה או ארכיטקט הפלטפורמות.',
      ];

  appendMessage('assistant', summaryLines.join('\n'));
};
