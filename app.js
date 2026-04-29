import { getSectionPrompt } from './prompt.js';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_OUTPUT_TOKENS = 65000;
const TOTAL_CHUNKS = 3;

// --- State ---
let extractedText = '';
let chunkResults = [null, null, null]; // index 0 = chunk 1, etc.

// --- DOM refs ---
const apiKeyInput = document.getElementById('api-key');
const projectIdInput = document.getElementById('project-id');
const orgStateInput = document.getElementById('org-state');
const inFlightInput = document.getElementById('inflight-specs');
const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
const generateBtn = document.getElementById('generate-btn');
const retryBtn = document.getElementById('retry-btn');
const downloadBtn = document.getElementById('download-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const errorBox = document.getElementById('error-box');
const warningBox = document.getElementById('warning-box');
const noStateNotice = document.getElementById('no-state-notice');

// --- Collapsible sections ---
function initCollapsible(toggleId, bodyId) {
  const toggle = document.getElementById(toggleId);
  const body = document.getElementById(bodyId);
  if (!toggle || !body) return;

  toggle.addEventListener('click', () => expandCollapsible(toggle, body));
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      expandCollapsible(toggle, body);
    }
  });
}

function expandCollapsible(toggle, body) {
  const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!isExpanded));
  const chevron = toggle.querySelector('.chevron');
  if (isExpanded) {
    body.hidden = true;
    if (chevron) chevron.textContent = '▼';
  } else {
    body.hidden = false;
    if (chevron) chevron.textContent = '▲';
  }
}

initCollapsible('state-toggle', 'state-body');
initCollapsible('inflight-toggle', 'inflight-body');

// Show no-state notice when org state textarea loses focus and is empty
orgStateInput.addEventListener('blur', () => {
  const hasState = orgStateInput.value.trim().length > 0;
  noStateNotice.hidden = hasState;
});

orgStateInput.addEventListener('input', () => {
  if (orgStateInput.value.trim().length > 0) {
    noStateNotice.hidden = true;
  }
});

// --- File selection label ---
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileLabel.textContent = file ? file.name : 'לא נבחר קובץ';
  extractedText = '';
  resetOutput();
});

// --- Main generate ---
generateBtn.addEventListener('click', async () => {
  clearMessages();
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showError('נא להזין מפתח API של Gemini.');
    return;
  }
  const file = fileInput.files[0];
  if (!file) {
    showError('נא לבחור קובץ FSD (Word או PDF).');
    return;
  }

  const orgState = orgStateInput.value.trim();
  if (!orgState) {
    showWarning(
      '⚠ לא הוזן מצב ארגון — הסוכן יעצב כ-Greenfield ויסמן כל הנחה מבנית עם NO-STATE. ' +
      'מומלץ מאוד להזין state snapshot לפני הרצה.'
    );
  }

  setUIBusy(true);
  retryBtn.dataset.failedChunk = '';

  try {
    if (!extractedText) {
      progressText.textContent = 'מחלץ טקסט מהקובץ...';
      showProgress(0);
      extractedText = await extractText(file);
    }
    await runChunks(apiKey, projectIdInput.value.trim(), orgState, inFlightInput.value.trim(), 1);
  } catch (err) {
    showError(`שגיאה כללית: ${err.message}`);
  } finally {
    setUIBusy(false);
  }
});

// --- Retry failed chunk ---
retryBtn.addEventListener('click', async () => {
  const failedChunk = parseInt(retryBtn.dataset.failedChunk, 10);
  if (!failedChunk) return;
  clearMessages();
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showError('נא להזין מפתח API של Gemini.');
    return;
  }
  setUIBusy(true);
  try {
    const orgState = orgStateInput.value.trim();
    await runChunks(apiKey, projectIdInput.value.trim(), orgState, inFlightInput.value.trim(), failedChunk);
  } catch (err) {
    showError(`שגיאה כללית: ${err.message}`);
  } finally {
    setUIBusy(false);
  }
});

// --- Download ---
downloadBtn.addEventListener('click', () => {
  const content = buildCombinedOutput();
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TSD_SF_Architect.md';
  a.click();
  URL.revokeObjectURL(url);
});

