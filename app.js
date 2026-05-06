import { getSectionPrompt } from './prompt.js';
import { CLAUDE_DESKTOP_PROMPT } from './claude-prompt.js';

const MODEL_CHAIN     = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
const MAX_OUTPUT_TOKENS = 65000;
const TOTAL_CHUNKS    = 3;

// --- State ---
let apiKey   = localStorage.getItem('gemini_sf_api_key') || '';
let modelIdx = 0;
let fsdText = '';
let fsdFile = null;
let deployedState = '';
let inFlightState = '';
let chunkResults = [null, null, null];

// --- DOM refs ---
const generateBtn = document.getElementById('generate-btn');
const retryBtn = document.getElementById('retry-btn');
const downloadTsdBtn = document.getElementById('download-tsd-btn');
const downloadInflightBtn = document.getElementById('download-inflight-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const errorBox = document.getElementById('error-box');
const warningBox = document.getElementById('warning-box');

// API key modal
const apikeyModal = document.getElementById('apikey-modal');
const apikeyInput = document.getElementById('apikey-modal-input');
const apikeySaveBtn = document.getElementById('apikey-modal-save');
const apikeyCancelBtn = document.getElementById('apikey-modal-cancel');

// Claude prompt modal
const claudePromptBtn = document.getElementById('show-claude-prompt-btn');
const claudePromptModal = document.getElementById('claude-prompt-modal');
const claudePromptText = document.getElementById('claude-prompt-text');
const claudePromptCopyBtn = document.getElementById('claude-prompt-copy');
const claudePromptCloseBtn = document.getElementById('claude-prompt-close');

// ════════════════════════════════════════════════════════════════
// Dropzones
// ════════════════════════════════════════════════════════════════
function setupDropzone({ zoneId, inputId, statusId, accept, onFile }) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      await onFile(file, zone, status);
    } catch (err) {
      showFileStatus(status, file.name, err.message, true, () => clearFileStatus(zone, status));
    }
  };

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', () => handleFile(input.files[0]));

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });
}

function showFileStatus(statusEl, name, meta, invalid, onRemove) {
  statusEl.hidden = false;
  statusEl.classList.toggle('invalid', !!invalid);
  statusEl.innerHTML = `
    <span>${invalid ? '❌' : '✅'}</span>
    <span class="file-name">${escapeHtml(name)}</span>
    <span class="file-meta">${escapeHtml(meta)}</span>
    <button type="button" aria-label="הסר" title="הסר">✕</button>
  `;
  statusEl.querySelector('button').addEventListener('click', onRemove);
}

function clearFileStatus(zone, statusEl) {
  statusEl.hidden = true;
  statusEl.innerHTML = '';
  zone.classList.remove('has-file');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── deployed.json ──
setupDropzone({
  zoneId: 'deployed-dropzone',
  inputId: 'deployed-input',
  statusId: 'deployed-status',
  accept: '.json',
  onFile: async (file, zone, status) => {
    const text = await file.text();
    const parsed = JSON.parse(text); // throws on invalid JSON
    const counts = countSections(parsed);
    deployedState = text;
    zone.classList.add('has-file');
    showFileStatus(status, file.name, counts, false, () => {
      deployedState = '';
      clearFileStatus(zone, status);
    });
  },
});

// ── in-flight.json ──
setupDropzone({
  zoneId: 'inflight-dropzone',
  inputId: 'inflight-input',
  statusId: 'inflight-status',
  accept: '.json',
  onFile: async (file, zone, status) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const counts = countSections(parsed);
    inFlightState = text;
    zone.classList.add('has-file');
    showFileStatus(status, file.name, counts, false, () => {
      inFlightState = '';
      clearFileStatus(zone, status);
    });
  },
});

