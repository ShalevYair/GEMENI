import { deps } from './deps.js';

// ── State ──────────────────────────────────────────────────────────────────
let phase = 'pick'; // 'pick' | 'calibrating' | 'running' | 'done' | 'error'
let pickedFiles = []; // [{ name, text, sizeChars, isInline, mimeType, base64? }]
let calibration = null; // { understanding, tenderTitle, internalPrompt, mode, sourceFileName, workPlan:[{section,prompt}], questions:[] }
let outputSections = []; // accumulated text from execution calls
let totalCallsPlanned = 0;
let selectedLevel = 'auto'; // 'low' | 'normal' | 'high' | 'auto'
let lastInstruction = '';
let runMode = 'write'; // 'write' (new tender from plan) | 'revise' (chunked rewrite of an existing tender)

const MAX_FILES = 20;
const WARN_CHARS = 80_000;
const HEAVY_CHARS = 200_000;

const BLOCKED_EXTS = new Set(['exe', 'com', 'bat', 'cmd', 'msi', 'scr', 'pif']);
const TEXT_EXTS    = new Set(['txt','md','csv','json','html','htm','xml','yaml','yml','toml','ini','cfg','log','sh','bash','ps1','py','js','ts','jsx','tsx','java','c','cpp','cs','go','rb','php','sql','r','swift','kt','rs','dart','vue','scss','css','less','gitignore','env','conf','properties']);

// Processing levels — bound the execution calls in write mode; in revise mode
// (updating an existing tender) they set the chunk size instead: a higher
// level means smaller chunks, i.e. more calls and a more thorough pass.
const LEVELS = {
  low:    { label: 'נמוכה',    icon: '🪶', desc: 'קריאה אחת — מכרז תמציתי וממוקד',          min: 1, max: 1, chunkChars: 45000 },
  normal: { label: 'רגילה',    icon: '📄', desc: '2–3 קריאות — מסמך מכרז מלא',              min: 2, max: 3, chunkChars: 30000 },
  high:   { label: 'גבוהה',    icon: '🏛️', desc: '4–6 קריאות — מכרז מעמיק על כל פרקיו',     min: 4, max: 6, chunkChars: 18000 },
  auto:   { label: 'אוטומטית', icon: '🤖', desc: 'הסוכן קובע לבד לפי היקף החומר (1–6)',      min: 1, max: 6, chunkChars: 30000 },
};

// ── Init ───────────────────────────────────────────────────────────────────
export function initTenderWriterModal() {
  injectModal();
}

