import { deps } from './deps.js';

// ── State ──────────────────────────────────────────────────────────────────
let phase = 'pick'; // 'pick' | 'calibrating' | 'running' | 'done' | 'error'
let pickedFiles = []; // [{ name, text, sizeChars, isInline, mimeType, base64? }]
let calibration = null; // { understanding, workPlan:[{section,prompt}], questions:[] }
let outputSections = []; // accumulated text from execution calls
let totalCallsPlanned = 0;

const MAX_FILES = 20;
const WARN_CHARS = 80_000;
const HEAVY_CHARS = 200_000;

const BLOCKED_EXTS = new Set(['exe', 'com', 'bat', 'cmd', 'msi', 'scr', 'pif']);
const INLINE_EXTS  = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'ico', 'svg']);
const TEXT_EXTS    = new Set(['txt','md','csv','json','html','htm','xml','yaml','yml','toml','ini','cfg','log','sh','bash','ps1','py','js','ts','jsx','tsx','java','c','cpp','cs','go','rb','php','sql','r','swift','kt','rs','dart','vue','scss','css','less','gitignore','env','conf','properties']);

// output format registry
const OUTPUT_FORMATS = { doc: 'application/msword', md: 'text/markdown', txt: 'text/plain', html: 'text/html', json: 'application/json' };

// ── Init ───────────────────────────────────────────────────────────────────
export function initShragaModal() {
  injectModal();
}

