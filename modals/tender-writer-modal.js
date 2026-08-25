import { deps } from './deps.js';

// ── State ──────────────────────────────────────────────────────────────────
let phase = 'pick'; // 'pick' | 'calibrating' | 'running' | 'done' | 'error'
let pickedFiles = []; // [{ name, text, sizeChars, isInline, mimeType, base64? }]
let calibration = null; // { understanding, tenderTitle, internalPrompt, mode, sourceFileName, workPlan:[{section,prompt}], questions:[] }
let outputSections = []; // accumulated text from execution calls
let totalCallsPlanned = 0;
let selectedLevel = 'auto'; // 'low' | 'normal' | 'high' | 'auto'
let lastInstruction = '';
let runMode = 'write'; // 'write' (new tender from plan) | 'revise' (block-patch update of an existing tender)
let patchStats = null; // revise mode: { blocksTotal, changed, inserted, deleted, segments, fallbackChunks, preserved, retried }
let callsDone = 0;     // API calls completed in the current run (for progress UI)
let cacheState = null;   // active explicit context cache: { name, model }
let cachePayload = null; // { sharedText, inlineParts } — what to (re)create the cache from
let cacheEverUsed = false;
let tenderImages = []; // base64 data URIs extracted from DOCX HTML, restored at assembly

const MAX_FILES = 20;
const WARN_CHARS = 80_000;
const HEAVY_CHARS = 200_000;

const BLOCK_TARGET_CHARS = 1200; // granularity of the ID-tagged blocks in revise mode
// Hebrew tokenizes at roughly 1.5–2 chars/token, so the 1,048,576-token input
// window is ~1.6M chars at best. Total-material caps per call, in chars:
const CAP_CALIBRATION = 400_000; // calibration sees every file truncated
const CAP_MATERIALS   = 700_000; // write mode: raw materials per chapter call
const CAP_CHANGE_DOCS = 250_000; // revise mode: change-instruction files
// Explicit context caching pays off only when the same big context is re-sent
// across 2+ calls and is above the cacheable minimum (~4K tokens on Gemini 3.x)
const CACHE_MIN_CHARS = 20_000;
const CACHE_TTL_SECONDS = 1800;

const BLOCKED_EXTS = new Set(['exe', 'com', 'bat', 'cmd', 'msi', 'scr', 'pif']);
const TEXT_EXTS    = new Set(['txt','md','csv','json','html','htm','xml','yaml','yml','toml','ini','cfg','log','sh','bash','ps1','py','js','ts','jsx','tsx','java','c','cpp','cs','go','rb','php','sql','r','swift','kt','rs','dart','vue','scss','css','less','gitignore','env','conf','properties']);

// Processing levels — bound the execution calls in write mode; in revise mode
// they set the segment size (how much of the tender each patch call sees):
// a higher level means smaller segments, i.e. more calls and a more thorough
// pass. chunkChars is used only by the legacy full-rewrite fallback path.
const LEVELS = {
  low:    { label: 'נמוכה',    icon: '🪶', desc: 'קריאה אחת — מכרז תמציתי וממוקד',          min: 1, max: 1, segmentChars: 350000, chunkChars: 30000 },
  normal: { label: 'רגילה',    icon: '📄', desc: '2–3 קריאות — מסמך מכרז מלא',              min: 2, max: 3, segmentChars: 250000, chunkChars: 20000 },
  high:   { label: 'גבוהה',    icon: '🏛️', desc: '4–6 קריאות — מכרז מעמיק על כל פרקיו',     min: 4, max: 6, segmentChars: 120000, chunkChars: 12000 },
  auto:   { label: 'אוטומטית', icon: '🤖', desc: 'הסוכן קובע לבד לפי היקף החומר (1–6)',      min: 1, max: 6, segmentChars: 250000, chunkChars: 20000 },
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
  tenderImages = [];
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
      🔁 <strong>עדכון מכרז קיים:</strong> המסמך מחולק לבלוקים ממוספרים והמודל מחזיר רק את הבלוקים שהשתנו — כל שאר התוכן מועתק מהמקור אות-באות (חיסכון ניכר בטוקנים, אפס סיכון לאיבוד תוכן). רמת עיבוד גבוהה = קטעי קריאה קטנים ויסודיים יותר.<br>
      💾 <strong>Context Caching:</strong> כשחומר משותף גדול נשלח בכמה קריאות — הוא נשמר במטמון בצד השרת ומחויב במחיר מוזל.<br>
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
      // a file that failed to read is NOT in the run — keep the warning
      // visible so the user doesn't run without noticing
      showModalError(`הקובץ "${f.name}" לא נקרא ולא ייכלל בעיבוד: ${e.message || e}`, true);
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

function showModalError(msg, persist = false) {
  const container = document.getElementById('tender-warnings');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'tender-warn danger';
  el.textContent = '❌ ' + msg;
  container.appendChild(el);
  if (!persist) setTimeout(() => el.remove(), 4000);
}

// ── Inline-image extraction ────────────────────────────────────────────────
// mammoth embeds every DOCX image as a base64 data URI inside the HTML — a
// 45K-word tender with logos/scans can balloon to tens of millions of chars,
// exploding the revise segmentation (hundreds of API calls) and flooding the
// model with unreadable noise. Extract the URIs into tenderImages and leave a
// short placeholder; the placeholders are swapped back at document assembly,
// so the images survive end-to-end without ever passing through the model.
function extractInlineImages(html) {
  return html.replace(/"data:[^"]{200,}"/g, (m) => {
    tenderImages.push(m.slice(1, -1));
    return `"⟦IMG${tenderImages.length - 1}⟧"`;
  });
}

