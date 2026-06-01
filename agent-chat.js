import { AGENTS } from './agents-config.js';
import { deps } from './modals/deps.js';
import { initStorytellerModal }  from './modals/storyteller-modal.js';
import { initArchitectModal }    from './modals/architect-modal.js';
import { initPlatformModal }     from './modals/platform-modal.js';
import { initOutSystemsModal }   from './modals/outsystems-modal.js';
import { initDesignQueenModal }  from './modals/design-queen-modal.js';
import { initSpecKingModal }     from './modals/spec-king-modal.js';
import { initRequirementsModal } from './modals/requirements-modal.js';
import { initNaturalModal }      from './modals/natural-modal.js';
import { initDynamicModal }     from './modals/dynamic-modal.js';
import { initJsonModal }        from './modals/json-modal.js';
import { initSummarizerModal }  from './modals/summarizer-modal.js';
import { initUiExplorerModal } from './modals/ui-explorer-modal.js';
import { initBrieferModal }    from './modals/briefer-modal.js';
import { initShragaModal }     from './modals/shraga-modal.js';

const STORAGE_KEY       = 'gemini_api_key';
const MODEL_CHAIN       = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
const MAX_FILE_MB       = 10;
const MAX_OUTPUT_TOKENS = 65000;
const CHUNK_SIZE        = 50000;  // chars per input chunk for large text files
const DOWNLOAD_THRESHOLD = 8000; // responses longer than this are auto-downloaded

// ── State ─────────────────────────────────────────────────────────────────
let apiKey          = localStorage.getItem(STORAGE_KEY) || '';
let chatHistory     = [];
let isLoading       = false;
let lastFailed      = null;
let retryTimer      = null;
let typingCounter   = 0;
let pendingFile     = null;
let natContext      = null; // loaded Natural files awaiting first chat message
let modelIdx        = 0; // current position in MODEL_CHAIN

// ── Bootstrap ─────────────────────────────────────────────────────────────
const agentId = new URLSearchParams(location.search).get('id');
const agent   = AGENTS[agentId];