function injectModal() {
  if (document.getElementById('shraga-modal')) return;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes shraga-spin { to { transform: rotate(360deg); } }
    .shraga-spinner { animation: shraga-spin .75s linear infinite; }
    .shraga-file-tag {
      display:inline-flex;align-items:center;gap:.3rem;background:#f1f5f9;
      border:1px solid #cbd5e1;border-radius:6px;padding:.18rem .5rem .18rem .35rem;
      font-size:.78rem;color:#334155;max-width:220px;
    }
    .shraga-file-tag span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .shraga-file-tag button {
      background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.85rem;
      padding:0 .1rem;line-height:1;flex-shrink:0;
    }
    .shraga-file-tag button:hover { color:#ef4444; }
    .shraga-warn {
      background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
      padding:.6rem .85rem;font-size:.81rem;color:#92400e;line-height:1.45;
    }
    .shraga-warn.danger { background:#fef2f2;border-color:#fecaca;color:#b91c1c; }
    .shraga-progress-bar {
      height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:.5rem;
    }
    .shraga-progress-fill {
      height:100%;background:linear-gradient(90deg,#0891b2,#7c3aed);
      border-radius:3px;transition:width .4s ease;
    }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'shraga-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:900;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:700px;width:calc(100% - 2rem);max-height:93vh;direction:rtl;box-shadow:0 24px 64px rgba(0,0,0,.35);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;display:flex;align-items:center;gap:.4rem;">🧠 שרגא — ניתוח מסמכים</h3>
          <p style="margin:0;color:#64748b;font-size:.82rem;">העלה קבצים, תן הקשר — קבל ניתוח מעמיק בקבצים מרובים</p>
        </div>
        <button onclick="window.closeShragaModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>
      <div id="shraga-body" style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:.9rem;"></div>
      <div id="shraga-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeShragaModal(); });
  document.body.appendChild(modal);
}

// ── Open / Close ───────────────────────────────────────────────────────────
window.openShragaModal = function () {
  if (deps.getIsLoading()) return;
  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }
  phase = 'pick';
  pickedFiles = [];
  calibration = null;
  outputSections = [];
  document.getElementById('shraga-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showPhasePick();
};

window.closeShragaModal = function () {
  document.getElementById('shraga-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ── Phase 1: pick files + context ─────────────────────────────────────────
function showPhasePick() {
  setBody(`
    <!-- Drop zone -->
    <label id="shraga-drop" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1rem;text-align:center;cursor:pointer;background:#fafbfc;transition:.15s;">
      <input type="file" id="shraga-file-input" multiple hidden />
      <div id="shraga-drop-label" style="font-size:.88rem;color:#475569;">
        <span style="font-size:1.8rem;display:block;margin-bottom:.3rem;">📂</span>
        לחץ לבחירת קבצים או גרור לכאן<br>
        <span style="font-size:.76rem;color:#94a3b8;">כל סוגי הקבצים נתמכים (למעט EXE)</span>
      </div>
    </label>

    <!-- File tags -->
    <div id="shraga-file-list" style="display:flex;flex-wrap:wrap;gap:.4rem;min-height:0;"></div>

    <!-- Warnings -->
    <div id="shraga-warnings"></div>

    <!-- Context -->
    <div>
      <label style="font-size:.83rem;font-weight:600;color:#374151;display:block;margin-bottom:.3rem;">
        📝 הקשר — ספר לשרגא מה אנחנו מנסים לעשות
        <span style="font-weight:400;color:#94a3b8;">(רשות)</span>
      </label>
      <textarea id="shraga-context" rows="3" placeholder="לדוגמה: אנחנו בונים מערכת ניהול מלאי. הקבצים כוללים דרישות ופגישות. רוצים לבדוק מה הפערים."
        style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:.55rem .7rem;font-family:Heebo,sans-serif;font-size:.85rem;resize:vertical;color:#1e293b;background:#fff;direction:rtl;line-height:1.5;"></textarea>
    </div>

    <!-- How it works -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:.75rem 1rem;font-size:.79rem;color:#475569;line-height:1.55;">
      <strong style="color:#334155;">איך שרגא עובד:</strong><br>
      📥 <strong>קבלה:</strong> כל סוגי הקבצים (עד ${MAX_FILES}) — DOCX, PDF, תמונות, קוד, CSV, JSON, HTML ועוד (למעט EXE).<br>
      🔍 <strong>קריאה 1 — כיול:</strong> שרגא קורא את כל החומרים ומחליט על תוכנית עבודה וקבצי פלט.<br>
      ⚙️ <strong>קריאות 2–5 — ביצוע:</strong> ניתוח מעמיק לפי היקף החומר.<br>
      📤 <strong>פלט:</strong> שרגא מחליט כמה קבצים להפיק ובאיזה פורמט — Word, Markdown, HTML, JSON, טקסט.
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeShragaModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button id="shraga-run-btn" onclick="window.runShraga()" disabled
        style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);opacity:.55;">
        🧠 נתח וייצא קבצים
      </button>
    </div>`);

  wireFileInput();
}

function wireFileInput() {
  const input = document.getElementById('shraga-file-input');
  const drop  = document.getElementById('shraga-drop');
  if (!input || !drop) return;

  input.addEventListener('change', async () => {
    await addFiles(Array.from(input.files || []));
    input.value = '';
  });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = '#eff6ff'; });
  drop.addEventListener('dragleave', () => { drop.style.background = '#fafbfc'; });
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    drop.style.background = '#fafbfc';
    await addFiles(Array.from(e.dataTransfer.files || []));
  });
}

async function addFiles(rawFiles) {
  if (!rawFiles.length) return;
  const btn = document.getElementById('shraga-run-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.55'; }
  const dropLabel = document.getElementById('shraga-drop-label');
  if (dropLabel) dropLabel.innerHTML = `<span style="font-size:1.4rem;display:block;margin-bottom:.2rem;">⏳</span>קורא קבצים…`;

  for (const f of rawFiles) {
    if (pickedFiles.length >= MAX_FILES) {
      showModalError(`מקסימום ${MAX_FILES} קבצים בו-זמנית.`); break;
    }
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (BLOCKED_EXTS.has(ext)) {
      showModalError(`סוג קובץ חסום מטעמי אבטחה: .${ext}`); continue;
    }
    try {
      const parsed = await readShragaFile(f);
      // dedupe by name
      if (!pickedFiles.find(x => x.name === parsed.name)) {
        pickedFiles.push(parsed);
      }
    } catch (e) {
      showModalError(`שגיאה בקריאת "${f.name}": ${e.message || e}`);
    }
  }

  renderFileTags();
  renderWarnings();
  updateDropLabel();

  const runBtn = document.getElementById('shraga-run-btn');
  if (runBtn && pickedFiles.length > 0) {
    runBtn.disabled = false; runBtn.style.opacity = '1';
  }
}

function renderFileTags() {
  const container = document.getElementById('shraga-file-list');
  if (!container) return;
  if (!pickedFiles.length) { container.innerHTML = ''; return; }
  container.innerHTML = pickedFiles.map((f, i) => `
    <div class="shraga-file-tag">
      <span>${fileTypeIcon(f.name)}</span>
      <span title="${deps.escHtml(f.name)}">${deps.escHtml(f.name)}</span>
      <button onclick="window.shragaRemoveFile(${i})" title="הסר">✕</button>
    </div>`).join('');
}

window.shragaRemoveFile = function (idx) {
  pickedFiles.splice(idx, 1);
  renderFileTags();
  renderWarnings();
  updateDropLabel();
  const btn = document.getElementById('shraga-run-btn');
  if (btn) { btn.disabled = !pickedFiles.length; btn.style.opacity = pickedFiles.length ? '1' : '.55'; }
};

function updateDropLabel() {
  const el = document.getElementById('shraga-drop-label');
  if (!el) return;
  if (pickedFiles.length === 0) {
    el.innerHTML = `<span style="font-size:1.8rem;display:block;margin-bottom:.3rem;">📂</span>
      לחץ לבחירת קבצים או גרור לכאן<br>
      <span style="font-size:.76rem;color:#94a3b8;">כל סוגי הקבצים נתמכים (למעט EXE)</span>`;
  } else {
    el.innerHTML = `<span style="font-size:1.4rem;display:block;margin-bottom:.2rem;">✅</span>
      <strong style="color:#0f766e;">${pickedFiles.length} קבצים נטענו</strong>
      <div style="font-size:.75rem;color:#64748b;margin-top:.15rem;">לחץ להוסיף עוד קבצים</div>`;
  }
}

function renderWarnings() {
  const container = document.getElementById('shraga-warnings');
  if (!container) return;
  const warnings = [];

  // warn about binary/unknown files
  const binaryFiles = pickedFiles.filter(f => f.binaryWarning);
  if (binaryFiles.length) {
    warnings.push({
      danger: true,
      text: `⚠️ ${binaryFiles.length} קבצים לא זוהו כטקסט או פורמט מוכר: ${binaryFiles.map(f => f.name).join(', ')}.\nהם יועברו כ-base64 — ייתכן שהמודל לא יוכל לקרוא אותם. מומלץ לבדוק שהפורמט נכון.`
    });
  }

  // check total size
  const totalChars = pickedFiles.reduce((s, f) => s + (f.sizeChars || 0), 0);
  if (totalChars > HEAVY_CHARS) {
    warnings.push({
      danger: true,
      text: `⏱️ היקף חומר גדול מאד (כ-${Math.round(totalChars / 1000)}K תווים). העיבוד עשוי לקחת 20–40 דקות ולצרוך מכסת API משמעותית. שקול להסיר קבצים פחות רלוונטיים.`
    });
  } else if (totalChars > WARN_CHARS) {
    warnings.push({
      danger: false,
      text: `⏳ היקף חומר בינוני–גדול (כ-${Math.round(totalChars / 1000)}K תווים). העיבוד עשוי לקחת מספר דקות.`
    });
  }

  // warn about DOC files
  const docFiles = pickedFiles.filter(f => /\.doc$/i.test(f.name));
  if (docFiles.length) {
    warnings.push({
      danger: false,
      text: `📄 קבצי DOC ישנים (לא DOCX) עשויים להיקרא בצורה חלקית. מומלץ להמיר ל-DOCX או PDF לפני העלאה.`
    });
  }

  container.innerHTML = warnings.map(w =>
    `<div class="shraga-warn${w.danger ? ' danger' : ''}" style="white-space:pre-line;">${w.text}</div>`
  ).join('');
}

function showModalError(msg) {
  const container = document.getElementById('shraga-warnings');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'shraga-warn danger';
  el.textContent = '❌ ' + msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── File reading ───────────────────────────────────────────────────────────
async function readShragaFile(file) {
  const ext  = (file.name.split('.').pop() || '').toLowerCase();
  const name = file.name;

  if (ext === 'docx') {
    if (!window.mammoth) throw new Error('mammoth לא נטען');
    const buf = await file.arrayBuffer();
    const res = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return { name, text: res.value, sizeChars: res.value.length, isInline: false };
  }

  if (ext === 'doc') {
    const buf  = await file.arrayBuffer();
    const arr  = new Uint8Array(buf);
    const text = Array.from(arr)
      .map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : ' ')
      .join('')
      .replace(/ {3,}/g, ' ')
      .trim();
    return { name, text: `[קובץ DOC — קריאה חלקית]\n${text}`, sizeChars: text.length, isInline: false };
  }

  if (ext === 'pdf') {
    const base64 = await toBase64(file);
    return { name, base64, mimeType: 'application/pdf', isInline: true, sizeChars: Math.round(file.size * 0.75) };
  }

  // images — send inline
  if (['png','jpg','jpeg','gif','webp','bmp','tiff','tif','ico'].includes(ext)) {
    const mimeMap = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', bmp:'image/bmp', tiff:'image/tiff', tif:'image/tiff', ico:'image/x-icon' };
    const base64 = await toBase64(file);
    return { name, base64, mimeType: mimeMap[ext] || 'image/png', isInline: true, sizeChars: Math.round(file.size * 0.1) };
  }

  if (['xls', 'xlsx'].includes(ext)) {
    if (typeof XLSX === 'undefined') throw new Error('ספריית XLSX לא נטענה');
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    const lines = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv.trim()) lines.push(`--- גיליון: ${sheetName} ---\n${csv}`);
    }
    const text = lines.join('\n\n');
    return { name, text, sizeChars: text.length, isInline: false };
  }

  // all known text formats + fallback attempt
  if (TEXT_EXTS.has(ext) || ext === 'svg') {
    const text = await file.text();
    return { name, text, sizeChars: text.length, isInline: false };
  }

  // unknown — try as text, fallback to base64
  try {
    const text = await file.text();
    // if the result looks like binary (many replacement chars), bail
    const nullCount = (text.match(/�/g) || []).length;
    if (nullCount / text.length > 0.05) throw new Error('binary');
    return { name, text: `[קובץ ${ext.toUpperCase()}]\n${text}`, sizeChars: text.length, isInline: false };
  } catch {
    const base64 = await toBase64(file);
    return { name, base64, mimeType: 'application/octet-stream', isInline: true, sizeChars: Math.round(file.size * 0.1), binaryWarning: true };
  }
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function fileTypeIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png','jpg','jpeg','gif','webp','bmp','tiff','tif','ico','svg'].includes(ext)) return '🖼️';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  if (['pdf'].includes(ext)) return '📄';
  if (['docx','doc'].includes(ext)) return '📝';
  if (['txt','md','log'].includes(ext)) return '📃';
  if (['json','xml','yaml','yml','toml'].includes(ext)) return '🔧';
  if (['html','htm'].includes(ext)) return '🌐';
  if (['py','js','ts','java','c','cpp','cs','go','rb','php','sql','sh','swift','kt','rs'].includes(ext)) return '💻';
  return '📎';
}