function restoreInlineImages(html) {
  if (!tenderImages.length) return html;
  return html.replace(/⟦IMG(\d+)⟧/g, (m, i) => tenderImages[+i] ?? m);
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
      const html = extractInlineImages((res.value || '').trim());
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
  patchStats = null;
  callsDone = 0;
  cacheState = null;
  cachePayload = null;
  cacheEverUsed = false;

  showRunning('🔍 קריאה 1 — כותב המכרזים קורא את החומרים ובונה תוכנית עבודה…', 1, 2);

  let mIdx = deps.getModelIdx();

  // ── Call 1: calibration (single call — caching never pays off here) ────
  let calibJson;
  try {
    const calibRaw = await callWithFallback((useCache, shrink) => ({ prompt: buildCalibrationPrompt(instruction, lvl, shrink) }), mIdx);
    callsDone = 1;
    calibJson = parseCalibration(calibRaw);

    // Malformed JSON leaves us with a degraded single-chapter plan. One
    // retry with a stern format reminder is far cheaper than letting the
    // whole run proceed on it.
    if (calibJson._parseFailed) {
      totalCallsPlanned++;
      updateRunning('🔁 תשובת הכיול לא הייתה JSON תקין — מנסה שוב…');
      const retryRaw = await callWithFallback((useCache, shrink) => ({
        prompt: buildCalibrationPrompt(instruction, lvl, shrink) +
          '\n\nתזכורת קריטית: בניסיון הקודם הפלט לא היה JSON תקין. החזר אך ורק אובייקט JSON יחיד לפי הסכימה שלמעלה — ללא גושי קוד וללא שום טקסט נוסף.',
      }), deps.getModelIdx());
      callsDone++;
      const retryJson = parseCalibration(retryRaw);
      if (!retryJson._parseFailed) calibJson = retryJson;
    }
  } catch (err) {
    phase = 'error';
    showError(err.message || String(err)); return;
  }

  calibration = calibJson;

  // Still degraded after the retry — this is the user's call, not ours. A
  // silent run here produces a document they have no reason to distrust.
  if (calibration._parseFailed && !confirm(
    'שלב הכיול נכשל פעמיים — המודל לא החזיר תוכנית עבודה תקינה.\n\n' +
    'אפשר להמשיך, אבל המכרז ייכתב בקריאה אחת גנרית ואיכותו תהיה נמוכה משמעותית.\n' +
    'לרוב עדיף לבטל, לחדד את ההנחיה ולנסות שוב.\n\n' +
    'להמשיך בכל זאת?'
  )) {
    phase = 'pick';
    showPhasePick();
    return;
  }

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

  try {
    if (runMode === 'revise') {
      await runReviseFlow(instruction, lvl, sourceFile);
    } else {
      await runWriteFlow(instruction, lvl);
    }
  } catch (err) {
    dropTenderCache();
    phase = 'error';
    // Anything already written is real work the user paid for — offer it
    // rather than discarding the run.
    showError(err.message || String(err), { partial: true });
    return;
  }

  dropTenderCache();
  phase = 'done';
  downloadTenderDoc();
  showDone();
};

// Resume a write-mode run that died partway: the calibration is still in
// memory, so only the unwritten chapters are re-requested. Charging the user
// for a second calibration to recover from our own failure is not acceptable.
window.tenderResume = async function () {
  if (runMode !== 'write' || !calibration?.workPlan?.length) return;
  const plan = calibration.workPlan;
  const doneCount = outputSections.length;
  if (doneCount >= plan.length) return;

  phase = 'running';
  totalCallsPlanned = 1 + plan.length;
  showRunning(`⚙️ ממשיך מפרק ${doneCount + 1} מתוך ${plan.length}…`, callsDone, totalCallsPlanned);

  try {
    let mIdx = deps.getModelIdx();
    for (let i = doneCount; i < plan.length; i++) {
      const section = plan[i];
      updateRunning(`⚙️ קריאה ${callsDone + 1} מתוך ${totalCallsPlanned} — ${section.section || 'כתיבת פרק'}…`, callsDone + 1, totalCallsPlanned);
      const result = await callWithFallback((useCache, shrink) => ({
        prompt: useCache
          ? buildExecutionTaskPrompt(section, i, plan.length)
          : buildExecutionPrompt(lastInstruction, calibration, section, i, plan.length, shrink),
        inlineFile: useCache ? null : (pickedFiles.find(f => f.isInline) || null),
      }), mIdx);
      mIdx = deps.getModelIdx(); callsDone++;
      outputSections.push({ title: section.section || `פרק ${i + 1}`, text: result });
    }
  } catch (err) {
    dropTenderCache();
    phase = 'error';
    showError(err.message || String(err), { partial: true });
    return;
  }

  dropTenderCache();
  phase = 'done';
  downloadTenderDoc();
  showDone();
};