// ── FSD (.docx / .pdf) ──
setupDropzone({
  zoneId: 'fsd-dropzone',
  inputId: 'fsd-input',
  statusId: 'fsd-status',
  accept: '.docx,.pdf',
  onFile: async (file, zone, status) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['docx', 'pdf'].includes(ext)) {
      throw new Error('פורמט לא נתמך. רק .docx או .pdf.');
    }
    fsdText = await extractText(file);
    fsdFile = file;
    chunkResults = [null, null, null];
    hideDownloadButtons();
    zone.classList.add('has-file');
    showFileStatus(status, file.name, `${Math.round(fsdText.length / 1000)}K תווים`, false, () => {
      fsdText = '';
      fsdFile = null;
      clearFileStatus(zone, status);
    });
  },
});

function countSections(parsed) {
  const sections = ['objects', 'fields', 'automations', 'permissions', 'integrations', 'layouts'];
  const parts = sections
    .filter((s) => Array.isArray(parsed[s]) && parsed[s].length > 0)
    .map((s) => `${parsed[s].length} ${s}`);
  return parts.length > 0 ? parts.join(' · ') : 'ריק / empty';
}

// ════════════════════════════════════════════════════════════════
// API Key Modal
// ════════════════════════════════════════════════════════════════
function openApiKeyModal() {
  return new Promise((resolve, reject) => {
    apikeyModal.hidden = false;
    apikeyInput.value = '';
    setTimeout(() => apikeyInput.focus(), 50);

    const cleanup = () => {
      apikeyModal.hidden = true;
      apikeySaveBtn.removeEventListener('click', onSave);
      apikeyCancelBtn.removeEventListener('click', onCancel);
      apikeyInput.removeEventListener('keydown', onKey);
    };
    const onSave = () => {
      const v = apikeyInput.value.trim();
      if (!v) {
        apikeyInput.focus();
        return;
      }
      localStorage.setItem('gemini_sf_api_key', v);
      cleanup();
      resolve(v);
    };
    const onCancel = () => {
      cleanup();
      reject(new Error('ביטול הזנת מפתח.'));
    };
    const onKey = (e) => {
      if (e.key === 'Enter') onSave();
      if (e.key === 'Escape') onCancel();
    };
    apikeySaveBtn.addEventListener('click', onSave);
    apikeyCancelBtn.addEventListener('click', onCancel);
    apikeyInput.addEventListener('keydown', onKey);
  });
}

// ════════════════════════════════════════════════════════════════
// Claude Desktop Prompt Modal
// ════════════════════════════════════════════════════════════════
claudePromptBtn.addEventListener('click', () => {
  claudePromptText.value = CLAUDE_DESKTOP_PROMPT;
  claudePromptModal.hidden = false;
});

claudePromptCloseBtn.addEventListener('click', () => {
  claudePromptModal.hidden = true;
});

claudePromptCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(claudePromptText.value);
    claudePromptCopyBtn.textContent = '✅ הועתק!';
    setTimeout(() => (claudePromptCopyBtn.textContent = '📋 העתק פרומפט'), 1800);
  } catch {
    claudePromptText.select();
    document.execCommand('copy');
    claudePromptCopyBtn.textContent = '✅ הועתק!';
    setTimeout(() => (claudePromptCopyBtn.textContent = '📋 העתק פרומפט'), 1800);
  }
});

// ════════════════════════════════════════════════════════════════
// Generate
// ════════════════════════════════════════════════════════════════
generateBtn.addEventListener('click', async () => {
  clearMessages();

  if (!fsdText) {
    showError('נא להעלות מסמך FSD לפני יצירת ה-TSD.');
    return;
  }

  if (!apiKey) {
    try {
      apiKey = await openApiKeyModal();
    } catch {
      return;
    }
  }

  if (!deployedState && !inFlightState) {
    showWarning(
      '⚠ לא הועלה אף קובץ state. הסוכן יעצב כ-greenfield ויסמן הנחות עם NO-STATE. ' +
      'מומלץ להעלות לפחות deployed.json.'
    );
  }

  setUIBusy(true);
  retryBtn.dataset.failedChunk = '';

  try {
    await runChunks(1);
  } catch (err) {
    showError(`שגיאה: ${err.message}`);
  } finally {
    setUIBusy(false);
  }
});

