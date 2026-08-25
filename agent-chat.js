import { AGENTS } from './agents-config.js?v=20260825';
import { deps } from './modals/deps.js?v=20260825';
import { initStorytellerModal }  from './modals/storyteller-modal.js?v=20260825';
import { initArchitectModal }    from './modals/architect-modal.js?v=20260825';
import { initPlatformModal }     from './modals/platform-modal.js?v=20260825';
import { initOutSystemsModal }   from './modals/outsystems-modal.js?v=20260825';
import { initDesignQueenModal }  from './modals/design-queen-modal.js?v=20260825';
import { initSpecKingModal }     from './modals/spec-king-modal.js?v=20260825';
import { initRequirementsModal } from './modals/requirements-modal.js?v=20260825';
import { initNaturalModal }      from './modals/natural-modal.js?v=20260825';
import { initDynamicModal }     from './modals/dynamic-modal.js?v=20260825';
import { initJsonModal }        from './modals/json-modal.js?v=20260825';
import { initSummarizerModal }  from './modals/summarizer-modal.js?v=20260825';
import { initUiExplorerModal } from './modals/ui-explorer-modal.js?v=20260825';
import { initBrieferModal }    from './modals/briefer-modal.js?v=20260825';
import { initShragaModal }     from './modals/shraga-modal.js?v=20260825';
import { initMaturityCheckerModal } from './modals/maturity-checker-modal.js?v=20260825';
import { initTenderWriterModal } from './modals/tender-writer-modal.js?v=20260825';
import {
  ENGINES, getEngine, setEngine, getModelChain,
  thinkingCfg, DEFAULT_THINKING_LEVEL, JSON_THINKING_LEVEL,
  isThinkingFieldError, markThinkingUnsupported,
  isBillingRequiredError, isUnknownModelError,
  fetchAvailableModels, pruneChain,
} from './models.js?v=20260825';

const STORAGE_KEY       = 'gemini_api_key';
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

// Mutated in place rather than reassigned: modals hold a reference to this
// array through deps.MODEL_CHAIN, so swapping engines has to keep the same
// array identity or their fallback logic would read a stale chain.
const MODEL_CHAIN = [...getModelChain()];

function refreshModelChain() {
  const next = getModelChain();
  MODEL_CHAIN.length = 0;
  MODEL_CHAIN.push(...next);
  modelIdx = 0;
  setHeaderActions(true);
}

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
    resetUsage,
    getUsage,
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
  if (agentId === 'maturity-checker')   initMaturityCheckerModal();
  if (agentId === 'tender-writer')      initTenderWriterModal();
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
  pruneChainToAvailable();
}

function setHeaderActions(show) {
  const slot = document.getElementById('site-header-actions');
  if (!slot) return;
  if (!show) { slot.innerHTML = ''; return; }
  const modelLabel = MODEL_CHAIN[modelIdx] || MODEL_CHAIN[0];
  const engine = getEngine();
  slot.innerHTML = `
    <select class="site-header-engine" id="engine-select" title="מנוע — חל על כל הסוכנים"
      onchange="window.changeEngine(this.value)">
      ${Object.values(ENGINES).map(e =>
        `<option value="${e.id}"${e.id === engine ? ' selected' : ''}>${e.icon} ${e.label}</option>`
      ).join('')}
    </select>
    <span class="site-header-model-tag" title="מודל פעיל">${modelLabel}</span>
    <button class="site-header-btn" onclick="clearChat()" title="נקה שיחה">🗑</button>
    <button class="site-header-btn" onclick="changeApiKey()" title="החלף מפתח API">🔑</button>`;
}

// The engine choice is global — every agent reads it on its next call — so a
// switch mid-conversation is worth confirming rather than silently repricing
// the rest of the session.
window.changeEngine = function (id) {
  if (!ENGINES[id] || id === getEngine()) return;
  if (id === 'pro' && !confirm(
    'מצב "מדויק" (Pro) איטי ויקר משמעותית, ודורש חשבון Google עם חיוב מופעל.\n' +
    'הבחירה חלה על כל הסוכנים באתר.\n\nלהחליף?'
  )) {
    const sel = document.getElementById('engine-select');
    if (sel) sel.value = getEngine();
    return;
  }
  setEngine(id);
  refreshModelChain();
  appendMessage('error', `🔀 המנוע הוחלף ל-${ENGINES[id].icon} ${ENGINES[id].label} — ${MODEL_CHAIN[0]}`);
};