// ── Revise mode: block-addressed patching ──────────────────────────────────
// The tender is split into small ID-tagged blocks and sent (in large segments,
// well within the model's context window) with the change instructions; the
// model returns ONLY the blocks that actually change, as a JSON edit list.
// Every block it doesn't mention is copied byte-for-byte from the source —
// untouched content structurally cannot be summarized or lost, and output
// tokens are paid only for real changes.
async function runReviseFlow(instruction, lvl, sourceFile) {
  const isHtml = !!sourceFile.isHtml;
  const blocks = splitIntoBlocks(sourceFile.text, isHtml);
  const annotated = blocks.map((b, i) => `⟦B${i}⟧\n${b}`);
  const segments = buildSegments(annotated, lvl.segmentChars);

  totalCallsPlanned = 1 + segments.length;
  patchStats = { blocksTotal: blocks.length, changed: 0, inserted: 0, deleted: 0, segments: segments.length, fallbackChunks: 0, preserved: 0, retried: 0 };

  // The change instructions + change files are re-sent with every segment —
  // cache them once when there are several segments and they're big enough
  const sharedText = buildReviseSharedContext(instruction, calibration, sourceFile);
  if (segments.length >= 2 && sharedText.length >= CACHE_MIN_CHARS) {
    cachePayload = { sharedText, inlineParts: [] };
  }

  for (let s = 0; s < segments.length; s++) {
    await patchOneSegment(instruction, lvl, sourceFile, blocks, annotated, segments[s], `${s + 1}/${segments.length}`);
  }
}

// Run the patch protocol on one segment; on a token-window overflow that even
// the material-shrinking retries couldn't cure, bisect the segment and patch
// each half — every level of recursion halves the input until it fits.
async function patchOneSegment(instruction, lvl, sourceFile, blocks, annotated, seg, segLabel) {
  const isHtml = !!sourceFile.isHtml;
  const segText = annotated.slice(seg.start, seg.end).join('\n\n');
  updateRunning(`⚙️ קריאה ${callsDone + 1} מתוך ${totalCallsPlanned} — איתור וכתיבת השינויים בקטע ${segLabel}…`, callsDone + 1, totalCallsPlanned);

  let mIdx = deps.getModelIdx();
  let edits = null;
  try {
    const raw = await callWithFallback((useCache, shrink) => ({
      prompt: buildRevisePatchPrompt(instruction, sourceFile, segText, segLabel, useCache, shrink),
      inlineFile: null,
    }), mIdx);
    mIdx = deps.getModelIdx(); callsDone++;
    edits = parseEdits(raw, seg);

    if (!edits) {
      // malformed JSON — one retry with a stern format reminder
      patchStats.retried++;
      totalCallsPlanned++;
      updateRunning(`🔁 קריאה ${callsDone + 1} מתוך ${totalCallsPlanned} — הפלט לא היה JSON תקין, מנסה שוב…`, callsDone + 1, totalCallsPlanned);
      const raw2 = await callWithFallback((useCache, shrink) => ({
        prompt: buildRevisePatchPrompt(instruction, sourceFile, segText, segLabel, useCache, shrink) +
          '\n\nתזכורת קריטית: בניסיון הקודם הפלט לא היה JSON תקין. החזר אך ורק מערך JSON של פעולות עריכה, ללא גושי קוד וללא שום טקסט נוסף.',
        inlineFile: null,
      }), mIdx);
      mIdx = deps.getModelIdx(); callsDone++;
      edits = parseEdits(raw2, seg);
    }
  } catch (err) {
    if (isTokenLimitError(err.message) && seg.end - seg.start > 1) {
      const mid = seg.start + Math.ceil((seg.end - seg.start) / 2);
      totalCallsPlanned++;
      await patchOneSegment(instruction, lvl, sourceFile, blocks, annotated, { start: seg.start, end: mid }, `${segLabel}·א`);
      await patchOneSegment(instruction, lvl, sourceFile, blocks, annotated, { start: mid, end: seg.end }, `${segLabel}·ב`);
      return;
    }
    throw err;
  }

  if (edits) {
    outputSections.push({ title: `קטע ${segLabel}`, text: applyEditsToSegment(blocks, seg, edits, isHtml), isHtml });
  } else {
    // JSON failed twice — legacy fallback: full rewrite of this segment only
    const out = await legacyReviseSegment(instruction, sourceFile, blocks.slice(seg.start, seg.end).join(''), lvl);
    outputSections.push({ title: `קטע ${segLabel}`, text: out, isHtml });
  }
}

