import { deps } from './deps.js';

// ── State ────────────────────────────────────────────────────────────────
let phase = 'pick'; // 'pick' | 'calibrating' | 'preliminary' | 'running' | 'done' | 'error'
let pickedFiles = []; // [{ name, text, sizeChars, isInline, mimeType, base64? }]
let calibration = null; // { understanding, preliminaryQuestions: [{ question, why }] }
let answers = {}; // { [questionIdx]: answerText }
let result = null; // final assembled JSON across all execution calls
let lastWb = null; // last built XLSX workbook (for re-download)
let lastBaseName = '';

const MAX_FILES = 20;
const TOTAL_CALLS = 4; // calibration + overview + workbook + extras

const CRITICALITY_OPTIONS = ['Must clarify', 'Should clarify', 'Nice to clarify'];

const BLOCKED_EXTS = new Set(['exe', 'com', 'bat', 'cmd', 'msi', 'scr', 'pif']);
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'html', 'htm', 'xml', 'yaml', 'yml']);

// ── Init ─────────────────────────────────────────────────────────────────
export function initMaturityCheckerModal() {
  injectModal();
}

function injectModal() {
  if (document.getElementById('maturity-modal')) return;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes mtc-spin { to { transform: rotate(360deg); } }
    .mtc-spinner { animation: mtc-spin .75s linear infinite; }
    .mtc-file-tag {
      display:inline-flex;align-items:center;gap:.3rem;background:#f1f5f9;
      border:1px solid #cbd5e1;border-radius:6px;padding:.18rem .5rem .18rem .35rem;
      font-size:.78rem;color:#334155;max-width:220px;
    }
    .mtc-file-tag span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .mtc-file-tag button { background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.85rem;padding:0 .1rem;line-height:1;flex-shrink:0; }
    .mtc-file-tag button:hover { color:#ef4444; }
    .mtc-progress-bar { height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:.5rem; }
    .mtc-progress-fill { height:100%;background:linear-gradient(90deg,#0d9488,#0891b2);border-radius:3px;transition:width .4s ease; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'maturity-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:900;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:720px;width:calc(100% - 2rem);max-height:93vh;direction:rtl;box-shadow:0 24px 64px rgba(0,0,0,.35);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;display:flex;align-items:center;gap:.4rem;">🩺 בודק הבשלות</h3>
          <p style="margin:0;color:#64748b;font-size:.82rem;">בדוק אם מסמכי האפיון בשלים מספיק לפני מעבר לתכנון פתרון</p>
        </div>
        <button onclick="window.closeMaturityModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>
      <div id="mtc-body" style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:.9rem;"></div>
      <div id="mtc-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeMaturityModal(); });
  document.body.appendChild(modal);
}

// ── Open / Close ─────────────────────────────────────────────────────────
window.openMaturityModal = function () {
  if (deps.getIsLoading()) return;
  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }
  phase = 'pick';
  pickedFiles = [];
  calibration = null;
  answers = {};
  result = null;
  document.getElementById('maturity-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showPhasePick();
};

window.closeMaturityModal = function () {
  document.getElementById('maturity-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ── Phase 1: pick files + context ───────────────────────────────────────
function showPhasePick() {
  setBody(`
    <label id="mtc-drop" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1rem;text-align:center;cursor:pointer;background:#fafbfc;transition:.15s;">
      <input type="file" id="mtc-file-input" multiple hidden accept=".docx,.doc,.txt,.md,.pdf,.xls,.xlsx" />
      <div id="mtc-drop-label" style="font-size:.88rem;color:#475569;">
        <span style="font-size:1.8rem;display:block;margin-bottom:.3rem;">📂</span>
        לחץ לבחירת מסמכי אפיון או גרור לכאן<br>
        <span style="font-size:.76rem;color:#94a3b8;">DOCX, DOC, PDF, TXT, MD, XLS/XLSX — עד ${MAX_FILES} קבצים</span>
      </div>
    </label>

    <div id="mtc-file-list" style="display:flex;flex-wrap:wrap;gap:.4rem;min-height:0;"></div>
    <div id="mtc-warnings"></div>

    <div>
      <label style="font-size:.83rem;font-weight:600;color:#374151;display:block;margin-bottom:.3rem;">
        📝 הקשר — מה המטרה של הניתוח? <span style="font-weight:400;color:#94a3b8;">(רשות)</span>
      </label>
      <textarea id="mtc-context" rows="3" placeholder="לדוגמה: אלו מסמכי אפיון לפרויקט ניהול מלאי. רוצים לוודא בשלות עסקית לפני שמתחילים אפיון טכני."
        style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:.55rem .7rem;font-family:Heebo,sans-serif;font-size:.85rem;resize:vertical;color:#1e293b;background:#fff;direction:rtl;line-height:1.5;"></textarea>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:.75rem 1rem;font-size:.79rem;color:#475569;line-height:1.55;">
      <strong style="color:#334155;">איך בודק הבשלות עובד:</strong><br>
      📥 <strong>קבלה:</strong> מסמך אחד או כמה מסמכי אפיון עסקי.<br>
      🔍 <strong>שלב 1:</strong> ניתוח ראשוני ועד 10 שאלות הבהרה קצרות עליך (מטרה, קהל יעד, עומק נדרש).<br>
      ⚙️ <strong>שלב 2:</strong> זיהוי פערים עסקיים, סתירות בין מסמכים, ואלמנטים חסרים — <u>ללא</u> נגיעה בפתרון טכני.<br>
      📤 <strong>פלט:</strong> קובץ Excel מובנה עם שאלות הבהרה עסקיות, ממוינות לפי דומיין ועדיפות, מוכן לשיגור לבעלי עניין.
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeMaturityModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button id="mtc-run-btn" onclick="window.runMaturityCalibration()" disabled
        style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(13,148,136,.35);opacity:.55;">
        🩺 התחל בדיקת בשלות
      </button>
    </div>`);

  wireFileInput();
}

function wireFileInput() {
  const input = document.getElementById('mtc-file-input');
  const drop  = document.getElementById('mtc-drop');
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
  const btn = document.getElementById('mtc-run-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.55'; }

  for (const f of rawFiles) {
    if (pickedFiles.length >= MAX_FILES) { showModalError(`מקסימום ${MAX_FILES} קבצים בו-זמנית.`); break; }
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (BLOCKED_EXTS.has(ext)) { showModalError(`סוג קובץ חסום מטעמי אבטחה: .${ext}`); continue; }
    try {
      const parsed = await readMaturityFile(f);
      if (!pickedFiles.find(x => x.name === parsed.name)) pickedFiles.push(parsed);
    } catch (e) {
      showModalError(`שגיאה בקריאת "${f.name}": ${e.message || e}`);
    }
  }

  renderFileTags();
  updateDropLabel();
  const runBtn = document.getElementById('mtc-run-btn');
  if (runBtn && pickedFiles.length > 0) { runBtn.disabled = false; runBtn.style.opacity = '1'; }
}

function renderFileTags() {
  const container = document.getElementById('mtc-file-list');
  if (!container) return;
  if (!pickedFiles.length) { container.innerHTML = ''; return; }
  container.innerHTML = pickedFiles.map((f, i) => `
    <div class="mtc-file-tag">
      <span title="${deps.escHtml(f.name)}">📄 ${deps.escHtml(f.name)}</span>
      <button onclick="window.mtcRemoveFile(${i})" title="הסר">✕</button>
    </div>`).join('');
}

window.mtcRemoveFile = function (idx) {
  pickedFiles.splice(idx, 1);
  renderFileTags();
  updateDropLabel();
  const btn = document.getElementById('mtc-run-btn');
  if (btn) { btn.disabled = !pickedFiles.length; btn.style.opacity = pickedFiles.length ? '1' : '.55'; }
};

function updateDropLabel() {
  const el = document.getElementById('mtc-drop-label');
  if (!el) return;
  if (pickedFiles.length === 0) {
    el.innerHTML = `<span style="font-size:1.8rem;display:block;margin-bottom:.3rem;">📂</span>
      לחץ לבחירת מסמכי אפיון או גרור לכאן<br>
      <span style="font-size:.76rem;color:#94a3b8;">DOCX, DOC, PDF, TXT, MD, XLS/XLSX — עד ${MAX_FILES} קבצים</span>`;
  } else {
    el.innerHTML = `<span style="font-size:1.4rem;display:block;margin-bottom:.2rem;">✅</span>
      <strong style="color:#0f766e;">${pickedFiles.length} מסמכים נטענו</strong>
      <div style="font-size:.75rem;color:#64748b;margin-top:.15rem;">לחץ להוסיף עוד מסמכים</div>`;
  }
}

function showModalError(msg) {
  const container = document.getElementById('mtc-warnings');
  if (!container) return;
  const el = document.createElement('div');
  el.style.cssText = 'background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:.5rem .75rem;font-size:.8rem;color:#b91c1c;margin-top:.4rem;';
  el.textContent = '❌ ' + msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── File reading ─────────────────────────────────────────────────────────
async function readMaturityFile(file) {
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

  if (TEXT_EXTS.has(ext)) {
    const text = await file.text();
    return { name, text, sizeChars: text.length, isInline: false };
  }

  // unknown — try as text
  const text = await file.text();
  return { name, text: `[קובץ ${ext.toUpperCase()}]\n${text}`, sizeChars: text.length, isInline: false };
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Shared file-block builder ───────────────────────────────────────────
function buildFileBlocks(limitChars = 40000) {
  return pickedFiles.map(f => {
    if (f.isInline) return `[מסמך: "${f.name}" — PDF מצורף inline לקריאה ישירה]`;
    return `=== מסמך: "${f.name}" ===\n${(f.text || '').slice(0, limitChars)}\n=== סוף מסמך ===`;
  }).join('\n\n');
}

// ── Shared behavioral core rules (used in every generation call) ────────
function buildCoreRules() {
  return `אתה אנליסט עסקי בכיר (Senior Business/Functional Analyst). תפקידך לזהות שאלות הבהרה עסקיות שחייבות להיענות לפני מעבר לשלב תכנון הפתרון (Solutioning) — ERD, User Stories, אינטגרציות, הרשאות, אוטומציות, מסכים, מודל נתונים, דוחות.

## חוקי ברזל — קרא בעיון ואל תסטה מהם
- אסור לשאול שאלות טכניות. אסור להניח פתרון Salesforce/OutSystems או כל פתרון טכני אחר. אסור להציע אובייקטים, שדות, API, אינטגרציות, מסכים, ארכיטקטורה או פרטי מימוש.
- אסור להמציא כללים עסקיים שאינם במסמכים.
- אם התשובה כבר קיימת במסמך בבירור — אל תשאל עליה, אלא אם היא סותרת מקור אחר או לא ספציפית מספיק.
- כל שאלה חייבת להיות מקושרת למקור מפורש במסמך (שם מסמך + עמוד/סעיף + ציטוט אם אפשר) או לפער קריטי מזוהה. אם מבוססת על היעדר מידע — כתוב: "בסיס: חסר מידע עסקי לאחר סקירת [שם המסמך], סעיף [שם הסעיף]." לעולם אל תמציא מקור, עמוד או ציטוט.
- קבץ שאלות לפי דומיין עסקי, וסדר אותן כמשפך (Funnel) מהרחב לספציפי: (1) מטרת הדומיין העסקי (2) שחקנים מעורבים (3) תהליך עסקי רגיל (4) סטטוסים ומעברי מחזור חיים (5) כללים עסקיים ותנאים (6) כללי ולידציה (7) נתונים עסקיים נדרשים (8) חריגים ומקרי קצה (9) תוצרים/טפסים/דוחות/חתימות (10) בעלות והכרעה.
- הימנע משאלות גנריות ("מי אחראי?", "מה הכללים?"). כל שאלה חייבת להיות ספציפית, ניתנת לשימוש ישיר בפגישה עם בעל עניין עסקי.
- כשמשווים בין כמה מסמכים — זהה סתירות, פערים וחפיפות בניסוח לא מאשים: "איזה תרחיש נכון בפועל?", "מהו הכלל העסקי המחייב בנושא זה?"
- קטגוריות אפשריות: Process, Role/Responsibility, Business Rule, Validation Rule, Status/Lifecycle, Data/Business Object, Exception, Approval/Decision, Form/Output/Signature, Reporting/KPI, Audit/Traceability, Arbitration, Assumption to Validate, Missing Business Element.
- סולם קריטיות (ערכים מדויקים באנגלית): "Must clarify" = חוסם לחלוטין את כתיבת האפיון. "Should clarify" = חשוב, מפחית סיכון. "Nice to clarify" = משפר שלמות אך לא חוסם.
- ענה תמיד בעברית בלבד (מלבד ערכי enum שמצוינים באנגלית כפי שהתבקש).
- ענה **אך ורק** ב-JSON תקני, ללא טקסט נלווה, ללא בלוקי קוד.`;
}

function buildDocContextBlock(context, calibAnswersText) {
  return `${context ? `הקשר מהמפעיל:\n"${context}"\n\n` : ''}${calibAnswersText ? `תשובות המפעיל לשאלות המקדימות:\n${calibAnswersText}\n\n` : ''}מסמכי המקור (${pickedFiles.length}):
${buildFileBlocks()}`;
}

// ── Phase 2: calibration call ────────────────────────────────────────────
window.runMaturityCalibration = async function () {
  if (!pickedFiles.length) return;
  const contextEl = document.getElementById('mtc-context');
  const context = contextEl ? contextEl.value.trim() : '';
  window.__mtcContext = context;

  phase = 'calibrating';
  showRunning('🔍 קורא את המסמכים ומכין שאלות הבהרה מקדימות…', 1, TOTAL_CALLS);

  let mIdx = deps.getModelIdx();
  try {
    const prompt = `${buildCoreRules()}

## המשימה שלך עכשיו — שאלות מקדימות (לפני הפקת המסמך הסופי)
לפני שתפיק את מסמך ההבהרה הסופי, שאל את המפעיל (לא את בעלי העניין העסקיים!) עד 10 שאלות קצרות שיעזרו לך להבין:
- מטרת הניתוח והתוצר המצופה
- קהל היעד (למי ישלח המסמך)
- עומק הניתוח הנדרש
- שלב הפרויקט הבא שמכינים אליו
- דומיינים עסקיים להתמקד בהם
- האם להדגיש סתירות בין מסמכים
- האם לכלול רק שאלות חוסמות או גם שאלות בעדיפות נמוכה יותר
- האם יש מסמך מקור ראשי (source of truth)

אל תשאל שאלות טכניות בשלב הזה.

${context ? `הקשר מהמפעיל:\n"${context}"\n\n` : ''}מסמכי המקור (${pickedFiles.length}):
${buildFileBlocks(20000)}

ענה **אך ורק** ב-JSON תקני בפורמט:
{
  "understanding": "תיאור קצר (2-4 משפטים) של מה הבנת מהמסמכים",
  "preliminaryQuestions": [
    { "question": "שאלה למפעיל", "why": "למה זה עוזר לך לכייל את הניתוח" }
  ]
}
עד 10 שאלות. אם המסמכים ברורים מספיק — אפשר פחות שאלות, גם 0.`;

    const raw = await callWithFallback(prompt, mIdx);
    mIdx = deps.getModelIdx();
    calibration = parseJsonObject(raw) || { understanding: '', preliminaryQuestions: [] };
    if (!Array.isArray(calibration.preliminaryQuestions)) calibration.preliminaryQuestions = [];
  } catch (err) {
    phase = 'error';
    showError(err.message || String(err));
    return;
  }

  if (calibration.preliminaryQuestions.length === 0) {
    // no preliminary questions — go straight to generation
    runMaturityGeneration();
    return;
  }

  phase = 'preliminary';
  showPreliminary();
};

function showPreliminary() {
  const qs = calibration.preliminaryQuestions || [];
  setBody(`
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:.75rem 1rem;font-size:.83rem;color:#1e40af;line-height:1.5;">
      ${deps.escHtml(calibration.understanding || '')}
    </div>
    <div style="font-size:.85rem;color:#374151;">כמה שאלות קצרות שיעזרו לכייל את הניתוח (ניתן לדלג):</div>
    <div style="display:flex;flex-direction:column;gap:.7rem;">
      ${qs.map((q, i) => `
        <div>
          <label style="font-size:.83rem;font-weight:600;color:#1e293b;display:block;margin-bottom:.25rem;">${i + 1}. ${deps.escHtml(q.question)}</label>
          ${q.why ? `<div style="font-size:.74rem;color:#94a3b8;margin-bottom:.25rem;">${deps.escHtml(q.why)}</div>` : ''}
          <input type="text" id="mtc-answer-${i}" placeholder="תשובה (רשות)"
            style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:7px;padding:.4rem .6rem;font-family:Heebo,sans-serif;font-size:.83rem;direction:rtl;color:#1e293b;background:#fff;" />
        </div>`).join('')}
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeMaturityModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button onclick="window.submitMaturityAnswers()" style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;">
        המשך להפקת המסמך →
      </button>
    </div>`);
}

window.submitMaturityAnswers = function () {
  const qs = calibration.preliminaryQuestions || [];
  answers = {};
  qs.forEach((q, i) => {
    const el = document.getElementById(`mtc-answer-${i}`);
    const val = el ? el.value.trim() : '';
    if (val) answers[i] = val;
  });
  runMaturityGeneration();
};

// ── Phase 3: generation calls (overview → workbook → extras) ────────────
async function runMaturityGeneration() {
  phase = 'running';
  const context = window.__mtcContext || '';
  const qs = calibration.preliminaryQuestions || [];
  const calibAnswersText = qs
    .map((q, i) => answers[i] ? `- ${q.question}\n  ${answers[i]}` : null)
    .filter(Boolean)
    .join('\n');

  let mIdx = deps.getModelIdx();
  const baseBlock = buildDocContextBlock(context, calibAnswersText);

  showRunning('⚙️ קריאה 2 מתוך 4 — תקציר מנהלים והשוואה בין מסמכים…', 2, TOTAL_CALLS);
  let overview;
  try {
    const prompt = `${buildCoreRules()}

## המשימה שלך עכשיו — חלק 1: תקציר מנהלים + ניתוח לפי מסמך + השוואה בין מסמכים
${baseBlock}

ענה **אך ורק** ב-JSON תקני בפורמט:
{
  "executiveOverview": {
    "domains": ["דומיין עסקי 1", "..."],
    "actors": ["שחקן 1", "..."],
    "mainLifecycle": "תיאור קצר של מחזור החיים העיקרי",
    "mainObjects": ["אובייקט עסקי 1", "..."],
    "clearAreas": ["תחום ברור 1", "..."],
    "riskyAreas": ["תחום לא ברור/בסיכון 1", "..."]
  },
  "documents": [
    { "documentName":"", "businessScope":"", "mainProcessElements":"", "rolesMentioned":"", "statusesMentioned":"", "businessObjects":"", "outputsForms":"", "openPoints":"" }
  ],
  "crossDocumentComparison": [
    { "topic":"", "source1":"מסמך + עמוד/סעיף + ציטוט", "source2":"מסמך + עמוד/סעיף + ציטוט", "differenceRisk":"", "clarificationQuestion":"" }
  ]
}
"documents" — פריט אחד לכל מסמך שהועלה. "crossDocumentComparison" — ${pickedFiles.length > 1 ? 'רק פערים/סתירות/הבדלים אמיתיים בין המסמכים; מערך ריק אם אין' : 'מערך ריק (מסמך יחיד הועלה)'}.`;

    const raw = await callWithFallback(prompt, mIdx);
    mIdx = deps.getModelIdx();
    overview = parseJsonObject(raw) || {};
  } catch (err) {
    phase = 'error'; showError(err.message || String(err)); return;
  }

  showRunning('⚙️ קריאה 3 מתוך 4 — חוברת שאלות ההבהרה…', 3, TOTAL_CALLS);
  let workbook;
  try {
    const prompt = `${buildCoreRules()}

## המשימה שלך עכשיו — חלק 2: חוברת שאלות הבהרה עסקיות
${baseBlock}

תקציר שכבר הפקת (לשימוש כהקשר, אל תחזור עליו):
${JSON.stringify(overview.executiveOverview || {})}

הפק את כל שאלות ההבהרה העסקיות הנדרשות. תעדף איכות על פני כמות, כלול את כל שאלות ה-"Must clarify" וגם את החשובות שבין ה-"Should clarify". קבץ לפי דומיין, וסדר בכל דומיין ממשפך רחב לספציפי.

ענה **אך ורק** ב-JSON תקני בפורמט:
{
  "questions": [
    {
      "number": 1,
      "domain": "דומיין עסקי",
      "funnelLevel": "אחד מ: מטרה עסקית / שחקנים / תהליך / סטטוס ומחזור חיים / כלל עסקי / כלל ולידציה / נתונים / חריג / תוצר / בעלות והכרעה",
      "category": "אחת מהקטגוריות שהוגדרו",
      "question": "השאלה המדויקת לבעל העניין העסקי",
      "criticality": "Must clarify | Should clarify | Nice to clarify",
      "solutioningImpact": "ERD / User Stories / Permissions / Integration / Automation / UI / Reporting / Data Model / Technical Specs (אחד או יותר מופרדים בפסיק — רק כדי לציין על מה זה ישפיע בהמשך, לא כהצעת פתרון)",
      "whyItMatters": "למה התשובה חשובה",
      "impactIfOpen": "מה הסיכון/ההשפעה אם השאלה נשארת פתוחה",
      "sourceReference": "שם מסמך + עמוד/סעיף + ציטוט, או 'בסיס: חסר מידע עסקי לאחר סקירת [מסמך], סעיף [סעיף]'",
      "missingOrAssumption": "מה חסר, לא ברור, מונח כהנחה, או סותר"
    }
  ]
}`;

    const raw = await callWithFallback(prompt, mIdx);
    mIdx = deps.getModelIdx();
    workbook = parseJsonObject(raw) || { questions: [] };
    if (!Array.isArray(workbook.questions)) workbook.questions = [];
  } catch (err) {
    phase = 'error'; showError(err.message || String(err)); return;
  }

  showRunning('⚙️ קריאה 4 מתוך 4 — אלמנטים חסרים, הנחות ורשימת עדיפות לפגישה…', 4, TOTAL_CALLS);
  let extras;
  try {
    const prompt = `${buildCoreRules()}

## המשימה שלך עכשיו — חלק 3: אלמנטים חסרים, הנחות לאימות, ורשימת שאלות עדיפות לפגישה
${baseBlock}

חוברת השאלות שכבר הפקת (לשימוש כהקשר, בחר מתוכה את הכי חשובות לרשימת העדיפות):
${JSON.stringify((workbook.questions || []).slice(0, 40).map(q => ({ domain: q.domain, question: q.question, criticality: q.criticality })))}

ענה **אך ורק** ב-JSON תקני בפורמט:
{
  "missingElements": [
    { "domain":"", "missingElement":"", "whyMissing":"", "impact":"", "sourceBasis":"" }
  ],
  "assumptions": [
    { "assumption":"", "whyPlausible":"", "riskIfWrong":"", "validationQuestion":"", "sourceReference":"" }
  ],
  "priorityMeetingQuestions": [
    { "question":"", "domain":"", "criticality":"Must clarify | Should clarify | Nice to clarify", "sourceDocument":"", "whyEarly":"" }
  ]
}
"priorityMeetingQuestions" — עד 10 השאלות הכי חשובות לפתוח איתן פגישת עבודה עם בעלי העניין.`;

    const raw = await callWithFallback(prompt, mIdx);
    mIdx = deps.getModelIdx();
    extras = parseJsonObject(raw) || {};
  } catch (err) {
    phase = 'error'; showError(err.message || String(err)); return;
  }

  result = {
    executiveOverview: overview.executiveOverview || {},
    documents: overview.documents || [],
    crossDocumentComparison: overview.crossDocumentComparison || [],
    questions: workbook.questions || [],
    missingElements: extras.missingElements || [],
    assumptions: extras.assumptions || [],
    priorityMeetingQuestions: extras.priorityMeetingQuestions || [],
  };

  phase = 'done';
  buildAndDownloadXlsx();
  showDone();
}

// ── XLSX assembly ─────────────────────────────────────────────────────────
function buildAndDownloadXlsx() {
  if (typeof XLSX === 'undefined') { showError('ספריית XLSX לא נטענה — לא ניתן להפיק קובץ Excel.'); return; }

  const wb = XLSX.utils.book_new();
  const ov = result.executiveOverview || {};

  // Sheet 1 — תקציר מנהלים
  const ovAoa = [
    ['רכיב', 'תוכן'],
    ['דומיינים עסקיים עיקריים', (ov.domains || []).join('; ')],
    ['שחקנים מרכזיים', (ov.actors || []).join('; ')],
    ['מחזור חיים עיקרי', ov.mainLifecycle || ''],
    ['אובייקטים עסקיים עיקריים', (ov.mainObjects || []).join('; ')],
    ['תחומים ברורים', (ov.clearAreas || []).join('; ')],
    ['תחומים לא ברורים / בסיכון', (ov.riskyAreas || []).join('; ')],
  ];
  addSheet(wb, 'תקציר מנהלים', ovAoa, [{ wch: 28 }, { wch: 95 }]);

  // Sheet 2 — ניתוח לפי מסמך
  const docHeaders = ['מסמך', 'תחום עסקי', 'אלמנטי תהליך עיקריים', 'תפקידים שהוזכרו', 'סטטוסים שהוזכרו', 'אובייקטים/נתונים עסקיים', 'תוצרים/טפסים', 'נקודות פתוחות'];
  const docRows = (result.documents || []).map(d => [
    d.documentName || '', d.businessScope || '', d.mainProcessElements || '', d.rolesMentioned || '',
    d.statusesMentioned || '', d.businessObjects || '', d.outputsForms || '', d.openPoints || '',
  ]);
  addSheet(wb, 'ניתוח לפי מסמך', [docHeaders, ...docRows], [{ wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 30 }]);

  // Sheet 3 — השוואה בין מסמכים (רק אם יש תוכן)
  const cross = result.crossDocumentComparison || [];
  if (cross.length > 0) {
    const crossHeaders = ['נושא', 'מקור 1', 'מקור 2', 'פער / סיכון', 'שאלת הבהרה'];
    const crossRows = cross.map(c => [c.topic || '', c.source1 || '', c.source2 || '', c.differenceRisk || '', c.clarificationQuestion || '']);
    addSheet(wb, 'השוואה בין מסמכים', [crossHeaders, ...crossRows], [{ wch: 24 }, { wch: 34 }, { wch: 34 }, { wch: 34 }, { wch: 40 }]);
  }

  // Sheet(s) 4 — שאלות הבהרה (חוברת ראשית) — פיצול ל-2 טאבים אם מעל 30 שאלות
  const qHeaders = ['מס\'', 'דומיין עסקי', 'רמת Funnel', 'קטגוריה', 'שאלה עסקית', 'קריטיות', 'השפעה על הפתרון', 'למה זה חשוב', 'השפעה אם נשאר פתוח', 'מקור', 'אלמנט חסר / הנחה / סתירה', 'תשובה', 'סטטוס'];
  const qCols = [{ wch: 5 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 45 }, { wch: 14 }, { wch: 22 }, { wch: 32 }, { wch: 32 }, { wch: 32 }, { wch: 32 }, { wch: 24 }, { wch: 10 }];
  const toRow = q => [
    q.number ?? '', q.domain || '', q.funnelLevel || '', q.category || '', q.question || '',
    q.criticality || '', q.solutioningImpact || '', q.whyItMatters || '', q.impactIfOpen || '',
    q.sourceReference || '', q.missingOrAssumption || '', '', 'פתוח',
  ];
  const questions = result.questions || [];
  if (questions.length > 30) {
    const must = questions.filter(q => /must/i.test(q.criticality || ''));
    const rest = questions.filter(q => !/must/i.test(q.criticality || ''));
    addSheet(wb, 'שאלות קריטיות', [qHeaders, ...must.map(toRow)], qCols);
    addSheet(wb, 'שאלות נוספות', [qHeaders, ...rest.map(toRow)], qCols);
  } else {
    addSheet(wb, 'שאלות הבהרה', [qHeaders, ...questions.map(toRow)], qCols);
  }

  // Sheet 5 — אלמנטים חסרים
  const missing = result.missingElements || [];
  const missingHeaders = ['דומיין עסקי', 'אלמנט חסר', 'למה חסר / לא ברור', 'השפעה על האפיון', 'בסיס מקור'];
  addSheet(wb, 'אלמנטים חסרים', [missingHeaders, ...missing.map(m => [m.domain || '', m.missingElement || '', m.whyMissing || '', m.impact || '', m.sourceBasis || ''])], [{ wch: 20 }, { wch: 30 }, { wch: 34 }, { wch: 34 }, { wch: 32 }]);

  // Sheet 6 — הנחות לאימות
  const assumptions = result.assumptions || [];
  const assumpHeaders = ['הנחה', 'למה נראית סבירה', 'סיכון אם שגויה', 'שאלת אימות', 'מקור'];
  addSheet(wb, 'הנחות לאימות', [assumpHeaders, ...assumptions.map(a => [a.assumption || '', a.whyPlausible || '', a.riskIfWrong || '', a.validationQuestion || '', a.sourceReference || ''])], [{ wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 34 }, { wch: 28 }]);

  // Sheet 7 — שאלות עדיפות לפגישה
  const priority = result.priorityMeetingQuestions || [];
  const priorityHeaders = ['שאלה', 'דומיין', 'קריטיות', 'מסמך מקור', 'למה לשאול מוקדם'];
  addSheet(wb, 'עדיפות לפגישה', [priorityHeaders, ...priority.map(p => [p.question || '', p.domain || '', p.criticality || '', p.sourceDocument || '', p.whyEarly || ''])], [{ wch: 45 }, { wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 34 }]);

  lastWb = wb;
  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  lastBaseName = `בדיקת-בשלות_${ts}`;
  XLSX.writeFile(wb, `${lastBaseName}.xlsx`);
}

function addSheet(wb, name, aoa, cols) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (cols) ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
}

// ── JSON parsing helper ───────────────────────────────────────────────────
function parseJsonObject(raw) {
  let s = (raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const first = s.indexOf('{'), last = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
}

// ── API call with fallback ─────────────────────────────────────────────────
async function callWithFallback(prompt, startIdx) {
  const inlineFile = pickedFiles.find(f => f.isInline) || null;
  let mIdx = startIdx;
  while (true) {
    try {
      return await deps.callGeminiForSpec(prompt, mIdx, inlineFile, {
        genCfg: { responseMimeType: 'application/json' },
        maxContinuations: 0,
      });
    } catch (err) {
      const msg = err.message || '';
      const quota = deps.isQuotaExceeded ? deps.isQuotaExceeded(msg) : /quota|exceeded|free_tier/i.test(msg);
      const busy  = /503|high demand|overload|temporarily|429/i.test(msg);
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

// ── Running / Done / Error UI ───────────────────────────────────────────
function showRunning(msg, current, total) {
  const pct = Math.round((current / total) * 100);
  setBody(`
    <div style="display:flex;flex-direction:column;gap:.9rem;padding:.3rem 0;">
      <div style="display:flex;align-items:center;gap:.75rem;color:#334155;font-size:.9rem;">
        <div class="mtc-spinner" style="width:22px;height:22px;border:3px solid #e2e8f0;border-top-color:#0891b2;border-radius:50%;flex-shrink:0;"></div>
        <span id="mtc-running-msg">${msg}</span>
      </div>
      <div class="mtc-progress-bar"><div class="mtc-progress-fill" id="mtc-prog-fill" style="width:${pct}%;"></div></div>
      <div style="font-size:.78rem;color:#94a3b8;" id="mtc-prog-label">קריאה ${current} מתוך ${total}</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.65rem .85rem;font-size:.8rem;color:#64748b;line-height:1.5;">
        💡 בודק הבשלות עובד — זה עשוי לקחת מספר דקות. לא לסגור את החלון.
      </div>
    </div>`);
  setFooter('');
}

function updateRunning(msg) {
  const el = document.getElementById('mtc-running-msg');
  if (el) el.textContent = msg;
}

function showDone() {
  const q = result.questions || [];
  const must = q.filter(x => /must/i.test(x.criticality || '')).length;
  const priority = result.priorityMeetingQuestions || [];

  setBody(`
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:1rem;font-weight:700;color:#166534;margin-bottom:.4rem;">✅ בדיקת הבשלות הושלמה — קובץ ה-Excel הורד</div>
      <div style="font-size:.83rem;color:#166534;">
        ${q.length} שאלות הבהרה (${must} מהן "Must clarify") · ${(result.missingElements || []).length} אלמנטים חסרים · ${(result.assumptions || []).length} הנחות לאימות
      </div>
    </div>
    ${priority.length ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:.75rem 1rem;font-size:.82rem;color:#1e40af;">
      <strong>שאלות עדיפות לפגישה:</strong>
      <ol style="margin:.3rem 0 0;padding-right:1.1rem;">
        ${priority.map(p => `<li>${deps.escHtml(p.question || '')}</li>`).join('')}
      </ol>
    </div>` : ''}
    <div style="font-size:.82rem;color:#475569;">אם ההורדה נחסמה על ידי הדפדפן — לחץ "הורד שוב".</div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeMaturityModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <div style="display:flex;gap:.5rem;">
        <button onclick="window.mtcRedownload()" style="padding:.48rem 1rem;background:#dcfce7;border:1px solid #86efac;border-radius:8px;cursor:pointer;font-size:.85rem;font-family:Heebo,sans-serif;color:#166534;">⬇ הורד שוב</button>
        <button onclick="window.openMaturityModal()" style="padding:.5rem 1.1rem;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">🔄 בדיקה חדשה</button>
      </div>
    </div>`);
}

window.mtcRedownload = function () {
  if (!lastWb) return;
  XLSX.writeFile(lastWb, `${lastBaseName}.xlsx`);
};

function showError(msg) {
  setBody(`
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">
      ❌ שגיאה: ${deps.escHtml(msg)}
    </div>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;">
      <button onclick="window.closeMaturityModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.openMaturityModal()" style="padding:.48rem 1rem;background:#0891b2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;">נסה שוב</button>
    </div>`);
}

function setBody(html)   { const el = document.getElementById('mtc-body');   if (el) el.innerHTML = html; }
function setFooter(html) { const el = document.getElementById('mtc-footer'); if (el) el.innerHTML = html; }