// One listing call per key per day tells us which chain entries this key can
// actually reach, so a model retired upstream is dropped from the fallback
// chain instead of surfacing as a mid-run failure.
async function pruneChainToAvailable() {
  if (!apiKey) return;
  const ids = await fetchAvailableModels(apiKey);
  if (!ids) return;
  const pruned = pruneChain(getModelChain(), ids);
  if (pruned.length === MODEL_CHAIN.length && pruned.every((m, i) => m === MODEL_CHAIN[i])) return;
  MODEL_CHAIN.length = 0;
  MODEL_CHAIN.push(...pruned);
  if (modelIdx >= MODEL_CHAIN.length) modelIdx = 0;
  setHeaderActions(true);
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
        ? `<button class="chip chip--generate" onclick="window.openSpecKingModal()">👑 צור אפיון מלא מקבצי דרישות</button>`
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
      ${agentId === 'summarizer'
        ? `<button class="chip" onclick="window.openSummarizerMindMap()">🗺 הצג מפת חשיבה</button>`
        : ''}
      ${agentId === 'ui-explorer'
        ? `<button class="chip chip--generate" onclick="window.openUiExplorerModal()">🔬 חקור ממשק HTML</button>`
        : ''}
      ${agentId === 'briefer'
        ? `<button class="chip chip--generate" onclick="window.openBrieferModal()">📋 הורד שאלון + הפק בריף</button>`
        : ''}
      ${agentId === 'shraga'
        ? `<button class="chip chip--generate" onclick="window.openShragaModal()">🧠 העלה קבצים וקבל ניתוח מעמיק</button>`
        : ''}
      ${agentId === 'maturity-checker'
        ? `<button class="chip chip--generate" onclick="window.openMaturityModal()">🩺 העלה מסמכי אפיון וקבל שאלות הבהרה עסקיות</button>`
        : ''}
      ${agentId === 'tender-writer'
        ? `<button class="chip chip--generate" onclick="window.openTenderModal()">📝 עבוד על מכרז — העלה חומרים וקבל מסמך מכרז מלא</button>`
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
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2, ...thinkingCfg() },
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
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2, ...thinkingCfg() },
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
  // Pro is not offered on the free tier, so this failure means "no billing",
  // not "out of quota" — falling through to the quota path would silently
  // demote the run to Flash while the header still advertised Pro.
  if (isBillingRequiredError(msg) && getEngine() === 'pro') {
    appendMessage('error',
      `⚠️ מצב "מדויק" (Pro) אינו זמין למפתח הזה — הוא דורש חשבון Google עם חיוב מופעל.\n` +
      `אפשר לחזור למצב ⚡ מהיר בבורר שבראש העמוד, או להפעיל חיוב:\n` +
      `👉 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>`
    );
  } else if (isUnknownModelError(msg)) {
    // A retired model ID: re-probe the listing endpoint so the stale entry is
    // dropped from the chain instead of failing again on the next message.
    appendMessage('error',
      `⚠️ המודל ${MODEL_CHAIN[modelIdx]} אינו זמין עוד. מרענן את רשימת המודלים…`
    );
    fetchAvailableModels(apiKey, { force: true }).then(() => pruneChainToAvailable());
  } else if (/API_KEY|401|403|INVALID|api key/i.test(msg)) {
    apiKey = '';
    localStorage.removeItem(STORAGE_KEY);
    document.getElementById('api-banner').hidden = false;
    setHeaderActions(false);
    appendMessage('error',
      'מפתח ה-API אינו תקף. אנא הזן מפתח חדש.\n' +
      'שים לב: Google מפסיקה בהדרגה את התמיכה במפתחות מהדור הישן — ' +
      'אם המפתח עבד בעבר, ייתכן שצריך ליצור חדש ב-' +
      '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">AI Studio</a>.'
    );
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

// ── Token usage accounting ────────────────────────────────────────────────
// Every response carries usageMetadata and it was being thrown away, so a run
// that can cost real money reported its size in characters. Callers reset the
// counter at the start of a run and read it at the end.
let usage = { prompt: 0, output: 0, cached: 0, thoughts: 0, calls: 0 };

function recordUsage(u) {
  if (!u) return;
  usage.prompt   += u.promptTokenCount        || 0;
  usage.output   += u.candidatesTokenCount    || 0;
  usage.cached   += u.cachedContentTokenCount || 0;
  usage.thoughts += u.thoughtsTokenCount      || 0;
  usage.calls    += 1;
}

function resetUsage() {
  usage = { prompt: 0, output: 0, cached: 0, thoughts: 0, calls: 0 };
}

function getUsage() {
  return { ...usage };
}

// ── Gemini helpers used by modal files (via deps) ─────────────────────────


async function callGeminiForArchitectSpec(promptText, mIdx, inlineFile = null, opts = {}) {
  const makeUrl = (idx) => `https://generativelanguage.googleapis.com/v1beta/models/${opts.model || MODEL_CHAIN[idx]}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const maxCont   = opts.maxContinuations ?? 3;
  // opts.cachedContent — name of an explicit context cache ("cachedContents/…")
  // whose contents are prepended server-side; must match the model in the URL
  const cacheRef  = opts.cachedContent ? { cachedContent: opts.cachedContent } : {};
  // A system instruction baked into a cache at creation time is already in
  // effect server-side; sending it again alongside cachedContent is rejected.
  const sysText   = opts.systemPrompt ?? agent.systemPrompt;
  const sysRef    = (sysText && !opts.cachedContent)
    ? { system_instruction: { parts: [{ text: sysText }] } }
    : {};
  const userParts = [{ text: promptText }];
  if (inlineFile) userParts.push({ inlineData: { mimeType: inlineFile.mimeType, data: inlineFile.base64 } });

  // Reasoning budget is billed as output and counts against maxOutputTokens,
  // so it rides in generationConfig alongside the cap it consumes.
  const buildCfg = () => ({
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    ...thinkingCfg(opts.thinkingLevel ?? DEFAULT_THINKING_LEVEL),
    ...(opts.genCfg || {}),
  });
  let genConfig = buildCfg();

  const post = (body) => fetch(makeUrl(mIdx), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let res = await post({ ...sysRef, ...cacheRef, contents: [{ role: 'user', parts: userParts }], generationConfig: genConfig });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message ?? `HTTP ${res.status}`;
    // The thinkingLevel request shape is unverified against primary docs, so
    // a rejection naming that field retires it for the session and retries
    // rather than failing the run over an optional tuning parameter.
    if (isThinkingFieldError(msg)) {
      markThinkingUnsupported();
      genConfig = buildCfg();
      res = await post({ ...sysRef, ...cacheRef, contents: [{ role: 'user', parts: userParts }], generationConfig: genConfig });
    }
    if (!res.ok) {
      const err2 = await res.json().catch(() => ({}));
      throw new Error(err2?.error?.message ?? msg);
    }
  }
  const data      = await res.json();
  recordUsage(data.usageMetadata);
  const candidate = data.candidates[0];
  let text = candidate.content.parts.map(p => p.text).join('');

  // Auto-continuation: if truncated, resume via multi-turn conversation
  if (candidate.finishReason === 'MAX_TOKENS' && maxCont > 0) {
    let truncated = true;
    let contNum = 0;
    while (truncated && contNum < maxCont) {
      contNum++;
      appendMessage('error', `⚠️ חלק נחתך — ממשיך אוטומטית (${contNum}/${maxCont})…`);
      const contRes = await post({
        ...sysRef,
        ...cacheRef,
        contents: [
          { role: 'user',  parts: userParts },
          { role: 'model', parts: [{ text }] },
          { role: 'user',  parts: [{ text: 'המשך ישירות מהיכן שנעצרת — ללא חזרה על מה שכבר נכתב.' }] },
        ],
        generationConfig: genConfig,
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
      system_instruction: { parts: [{ text: agent.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        ...thinkingCfg(),
      },
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