// Legacy full-rewrite path (pre-patch behavior), used only when a segment's
// patch call fails to return valid JSON twice: the segment is re-emitted
// chunk-by-chunk with the anti-summarization safety net.
async function legacyReviseSegment(instruction, sourceFile, segSource, lvl) {
  const chunks = splitIntoChunks(segSource, !!sourceFile.isHtml, lvl.chunkChars);
  totalCallsPlanned += chunks.length;
  patchStats.fallbackChunks += chunks.length;
  let mIdx = deps.getModelIdx();
  const outs = [];
  for (let i = 0; i < chunks.length; i++) {
    updateRunning(`⚙️ קריאה ${callsDone + 1} מתוך ${totalCallsPlanned} — שכתוב מלא של תת-קטע ${i + 1} מתוך ${chunks.length} (מסלול גיבוי)…`, callsDone + 1, totalCallsPlanned);
    const chunk = chunks[i];
    let result = cleanModelOutput(await callWithFallback((useCache, shrink) => ({
      prompt: buildReviseChunkPrompt(instruction, calibration, sourceFile, chunk, i, chunks.length, shrink),
      inlineFile: null, noCache: true,
    }), mIdx));
    mIdx = deps.getModelIdx(); callsDone++;

    // Safety net: models tend to summarize instead of echoing long text.
    // A revised chunk can never legitimately shrink to under half its
    // source — retry once with a sterner reminder, then fall back to the
    // original chunk so content is never lost.
    if (result.length < chunk.length * 0.5) {
      patchStats.retried++;
      totalCallsPlanned++;
      updateRunning(`🔁 קריאה ${callsDone + 1} מתוך ${totalCallsPlanned} — הפלט קצר מדי (${result.length.toLocaleString()} מתוך ${chunk.length.toLocaleString()} תווים), מנסה שוב…`, callsDone + 1, totalCallsPlanned);
      const sternNote = `\n\nתזכורת קריטית: בניסיון הקודם החזרת רק ${result.length} תווים מתוך קטע של ${chunk.length} תווים — זה אומר שסיכמת או השמטת תוכן. החזר את הקטע בשלמותו, מילה במילה, כולל כל הסעיפים והטבלאות. אורך הפלט חייב להיות דומה לאורך הקטע המקורי.`;
      const retry = cleanModelOutput(await callWithFallback((useCache, shrink) => ({
        prompt: buildReviseChunkPrompt(instruction, calibration, sourceFile, chunk, i, chunks.length, shrink) + sternNote,
        inlineFile: null, noCache: true,
      }), mIdx));
      mIdx = deps.getModelIdx(); callsDone++;
      if (retry.length > result.length) result = retry;
    }
    if (result.length < chunk.length * 0.5) {
      // still too short — keep the original chunk untouched
      patchStats.preserved++;
      result = chunk;
    }
    outs.push(result);
  }
  return outs.join(sourceFile.isHtml ? '\n' : '\n\n');
}

// ── Write mode: one call per planned tender chapter ────────────────────────
async function runWriteFlow(instruction, lvl) {
  const plan = clampWorkPlan(calibration.workPlan || [], lvl);
  calibration.workPlan = plan;
  totalCallsPlanned = 1 + plan.length;

  // Every chapter call re-sends the full raw materials (up to 120K chars per
  // file, plus inline PDFs/images) — with 2+ chapters and enough material,
  // cache the shared context once instead of paying for it on every call
  const sharedText = buildWriteSharedContext(instruction, calibration);
  const inlineParts = pickedFiles.filter(f => f.isInline).map(f => ({ inlineData: { mimeType: f.mimeType, data: f.base64 } }));
  const inlineApprox = pickedFiles.filter(f => f.isInline).reduce((s, f) => s + (f.sizeChars || 0), 0);
  if (plan.length >= 2 && sharedText.length + inlineApprox >= CACHE_MIN_CHARS) {
    cachePayload = { sharedText, inlineParts };
  }

  let mIdx = deps.getModelIdx();
  for (let i = 0; i < plan.length; i++) {
    const section = plan[i];
    updateRunning(`⚙️ קריאה ${callsDone + 1} מתוך ${totalCallsPlanned} — ${section.section || 'כתיבת פרק'}…`, callsDone + 1, totalCallsPlanned);
    const result = await callWithFallback((useCache, shrink) => ({
      prompt: useCache
        ? buildExecutionTaskPrompt(section, i, plan.length)
        : buildExecutionPrompt(instruction, calibration, section, i, plan.length, shrink),
      // when the cache is active the materials (including inline files) are
      // already in it — don't re-attach them
      inlineFile: useCache ? null : (pickedFiles.find(f => f.isInline) || null),
    }), mIdx);
    mIdx = deps.getModelIdx(); callsDone++;
    outputSections.push({ title: section.section || `פרק ${i + 1}`, text: result });
  }
}

// Split a document into small blocks at paragraph/tag boundaries, preserving
// the original separators so that blocks.join('') === text exactly. These are
// the addressable units of the revise-mode patch protocol.
function splitIntoBlocks(text, isHtml) {
  const raw = [];
  if (isHtml) {
    const parts = text.split(/(<\/(?:p|h[1-6]|table|ul|ol|blockquote)>)/gi);
    for (let i = 0; i < parts.length; i += 2) {
      const piece = parts[i] + (parts[i + 1] || '');
      if (piece) raw.push(...hardSplit(piece, isHtml));
    }
  } else {
    const parts = text.split(/(\n\s*\n)/);
    for (let i = 0; i < parts.length; i += 2) {
      const piece = parts[i] + (parts[i + 1] || '');
      if (piece) raw.push(...hardSplit(piece, isHtml));
    }
  }
  // group adjacent pieces up to the target size so block IDs stay manageable
  const blocks = [];
  let cur = '';
  for (const p of raw) {
    if (cur && cur.length + p.length > BLOCK_TARGET_CHARS) { blocks.push(cur); cur = ''; }
    cur += p;
  }
  if (cur) blocks.push(cur);
  return blocks.length ? blocks : [text];
}