retryBtn.addEventListener('click', async () => {
  const failed = parseInt(retryBtn.dataset.failedChunk, 10);
  if (!failed) return;
  clearMessages();
  setUIBusy(true);
  try {
    await runChunks(failed);
  } catch (err) {
    showError(`שגיאה: ${err.message}`);
  } finally {
    setUIBusy(false);
  }
});

downloadTsdBtn.addEventListener('click', () => {
  const content = buildTsdMarkdown();
  downloadFile(content, deriveFilename('TSD', 'md'), 'text/markdown;charset=utf-8');
});

downloadInflightBtn.addEventListener('click', () => {
  const json = extractInflightJson(chunkResults[2] || '');
  if (!json) {
    showError('לא נמצא JSON של in-flight בפלט. נסה ליצור מחדש את חלק 3.');
    return;
  }
  downloadFile(json, 'in-flight-updated.json', 'application/json;charset=utf-8');
});

function buildTsdMarkdown() {
  const header = `<!-- SF Architect Agent — TSD -->\n<!-- Generated: ${new Date().toISOString()} -->\n<!-- Files: 00_executive_summary · 01_objects · 02_fields · 03_automations · 04_permissions · 05_layouts · 06_integrations · 07_impact_analysis -->\n\n`;
  const cleaned = chunkResults
    .map((c) => (c ? stripInflightBlock(c) : ''))
    .filter(Boolean)
    .join('\n\n---\n\n');
  return header + cleaned;
}

function stripInflightBlock(text) {
  // Remove the trailing in-flight-updated.json fenced block (and the heading) from the markdown
  const headingRe = /\n#\s*in-flight-updated\.json[\s\S]*$/i;
  return text.replace(headingRe, '').trimEnd();
}