// ── Phase 2: calibration + execution ──────────────────────────────────────
window.runShraga = async function () {
  if (!pickedFiles.length) return;
  const contextEl = document.getElementById('shraga-context');
  const context = contextEl ? contextEl.value.trim() : '';

  phase = 'calibrating';
  outputSections = [];
  totalCallsPlanned = 0;

  showRunning('🔍 קריאה 1 — שרגא קורא את החומרים ומכייל את עצמו…', 1, 2);

  let mIdx = deps.getModelIdx();

  // ── Call 1: calibration ────────────────────────────────────────────────
  let calibJson;
  try {
    const calibPrompt = buildCalibrationPrompt(context);
    const calibRaw = await callWithFallback(calibPrompt, mIdx);
    mIdx = deps.getModelIdx();
    calibJson = parseCalibration(calibRaw);
  } catch (err) {
    phase = 'error';
    showError(err.message || String(err)); return;
  }

  calibration = calibJson;
  const plan = calibration.workPlan || [];
  // clamp: 1–4 execution calls
  const execCalls = Math.min(4, Math.max(1, plan.length || 1));
  totalCallsPlanned = 1 + execCalls;

  // ── Calls 2…N: execution ──────────────────────────────────────────────
  phase = 'running';
  for (let i = 0; i < execCalls; i++) {
    const callNum = i + 2;
    const section = plan[i] || { section: 'ניתוח כללי', prompt: calibration.internalPrompt || '' };
    updateRunning(`⚙️ קריאה ${callNum} מתוך ${totalCallsPlanned} — ${section.section || 'עיבוד'}…`, callNum, totalCallsPlanned);
    try {
      const execPrompt = buildExecutionPrompt(context, calibration, section, i, execCalls);
      const result = await callWithFallback(execPrompt, mIdx);
      mIdx = deps.getModelIdx();
      outputSections.push({ title: section.section || `חלק ${i + 1}`, text: result });
    } catch (err) {
      phase = 'error';
      showError(err.message || String(err)); return;
    }
  }

  phase = 'done';
  const outFiles = calibration.outputFiles && calibration.outputFiles.length
    ? calibration.outputFiles
    : [{ filename: 'shraga_analysis', format: 'doc', title: 'ניתוח מלא' }];

  // group sections by outputFileIndex
  const grouped = outFiles.map((_, i) => outputSections.filter((s, si) => {
    const plan = (calibration.workPlan || [])[si];
    return (plan ? (plan.outputFileIndex ?? 0) : 0) === i;
  }));
  // any unassigned sections go to file 0
  outputSections.forEach((s, si) => {
    const plan = (calibration.workPlan || [])[si];
    const idx = plan ? (plan.outputFileIndex ?? 0) : 0;
    if (idx >= outFiles.length) grouped[0].push(s);
  });

  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  for (let i = 0; i < outFiles.length; i++) {
    const fileDef = outFiles[i];
    const sections = grouped[i] || outputSections; // fallback: all sections in file 0
    if (!sections.length && i > 0) continue; // skip empty extra files
    const content = assembleDocument(context, calibration, sections, fileDef.title || fileDef.filename);
    downloadFile(content, `${fileDef.filename || 'shraga'}_${ts}`, fileDef.format || 'doc');
    await new Promise(r => setTimeout(r, 400)); // stagger downloads
  }
  showDone(outFiles);
};