// A single natural piece can be enormous — e.g. a DOCX whose whole body is one
// giant <table> yields no closing-tag boundaries and would ride into one API
// call whole, blowing the input-token window. Slice such pieces at the best
// soft boundary available (between tags / at a newline), or at a fixed offset
// as a last resort. Consecutive slices concatenate back losslessly.
function hardSplit(piece, isHtml) {
  const hardMax = BLOCK_TARGET_CHARS * 4;
  if (piece.length <= hardMax) return [piece];
  const out = [];
  let rest = piece;
  while (rest.length > hardMax) {
    const window = rest.slice(0, hardMax);
    let cut = isHtml ? window.lastIndexOf('><') + 1 : window.lastIndexOf('\n') + 1;
    if (cut <= hardMax / 2) cut = hardMax;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

// Group annotated blocks into segments of up to `target` chars — each segment
// is one patch call. Returns [{ start, end }] with `end` exclusive.
function buildSegments(annotated, target) {
  const segs = [];
  let start = 0, size = 0;
  for (let i = 0; i < annotated.length; i++) {
    const len = annotated[i].length + 2;
    if (i > start && size + len > target) { segs.push({ start, end: i }); start = i; size = 0; }
    size += len;
  }
  segs.push({ start, end: annotated.length });
  return segs;
}

// Parse the model's JSON edit list. Returns a validated array (possibly empty
// — a segment with no relevant changes), or null when the output isn't JSON.
function parseEdits(raw, seg) {
  let s = cleanModelOutput(raw || '');
  let arr = null;
  try { arr = JSON.parse(s); } catch { /* fall through */ }
  if (!Array.isArray(arr)) {
    const first = s.indexOf('['), last = s.lastIndexOf(']');
    if (first !== -1 && last > first) {
      try { arr = JSON.parse(s.slice(first, last + 1)); } catch { /* ignore */ }
    }
  }
  if (!Array.isArray(arr)) return null;
  return arr
    .map(e => e && typeof e === 'object' ? { ...e, id: Number(e.id) } : null)
    .filter(e => e && Number.isInteger(e.id) && e.id >= seg.start && e.id < seg.end &&
      (e.op === 'delete' || ((e.op === 'replace' || e.op === 'insert_after') && typeof e.text === 'string')));
}

// Rebuild a segment: unmentioned blocks are copied verbatim from the source;
// replaced/inserted blocks keep the original block separators intact.
function applyEditsToSegment(blocks, seg, edits, isHtml) {
  const repl = new Map(), del = new Set(), ins = new Map();
  for (const e of edits) {
    if (e.op === 'replace') repl.set(e.id, e.text);
    else if (e.op === 'delete') del.add(e.id);
    else if (e.op === 'insert_after') ins.set(e.id, (ins.get(e.id) || []).concat(e.text));
  }
  let out = '';
  for (let i = seg.start; i < seg.end; i++) {
    if (del.has(i)) {
      patchStats.deleted++;
    } else if (repl.has(i)) {
      patchStats.changed++;
      out += withBlockTail(blocks[i], repl.get(i), isHtml);
    } else {
      out += blocks[i];
    }
    if (ins.has(i)) {
      for (const t of ins.get(i)) {
        patchStats.inserted++;
        out += withBlockTail('', t, isHtml);
      }
    }
  }
  return out;
}

function withBlockTail(orig, text, isHtml) {
  const tail = (orig.match(/\s+$/) || [''])[0] || (isHtml ? '\n' : '\n\n');
  return (text || '').replace(/\s+$/, '') + tail;
}

// Split a large document into chunks at block boundaries, so no paragraph,
// heading or table is cut in the middle. Used only by the legacy fallback
// path of revise mode (when the patch protocol fails to produce valid JSON).
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
    .replace(/^```(?:html|markdown|md|json)?\s*\n?/i, '')
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
// limit — max chars per file; totalCap — max chars for all files combined
// (the per-file limit is reduced so the sum stays inside the model's input
// window); shrink — halves the caps per step, driven by the token-limit
// retry in callWithFallback.
function fileBlocksFor(limit, files = pickedFiles, totalCap = 0, shrink = 0) {
  const div = 2 ** shrink;
  let eff = Math.floor(limit / div);
  const textFileCount = files.filter(f => !f.isInline).length;
  if (totalCap && textFileCount) {
    eff = Math.min(eff, Math.max(8000, Math.floor(totalCap / div / textFileCount)));
  }
  return files.map(f => {
    if (f.isInline) return `[קובץ: "${f.name}" — מצורף inline]`;
    const t = f.text || '';
    const truncNote = t.length > eff
      ? `\n[... הקובץ נחתך כאן — אורכו המלא ${t.length.toLocaleString()} תווים ...]`
      : '';
    return `=== קובץ: "${f.name}"${f.isHtml ? ' (HTML שחולץ מ-DOCX — המבנה המקורי נשמר)' : ''} ===\n${t.slice(0, eff)}${truncNote}\n=== סוף קובץ ===`;
  }).join('\n\n');
}

function buildCalibrationPrompt(instruction, lvl, shrink = 0) {
  const inlineFiles = pickedFiles.filter(f => f.isInline);
  const rangeText = lvl.min === lvl.max
    ? `בדיוק ${lvl.max} קריאת ביצוע אחת — החזר סעיף workPlan אחד בלבד`
    : `בין ${lvl.min} ל-${lvl.max} קריאות ביצוע — החזר ${lvl.min}–${lvl.max} סעיפי workPlan`;

  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש לפרויקטי תוכנה ממשלתיים ועסקיים. עכשיו בשלב הכיול.

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}${pickedFiles.length ? `חומרים שהועלו:\n${fileBlocksFor(25000, pickedFiles, CAP_CALIBRATION, shrink)}\n` : 'לא הועלו קבצים — עבוד לפי ההנחיה בלבד.\n'}${inlineFiles.length ? `\n[${inlineFiles.length} קבצים מצורפים כ-inline לקריאה ישירה]\n` : ''}
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

// Shared context for revise mode — everything that repeats across all patch
// calls (the change instructions and change files). Sent once when cached,
// or prepended to every patch prompt when not.
function buildReviseSharedContext(instruction, calib, sourceFile, shrink = 0) {
  const changeFiles = pickedFiles.filter(f => f !== sourceFile && !f.isInline && (f.text || '').trim());
  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש. אתה מעדכן מכרז קיים לפי הנחיות שינוי. המסמך חולק לבלוקים ממוספרים; בכל קריאה תקבל קטע מהמסמך ותחזיר רשימת עריכות JSON — רק לבלוקים שהשינויים חלים עליהם.

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}השינויים המבוקשים כפי שסיכמת בשלב הכיול:
${calib.internalPrompt || ''}

${changeFiles.length ? `קבצי הנחיות השינוי (במלואם):\n${fileBlocksFor(60000, changeFiles, CAP_CHANGE_DOCS, shrink)}\n` : ''}`;
}

function buildRevisePatchPrompt(instruction, sourceFile, segText, segLabel, useCache, shrink = 0) {
  const fmt = sourceFile.isHtml ? 'HTML' : 'Markdown/טקסט';
  return `${useCache ? 'ההקשר המשותף (הנחיות השינוי וקבצי השינוי) כבר נמסר לך למעלה.' : buildReviseSharedContext(instruction, calibration, sourceFile, shrink)}

לפניך קטע ${segLabel} מהמכרז המקורי (פורמט ${fmt}). כל בלוק פותח בשורת סימון ⟦B<מספר>⟧ — הסימון אינו חלק מתוכן המסמך:

<<<תחילת הקטע>>>
${segText}
<<<סוף הקטע>>>

משימתך: אתר את הבלוקים שהשינויים המבוקשים חלים עליהם, והחזר **אך ורק** JSON תקני — מערך של פעולות עריכה (ללא גושי קוד, ללא טקסט נלווה):
[
  { "id": 12, "op": "replace", "text": "תוכן הבלוק המעודכן במלואו" },
  { "id": 30, "op": "delete" },
  { "id": 7,  "op": "insert_after", "text": "בלוק חדש שייכנס מיד אחרי בלוק 7" }
]

כללים מחייבים:
1. כלול אך ורק בלוקים שהשינויים המבוקשים באמת משנים. כל בלוק שלא תזכיר יועתק מהמסמך המקורי אות-באות — לכן אין לכלול בלוקים ללא שינוי, ואסור "לשפר ניסוח" בבלוק שלא התבקש בו שינוי.
2. ב-"text" החזר את תוכן הבלוק המלא לאחר השינוי, באותו פורמט (${fmt}) ובאותו סגנון — ללא שורת הסימון ⟦B⟧.
3. שמור על מספור סעיפים, מבני טבלאות וכותרות כפי שהם במסמך המקורי.
4. "id" חייב להיות מספר מתוך סימוני הבלוקים שבקטע זה בלבד.
5. מצייני ⟦IMG<מספר>⟧ מייצגים תמונות מוטמעות — אם בלוק עם מציין כזה משתנה, השאר את המציין במקומו כלשונו.
6. אם אף שינוי אינו נוגע לקטע זה — החזר [].`;
}

// Shared context for write mode — instruction, calibration and the full raw
// materials that otherwise get re-sent with every chapter call.
function buildWriteSharedContext(instruction, calib) {
  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש. לפניך ההקשר המשותף לכל פרקי המכרז; בכל אחת מהקריאות הבאות תתבקש לכתוב פרק אחד על בסיס הקשר זה.

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}הנחיות כלליות שקבעת לעצמך בשלב הכיול:
${calib.internalPrompt || ''}

הבנתך את הצורך: ${calib.understanding || ''}

${pickedFiles.length ? `חומרי הגלם:\n${fileBlocksFor(120000, pickedFiles, CAP_MATERIALS)}\n` : ''}`;
}

// Chapter task sent when the shared context is already in the server-side
// cache — only the section-specific part travels with the call.
function buildExecutionTaskPrompt(section, sectionIdx, totalSections) {
  return `על בסיס ההקשר המשותף שנמסר לך למעלה (ההנחיות וחומרי הגלם), כתוב עכשיו את פרק ${sectionIdx + 1} מתוך ${totalSections} של מסמך המכרז (${section.section}):
${section.prompt}

${WRITING_PRINCIPLES}`;
}

const WRITING_PRINCIPLES = `עקרונות כתיבה מחייבים:
- לשון מכרז רשמית, ברורה ומדויקת — ללא עמימות. כל דרישה ניתנת לבדיקה.
- כל קריטריון הערכה מדיד ואובייקטיבי, עם משקל מספרי בטבלה משוקללת.
- SLA מגדיר בדיוק: מה נמדד, מתי, מי מודד, מה הסנקציה.
- השתמש בכותרות (## ו-###), סעיפים ממוספרים וטבלאות Markdown לפי הצורך.
- אל תמציא נתונים שאינם בחומרים — במקום נתון חסר כתוב [להשלמה: ___] כדי שהגורם המזמין ימלא.
- כתוב בעברית בלבד, מלבד מונחים טכניים.
כתוב את הפרק במלואו. אל תכתוב פתיח או סיכום מחוץ לפרק.`;

function buildReviseChunkPrompt(instruction, calib, sourceFile, chunk, chunkIdx, totalChunks, shrink = 0) {
  const changeFiles = pickedFiles.filter(f => f !== sourceFile && !f.isInline && (f.text || '').trim());
  const fmt = sourceFile.isHtml ? 'HTML' : 'Markdown/טקסט';

  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש. אתה מעדכן מכרז קיים לפי הנחיות שינוי — קטע ${chunkIdx + 1} מתוך ${totalChunks}.

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}השינויים המבוקשים כפי שסיכמת בשלב הכיול:
${calib.internalPrompt || ''}

${changeFiles.length ? `קבצי הנחיות השינוי (במלואם):\n${fileBlocksFor(60000, changeFiles, CAP_CHANGE_DOCS, shrink)}\n\n` : ''}לפניך קטע ${chunkIdx + 1} מתוך ${totalChunks} מהמכרז המקורי (פורמט ${fmt}):

<<<תחילת הקטע>>>
${chunk}
<<<סוף הקטע>>>

החזר את הקטע הזה במלואו לאחר החלת השינויים. כללים מחייבים:
1. החל רק את השינויים הרלוונטיים לקטע זה. אם אף שינוי לא נוגע לקטע — החזר אותו כלשונו.
2. כל תוכן שאינו מושפע מהשינויים — החזר מילה במילה, ללא קיצור, סיכום או ניסוח מחדש. אסור להשמיט סעיפים, טבלאות או פרטים.
3. שמור בדיוק על הפורמט המקורי (${fmt}): אותן תגיות/כותרות, אותו מספור סעיפים, אותם מבני טבלאות.
4. אל תוסיף הקדמות, הערות, הסברים או סיכומים — החזר אך ורק את תוכן הקטע המעודכן, ללא גושי קוד.`;
}

function buildExecutionPrompt(instruction, calib, section, sectionIdx, totalSections, shrink = 0) {
  return `אתה "כותב המכרזים" — מומחה לניסוח מסמכי מכרז (RFP) ורכש. עכשיו בשלב הכתיבה (פרק ${sectionIdx + 1} מתוך ${totalSections}).

${instruction ? `הנחיית המפעיל:\n"${instruction}"\n\n` : ''}הנחיות כלליות שקבעת לעצמך בשלב הכיול:
${calib.internalPrompt || ''}

הבנתך את הצורך: ${calib.understanding || ''}

הפרק שעליך לכתוב עכשיו (${section.section}):
${section.prompt}

${pickedFiles.length ? `חומרי הגלם:\n${fileBlocksFor(120000, pickedFiles, CAP_MATERIALS, shrink)}\n` : ''}
---
${WRITING_PRINCIPLES}`;
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
  // Degraded plan. _parseFailed is what the caller checks — without it this
  // fallback is indistinguishable from a real calibration, and the run
  // silently produces a weak single-chapter document.
  return {
    _parseFailed: true,
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
  if (runMode === 'revise' && outputSections[0]?.isHtml) {
    // revised tender: reassemble the blocks as-is — no metadata header, the
    // document keeps its own original title and structure — and put the
    // extracted images back into their src attributes
    html = restoreInlineImages(wordShell(outputSections.map(s => s.text).join('\n'), title));
  } else {
    const md = runMode === 'revise'
      ? outputSections.map(s => s.text).join('\n\n')
      : assembleTenderMarkdown();
    // in markdown output an image placeholder has no src attribute to return
    // to — drop any that leaked in rather than paste raw base64 as text
    html = markdownToWordHtml(md.replace(/⟦IMG\d+⟧/g, ''), title);
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

// ── Explicit context caching (Gemini cachedContents API) ──────────────────
// An explicit cache holds the run's shared context (raw materials / change
// instructions) server-side, so repeated calls pay the discounted cached-token
// rate instead of full input price. A cache is bound to one exact model, so a
// fallback model switch invalidates it and it's recreated on the new model.
async function createTenderCache(model, payload) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${encodeURIComponent(deps.getApiKey())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${model}`,
        displayName: 'tender-writer-shared-context',
        contents: [{ role: 'user', parts: [{ text: payload.sharedText }, ...(payload.inlineParts || [])] }],
        ttl: `${CACHE_TTL_SECONDS}s`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.name ? { name: data.name, model } : null;
  } catch {
    return null;
  }
}

async function ensureCacheFor(mIdx) {
  if (!cachePayload) return false;
  const model = deps.MODEL_CHAIN[mIdx];
  if (cacheState && cacheState.model === model) return true;
  if (cacheState) dropTenderCache(); // model switched — the old cache is unusable
  cacheState = await createTenderCache(model, cachePayload);
  if (cacheState) cacheEverUsed = true;
  else cachePayload = null; // creation failed (e.g. below minimum) — run inline
  return !!cacheState;
}

function dropTenderCache() {
  if (!cacheState) return;
  const name = cacheState.name;
  cacheState = null;
  // best-effort delete so the cache doesn't accrue storage cost until TTL
  fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${encodeURIComponent(deps.getApiKey())}`, { method: 'DELETE' }).catch(() => {});
}

// ── API call with fallback ─────────────────────────────────────────────────
// buildRequest(useCache, shrink) → { prompt, inlineFile?, noCache? }. It's a
// factory (not a fixed prompt) because the prompt depends on runtime state:
// whether the shared context rides in the server-side cache or must be
// inlined (a quota fallback switches models mid-run and invalidates the
// cache), and how much material fits (shrink grows when the model rejects
// the input as exceeding its token window — each step halves the file caps).
function isTokenLimitError(msg) {
  return /token count exceeds|exceeds the maximum number of (?:input )?tokens/i.test(msg || '');
}

async function callWithFallback(buildRequest, startIdx) {
  let mIdx = startIdx;
  let shrink = 0;
  while (true) {
    const probe = buildRequest(false, shrink);
    // once we're shrinking, the oversized shared context must not ride along
    // via the cache either — build fully inline with the reduced caps
    const cacheActive = (probe.noCache || shrink > 0) ? false : await ensureCacheFor(mIdx);
    const req = cacheActive ? buildRequest(true, shrink) : probe;
    const inlineFile = 'inlineFile' in req ? req.inlineFile : (pickedFiles.find(f => f.isInline) || null);
    const opts = cacheActive ? { cachedContent: cacheState.name } : {};
    try {
      return await deps.callGeminiForSpec(req.prompt, mIdx, inlineFile, opts);
    } catch (err) {
      const msg = err.message || '';
      // input too large — retry with progressively less material per file
      if (isTokenLimitError(msg) && shrink < 3) {
        shrink++;
        if (cacheState) { dropTenderCache(); cachePayload = null; }
        updateRunning(`⚠️ ההקשר גדול מדי למודל — מצמצם את היקף החומר ומנסה שוב (${shrink}/3)…`);
        continue;
      }
      // an expired/invalid cache is recoverable — retry without it
      if (cacheActive && /cach/i.test(msg)) {
        dropTenderCache();
        cachePayload = null;
        continue;
      }
      const quota = /quota|exceeded|free_tier/i.test(msg);
      const busy  = /503|high demand|overload|429/i.test(msg);
      if ((quota || busy) && !isTokenLimitError(msg) && mIdx < deps.MODEL_CHAIN.length - 1) {
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
  const outChars = outputSections.reduce((s, x) => s + (x.text || '').length, 0);
  const srcChars = pickedFiles.reduce((s, f) => s + (f.isInline ? 0 : (f.text || '').length), 0);
  const cacheNote = cacheEverUsed ? ' | Context Caching: <strong>פעיל 💾</strong>' : '';
  const statsLine = runMode === 'revise' && patchStats
    ? `<div style="margin-top:.25rem;font-size:.8rem;color:#6b7280;">היקף המקור: <strong>${Math.round(srcChars / 1000)}K תווים</strong> | היקף הפלט: <strong>${Math.round(outChars / 1000)}K תווים</strong> | בלוקים: <strong>${patchStats.changed} עודכנו${patchStats.inserted ? `, ${patchStats.inserted} נוספו` : ''}${patchStats.deleted ? `, ${patchStats.deleted} נמחקו` : ''} מתוך ${patchStats.blocksTotal}</strong> — השאר הועתקו מהמקור ללא עלות פלט${patchStats.fallbackChunks ? ` | מסלול גיבוי (שכתוב מלא): <strong>${patchStats.fallbackChunks} תת-קטעים</strong>${patchStats.preserved ? ` (${patchStats.preserved} נשמרו במקור לאחר פלט חסר)` : ''}` : ''}${cacheNote}</div>`
    : `<div style="margin-top:.25rem;font-size:.8rem;color:#6b7280;">היקף הפלט: <strong>${Math.round(outChars / 1000)}K תווים</strong>${cacheNote}</div>`;
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
      ${statsLine}
    </div>
    ${calibration?._parseFailed ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:.75rem 1rem;font-size:.82rem;color:#92400e;line-height:1.55;">
      ⚠️ <strong>שלב הכיול נכשל בריצה הזו</strong> — המכרז נכתב במסלול גנרי מצומצם,
      ללא תוכנית פרקים. מומלץ לחדד את ההנחיה ולהריץ שוב.
    </div>` : ''}
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

function showError(msg, { partial = false } = {}) {
  const written = partial ? outputSections.length : 0;
  const planned = calibration?.workPlan?.length || 0;
  const canResume = runMode === 'write' && written > 0 && planned > written;

  setBody(`
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">
      ❌ שגיאה: ${deps.escHtml(msg)}
    </div>
    ${written ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:.8rem 1rem;font-size:.83rem;color:#92400e;line-height:1.55;">
      <strong>${written} ${written === 1 ? 'פרק נכתב' : 'פרקים נכתבו'} לפני התקלה${planned ? ` (מתוך ${planned})` : ''}</strong> —
      אפשר להוריד אותם עכשיו${canResume ? ', או להמשיך מהפרק שנכשל בלי לשלם שוב על הכיול' : ''}.
      <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap;">
        <button onclick="window.tenderRedownload()"
          style="padding:.35rem .8rem;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;cursor:pointer;font-size:.8rem;font-family:Heebo,sans-serif;color:#92400e;font-weight:600;">
          ⬇ הורד את מה שנכתב
        </button>
        ${canResume ? `
        <button onclick="window.tenderResume()"
          style="padding:.35rem .8rem;background:#d97706;border:none;border-radius:6px;cursor:pointer;font-size:.8rem;font-family:Heebo,sans-serif;color:#fff;font-weight:600;">
          🔄 המשך מפרק ${written + 1}
        </button>` : ''}
      </div>
    </div>` : ''}`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;">
      <button onclick="window.closeTenderModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.openTenderModal()" style="padding:.48rem 1rem;background:#d97706;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;">התחל מחדש</button>
    </div>`);
}

function setBody(html)   { const el = document.getElementById('tender-body');   if (el) el.innerHTML = html; }
function setFooter(html) { const el = document.getElementById('tender-footer'); if (el) el.innerHTML = html; }
