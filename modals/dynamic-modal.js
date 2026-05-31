import { deps } from './deps.js';

// ── State ─────────────────────────────────────────────────────────────────
let dynPhase       = 'mode';
let agentDesc      = '';
let generatedMd    = '';
let mdInstFile     = null;   // { name, text }
let inputFiles     = [];     // [{ name, text?, isInline?, base64?, mimeType }]
let outputFiles    = [];     // [{ name, content }]
let execDepth      = 'normal';

// ── Init ──────────────────────────────────────────────────────────────────
export function initDynamicModal() {
  injectModal();
}

function injectModal() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes dyn-spin{to{transform:rotate(360deg)}}
    .dyn-spinner{width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;flex-shrink:0;animation:dyn-spin .7s linear infinite}
    .dyn-mode-card{border:2px solid #e2e8f0;border-radius:12px;padding:1.1rem 1.2rem;cursor:pointer;transition:all .15s;text-align:right;}
    .dyn-mode-card:hover{border-color:#7c3aed;background:#faf5ff;}
    .dyn-file-row{display:flex;align-items:center;gap:.5rem;padding:.45rem .75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:.82rem;color:#374151;}
    .dyn-file-rm{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;padding:0 .15rem;line-height:1;margin-right:auto;flex-shrink:0;}
    .dyn-file-rm:hover{color:#ef4444;}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'dynamic-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:640px;width:calc(100% - 2rem);max-height:92vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 id="dyn-title" style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;">🔮 סוכן דינמי</h3>
          <p  id="dyn-subtitle" style="margin:0;color:#64748b;font-size:.82rem;"></p>
        </div>
        <button onclick="window.closeDynamicModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>
      <div id="dyn-body"   style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:1rem;"></div>
      <div id="dyn-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>
    <input type="file" id="dyn-md-pick"   accept=".md,.txt" hidden>
    <input type="file" id="dyn-file-pick" accept=".md,.txt,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.webp" hidden>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeDynamicModal(); });
  document.body.appendChild(modal);

  document.getElementById('dyn-md-pick').addEventListener('change',   onMdFilePicked);
  document.getElementById('dyn-file-pick').addEventListener('change', onInputFilePicked);
}

// ── Open / Close ──────────────────────────────────────────────────────────
window.openDynamicModal = function () {
  if (deps.getIsLoading()) return;
  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }
  dynPhase    = 'mode';
  agentDesc   = '';
  generatedMd = '';
  mdInstFile  = null;
  inputFiles  = [];
  outputFiles = [];
  execDepth   = 'normal';
  document.getElementById('dynamic-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showMode();
};

window.closeDynamicModal = function () {
  document.getElementById('dynamic-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ── Mode selection ────────────────────────────────────────────────────────
function showMode() {
  setTitle('🔮 סוכן דינמי', 'בחר מצב פעולה');
  setBody(`
    <div class="dyn-mode-card" onclick="window.dynStartDesign()">
      <div style="font-size:1.3rem;margin-bottom:.3rem;">🛠️</div>
      <div style="font-weight:700;color:#1e293b;font-size:.95rem;margin-bottom:.25rem;">הגדר סוכן חדש</div>
      <div style="color:#64748b;font-size:.8rem;line-height:1.5;">תאר לי מה הסוכן עושה — אייצר מסמך הפעלה MD שאפשר לשמור ולהשתמש בו שוב ושוב.</div>
    </div>
    <div class="dyn-mode-card" onclick="window.dynStartExecute()">
      <div style="font-size:1.3rem;margin-bottom:.3rem;">⚡</div>
      <div style="font-weight:700;color:#1e293b;font-size:.95rem;margin-bottom:.25rem;">הפעל סוכן קיים</div>
      <div style="color:#64748b;font-size:.8rem;line-height:1.5;">העלה מסמך הפעלה MD וקבצי קלט, בחר רמת ביצוע — וקבל קבצי פלט.</div>
    </div>`);
  setFooter(`<div style="text-align:center;">
    <button onclick="window.closeDynamicModal()" style="padding:.4rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
  </div>`);
}

window.dynBackToMode = function () { showMode(); };

// ── Design: describe agent ─────────────────────────────────────────────────
window.dynStartDesign = function () {
  dynPhase = 'design-input';
  setTitle('🛠️ הגדרת סוכן', 'תאר מה הסוכן יעשה');
  setBody(`
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.85rem 1rem;">
      <div style="font-size:.84rem;font-weight:600;color:#1e293b;margin-bottom:.2rem;">מה הסוכן שלך עושה?</div>
      <div style="font-size:.78rem;color:#64748b;line-height:1.5;">ציין: שם, אילו קבצים מקבל (סוג + תוכן), מה מחזיר, ומה הלוגיקה.</div>
    </div>
    <textarea id="dyn-desc-ta" rows="5" dir="rtl"
      placeholder="לדוגמה: סוכן שמקבל קובץ CSV עם נתוני מכירות ומחזיר קובץ MD עם ניתוח מגמות וגרפי Mermaid."
      style="width:100%;padding:.65rem .8rem;border:1.5px solid #e2e8f0;border-radius:9px;font-family:Heebo,sans-serif;font-size:.9rem;color:#1e293b;resize:vertical;box-sizing:border-box;"
      onkeydown="if(event.ctrlKey&&event.key==='Enter')window.dynGenerateMd()">${deps.escHtml(agentDesc)}</textarea>
    <div style="font-size:.73rem;color:#94a3b8;">Ctrl+Enter לשליחה</div>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;">
      <button onclick="window.dynBackToMode()" style="padding:.45rem .9rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.84rem;font-family:Heebo,sans-serif;color:#374151;">← חזור</button>
      <button onclick="window.dynGenerateMd()" style="padding:.48rem 1.3rem;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">צור מסמך הפעלה →</button>
    </div>`);
  setTimeout(() => { const ta = document.getElementById('dyn-desc-ta'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 80);
};

window.dynGenerateMd = async function () {
  const desc = (document.getElementById('dyn-desc-ta')?.value || '').trim();
  if (!desc) return;
  agentDesc = desc;
  setTitle('🛠️ מייצר מסמך', 'אנא המתן…');
  showSpinner('מייצר מסמך הפעלה…');

  const prompt = `המשתמש רוצה לבנות סוכן AI שיעשה את הדברים הבאים:

"${agentDesc}"

צור מסמך הפעלה MD מפורט בעברית לסוכן הזה.
המסמך ישמש כהוראות קבועות לסוכן בכל הפעלה.

כלול בדיוק את הסעיפים הבאים:

# שם הסוכן
שם ממותג וקצר.

# תיאור
2–3 משפטים על מה הסוכן עושה.

# קבצי קלט
- סוגי קבצים (פורמט, סיומת)
- תוכן צפוי בכל קובץ
- כמות מקסימלית

# קבצי פלט
- שמות הקבצים שיוחזרו
- פורמט כל קובץ (MD / JSON / CSV / HTML)
- תיאור מה כל קובץ מכיל

# כללי עיבוד
הנחיות מפורטות: מה לנתח, כיצד לעבד, מה לכלול בפלט.

# רמות ביצוע
## בסיסי
מה מבוצע ברמה בסיסית — פלט מינימלי, עיבוד מהיר.
## רגיל
מה מבוצע ברמה רגילה — פלט מלא, ניתוח מפורט. ברירת המחדל.
## גבוה
מה מבוצע ברמה גבוהה — פלט עשיר, תרשימים Mermaid, ניתוח מקיף.

# הגבלות
מה הסוכן לא עושה.

# דוגמה
קלט לדוגמה ← פלט לדוגמה (קצר).

כתוב מסמך מקצועי, ברור ומפורט.`;

  try {
    generatedMd = await dynCallWithFallback(prompt, deps.getModelIdx());
    showDesignPreview();
  } catch (e) {
    showError(e.message, window.dynStartDesign);
  }
};

function showDesignPreview() {
  dynPhase = 'design-preview';
  setTitle('📄 מסמך הפעלה מוכן', 'ניתן לערוך לפני ההורדה');
  setBody(`
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:.75rem 1rem;">
      <div style="font-size:.78rem;font-weight:700;color:#1d4ed8;margin-bottom:.15rem;">✅ המסמך נוצר</div>
      <div style="font-size:.77rem;color:#1e40af;">ערוך לפי הצורך, הורד ושמור. בהפעלה הבאה העלה אותו יחד עם קבצי הקלט.</div>
    </div>
    <textarea id="dyn-md-preview" rows="14" dir="rtl"
      style="width:100%;padding:.65rem .8rem;border:1.5px solid #bfdbfe;border-radius:9px;font-family:monospace;font-size:.77rem;color:#1e293b;resize:vertical;box-sizing:border-box;background:#f8fbff;line-height:1.5;"
    >${deps.escHtml(generatedMd)}</textarea>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.dynStartDesign()" style="padding:.45rem .9rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.84rem;font-family:Heebo,sans-serif;color:#374151;">← ערוך תיאור</button>
      <button onclick="window.dynDownloadMd()" style="padding:.48rem 1.3rem;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">⬇ הורד מסמך הפעלה</button>
    </div>`);
}

window.dynDownloadMd = function () {
  const text = (document.getElementById('dyn-md-preview')?.value || '').trim() || generatedMd;
  const name = (extractAgentName(text) || 'סוכן-דינמי').replace(/\s+/g, '-');
  const filename = name + '-הוראות.md';
  triggerDownload(filename, text, 'text/markdown');
  const footer = document.getElementById('dyn-footer');
  if (!footer) return;
  const msg = document.createElement('div');
  msg.style.cssText = 'margin-top:.45rem;font-size:.79rem;color:#059669;text-align:center;';
  msg.textContent = `✅ "${filename}" הורד. לחץ "הפעל סוכן קיים" כדי להשתמש בו.`;
  footer.appendChild(msg);
  setTimeout(() => msg.remove(), 6000);
};

function extractAgentName(md) {
  const m = md.match(/^#\s+שם הסוכן\s*\n+(.+)/m) || md.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : null;
}

// ── Execute: upload files ──────────────────────────────────────────────────
window.dynStartExecute = function () {
  dynPhase = 'exec-upload';
  setTitle('⚡ הפעלת סוכן', 'העלה קבצים');
  renderUploadPhase();
};

function renderUploadPhase() {
  const mdRow = mdInstFile
    ? `<div class="dyn-file-row">
        <span>📄</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${deps.escHtml(mdInstFile.name)}</span>
        <button class="dyn-file-rm" onclick="window.dynRemoveMd()" title="הסר">✕</button>
       </div>`
    : `<button onclick="document.getElementById('dyn-md-pick').click()"
         style="width:100%;padding:.65rem;border:2px dashed #c8d0e0;border-radius:9px;background:#f8fafc;cursor:pointer;font-family:Heebo,sans-serif;font-size:.84rem;color:#64748b;">
         📎 לחץ להעלאת קובץ MD
       </button>`;

  const inputRows = inputFiles.map((f, i) =>
    `<div class="dyn-file-row">
      <span>${fileEmoji(f.mimeType)}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${deps.escHtml(f.name)}</span>
      <button class="dyn-file-rm" onclick="window.dynRemoveInput(${i})" title="הסר">✕</button>
    </div>`).join('');

  const addBtn = inputFiles.length < 5
    ? `<button onclick="document.getElementById('dyn-file-pick').click()"
         style="width:100%;padding:.55rem;border:2px dashed #c8d0e0;border-radius:9px;background:#f8fafc;cursor:pointer;font-family:Heebo,sans-serif;font-size:.82rem;color:#64748b;">
         + הוסף קובץ קלט
       </button>`
    : `<div style="font-size:.79rem;color:#94a3b8;text-align:center;padding:.3rem;">מקסימום 5 קבצי קלט</div>`;

  setBody(`
    <div>
      <div style="font-size:.84rem;font-weight:600;color:#1e293b;margin-bottom:.4rem;">📄 מסמך הפעלה <span style="color:#ef4444;font-weight:400;">חובה</span></div>
      ${mdRow}
    </div>
    <div>
      <div style="font-size:.84rem;font-weight:600;color:#1e293b;margin-bottom:.4rem;">📁 קבצי קלט</div>
      <div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.4rem;">${inputRows}</div>
      ${addBtn}
    </div>`);

  const ok = !!mdInstFile;
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.dynBackToMode()" style="padding:.45rem .9rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.84rem;font-family:Heebo,sans-serif;color:#374151;">← חזור</button>
      <button onclick="window.dynGoToDepth()" ${ok ? '' : 'disabled'}
        style="padding:.48rem 1.3rem;background:${ok ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#c8d0e0'};color:#fff;border:none;border-radius:8px;cursor:${ok ? 'pointer' : 'not-allowed'};font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">
        המשך →
      </button>
    </div>`);
}

window.dynRemoveMd     = function ()  { mdInstFile = null; renderUploadPhase(); };
window.dynRemoveInput  = function (i) { inputFiles.splice(i, 1); renderUploadPhase(); };

async function onMdFilePicked(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const f = await deps.readFile(file);
    if (!f.text) { showFileToast('קובץ ה-MD חייב להיות קובץ טקסט'); return; }
    mdInstFile = { name: f.name, text: f.text };
    renderUploadPhase();
  } catch (err) { showFileToast(err.message || 'שגיאה בקריאת הקובץ'); }
}

async function onInputFilePicked(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const f = await deps.readFile(file);
    inputFiles.push(f);
    renderUploadPhase();
  } catch (err) { showFileToast(err.message || 'שגיאה בקריאת הקובץ'); }
}

// ── Execute: choose depth ──────────────────────────────────────────────────
window.dynGoToDepth = function () {
  if (!mdInstFile) return;
  dynPhase = 'exec-depth';
  renderDepthPhase();
};

window.dynGoBackToUpload = function () { renderUploadPhase(); };

function renderDepthPhase() {
  setTitle('⚡ רמת ביצוע', 'כמה עמוק לעבד?');
  const opts = [
    { v: 'basic',  label: 'בסיסי', calls: 'קריאה אחת',  desc: 'עיבוד מהיר, פלט ממוקד.' },
    { v: 'normal', label: 'רגיל',  calls: '2 קריאות',   desc: 'ניתוח מעמיק ועיבוד מלא. מומלץ.' },
    { v: 'high',   label: 'גבוה',  calls: '3 קריאות',   desc: 'ניתוח מקיף, פלט עשיר עם תרשימים ובדיקת איכות.' },
  ];
  setBody(`
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:.75rem 1rem;font-size:.82rem;color:#374151;">
      📄 <strong>${deps.escHtml(mdInstFile.name)}</strong>
      ${inputFiles.length ? ` · ${inputFiles.length} קובצי קלט` : ' · ללא קבצי קלט'}
    </div>
    <div style="display:flex;flex-direction:column;gap:.4rem;">
      ${opts.map(o => `
        <label style="display:flex;align-items:flex-start;gap:.6rem;cursor:pointer;padding:.55rem .75rem;border:1.5px solid ${execDepth === o.v ? '#7c3aed' : '#e2e8f0'};border-radius:9px;background:${execDepth === o.v ? '#faf5ff' : '#fff'};" onclick="window.dynSetDepth('${o.v}')">
          <input type="radio" name="dyn-depth" value="${o.v}" ${execDepth === o.v ? 'checked' : ''} style="accent-color:#7c3aed;margin-top:.15rem;" readonly>
          <div>
            <div style="font-size:.87rem;font-weight:600;color:#1e293b;">${o.label} <span style="font-weight:400;color:#94a3b8;font-size:.77rem;">(${o.calls})</span></div>
            <div style="font-size:.79rem;color:#64748b;margin-top:.1rem;">${o.desc}</div>
          </div>
        </label>`).join('')}
    </div>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.dynGoBackToUpload()" style="padding:.45rem .9rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.84rem;font-family:Heebo,sans-serif;color:#374151;">← קבצים</button>
      <button onclick="window.dynExecute()" style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);">⚡ הפעל סוכן</button>
    </div>`);
}

window.dynSetDepth = function (v) { execDepth = v; renderDepthPhase(); };

// ── Execute: run ───────────────────────────────────────────────────────────
window.dynExecute = async function () {
  if (!mdInstFile) return;
  window.closeDynamicModal();
  deps.hideEmpty();
  deps.setLoading(true);

  const numCalls   = { basic: 1, normal: 2, high: 3 }[execDepth] || 2;
  const depthLabel = { basic: 'בסיסי', normal: 'רגיל', high: 'גבוה' }[execDepth];
  const estTime    = { basic: '2–5 דקות', normal: '5–15 דקות', high: '10–25 דקות' }[execDepth];

  const STEP_LABELS = {
    basic:  ['⚙️ מבצע עיבוד ומפיק פלט'],
    normal: ['🔍 שלב א מתוך 2 — מנתח קבצי קלט ומכין תכנית', '📝 שלב ב מתוך 2 — מפיק קבצי פלט'],
    high:   ['🔍 שלב א מתוך 3 — ניתוח מעמיק של הקלט', '📝 שלב ב מתוך 3 — מפיק קבצי פלט מלאים', '✨ שלב ג מתוך 3 — בודק, משפר ומוסיף תרשימים'],
  }[execDepth] || [];

  deps.appendMessage('assistant',
    `⚡ **הסוכן הדינמי מתחיל לעבוד** (עומק: ${depthLabel}, ${numCalls} קריאות API)\n\n` +
    `📄 ${mdInstFile.name}` +
    (inputFiles.length ? ` · ${inputFiles.map(f => f.name).join(', ')}` : '') + '\n\n' +
    `⏳ **זמן עיבוד משוער: ${estTime}** — לפעמים אף יותר מ-20 דקות.\nאנא המתן בסבלנות ואל תסגור את הדף.`
  );

  const pid       = deps.appendTyping();
  const startTime = Date.now();
  let   curStep   = 0;

  function fmtElapsed() {
    const s = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `0:${String(s % 60).padStart(2, '0')}`;
  }

  const timerInterval = setInterval(() => {
    const label = STEP_LABELS[curStep] || `מעבד שלב ${curStep + 1} מתוך ${numCalls}…`;
    deps.updateTyping(pid, `${label} · ⏱️ ${fmtElapsed()}`);
  }, 500);

  const prompts = buildExecPrompts(mdInstFile.text, inputFiles, execDepth, numCalls);
  let   mIdx    = deps.getModelIdx();
  const results = [];

  try {
    for (let i = 0; i < prompts.length; i++) {
      curStep = i;
      const stepLabel = STEP_LABELS[i] || `שלב ${i + 1} מתוך ${numCalls}`;
      deps.updateTyping(pid, `${stepLabel} · ⏱️ ${fmtElapsed()}`);

      const result = await dynCallWithFallback(prompts[i], mIdx);
      results.push(result);

      // After intermediate steps, show a brief preview snippet
      if (i < prompts.length - 1) {
        const clean   = result.replace(/===FILE_START[\s\S]*?===FILE_END===/g, '').trim();
        const snippet = clean.substring(0, 250);
        if (snippet) {
          deps.appendMessage('assistant',
            `✅ **${stepLabel.replace(/^[^\s]+\s/, '')} הושלם** (${fmtElapsed()})\n\n` +
            `> ${snippet.replace(/\n/g, '\n> ')}${clean.length > 250 ? '\n> …' : ''}`
          );
        }
      }
    }
  } catch (err) {
    clearInterval(timerInterval);
    deps.removeTyping(pid);
    deps.setLoading(false);
    deps.appendMessage('error', '❌ שגיאה: ' + err.message);
    return;
  }

  clearInterval(timerInterval);
  deps.removeTyping(pid);
  deps.setLoading(false);

  const totalSec  = Math.floor((Date.now() - startTime) / 1000);
  const totalMins = Math.floor(totalSec / 60);
  const totalStr  = totalMins > 0 ? `${totalMins} דק' ${totalSec % 60} שנ'` : `${totalSec} שניות`;

  const lastResult = results[results.length - 1];
  const files = parseOutputFiles(lastResult);
  if (!files.length) files.push({ name: 'פלט-סוכן.md', content: lastResult });
  outputFiles = files;

  deps.appendMessage('assistant',
    `✅ **הסוכן הדינמי סיים** — עומק: ${depthLabel} · זמן כולל: ${totalStr}\n\n` +
    `📥 **נוצרו ${outputFiles.length} קבצי פלט:**\n` +
    outputFiles.map(f => `- ${f.name}`).join('\n')
  );

  appendOutputFilesUI(outputFiles);
};

function buildExecPrompts(mdContent, files, depth, numCalls) {
  const depthGuide = {
    basic:  'עבד ישירות וממוקד. ספק פלט מינימלי אך מדויק.',
    normal: 'ספק עיבוד מלא ומפורט לפי ההוראות.',
    high:   'ספק עיבוד מעמיק. כלול תרשימי Mermaid, ניתוח מקיף, הערות.',
  }[depth] || '';

  const filesBlock = files.length
    ? files.map((f, i) =>
        f.isInline
          ? `### קובץ ${i + 1}: ${f.name}\n[קובץ בינארי — ${f.mimeType}]`
          : `### קובץ ${i + 1}: ${f.name}\n\`\`\`\n${f.text}\n\`\`\``
      ).join('\n\n')
    : '(לא הועלו קבצי קלט)';

  const outputFmt = `

## פורמט פלט — חובה
כל קובץ פלט חייב להיות עטוף כך:
===FILE_START: שם-הקובץ.ext===
[תוכן הקובץ]
===FILE_END===`;

  const base = `# מסמך הפעלה\n${mdContent}\n\n# קבצי קלט\n${filesBlock}\n\n# רמת ביצוע: ${depth}\n${depthGuide}${outputFmt}`;

  if (numCalls === 1) return [base + '\n\nבצע את העיבוד והחזר את קבצי הפלט.'];
  if (numCalls === 2) return [
    base + '\n\n**שלב א — ניתוח:** נתח את קבצי הקלט לפי ההוראות. זהה מבנה, תכנים ודפוסים. הכן תכנית לפלט.',
    base + '\n\n**שלב ב — הפקה:** על סמך הניתוח, הפק את כל קבצי הפלט הנדרשים.',
  ];
  return [
    base + '\n\n**שלב א — ניתוח מעמיק:** נתח את קבצי הקלט לעומק. זהה מבנה, תכנים, חריגות ונקודות מרכזיות.',
    base + '\n\n**שלב ב — הפקה:** הפק את קבצי הפלט הנדרשים בצורה מלאה ומפורטת.',
    base + '\n\n**שלב ג — שיפור:** בדוק ושפר את הפלט. הוסף תרשימים וטבלאות. החזר את הגרסה הסופית.',
  ];
}

function parseOutputFiles(text) {
  const files = [];
  const re = /===FILE_START:\s*(.+?)===\n([\s\S]*?)\n?===FILE_END===/g;
  let m;
  while ((m = re.exec(text)) !== null) files.push({ name: m[1].trim(), content: m[2].trim() });
  return files;
}

function appendOutputFilesUI(files) {
  const msgs = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg chat-msg-assistant';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-weight:600;font-size:.87rem;color:#166534;margin-bottom:.4rem;';
  hdr.textContent = '📥 קבצי פלט — לחץ להורדה:';
  bubble.appendChild(hdr);
  files.forEach(f => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.5rem .8rem;gap:.5rem;margin-bottom:.3rem;';
    const nm = document.createElement('span');
    nm.style.cssText = 'font-size:.83rem;color:#166534;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nm.textContent = '📄 ' + f.name;
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:.28rem .75rem;background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.78rem;font-family:Heebo,sans-serif;font-weight:600;white-space:nowrap;flex-shrink:0;';
    btn.textContent = '⬇ הורד';
    btn.addEventListener('click', () => triggerDownload(f.name, f.content, guessMime(f.name)));
    row.appendChild(nm); row.appendChild(btn);
    bubble.appendChild(row);
  });
  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

// ── API ────────────────────────────────────────────────────────────────────
async function dynCallWithFallback(prompt, startIdx) {
  let mIdx = startIdx;
  while (true) {
    try {
      return await deps.callGeminiForSpec(prompt, mIdx);
    } catch (err) {
      const q = deps.isQuotaExceeded(err.message);
      const b = /503|high demand|overload|temporarily/i.test(err.message);
      if ((q || b) && mIdx < deps.MODEL_CHAIN.length - 1) {
        mIdx++;
        deps.setModelIdx(mIdx);
        deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[mIdx]}… 🔄`);
        await new Promise(r => setTimeout(r, 2000));
      } else throw err;
    }
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function setTitle(title, subtitle) {
  const t = document.getElementById('dyn-title');
  const s = document.getElementById('dyn-subtitle');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
}
function setBody(html)   { const el = document.getElementById('dyn-body');   if (el) el.innerHTML = html; }
function setFooter(html) { const el = document.getElementById('dyn-footer'); if (el) el.innerHTML = html; }

function showSpinner(msg) {
  setBody(`<div style="display:flex;align-items:center;gap:.75rem;color:#64748b;font-size:.88rem;padding:.5rem 0;">
    <div class="dyn-spinner"></div><span>${msg}</span>
  </div>`);
  setFooter('');
}

function showError(msg, onBack) {
  setBody(`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">❌ שגיאה: ${deps.escHtml(msg)}</div>`);
  const footer = document.getElementById('dyn-footer');
  if (!footer) return;
  footer.innerHTML = '';
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;gap:.6rem;justify-content:space-between;';
  const back = document.createElement('button');
  back.textContent = '← חזור';
  back.style.cssText = 'padding:.45rem .9rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.84rem;font-family:Heebo,sans-serif;color:#374151;';
  back.onclick = onBack || showMode;
  const close = document.createElement('button');
  close.textContent = 'סגור';
  close.style.cssText = back.style.cssText;
  close.onclick = window.closeDynamicModal;
  d.appendChild(back); d.appendChild(close);
  footer.appendChild(d);
}

function showFileToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:.6rem 1rem;border-radius:9px;font-size:.83rem;font-family:Heebo,sans-serif;z-index:9999;box-shadow:0 2px 12px rgba(0,0,0,.15);';
  t.textContent = '❌ ' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function triggerDownload(name, content, mime) {
  const blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function guessMime(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return { md: 'text/markdown', txt: 'text/plain', csv: 'text/csv', json: 'application/json', html: 'text/html' }[ext] || 'text/plain';
}

function fileEmoji(mimeType) {
  if (!mimeType) return '📎';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  return '📎';
}