// ── Prompt builders ────────────────────────────────────────────────────────
function buildCalibrationPrompt(context) {
  const fileBlocks = pickedFiles.map(f => {
    if (f.isInline) return `[קובץ: "${f.name}" — PDF מצורף inline]`;
    return `=== קובץ: "${f.name}" ===\n${(f.text || '').slice(0, 30000)}\n=== סוף קובץ ===`;
  }).join('\n\n');

  const inlineFiles = pickedFiles.filter(f => f.isInline);

  return `אתה שרגא — סוכן ניתוח מסמכים מקצועי. עכשיו בשלב הכיול.

${context ? `הקשר מהמפעיל:\n"${context}"\n\n` : ''}חומרים שהועלו:
${fileBlocks}
${inlineFiles.length ? `\n[${inlineFiles.length} קבצי PDF מצורפים כ-inline לקריאה ישירה]\n` : ''}
---

משימתך בקריאה זו:
1. הבן את כל החומרים והצרכים.
2. קבע כמה קריאות ביצוע נדרשות (1 עד 4) לפי היקף ועומק — מקסימום 4.
3. הגדר תוכנית עבודה מפורטת: לכל קריאה — שם הסעיף ופרומט מפורט מה לנתח/לכתוב.
4. רשום שאלות הבהרה אם נדרש.

ענה **אך ורק** ב-JSON תקני (ללא גושי קוד, ללא טקסט נלווה):
{
  "understanding": "תיאור קצר של מה הבנת מהחומרים",
  "numExecutionCalls": <1–4>,
  "internalPrompt": "פרומט ראשי מפורט לשרגא — הנחיות כלליות לביצוע הניתוח",
  "workPlan": [
    { "section": "שם הסעיף", "prompt": "מה לנתח/לכתוב בסעיף זה — פירוט מלא", "outputFileIndex": 0 }
  ],
  "outputFiles": [
    { "filename": "shraga_analysis", "format": "doc", "title": "ניתוח מלא" }
  ],
  "questions": ["שאלה 1", "שאלה 2"]
}

הנחיות לבחירת קבצי פלט (outputFiles):
- החלט כמה קבצי פלט נדרשים (1 עד 4) לפי סוג הניתוח וצרכי המשתמש.
- format יכול להיות: "doc" (Word — לדוחות מפורטים), "md" (Markdown — לתיעוד טכני), "txt" (טקסט רגיל), "html" (דף HTML — לממשקים או מסמכים חזותיים), "json" (JSON — לנתונים מובנים).
- בשדה outputFileIndex בכל סעיף workPlan — ציין באיזה קובץ פלט הסעיף הזה ישתייך (אינדקס ב-outputFiles).
- אם מדובר בניתוח פשוט — קובץ אחד doc מספיק. אם יש גם נתונים מובנים וגם פרוזה — שקול doc + json. אם נדרש סיכום מנהלים + ניתוח מפורט — שני doc נפרדים.`;
}