function extractInflightJson(text) {
  const fenceRe = /```json\s*\n([\s\S]*?)\n```/i;
  const match = text.match(fenceRe);
  if (!match) return null;
  const candidate = match[1].trim();
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function deriveFilename(prefix, ext) {
  const base = fsdFile ? fsdFile.name.replace(/\.[^.]+$/, '') : 'spec';
  const clean = base.replace(/[^\w֐-׿\-]+/g, '_').slice(0, 40);
  return `${prefix}_${clean}.${ext}`;
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function hideDownloadButtons() {
  downloadTsdBtn.hidden = true;
  downloadInflightBtn.hidden = true;
}

// ════════════════════════════════════════════════════════════════
// Run chunks
// ════════════════════════════════════════════════════════════════
function isQuotaExceeded(msg) {
  return /quota|exceeded your current quota|free_tier|generativelanguage.*requests/i.test(msg);
}

function isHighDemand(msg) {
  return /503|high demand|overload|temporarily unavailable/i.test(msg);
}

async function runChunks(startChunk) {
  const labels = [
    'מייצר: סיכום מנהלי, אובייקטים, שדות (1/3)...',
    'מייצר: אוטומציות, הרשאות, UI, אינטגרציות (2/3)...',
    'מייצר: ניתוח השפעה + in-flight מעודכן (3/3)...',
  ];
  for (let chunk = startChunk; chunk <= TOTAL_CHUNKS; chunk++) {
    if (chunkResults[chunk - 1] !== null) continue;
    showProgress(((chunk - 1) / TOTAL_CHUNKS) * 100);
    progressText.textContent = labels[chunk - 1];

    while (true) {
      try {
        chunkResults[chunk - 1] = await callGemini(chunk);
        break;
      } catch (err) {
        if ((isQuotaExceeded(err.message) || isHighDemand(err.message)) && modelIdx < MODEL_CHAIN.length - 1) {
          const from = MODEL_CHAIN[modelIdx++];
          const reason = isHighDemand(err.message) ? 'עומס גבוה' : 'מגבלת שימוש';
          showWarning(`⚠️ ${reason} ב-${from}. עובר ל-${MODEL_CHAIN[modelIdx]} וממשיך מחלק ${chunk}...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        retryBtn.dataset.failedChunk = chunk;
        retryBtn.hidden = false;
        if (isQuotaExceeded(err.message)) {
          throw new Error(`הגעת למגבלת השימוש היומית בכל המודלים הזמינים. נסה שוב מחר.`);
        }
        if (isHighDemand(err.message)) {
          throw new Error(`כל המודלים הזמינים עמוסים כרגע. נסה שוב מאוחר יותר.`);
        }
        throw new Error(`חלק ${chunk}: ${err.message}`);
      }
    }
  }
  showProgress(100);
  progressText.textContent = '✅ הושלם — TSD מלא + in-flight.json מעודכן מוכנים להורדה.';
  downloadTsdBtn.hidden = false;
  if (extractInflightJson(chunkResults[2] || '')) {
    downloadInflightBtn.hidden = false;
  }

  // Save approved spec to localStorage for admin screen
  saveSpecToHistory();
}

function saveSpecToHistory() {
  try {
    const inflightJson = extractInflightJson(chunkResults[2] || '');
    const record = {
      spec_name: deriveFilename('', '').replace(/^_|\.$/g, '') || `spec-${Date.now()}`,
      generated_at: new Date().toISOString(),
      fsd_filename: fsdFile?.name || 'unknown',
      fsd_size_chars: fsdText.length,
      had_deployed_state: !!deployedState,
      had_inflight_state: !!inFlightState,
      inflight_output: inflightJson ? JSON.parse(inflightJson) : null,
    };
    const key = 'sf-architect:approved-specs';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 200)));
  } catch (err) {
    console.warn('Failed to save spec history', err);
  }
}

// ════════════════════════════════════════════════════════════════
// Gemini API
// ════════════════════════════════════════════════════════════════
async function callGemini(chunkNumber) {
  const prompt = getSectionPrompt(fsdText, chunkNumber, deployedState, inFlightState);
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_CHAIN[modelIdx]}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`בעיית רשת: ${e.message}`);
  }

  if (!response.ok) {
    let msg = `קוד ${response.status}`;
    try {
      const j = await response.json();
      msg += `: ${j?.error?.message || response.statusText}`;
    } catch {}
    if (response.status === 400 || response.status === 403) {
      apiKey = '';
      localStorage.removeItem('gemini_sf_api_key');
      msg += ' — ייתכן שמפתח ה-API שגוי. נסה שוב.';
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) throw new Error('התגובה ריקה.');
  const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (candidate.finishReason === 'MAX_TOKENS') {
    showWarning(`חלק ${chunkNumber} נקטע בגלל מגבלת אסימונים. ייתכן שחלק מהתוכן חסר.`);
  }
  if (!text) throw new Error('לא התקבל תוכן.');
  return text;
}

// ════════════════════════════════════════════════════════════════
// File extraction
// ════════════════════════════════════════════════════════════════
async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'docx') return extractDocx(file);
  if (ext === 'pdf') return extractPdf(file);
  throw new Error('פורמט לא נתמך.');
}

async function extractDocx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
        resolve(result.value);
      } catch (err) {
        reject(new Error(`קריאת Word נכשלה: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ.'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arr = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((it) => it.str).join(' '));
        }
        resolve(pages.join('\n'));
      } catch (err) {
        reject(new Error(`קריאת PDF נכשלה: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ.'));
    reader.readAsArrayBuffer(file);
  });
}

// ════════════════════════════════════════════════════════════════
// UI helpers
// ════════════════════════════════════════════════════════════════
function showProgress(pct) {
  progressSection.hidden = false;
  progressBar.style.width = `${pct}%`;
  progressBar.setAttribute('aria-valuenow', pct);
}

function setUIBusy(busy) {
  generateBtn.disabled = busy;
  if (!busy) retryBtn.hidden = !retryBtn.dataset.failedChunk;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

function showWarning(msg) {
  warningBox.textContent = msg;
  warningBox.hidden = false;
}

function clearMessages() {
  errorBox.hidden = true;
  errorBox.textContent = '';
  warningBox.hidden = true;
  warningBox.textContent = '';
}