document.addEventListener('DOMContentLoaded', () => {
  if (!agent) { showNotFound(); return; }

  // Populate shared deps registry so modal files can call core utilities
  Object.assign(deps, {
    appendMessage,
    appendTyping,
    removeTyping,
    updateTyping,
    hideEmpty,
    setLoading,
    escHtml,
    readFile,
    isQuotaExceeded,
    callGeminiForSpec:    callGeminiForArchitectSpec,
    callGeminiForBacklog: callGeminiForBacklog,
    getApiKey:    () => apiKey,
    getModelIdx:  () => modelIdx,
    setModelIdx:  (v) => { modelIdx = v; setHeaderActions(true); },
    getIsLoading: () => isLoading,
    setNatContext: (files) => { natContext = files; showNatContextBanner(files); },
    MODEL_CHAIN,
    MAX_OUTPUT_TOKENS,
  });

  populateHero();
  renderEmptyState();
  if (agentId === 'storyteller')       initStorytellerModal();
  if (agentId === 'software-architect') initArchitectModal();
  if (agentId === 'platform-architect') initPlatformModal();
  if (agentId === 'outsystems')         initOutSystemsModal();
  if (agentId === 'design-queen')       initDesignQueenModal();
  if (agentId === 'spec-king')          initSpecKingModal();
  if (agentId === 'requirements')       initRequirementsModal();
  if (agentId === 'natural')            initNaturalModal();
  if (agentId === 'dynamic')            initDynamicModal();
  if (agentId === 'json-gen')           initJsonModal();
  if (agentId === 'summarizer')         initSummarizerModal();
  if (agentId === 'ui-explorer')        initUiExplorerModal();
  if (agentId === 'briefer')            initBrieferModal();
  if (agentId === 'shraga')             initShragaModal();
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
        ? `<button class="chip chip--generate" onclick="window.openOutSystemsModal()">צור מסמך טכני מפורט ב-OutSystems על בסיס קובץ אפיון</button>`
        : ''}
      ${agentId === 'design-queen'
        ? `<button class="chip chip--generate" onclick="window.openDesignQueenModal()">צור מסכי HTML מאפיון — קבל פרוטוטייפ אינטראקטיבי מלא</button>`
        : ''}
      ${agentId === 'spec-king'
        ? `<button class="chip chip--generate" onclick="window.openSpecKingModal()">👑 צור אפיון / שאלות הבהרה מקבצי דרישות</button>`
        : ''}
      ${agentId === 'requirements'
        ? `<button class="chip chip--generate" onclick="window.openRequirementsModal()">📋 צור מסמך דרישות / שאלות הבהרה מחומרים גולמיים</button>`
        : ''}
      ${agentId === 'requirements'
        ? `<button class="chip" onclick="window.downloadInterviewQuestions()">📥 הורד שאלות ראיון ראשוניות</button>`
        : ''}
      ${agentId === 'natural'
        ? `<button class="chip chip--generate" onclick="window.openNaturalModal()">🖥️ נתח קובץ Natural</button>`
        : ''}
      ${agentId === 'dynamic'
        ? `<button class="chip chip--generate" onclick="window.openDynamicModal()">🔮 הפעל סוכן דינמי</button>`
        : ''}
      ${agentId === 'json-gen'
        ? `<button class="chip chip--generate" onclick="window.openJsonModal()">{ } צור JSON מאפיון — מוכן להעלאה ל-Builder</button>`
        : ''}
      ${agentId === 'summarizer'
        ? `<button class="chip chip--generate" onclick="window.openSummarizerModal()">📝 סכם מסמך ל-Excel</button>`
        : ''}
      ${agentId === 'ui-explorer'
        ? `<button class="chip chip--generate" onclick="window.openUiExplorerModal()">🔬 חקור ממשק HTML</button>`
        : ''}
      ${agentId === 'briefer'
        ? `<button class="chip chip--generate" onclick="window.openBrieferModal()">📋 הורד שאלון + הפק בריף</button>`
        : ''}
      ${agentId === 'shraga'
        ? `<button class="chip chip--generate" onclick="window.openShragaModal()">🧠 העלה קבצים וקבל ניתוח Word</button>`
        : ''}
    </div>`;
  msgs.appendChild(empty);
}

window.clearChat = function () {
  chatHistory  = [];
  lastFailed   = null;
  pendingFile  = null;
  natContext   = null;
  clearPendingFile();
  clearNatContextBanner();
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

function showNatContextBanner(files) {
  clearNatContextBanner();
  const wrapper = document.getElementById('chat-input-wrapper');
  if (!wrapper) return;
  const banner = document.createElement('div');
  banner.id        = 'nat-context-banner';
  banner.className = 'pending-file-chip';
  const label = files.length === 1
    ? escHtml(files[0].name)
    : `${files.length} קבצי Natural`;
  banner.innerHTML = `
    <span class="pending-file-icon">🖥️</span>
    <span class="pending-file-name">${label} — טעונים בהקשר, שאל שאלה בצ'אט</span>
    <button class="pending-file-remove" onclick="window.clearNatContext()" title="נקה הקשר">✕</button>`;
  wrapper.prepend(banner);
}

function clearNatContextBanner() {
  document.getElementById('nat-context-banner')?.remove();
}

window.clearNatContext = function () {
  natContext = null;
  clearNatContextBanner();
};

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
  const natCtxSnap = natContext; // capture before buildUserParts clears it
  const userParts  = buildUserParts(userText, file);
  const contents   = [
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

  const historyText = natCtxSnap
    ? `[קבצי Natural: ${natCtxSnap.map(f => f.name).join(', ')}]\n${userText || ''}`.trim()
    : file
    ? `[קובץ מצורף: ${file.name}]${userText ? '\n' + userText : ''}`
    : userText;
  chatHistory.push({ role: 'user',  text: historyText });
  chatHistory.push({ role: 'model', text: reply });

  return reply;
}

function buildUserParts(text, file) {
  const parts = [];

  let natPrefix = '';
  if (natContext) {
    natPrefix = natContext.map(f =>
      `קובץ Natural: "${f.name}"\n\`\`\`natural\n${f.text}\n\`\`\``
    ).join('\n\n') +
      '\n\n---\n\nהוראה לכל שאלות ההמשך: ענה בתמציתיות — עד 5 פסקאות ברורות. תשובה ממוקדת בלבד, ללא מסמך ארוך.\n\n---\n\n';
    natContext = null;
    clearNatContextBanner();
  }

  if (!file) {
    parts.push({ text: natPrefix + (text || '') });
    return parts;
  }

  if (file.isInline) {
    if (natPrefix || text) parts.push({ text: natPrefix + (text || '') });
    parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
  } else {
    const combined = natPrefix + `תוכן הקובץ "${file.name}":\n\n${file.text}${text ? '\n\n' + text : ''}`;
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
  if (window.marked) {
    try {
      return window.marked.parse(text, { breaks: true, gfm: true });
    } catch {}
  }
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

// ── Gemini helpers used by modal files (via deps) ─────────────────────────


async function callGeminiForArchitectSpec(promptText, mIdx, inlineFile = null) {
  const makeUrl = (idx) => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CHAIN[idx]}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const userParts = [{ text: promptText }];
  if (inlineFile) userParts.push({ inlineData: { mimeType: inlineFile.mimeType, data: inlineFile.base64 } });

  const res = await fetch(makeUrl(mIdx), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const data      = await res.json();
  const candidate = data.candidates[0];
  let text = candidate.content.parts.map(p => p.text).join('');

  // Auto-continuation: if truncated, resume up to 3 times via multi-turn conversation
  if (candidate.finishReason === 'MAX_TOKENS') {
    const MAX_CONT = 3;
    let truncated = true;
    let contNum = 0;
    while (truncated && contNum < MAX_CONT) {
      contNum++;
      appendMessage('error', `⚠️ חלק נחתך — ממשיך אוטומטית (${contNum}/${MAX_CONT})…`);
      const contRes = await fetch(makeUrl(mIdx), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user',  parts: userParts },
            { role: 'model', parts: [{ text }] },
            { role: 'user',  parts: [{ text: 'המשך ישירות מהיכן שנעצרת — ללא חזרה על מה שכבר נכתב.' }] },
          ],
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
        }),
      });
      if (!contRes.ok) break;
      const contData = await contRes.json();
      const contCand = contData.candidates[0];
      text += contCand.content.parts.map(p => p.text).join('');
      truncated = contCand.finishReason === 'MAX_TOKENS';
    }
    if (truncated) {
      appendMessage('error', '⚠️ הפרק לא הושלם גם לאחר המשכים — שקול עומק גבוה יותר.');
    }
  }

  return text;
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