function buildExecutionPrompt(context, calib, section, sectionIdx, totalSections) {
  const fileBlocks = pickedFiles.map(f => {
    if (f.isInline) return `[קובץ: "${f.name}" — PDF מצורף inline]`;
    return `=== קובץ: "${f.name}" ===\n${(f.text || '').slice(0, 40000)}\n=== סוף קובץ ===`;
  }).join('\n\n');

  return `אתה שרגא — סוכן ניתוח מסמכים מקצועי. עכשיו בשלב הביצוע (סעיף ${sectionIdx + 1} מתוך ${totalSections}).

${context ? `הקשר מהמפעיל:\n"${context}"\n\n` : ''}הנחיות כלליות שקבעת לעצמך בשלב הכיול:
${calib.internalPrompt || ''}

הבנתך מהחומרים: ${calib.understanding || ''}

המשימה שלך עכשיו (${section.section}):
${section.prompt}

חומרי הגלם:
${fileBlocks}

---
כתוב ניתוח מפורט ומאורגן בעברית. השתמש בכותרות (## ו-###), רשימות נקודות (**) וטבלאות לפי הצורך.
אל תמציא מידע שאינו בחומרים — ציין מפורשות כשמשהו חסר.
בסוף הסעיף, אם יש שאלות הבהרה הנוגעות לסעיף זה — כלול אותן תחת כותרת ### שאלות פתוחות.`;
}