function injectModal() {
  if (document.getElementById('tender-modal')) return;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes tender-spin { to { transform: rotate(360deg); } }
    .tender-spinner { animation: tender-spin .75s linear infinite; }
    .tender-file-tag {
      display:inline-flex;align-items:center;gap:.3rem;background:#f1f5f9;
      border:1px solid #cbd5e1;border-radius:6px;padding:.18rem .5rem .18rem .35rem;
      font-size:.78rem;color:#334155;max-width:220px;
    }
    .tender-file-tag span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .tender-file-tag button {
      background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.85rem;
      padding:0 .1rem;line-height:1;flex-shrink:0;
    }
    .tender-file-tag button:hover { color:#ef4444; }
    .tender-warn {
      background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
      padding:.6rem .85rem;font-size:.81rem;color:#92400e;line-height:1.45;
    }
    .tender-warn.danger { background:#fef2f2;border-color:#fecaca;color:#b91c1c; }
    .tender-progress-bar {
      height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:.5rem;
    }
    .tender-progress-fill {
      height:100%;background:linear-gradient(90deg,#b45309,#d97706);
      border-radius:3px;transition:width .4s ease;
    }
    .tender-level-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem; }
    .tender-level-btn {
      display:flex;flex-direction:column;align-items:flex-start;gap:.15rem;
      border:1.5px solid #d1d5db;background:#fff;border-radius:9px;
      padding:.55rem .75rem;cursor:pointer;font-family:Heebo,sans-serif;
      text-align:right;transition:.12s;
    }
    .tender-level-btn:hover { border-color:#d97706; }
    .tender-level-btn.selected {
      border-color:#d97706;background:#fffbeb;box-shadow:0 0 0 1px #d97706;
    }
    .tender-level-btn .lvl-name { font-size:.86rem;font-weight:700;color:#1e293b; }
    .tender-level-btn .lvl-desc { font-size:.72rem;color:#64748b;line-height:1.35; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'tender-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:900;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:700px;width:calc(100% - 2rem);max-height:93vh;direction:rtl;box-shadow:0 24px 64px rgba(0,0,0,.35);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;display:flex;align-items:center;gap:.4rem;">📝 כותב המכרזים — עבודה על מכרז</h3>
          <p style="margin:0;color:#64748b;font-size:.82rem;">העלה חומרי רקע, תן הנחיה, בחר רמת עיבוד — קבל מסמך מכרז מלא</p>
        </div>
        <button onclick="window.closeTenderModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>
      <div id="tender-body" style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:.9rem;"></div>
      <div id="tender-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeTenderModal(); });
  document.body.appendChild(modal);
}

// ── Open / Close ───────────────────────────────────────────────────────────
window.openTenderModal = function () {
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
  selectedLevel = 'auto';
  lastInstruction = '';
  document.getElementById('tender-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showPhasePick();
};

window.closeTenderModal = function () {
  document.getElementById('tender-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ── Phase 1: pick files + instruction + level ──────────────────────────────
function showPhasePick() {
  setBody(`
    <!-- Drop zone -->
    <label id="tender-drop" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1rem;text-align:center;cursor:pointer;background:#fafbfc;transition:.15s;">
      <input type="file" id="tender-file-input" multiple hidden />
      <div id="tender-drop-label" style="font-size:.88rem;color:#475569;">
        <span style="font-size:1.8rem;display:block;margin-bottom:.3rem;">📂</span>
        לחץ לבחירת קבצים או גרור לכאן<br>
        <span style="font-size:.76rem;color:#94a3b8;">אפיונים, דרישות, מסמכי רקע, מכרזים קודמים — DOCX, PDF, Excel ועוד (למעט EXE)</span>
      </div>
    </label>

    <!-- File tags -->
    <div id="tender-file-list" style="display:flex;flex-wrap:wrap;gap:.4rem;min-height:0;"></div>

    <!-- Warnings -->
    <div id="tender-warnings"></div>

    <!-- Instruction -->
    <div>
      <label style="font-size:.83rem;font-weight:600;color:#374151;display:block;margin-bottom:.3rem;">
        📝 הנחיה — מה המכרז צריך להשיג
        <span style="font-weight:400;color:#94a3b8;">(רשות אם הועלו קבצים)</span>
      </label>
      <textarea id="tender-instruction" rows="3" placeholder="לדוגמה: מכרז להקמת מערכת ניהול פניות ציבור עבור רשות מקומית. דגש על SLA מחמיר, אבטחת מידע ותחזוקה ל-5 שנים."
        style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:.55rem .7rem;font-family:Heebo,sans-serif;font-size:.85rem;resize:vertical;color:#1e293b;background:#fff;direction:rtl;line-height:1.5;"></textarea>
    </div>

    <!-- Processing level -->
    <div>
      <label style="font-size:.83rem;font-weight:600;color:#374151;display:block;margin-bottom:.35rem;">
        ⚙️ רמת עיבוד
      </label>
      <div class="tender-level-grid" id="tender-level-grid">
        ${Object.entries(LEVELS).map(([key, lvl]) => `
          <button type="button" class="tender-level-btn${key === selectedLevel ? ' selected' : ''}" data-level="${key}" onclick="window.tenderSetLevel('${key}')">
            <span class="lvl-name">${lvl.icon} ${lvl.label}</span>
            <span class="lvl-desc">${lvl.desc}</span>
          </button>`).join('')}
      </div>
    </div>

    <!-- How it works -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:.75rem 1rem;font-size:.79rem;color:#475569;line-height:1.55;">
      <strong style="color:#334155;">איך זה עובד:</strong><br>
      📥 <strong>קבלה:</strong> עד ${MAX_FILES} קבצים — אפיונים, דרישות, פרוטוקולים, מכרזים לדוגמה.<br>
      🔍 <strong>קריאה 1 — כיול:</strong> הסוכן קורא את החומרים ומזהה: כתיבת מכרז חדש או עדכון מכרז קיים.<br>
      ⚙️ <strong>מכרז חדש:</strong> כתיבת פרקים לפי רמת העיבוד — דרישות, קריטריוני הערכה, SLA, תנאים חוזיים.<br>
      🔁 <strong>עדכון מכרז קיים:</strong> המסמך מעובד קטע-אחר-קטע בשלמותו — שום תוכן לא הולך לאיבוד; מספר הקריאות נקבע לפי גודל המסמך (רמת עיבוד גבוהה = קטעים קטנים ויסודיים יותר).<br>
      📤 <strong>פלט:</strong> מסמך Word (.doc) בעברית, במבנה ובפורמט המקוריים.
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeTenderModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button id="tender-run-btn" onclick="window.runTenderWriter()" disabled
        style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(217,119,6,.35);opacity:.55;">
        📝 עבוד על המכרז
      </button>
    </div>`);

  wireFileInput();
  const instr = document.getElementById('tender-instruction');
  if (instr) instr.addEventListener('input', updateRunBtn);
}

window.tenderSetLevel = function (key) {
  if (!LEVELS[key]) return;
  selectedLevel = key;
  document.querySelectorAll('#tender-level-grid .tender-level-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.level === key);
  });
};

function updateRunBtn() {
  const btn = document.getElementById('tender-run-btn');
  if (!btn) return;
  const instr = document.getElementById('tender-instruction');
  const ready = pickedFiles.length > 0 || (instr && instr.value.trim().length > 0);
  btn.disabled = !ready;
  btn.style.opacity = ready ? '1' : '.55';
}

function wireFileInput() {
  const input = document.getElementById('tender-file-input');
  const drop  = document.getElementById('tender-drop');
  if (!input || !drop) return;

  input.addEventListener('change', async () => {
    await addFiles(Array.from(input.files || []));
    input.value = '';
  });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = '#fffbeb'; });
  drop.addEventListener('dragleave', () => { drop.style.background = '#fafbfc'; });
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    drop.style.background = '#fafbfc';
    await addFiles(Array.from(e.dataTransfer.files || []));
  });
}

async function addFiles(rawFiles) {
  if (!rawFiles.length) return;
  const dropLabel = document.getElementById('tender-drop-label');
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
      const parsed = await readTenderFile(f);
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
  updateRunBtn();
}

function renderFileTags() {
  const container = document.getElementById('tender-file-list');
  if (!container) return;
  if (!pickedFiles.length) { container.innerHTML = ''; return; }
  container.innerHTML = pickedFiles.map((f, i) => `
    <div class="tender-file-tag">
      <span>${fileTypeIcon(f.name)}</span>
      <span title="${deps.escHtml(f.name)}">${deps.escHtml(f.name)}</span>
      <button onclick="window.tenderRemoveFile(${i})" title="הסר">✕</button>
    </div>`).join('');
}

window.tenderRemoveFile = function (idx) {
  pickedFiles.splice(idx, 1);
  renderFileTags();
  renderWarnings();
  updateDropLabel();
  updateRunBtn();
};

function updateDropLabel() {
  const el = document.getElementById('tender-drop-label');
  if (!el) return;
  if (pickedFiles.length === 0) {
    el.innerHTML = `<span style="font-size:1.8rem;display:block;margin-bottom:.3rem;">📂</span>
      לחץ לבחירת קבצים או גרור לכאן<br>
      <span style="font-size:.76rem;color:#94a3b8;">אפיונים, דרישות, מסמכי רקע, מכרזים קודמים — DOCX, PDF, Excel ועוד (למעט EXE)</span>`;
  } else {
    el.innerHTML = `<span style="font-size:1.4rem;display:block;margin-bottom:.2rem;">✅</span>
      <strong style="color:#0f766e;">${pickedFiles.length} קבצים נטענו</strong>
      <div style="font-size:.75rem;color:#64748b;margin-top:.15rem;">לחץ להוסיף עוד קבצים</div>`;
  }
}

function renderWarnings() {
  const container = document.getElementById('tender-warnings');
  if (!container) return;
  const warnings = [];

  const binaryFiles = pickedFiles.filter(f => f.binaryWarning);
  if (binaryFiles.length) {
    warnings.push({
      danger: true,
      text: `⚠️ ${binaryFiles.length} קבצים לא זוהו כטקסט או פורמט מוכר: ${binaryFiles.map(f => f.name).join(', ')}.\nהם יועברו כ-base64 — ייתכן שהמודל לא יוכל לקרוא אותם.`
    });
  }

  const totalChars = pickedFiles.reduce((s, f) => s + (f.sizeChars || 0), 0);
  if (totalChars > HEAVY_CHARS) {
    warnings.push({
      danger: true,
      text: `⏱️ היקף חומר גדול מאד (כ-${Math.round(totalChars / 1000)}K תווים). העיבוד עשוי לקחת זמן רב ולצרוך מכסת API משמעותית. שקול להסיר קבצים פחות רלוונטיים.`
    });
  } else if (totalChars > WARN_CHARS) {
    warnings.push({
      danger: false,
      text: `⏳ היקף חומר בינוני–גדול (כ-${Math.round(totalChars / 1000)}K תווים). העיבוד עשוי לקחת מספר דקות.`
    });
  }

  const docFiles = pickedFiles.filter(f => /\.doc$/i.test(f.name));
  if (docFiles.length) {
    warnings.push({
      danger: false,
      text: `📄 קבצי DOC ישנים (לא DOCX) עשויים להיקרא בצורה חלקית. מומלץ להמיר ל-DOCX או PDF לפני העלאה.`
    });
  }

  container.innerHTML = warnings.map(w =>
    `<div class="tender-warn${w.danger ? ' danger' : ''}" style="white-space:pre-line;">${w.text}</div>`
  ).join('');
}

function showModalError(msg) {
  const container = document.getElementById('tender-warnings');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'tender-warn danger';
  el.textContent = '❌ ' + msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── File reading ───────────────────────────────────────────────────────────
async function readTenderFile(file) {
  const ext  = (file.name.split('.').pop() || '').toLowerCase();
  const name = file.name;

  if (ext === 'docx') {
    if (!window.mammoth) throw new Error('mammoth לא נטען');
    const buf = await file.arrayBuffer();
    // HTML conversion keeps headings, numbering, lists and tables — critical
    // for revising an existing tender without destroying its structure
    try {
      const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
      const html = (res.value || '').trim();
      if (html) return { name, text: html, sizeChars: html.length, isInline: false, isHtml: true };
    } catch { /* fall back to raw text below */ }
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

  if (TEXT_EXTS.has(ext) || ext === 'svg') {
    const text = await file.text();
    return { name, text, sizeChars: text.length, isInline: false };
  }

  // unknown — try as text, fallback to base64
  try {
    const text = await file.text();
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
  return '📎';
}

// ── Phase 2: calibration + execution ──────────────────────────────────────
window.runTenderWriter = async function () {
  const instrEl = document.getElementById('tender-instruction');
  const instruction = instrEl ? instrEl.value.trim() : '';
  if (!pickedFiles.length && !instruction) return;
  lastInstruction = instruction;

  const lvl = LEVELS[selectedLevel] || LEVELS.auto;

  phase = 'calibrating';
  outputSections = [];
  totalCallsPlanned = 0;
  runMode = 'write';

  showRunning('🔍 קריאה 1 — כותב המכרזים קורא את החומרים ובונה תוכנית עבודה…', 1, 2);

  let mIdx = deps.getModelIdx();

  // ── Call 1: calibration ────────────────────────────────────────────────
  let calibJson;
  try {
    const calibPrompt = buildCalibrationPrompt(instruction, lvl);
    const calibRaw = await callWithFallback(calibPrompt, mIdx);
    mIdx = deps.getModelIdx();
    calibJson = parseCalibration(calibRaw);
  } catch (err) {
    phase = 'error';
    showError(err.message || String(err)); return;
  }

  calibration = calibJson;

  // ── Mode selection: revise an existing tender vs. write a new one ─────
  let sourceFile = null;
  if (calibration.mode === 'revise') {
    sourceFile = pickedFiles.find(f => f.name === calibration.sourceFileName && !f.isInline && (f.text || '').trim());
    if (!sourceFile) {
      // fallback: the largest text file is almost certainly the tender
      sourceFile = pickedFiles
        .filter(f => !f.isInline && (f.text || '').trim())
        .sort((a, b) => (b.text || '').length - (a.text || '').length)[0] || null;
    }
    if (sourceFile) runMode = 'revise';
  }

  phase = 'running';

  if (runMode === 'revise') {
    // ── Revise mode: rewrite the source tender chunk-by-chunk so nothing
    //    is lost — call count is driven by document size, not by level ────
    const chunks = splitIntoChunks(sourceFile.text, !!sourceFile.isHtml, lvl.chunkChars);
    totalCallsPlanned = 1 + chunks.length;
    for (let i = 0; i < chunks.length; i++) {
      const callNum = i + 2;
      updateRunning(`⚙️ קריאה ${callNum} מתוך ${totalCallsPlanned} — עדכון קטע ${i + 1} מתוך ${chunks.length}…`, callNum, totalCallsPlanned);
      try {
        const prompt = buildReviseChunkPrompt(instruction, calibration, sourceFile, chunks[i], i, chunks.length);
        const result = await callWithFallback(prompt, mIdx);
        mIdx = deps.getModelIdx();
        outputSections.push({ title: `קטע ${i + 1}`, text: cleanModelOutput(result), isHtml: !!sourceFile.isHtml });
      } catch (err) {
        phase = 'error';
        showError(err.message || String(err)); return;
      }
    }
  } else {
    // ── Write mode: one call per planned tender chapter ──────────────────
    const plan = clampWorkPlan(calibration.workPlan || [], lvl);
    calibration.workPlan = plan;
    totalCallsPlanned = 1 + plan.length;
    for (let i = 0; i < plan.length; i++) {
      const callNum = i + 2;
      const section = plan[i];
      updateRunning(`⚙️ קריאה ${callNum} מתוך ${totalCallsPlanned} — ${section.section || 'כתיבת פרק'}…`, callNum, totalCallsPlanned);
      try {
        const execPrompt = buildExecutionPrompt(instruction, calibration, section, i, plan.length);
        const result = await callWithFallback(execPrompt, mIdx);
        mIdx = deps.getModelIdx();
        outputSections.push({ title: section.section || `פרק ${i + 1}`, text: result });
      } catch (err) {
        phase = 'error';
        showError(err.message || String(err)); return;
      }
    }
  }

  phase = 'done';
  downloadTenderDoc();
  showDone();
};

// Split a large document into chunks at block boundaries, so no paragraph,
// heading or table is cut in the middle.
function splitIntoChunks(text, isHtml, target) {
  const chunks = [];
  let cur = '';
  if (isHtml) {
    // split after closing block tags, then re-accumulate up to the target size
    const parts = text.split(/(<\/(?:p|h[1-6]|table|ul|ol|blockquote)>)/gi);
    const blocks = [];
    for (let i = 0; i < parts.length; i += 2) {
      blocks.push(parts[i] + (parts[i + 1] || ''));
    }
    for (const b of blocks) {
      if (cur && cur.length + b.length > target) { chunks.push(cur); cur = ''; }
      cur += b;
    }
  } else {
    for (const p of text.split(/\n\s*\n/)) {
      if (cur && cur.length + p.length > target) { chunks.push(cur); cur = ''; }
      cur += (cur ? '\n\n' : '') + p;
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

function cleanModelOutput(s) {
  return (s || '').trim()
    .replace(/^```(?:html|markdown|md)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

// Clamp the calibration work plan to the level bounds: slice extra sections,
// or merge everything into one section when the level allows a single call.
function clampWorkPlan(plan, lvl) {
  if (!plan.length) {
    return [{ section: 'מסמך המכרז', prompt: 'כתוב את מסמך המכרז המלא לפי ההנחיה והחומרים.' }];
  }
  if (plan.length <= lvl.max) return plan;
  if (lvl.max === 1) {
    return [{
      section: 'מסמך המכרז המלא',
      prompt: 'כתוב מסמך מכרז אחד שלם ותמציתי המכסה את כל הנושאים הבאים:\n' +
        plan.map((p, i) => `${i + 1}. ${p.section}: ${p.prompt}`).join('\n'),
    }];
  }
  // merge the overflow sections into the last allowed one
  const kept = plan.slice(0, lvl.max);
  const overflow = plan.slice(lvl.max);
  kept[lvl.max - 1] = {
    section: kept[lvl.max - 1].section,
    prompt: kept[lvl.max - 1].prompt + '\n\nבנוסף, כלול בפרק זה גם את הנושאים הבאים:\n' +
      overflow.map((p, i) => `${i + 1}. ${p.section}: ${p.prompt}`).join('\n'),
  };
  return kept;
}

// ── Prompt builders ────────────────────────────────────────────────────────
function fileBlocksFor(limit, files = pickedFiles) {
  return files.map(f => {
    if (f.isInline) return `[קובץ: "${f.name}" — מצורף inline]`;
    const t = f.text || '';
    const truncNote = t.length > limit
      ? `\n[... הקובץ נחתך כאן — אורכו המלא ${t.length.toLocaleString()} תווים ...]`
      : '';
    return `=== קובץ: "${f.name}"${f.isHtml ? ' (HTML שחולץ מ-DOCX — המבנה המקורי נשמר)' : ''} ===\n${t.slice(0, limit)}${truncNote}\n=== סוף קובץ ===`;
  }).join('\n\n');
}

function buildCalibrationPrompt(instruction, lvl) {
  const inlineFiles = pickedFiles.filter(f => f.isInline);
  const rangeText = lvl.min === lvl.max
    ? `בדיוק ${lvl.max} קריאת ביצוע אחת — החזר סעיף workPlan אחד בלבד`
    : `בין ${lvl.min} ל-${lvl.max} קריאות ביצוע — החזר ${lvl.min}–${lvl.max} סעיפי workPlan`;

  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש לפרויקטי תוכנה ממשלתיים ועסקיים. עכשיו בשלב הכיול.

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}${pickedFiles.length ? `חומרים שהועלו:\n${fileBlocksFor(25000)}\n` : 'לא הועלו קבצים — עבוד לפי ההנחיה בלבד.\n'}${inlineFiles.length ? `\n[${inlineFiles.length} קבצים מצורפים כ-inline לקריאה ישירה]\n` : ''}
---

רמת העיבוד שנבחרה: "${lvl.label}" — ${rangeText}.

תחילה קבע את מצב העבודה (mode):
- "revise" — אם אחד הקבצים הוא מסמך מכרז קיים והמשימה היא לעדכן/לשנות/לשפר אותו (לפי הנחיית המפעיל או קובץ הנחיות שינוי). במצב זה המסמך יעובד קטע-אחר-קטע בשלמותו — אל תבנה workPlan של פרקים, והשאר אותו ריק. ציין ב-sourceFileName את שם הקובץ המדויק של המכרז הקיים.
- "write" — אם המשימה היא לכתוב מכרז חדש מתוך חומרי רקע.

משימתך בקריאה זו:
1. הבן את הצורך העסקי, היקף הפרויקט וסוג המשימה מתוך החומרים וההנחיה.
2. במצב write — קבע כותרת למכרז ותוכנית פרקים: לכל קריאת ביצוע שם פרק ופרומט מפורט. פרקי מכרז אופייניים: רקע ותיאור הצורך | דרישות פונקציונליות וטכניות | דרישות סף ותנאי השתתפות | קריטריוני הערכה משוקללים | SLA ו-KPIs | תנאים חוזיים, תשלומים ולוחות זמנים. ברמת עיבוד נמוכה — כל אלה בפרק אחד תמציתי; ברמה גבוהה — פרק לכל נושא.
3. במצב revise — ב-internalPrompt סכם במדויק את כל השינויים המבוקשים (מההנחיה ומקבצי הנחיות השינוי), כדי שיוחלו בעקביות על כל קטעי המסמך.
4. רשום שאלות הבהרה שכדאי לברר מול הגורם המזמין, אם יש.

ענה **אך ורק** ב-JSON תקני (ללא גושי קוד, ללא טקסט נלווה):
{
  "understanding": "תיאור קצר של הצורך והמשימה",
  "mode": "write" או "revise",
  "sourceFileName": "במצב revise — שם הקובץ המדויק של המכרז הקיים; אחרת מחרוזת ריקה",
  "tenderTitle": "כותרת מסמך המכרז",
  "internalPrompt": "הנחיות כלליות — סגנון ודגשים; במצב revise: רשימה ממוספרת ומדויקת של כל השינויים המבוקשים",
  "workPlan": [
    { "section": "שם הפרק", "prompt": "מה לכתוב בפרק זה — פירוט מלא" }
  ],
  "questions": ["שאלה 1", "שאלה 2"]
}`;
}

function buildReviseChunkPrompt(instruction, calib, sourceFile, chunk, chunkIdx, totalChunks) {
  const changeFiles = pickedFiles.filter(f => f !== sourceFile && !f.isInline && (f.text || '').trim());
  const fmt = sourceFile.isHtml ? 'HTML' : 'Markdown/טקסט';

  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש. אתה מעדכן מכרז קיים לפי הנחיות שינוי — קטע ${chunkIdx + 1} מתוך ${totalChunks}.

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}השינויים המבוקשים כפי שסיכמת בשלב הכיול:
${calib.internalPrompt || ''}

${changeFiles.length ? `קבצי הנחיות השינוי (במלואם):\n${fileBlocksFor(60000, changeFiles)}\n\n` : ''}לפניך קטע ${chunkIdx + 1} מתוך ${totalChunks} מהמכרז המקורי (פורמט ${fmt}):

<<<תחילת הקטע>>>
${chunk}
<<<סוף הקטע>>>

החזר את הקטע הזה במלואו לאחר החלת השינויים. כללים מחייבים:
1. החל רק את השינויים הרלוונטיים לקטע זה. אם אף שינוי לא נוגע לקטע — החזר אותו כלשונו.
2. כל תוכן שאינו מושפע מהשינויים — החזר מילה במילה, ללא קיצור, סיכום או ניסוח מחדש. אסור להשמיט סעיפים, טבלאות או פרטים.
3. שמור בדיוק על הפורמט המקורי (${fmt}): אותן תגיות/כותרות, אותו מספור סעיפים, אותם מבני טבלאות.
4. אל תוסיף הקדמות, הערות, הסברים או סיכומים — החזר אך ורק את תוכן הקטע המעודכן, ללא גושי קוד.`;
}

function buildExecutionPrompt(instruction, calib, section, sectionIdx, totalSections) {
  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש. עכשיו בשלב הכתיבה (פרק ${sectionIdx + 1} מתוך ${totalSections}).

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}הנחיות כלליות שקבעת לעצמך בשלב הכיול:
${calib.internalPrompt || ''}

הבנתך את הצורך: ${calib.understanding || ''}

הפרק שעליך לכתוב עכשיו (${section.section}):
${section.prompt}

${pickedFiles.length ? `חומרי הגלם:\n${fileBlocksFor(120000)}\n` : ''}
---
עקרונות כתיבה מחייבים:
- לשון מכרז רשמית, ברורה ומדויקת — ללא עמימות. כל דרישה ניתנת לבדיקה.
- כל קריטריון הערכה מדיד ואובייקטיבי, עם משקל מספרי בטבלה משוקללת.
- SLA מגדיר בדיוק: מה נמדד, מתי, מי מודד, מה הסנקציה.
- השתמש בכותרות (## ו-###), סעיפים ממוספרים וטבלאות Markdown לפי הצורך.
- אל תמציא נתונים שאינם בחומרים — במקום נתון חסר כתוב [להשלמה: ___] כדי שהגורם המזמין ימלא.
- כתוב בעברית בלבד, מלבד מונחים טכניים.
כתוב את הפרק במלואו. אל תכתוב פתיח או סיכום מחוץ לפרק.`;
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
    understanding: 'לא הצלחתי לפרסר את הכיול — עובר לכתיבה ישירה',
    mode: 'write',
    sourceFileName: '',
    tenderTitle: 'מסמך מכרז',
    internalPrompt: raw || '',
    workPlan: [{ section: 'מסמך המכרז', prompt: 'כתוב את מסמך המכרז המלא לפי ההנחיה והחומרים.' }],
    questions: [],
  };
}

// ── Document assembly + download ───────────────────────────────────────────
function assembleTenderMarkdown() {
  const ts = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  const title = calibration?.tenderTitle || 'מסמך מכרז';

  let md = `# ${title}\n\n`;
  md += `**תאריך:** ${ts}\n\n`;
  if (lastInstruction) md += `**הנחיה:** ${lastInstruction}\n\n`;
  if (pickedFiles.length) md += `**חומרי רקע:**\n${pickedFiles.map(f => `- ${f.name}`).join('\n')}\n\n`;
  md += `---\n\n`;

  for (const sec of outputSections) {
    md += `## ${sec.title}\n\n${sec.text}\n\n---\n\n`;
  }

  if (calibration?.questions?.length) {
    md += `## שאלות הבהרה לגורם המזמין\n\n`;
    calibration.questions.forEach((q, i) => { md += `${i + 1}. ${q}\n`; });
  }

  return md;
}

function markdownToWordHtml(markdownText, title) {
  let bodyHtml = '';
  if (window.marked) {
    try { bodyHtml = window.marked.parse(markdownText, { breaks: true, gfm: true }); }
    catch { bodyHtml = deps.escHtml(markdownText).replace(/\n/g, '<br>'); }
  } else {
    bodyHtml = deps.escHtml(markdownText).replace(/\n/g, '<br>');
  }
  return wordShell(bodyHtml, title);
}

function wordShell(bodyHtml, title) {
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${deps.escHtml(title)}</title>
  <style>
    body  { font-family: Arial, sans-serif; direction: rtl; font-size: 11pt; margin: 2cm; color: #1a202c; }
    h1    { font-size: 18pt; color: #7c2d12; border-bottom: 2px solid #fed7aa; padding-bottom: 4pt; }
    h2    { font-size: 14pt; color: #9a3412; margin-top: 16pt; }
    h3    { font-size: 12pt; color: #c2410c; }
    hr    { border: none; border-top: 1px solid #e2e8f0; margin: 12pt 0; }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
    td, th { border: 1px solid #cbd5e1; padding: 5pt 8pt; font-size: 10pt; text-align: right; }
    th    { background: #fff7ed; font-weight: bold; }
    code  { font-family: Consolas, monospace; background: #f7fafc; padding: 1pt 4pt; font-size: 10pt; }
    pre   { background: #f7fafc; padding: 8pt; border-radius: 4pt; direction: ltr; }
    ul, ol { padding-right: 20pt; padding-left: 0; }
    li    { margin-bottom: 3pt; }
    strong { color: #2d3748; }
    blockquote { border-right: 3px solid #fed7aa; margin: 0; padding-right: 12pt; color: #4a5568; }
  </style>
</head>
<body dir="rtl">${bodyHtml}</body>
</html>`;
}

function downloadTenderDoc() {
  const title = calibration?.tenderTitle || 'מסמך מכרז';
  let html;
  if (runMode === 'revise') {
    // revised tender: reassemble the chunks as-is — no metadata header, the
    // document keeps its own original title and structure
    if (outputSections[0]?.isHtml) {
      html = wordShell(outputSections.map(s => s.text).join('\n'), title);
    } else {
      html = markdownToWordHtml(outputSections.map(s => s.text).join('\n\n'), title);
    }
  } else {
    html = markdownToWordHtml(assembleTenderMarkdown(), title);
  }
  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tender_${ts}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

window.tenderRedownload = function () {
  if (!outputSections.length) return;
  downloadTenderDoc();
};

// ── API call with fallback ─────────────────────────────────────────────────
async function callWithFallback(prompt, startIdx) {
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
        <div class="tender-spinner" style="width:22px;height:22px;border:3px solid #e2e8f0;border-top-color:#d97706;border-radius:50%;flex-shrink:0;"></div>
        <span id="tender-running-msg">${msg}</span>
      </div>
      <div class="tender-progress-bar">
        <div class="tender-progress-fill" id="tender-prog-fill" style="width:${pct}%;"></div>
      </div>
      <div style="font-size:.78rem;color:#94a3b8;" id="tender-prog-label">קריאה ${current} מתוך ${total || '?'}</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.65rem .85rem;font-size:.8rem;color:#64748b;line-height:1.5;">
        💡 כותב המכרזים עובד — זה עשוי לקחת מספר דקות, בהתאם לרמת העיבוד וכמות החומר.
        לא לסגור את החלון.
      </div>
    </div>`);
  setFooter('');
}

function updateRunning(msg, current, total) {
  const el = document.getElementById('tender-running-msg');
  if (el) el.textContent = msg;
  if (current && total) {
    const fill = document.getElementById('tender-prog-fill');
    const label = document.getElementById('tender-prog-label');
    const pct = Math.round((current / total) * 100);
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = `קריאה ${current} מתוך ${total}`;
  }
}

function showDone() {
  const lvl = LEVELS[selectedLevel] || LEVELS.auto;
  setBody(`
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:1rem;font-weight:700;color:#166534;margin-bottom:.6rem;">✅ המכרז נכתב — הקובץ הורד</div>
      <div style="display:flex;align-items:center;gap:.5rem;font-size:.83rem;color:#15803d;">
        📝 <strong>${deps.escHtml(calibration?.tenderTitle || 'מסמך מכרז')}</strong>
        <span style="color:#6b7280;font-size:.76rem;">.doc</span>
        <button onclick="window.tenderRedownload()"
          style="margin-right:.3rem;font-size:.75rem;padding:.15rem .5rem;background:#dcfce7;border:1px solid #86efac;border-radius:5px;cursor:pointer;color:#166534;font-family:Heebo,sans-serif;">
          ⬇ הורד שוב
        </button>
      </div>
      <div style="margin-top:.5rem;font-size:.8rem;color:#6b7280;">מצב: <strong>${runMode === 'revise' ? 'עדכון מכרז קיים' : 'כתיבת מכרז חדש'}</strong> | רמת עיבוד: <strong>${lvl.label}</strong> | קבצי רקע: <strong>${pickedFiles.length}</strong> | קריאות API: <strong>${totalCallsPlanned}</strong></div>
    </div>
    <div style="font-size:.82rem;color:#475569;line-height:1.5;">
      אם ההורדה נחסמה על ידי הדפדפן — לחץ "הורד שוב".
      שדות שסומנו [להשלמה: ___] דורשים מילוי על ידי הגורם המזמין.
    </div>
    ${calibration?.questions?.length ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:9px;padding:.75rem 1rem;font-size:.82rem;color:#9a3412;">
      <strong>שאלות הבהרה לגורם המזמין:</strong>
      <ol style="margin:.3rem 0 0;padding-right:1.1rem;">
        ${(calibration.questions || []).map(q => `<li>${deps.escHtml(q)}</li>`).join('')}
      </ol>
    </div>` : ''}`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeTenderModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.openTenderModal()" style="padding:.5rem 1.1rem;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">🔄 מכרז חדש</button>
    </div>`);
}

function showError(msg) {
  setBody(`
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">
      ❌ שגיאה: ${deps.escHtml(msg)}
    </div>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;">
      <button onclick="window.closeTenderModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.openTenderModal()" style="padding:.48rem 1rem;background:#d97706;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;">נסה שוב</button>
    </div>`);
}

function setBody(html)   { const el = document.getElementById('tender-body');   if (el) el.innerHTML = html; }
function setFooter(html) { const el = document.getElementById('tender-footer'); if (el) el.innerHTML = html; }