function buildCombinedOutput() {
  const separator = '\n\n---\n\n';
  const header = `<!-- SF Architect Agent — TSD Output -->\n<!-- Generated: ${new Date().toISOString()} -->\n<!-- Contains: 00_executive_summary · 01_objects · 02_fields · 03_automations · 04_permissions · 05_layouts · 06_integrations · 07_impact_analysis -->\n\n`;
  return header + chunkResults.filter(Boolean).join(separator);
}

// --- Run chunks starting from startChunk ---
async function runChunks(apiKey, projectId, orgState, inFlightSpecs, startChunk) {
  const chunkLabels = [
    'מייצר: סיכום מנהלי, אובייקטים, שדות (1/3)...',
    'מייצר: אוטומציות, הרשאות, UI, אינטגרציות (2/3)...',
    'מייצר: ניתוח השפעה — REUSE/EXTEND/CREATE, קונפליקטים, ADRs (3/3)...',
  ];

  for (let chunk = startChunk; chunk <= TOTAL_CHUNKS; chunk++) {
    if (chunkResults[chunk - 1] !== null) continue;

    const progressPct = ((chunk - 1) / TOTAL_CHUNKS) * 100;
    showProgress(progressPct);
    progressText.textContent = chunkLabels[chunk - 1];

    try {
      const result = await callGemini(apiKey, projectId, extractedText, chunk, orgState, inFlightSpecs);
      chunkResults[chunk - 1] = result;
    } catch (err) {
      retryBtn.dataset.failedChunk = chunk;
      retryBtn.style.display = 'inline-block';
      throw new Error(`שגיאה בעיבוד חלק ${chunk}: ${err.message}`);
    }
  }

  showProgress(100);
  progressText.textContent = 'הושלם! 8 קבצי TSD נוצרו בהצלחה.';
  downloadBtn.style.display = 'inline-block';
}

// --- Gemini API call ---
async function callGemini(apiKey, projectId, fsdText, chunkNumber, orgState, inFlightSpecs) {
  const prompt = getSectionPrompt(fsdText, chunkNumber, orgState, inFlightSpecs);
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };

  const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const headers = { 'Content-Type': 'application/json' };
  if (projectId) headers['x-goog-user-project'] = projectId;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(`בעיית רשת: ${networkErr.message}`);
  }

  if (!response.ok) {
    let msg = `קוד שגיאה ${response.status}`;
    try {
      const errJson = await response.json();
      msg += `: ${errJson?.error?.message || response.statusText}`;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) throw new Error('התגובה מה-API ריקה.');

  const finishReason = candidate.finishReason;
  const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';

  if (finishReason === 'MAX_TOKENS') {
    showWarning(
      `אזהרה: התגובה לחלק ${chunkNumber} נקטעה — הגיעה למגבלת אסימונים. ייתכן שחלק מהתוכן חסר.`
    );
  }

  if (!text) throw new Error('לא התקבל תוכן בתגובה.');
  return text;
}

// --- Text extraction ---
async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'docx') return extractDocx(file);
  if (ext === 'pdf') return extractPdf(file);
  throw new Error('פורמט קובץ לא נתמך. יש להעלות קובץ Word (.docx) או PDF.');
}

async function extractDocx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
        resolve(result.value);
      } catch (err) {
        reject(new Error(`שגיאה בקריאת קובץ Word: ${err.message}`));
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
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item) => item.str).join(' '));
        }
        resolve(pages.join('\n'));
      } catch (err) {
        reject(new Error(`שגיאה בקריאת קובץ PDF: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ.'));
    reader.readAsArrayBuffer(file);
  });
}

// --- UI helpers ---
function showProgress(pct) {
  progressSection.style.display = 'block';
  progressBar.style.width = `${pct}%`;
  progressBar.setAttribute('aria-valuenow', pct);
}

function setUIBusy(busy) {
  generateBtn.disabled = busy;
  fileInput.disabled = busy;
  apiKeyInput.disabled = busy;
  if (!busy) retryBtn.style.display = retryBtn.dataset.failedChunk ? 'inline-block' : 'none';
}

function resetOutput() {
  chunkResults = [null, null, null];
  downloadBtn.style.display = 'none';
  retryBtn.style.display = 'none';
  progressSection.style.display = 'none';
  clearMessages();
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}

function showWarning(msg) {
  warningBox.textContent = msg;
  warningBox.style.display = 'block';
}

function clearMessages() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
  warningBox.style.display = 'none';
  warningBox.textContent = '';
}