// ── Calibration JSON parser ────────────────────────────────────────────────
function parseCalibration(raw) {
  let s = (raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const first = s.indexOf('{'), last = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return {
    understanding: 'לא הצלחתי לפרסר כיול — עובר לביצוע ישיר',
    numExecutionCalls: 1,
    internalPrompt: raw || '',
    workPlan: [{ section: 'ניתוח מלא', prompt: 'בצע ניתוח מלא ומקיף של כל החומרים לפי ההקשר שניתן.', outputFileIndex: 0 }],
    outputFiles: [{ filename: 'shraga_analysis', format: 'doc', title: 'ניתוח מלא' }],
    questions: [],
  };
}

// ── Document assembly ──────────────────────────────────────────────────────
function assembleDocument(context, calib, sections, docTitle = 'ניתוח שרגא') {
  const ts = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  const fileList = pickedFiles.map(f => `- ${f.name}`).join('\n');

  let md = `# ${docTitle}\n\n`;
  md += `**תאריך:** ${ts}\n\n`;
  if (context) md += `**הקשר:** ${context}\n\n`;
  md += `**קבצים שנותחו:**\n${fileList}\n\n---\n\n`;
  md += `## הבנת שרגא את החומרים\n\n${calib.understanding || ''}\n\n---\n\n`;

  for (const sec of sections) {
    md += `## ${sec.title}\n\n${sec.text}\n\n---\n\n`;
  }

  if (calib.questions && calib.questions.length) {
    md += `## שאלות הבהרה כלליות\n\n`;
    calib.questions.forEach((q, i) => { md += `${i + 1}. ${q}\n`; });
  }

  return md;
}

// ── File output ─────────────────────────────────────────────────────────────
function markdownToWordHtml(markdownText) {
  let bodyHtml = '';
  if (window.marked) {
    try { bodyHtml = window.marked.parse(markdownText, { breaks: true, gfm: true }); }
    catch { bodyHtml = deps.escHtml(markdownText).replace(/\n/g, '<br>'); }
  } else {
    bodyHtml = deps.escHtml(markdownText).replace(/\n/g, '<br>');
  }
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>ניתוח שרגא</title>
  <style>
    body  { font-family: Arial, sans-serif; direction: rtl; font-size: 11pt; margin: 2cm; color: #1a202c; }
    h1    { font-size: 18pt; color: #1a365d; border-bottom: 2px solid #bee3f8; padding-bottom: 4pt; }
    h2    { font-size: 14pt; color: #2c5282; margin-top: 16pt; }
    h3    { font-size: 12pt; color: #2b6cb0; }
    hr    { border: none; border-top: 1px solid #e2e8f0; margin: 12pt 0; }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
    td, th { border: 1px solid #cbd5e1; padding: 5pt 8pt; font-size: 10pt; text-align: right; }
    th    { background: #ebf8ff; font-weight: bold; }
    code  { font-family: Consolas, monospace; background: #f7fafc; padding: 1pt 4pt; font-size: 10pt; }
    pre   { background: #f7fafc; padding: 8pt; border-radius: 4pt; direction: ltr; }
    ul, ol { padding-right: 20pt; padding-left: 0; }
    li    { margin-bottom: 3pt; }
    strong { color: #2d3748; }
    blockquote { border-right: 3px solid #bee3f8; margin: 0; padding-right: 12pt; color: #4a5568; }
  </style>
</head>
<body dir="rtl">${bodyHtml}</body>
</html>`;
}

function markdownToHtml(markdownText) {
  let body = '';
  if (window.marked) {
    try { body = window.marked.parse(markdownText, { breaks: true, gfm: true }); }
    catch { body = deps.escHtml(markdownText).replace(/\n/g, '<br>'); }
  } else {
    body = deps.escHtml(markdownText).replace(/\n/g, '<br>');
  }
  return `<!DOCTYPE html><html lang="he"><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;direction:rtl;max-width:900px;margin:2rem auto;color:#1a202c;line-height:1.6;}
h1{color:#1a365d;}h2{color:#2c5282;}table{border-collapse:collapse;width:100%;}
td,th{border:1px solid #cbd5e1;padding:6px 10px;}th{background:#ebf8ff;}
code{background:#f7fafc;padding:1px 4px;}pre{background:#f7fafc;padding:12px;overflow:auto;}</style>
</head><body dir="rtl">${body}</body></html>`;
}

function downloadFile(markdownContent, filenameNoExt, format) {
  let content, mimeType, ext;
  switch (format) {
    case 'md':
      content  = markdownContent;
      mimeType = 'text/markdown';
      ext      = 'md';
      break;
    case 'txt':
      content  = markdownContent.replace(/#{1,6} /g, '').replace(/\*\*/g, '').replace(/\*/g, '');
      mimeType = 'text/plain';
      ext      = 'txt';
      break;
    case 'html':
      content  = markdownToHtml(markdownContent);
      mimeType = 'text/html';
      ext      = 'html';
      break;
    case 'json': {
      const lines = markdownContent.split('\n');
      const sections = [];
      let cur = null;
      for (const line of lines) {
        if (/^## /.test(line)) { if (cur) sections.push(cur); cur = { title: line.replace(/^## /, ''), content: '' }; }
        else if (cur) cur.content += line + '\n';
      }
      if (cur) sections.push(cur);
      content  = JSON.stringify({ generatedBy: 'שרגא', sections }, null, 2);
      mimeType = 'application/json';
      ext      = 'json';
      break;
    }
    default: // 'doc'
      content  = markdownToWordHtml(markdownContent);
      mimeType = 'application/msword';
      ext      = 'doc';
      break;
  }
  const blob = new Blob(ext === 'doc' ? ['﻿', content] : [content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filenameNoExt}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── API call with fallback ─────────────────────────────────────────────────
async function callWithFallback(prompt, startIdx) {
  // Collect inline files (PDFs)
  const inlineFile = pickedFiles.find(f => f.isInline) || null;
  let mIdx = startIdx;
  while (true) {
    try {
      return await deps.callGeminiForSpec(prompt, mIdx, inlineFile);
    } catch (err) {
      const msg = err.message || '';
      const quota = /quota|exceeded|free_tier/i.test(msg);
      const busy  = /503|high demand|overload|429/i.test(msg);
      if ((quota || busy) && mIdx < deps.MODEL_CHAIN.length - 1) {
        mIdx++;
        deps.setModelIdx(mIdx);
        updateRunning(`עובר למודל ${deps.MODEL_CHAIN[mIdx]} ומנסה שוב…`);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        throw err;
      }
    }
  }
}

// ── Running UI ─────────────────────────────────────────────────────────────
function showRunning(msg, current, total) {
  const pct = total > 1 ? Math.round((current / total) * 100) : 10;
  setBody(`
    <div style="display:flex;flex-direction:column;gap:.9rem;padding:.3rem 0;">
      <div style="display:flex;align-items:center;gap:.75rem;color:#334155;font-size:.9rem;">
        <div class="shraga-spinner" style="width:22px;height:22px;border:3px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;flex-shrink:0;"></div>
        <span id="shraga-running-msg">${msg}</span>
      </div>
      <div class="shraga-progress-bar">
        <div class="shraga-progress-fill" id="shraga-prog-fill" style="width:${pct}%;"></div>
      </div>
      <div style="font-size:.78rem;color:#94a3b8;" id="shraga-prog-label">קריאה ${current} מתוך ${total || '?'}</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.65rem .85rem;font-size:.8rem;color:#64748b;line-height:1.5;">
        💡 שרגא עובד — זה עשוי לקחת מספר דקות, בהתאם לכמות החומר.
        לא לסגור את החלון.
      </div>
    </div>`);
  setFooter('');
}

function updateRunning(msg, current, total) {
  const el = document.getElementById('shraga-running-msg');
  if (el) el.textContent = msg;
  if (current && total) {
    const fill = document.getElementById('shraga-prog-fill');
    const label = document.getElementById('shraga-prog-label');
    const pct = Math.round((current / total) * 100);
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = `קריאה ${current} מתוך ${total}`;
  }
}

function showDone(outFiles) {
  const formatIcon = { doc: '📝', md: '📃', txt: '📄', html: '🌐', json: '🔧' };
  const fileListHtml = (outFiles || [{ filename: 'shraga_analysis', format: 'doc', title: 'ניתוח מלא' }]).map((f, i) =>
    `<div style="display:flex;align-items:center;gap:.5rem;font-size:.83rem;color:#15803d;">
      ${formatIcon[f.format] || '📎'} <strong>${deps.escHtml(f.title || f.filename)}</strong>
      <span style="color:#6b7280;font-size:.76rem;">.${f.format}</span>
      <button onclick="window.shragaRedownload(${i})"
        style="margin-right:.3rem;font-size:.75rem;padding:.15rem .5rem;background:#dcfce7;border:1px solid #86efac;border-radius:5px;cursor:pointer;color:#166534;font-family:Heebo,sans-serif;">
        ⬇ הורד שוב
      </button>
    </div>`
  ).join('');

  setBody(`
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:1rem;font-weight:700;color:#166534;margin-bottom:.6rem;">✅ הניתוח הושלם — הקבצים הורדו</div>
      ${fileListHtml}
      <div style="margin-top:.5rem;font-size:.8rem;color:#6b7280;">קבצים שנותחו: <strong>${pickedFiles.length}</strong> | קריאות API: <strong>${totalCallsPlanned}</strong></div>
    </div>
    <div style="font-size:.82rem;color:#475569;line-height:1.5;">
      אם הורדה נחסמה על ידי הדפדפן — לחץ "הורד שוב" ליד הקובץ הרצוי.
    </div>
    ${calibration?.questions?.length ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:.75rem 1rem;font-size:.82rem;color:#1e40af;">
      <strong>שאלות הבהרה שעלו:</strong>
      <ol style="margin:.3rem 0 0;padding-right:1.1rem;">
        ${(calibration.questions || []).map(q => `<li>${deps.escHtml(q)}</li>`).join('')}
      </ol>
    </div>` : ''}`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeShragaModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.openShragaModal()" style="padding:.5rem 1.1rem;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">🔄 ניתוח חדש</button>
    </div>`);
}

window.shragaRedownload = async function (fileIdx = 0) {
  if (!outputSections.length || !calibration) return;
  const outFiles = calibration.outputFiles && calibration.outputFiles.length
    ? calibration.outputFiles
    : [{ filename: 'shraga_analysis', format: 'doc', title: 'ניתוח מלא' }];
  const fileDef = outFiles[fileIdx] || outFiles[0];
  const grouped = outputSections.filter((_, si) => {
    const plan = (calibration.workPlan || [])[si];
    return (plan ? (plan.outputFileIndex ?? 0) : 0) === fileIdx;
  });
  const sections = grouped.length ? grouped : outputSections;
  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const content = assembleDocument('', calibration, sections, fileDef.title || fileDef.filename);
  downloadFile(content, `${fileDef.filename || 'shraga'}_${ts}`, fileDef.format || 'doc');
};

function showError(msg) {
  setBody(`
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">
      ❌ שגיאה: ${deps.escHtml(msg)}
    </div>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;">
      <button onclick="window.closeShragaModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.openShragaModal()" style="padding:.48rem 1rem;background:#7c3aed;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;">נסה שוב</button>
    </div>`);
}

function setBody(html)   { const el = document.getElementById('shraga-body');   if (el) el.innerHTML = html; }
function setFooter(html) { const el = document.getElementById('shraga-footer'); if (el) el.innerHTML = html; }
