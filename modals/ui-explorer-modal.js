import { deps } from './deps.js';

// ── State ─────────────────────────────────────────────────────────────────
let phase = 'pick';
let pickedFile = null;

// ── Init ──────────────────────────────────────────────────────────────────
export function initUiExplorerModal() {
  injectModal();
}

function injectModal() {
  if (document.getElementById('ui-explorer-modal')) return;

  const style = document.createElement('style');
  style.textContent = '@keyframes uie-spin{to{transform:rotate(360deg)}} .uie-spinner{animation:uie-spin .7s linear infinite}';
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'ui-explorer-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:900;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:640px;width:calc(100% - 2rem);max-height:92vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;display:flex;align-items:center;gap:.4rem;">🔬 חוקר ממשק המשתמש</h3>
          <p style="margin:0;color:#64748b;font-size:.82rem;">העלה קובץ HTML של עיצוב וקבל קובץ מוגדר עם הערות על שחקנים, זרימות ונתונים</p>
        </div>
        <button onclick="window.closeUiExplorerModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>
      <div id="uie-body" style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:1rem;"></div>
      <div id="uie-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeUiExplorerModal(); });
  document.body.appendChild(modal);
}

// ── Open / Close ──────────────────────────────────────────────────────────

window.openUiExplorerModal = function () {
  if (deps.getIsLoading()) return;
  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }
  phase = 'pick';
  pickedFile = null;
  document.getElementById('ui-explorer-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showPhasePick();
};

window.closeUiExplorerModal = function () {
  document.getElementById('ui-explorer-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ── Phase 1: pick file + level ────────────────────────────────────────────

function showPhasePick() {
  setBody(`
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:.85rem;font-weight:600;color:#1e293b;margin-bottom:.3rem;">📄 בחר קובץ HTML לחקירה</div>
      <div style="font-size:.8rem;color:#64748b;">הסוכן יזהה שחקנים, זרימות עבודה, נתוני דמה ומעברי מסך — ויחזיר קובץ HTML מוגדר עם הערות מפורטות.</div>
    </div>

    <label id="uie-drop" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.1rem;text-align:center;cursor:pointer;background:#fff;transition:.15s;">
      <input type="file" id="uie-file-input" accept=".html,.htm" hidden />
      <div id="uie-drop-label" style="font-size:.88rem;color:#475569;">
        <span style="font-size:1.6rem;display:block;margin-bottom:.25rem;">🌐</span>
        לחץ לבחירת קובץ HTML או גרור לכאן
      </div>
    </label>

    <div style="display:flex;flex-direction:column;gap:.4rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:.8rem 1rem;">
      <div style="font-size:.8rem;font-weight:700;color:#374151;margin-bottom:.15rem;">רמת חקירה</div>
      ${[
        { v: 'basic',  checked: true,  label: 'בסיסית', calls: '1 קריאה',  tip: 'זיהוי שחקנים וזרימות + הערות עיקריות. מהיר.' },
        { v: 'normal', checked: false, label: 'רגילה',  calls: '2 קריאות', tip: 'ניתוח מעמיק + הערות מפורטות לכל קטע.' },
        { v: 'high',   checked: false, label: 'גבוהה',  calls: '3 קריאות', tip: 'חקירה מלאה: שחקנים, זרימות, נתונים, מעברים, וסיכום פתיחה.' },
      ].map(o => `
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem;padding:.15rem 0;">
          <input type="radio" name="uie-level" value="${o.v}" ${o.checked ? 'checked' : ''} style="accent-color:#7c3aed;">
          <span style="color:#1e293b;min-width:80px;"><strong>${o.label}</strong></span>
          <span style="color:#64748b;font-size:.76rem;">— ${o.calls}</span>
          <span title="${o.tip}" style="margin-right:auto;color:#7c3aed;font-size:.78rem;cursor:help;" tabindex="0">ⓘ</span>
        </label>`).join('')}
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeUiExplorerModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button id="uie-run-btn" onclick="window.runUiExplorer()" disabled style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);opacity:.55;">🔬 חקור ממשק</button>
    </div>`);

  const fileInput = document.getElementById('uie-file-input');
  const drop = document.getElementById('uie-drop');

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (f) await onPickFile(f);
  });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = '#f5f3ff'; });
  drop.addEventListener('dragleave', () => { drop.style.background = '#fff'; });
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    drop.style.background = '#fff';
    const f = e.dataTransfer.files[0];
    if (f) await onPickFile(f);
  });
}

async function onPickFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['html', 'htm'].includes(ext)) {
    showInlineError(`סוג קובץ לא נתמך: .${ext}. יש להעלות קובץ HTML בלבד.`);
    return;
  }
  try {
    const text = await file.text();
    pickedFile = { name: file.name, text };
    const label = document.getElementById('uie-drop-label');
    if (label) {
      label.innerHTML = `
        <span style="font-size:1.6rem;display:block;margin-bottom:.25rem;">✅</span>
        <strong style="color:#6d28d9;">${deps.escHtml(file.name)}</strong>
        <div style="font-size:.75rem;color:#64748b;margin-top:.2rem;">${Math.round(text.length / 1024)} KB · לחץ לבחירת קובץ אחר</div>`;
    }
    const btn = document.getElementById('uie-run-btn');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  } catch (e) {
    showInlineError('שגיאה בקריאת הקובץ: ' + (e.message || e));
  }
}

function showInlineError(msg) {
  let host = document.getElementById('uie-inline-err');
  if (!host) {
    host = document.createElement('div');
    host.id = 'uie-inline-err';
    host.style.cssText = 'background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.6rem .85rem;color:#b91c1c;font-size:.83rem;';
    document.getElementById('uie-body').appendChild(host);
  }
  host.textContent = '❌ ' + msg;
}

// ── Phase 2: run ──────────────────────────────────────────────────────────

window.runUiExplorer = async function () {
  if (!pickedFile) return;
  const level = document.querySelector('input[name="uie-level"]:checked')?.value || 'basic';
  const numCalls = { basic: 1, normal: 2, high: 3 }[level] || 1;

  phase = 'running';
  showLoading(`מנתח ממשק — שלב 1 מתוך ${numCalls}…`);

  let mIdx = deps.getModelIdx();
  let analysisResult = null;
  let annotatedHtml = null;

  try {
    if (numCalls === 1) {
      // Single call: full analysis + annotation in one shot
      updateLoading('מנתח ממשק ומייצר הערות — קריאה אחת…');
      const prompt = buildSingleCallPrompt(pickedFile.name, pickedFile.text);
      annotatedHtml = await callWithFallback(prompt, mIdx);
      mIdx = deps.getModelIdx();

    } else if (numCalls === 2) {
      // Call 1: deep analysis
      updateLoading('שלב 1/2 — ניתוח מעמיק של שחקנים, זרימות ונתונים…');
      const p1 = buildAnalysisPrompt(pickedFile.name, pickedFile.text);
      analysisResult = await callWithFallback(p1, mIdx);
      mIdx = deps.getModelIdx();

      // Call 2: annotate HTML based on analysis
      updateLoading('שלב 2/2 — הוספת הערות מפורטות לקובץ HTML…');
      const p2 = buildAnnotationPrompt(pickedFile.name, pickedFile.text, analysisResult, 'normal');
      annotatedHtml = await callWithFallback(p2, mIdx);
      mIdx = deps.getModelIdx();

    } else {
      // Call 1: analysis
      updateLoading('שלב 1/3 — ניתוח מעמיק: שחקנים, זרימות, נתוני דמה ומעברי מסך…');
      const p1 = buildAnalysisPrompt(pickedFile.name, pickedFile.text);
      analysisResult = await callWithFallback(p1, mIdx);
      mIdx = deps.getModelIdx();

      // Call 2: annotate
      updateLoading('שלב 2/3 — הוספת הערות מפורטות לכל קטע בקוד…');
      const p2 = buildAnnotationPrompt(pickedFile.name, pickedFile.text, analysisResult, 'high');
      annotatedHtml = await callWithFallback(p2, mIdx);
      mIdx = deps.getModelIdx();

      // Call 3: enrich with summary header and cross-screen navigation comments
      updateLoading('שלב 3/3 — הוספת סיכום ראשי ובדיקת עקביות הערות…');
      const p3 = buildEnrichmentPrompt(pickedFile.name, annotatedHtml, analysisResult);
      annotatedHtml = await callWithFallback(p3, mIdx);
      mIdx = deps.getModelIdx();
    }
  } catch (err) {
    phase = 'error';
    showError(err.message || String(err));
    return;
  }

  const cleaned = extractHtml(annotatedHtml);
  if (!cleaned) {
    phase = 'error';
    showError('לא התקבל HTML תקין מהמודל. נסה שוב או בחר רמת חקירה שונה.');
    return;
  }

  phase = 'done';
  downloadHtml(cleaned);
  showDone(level);
};

// ── Prompts ───────────────────────────────────────────────────────────────

function buildSingleCallPrompt(filename, htmlText) {
  return `אתה חוקר ממשק משתמש מומחה. קיבלת קובץ HTML של עיצוב UI שאינו מחובר לשום מערכת.

שמך: קובץ HTML "${filename}"

תוכן הקובץ:
\`\`\`html
${htmlText}
\`\`\`

משימתך: החזר את אותו קובץ HTML, מועשר בהערות מפורטות בעברית.

## הוראות

**בתחילת הקובץ** (לאחר תגית <!DOCTYPE> ולפני <html>), הוסף בלוק הערה ראשי גדול המכיל:
1. רשימת כל סוגי השחקנים שזיהית (למשל: מנהל, עובד, לקוח, אדמין)
2. לכל שחקן — זרימת העבודה שלו (רצף מסכים/פעולות)
3. מפת מסכים — אילו מסכים/קטעים שייכים לאיזה שחקן
4. רשימת נתוני דמה שזיהית (שמות, מספרים, תאריכים שהם דוגמה בלבד)

**לאורך הקוד** הוסף הערות HTML מיד לפני/בתוך קטעים רלוונטיים:
- <!-- [DB_DATA] שדה זה מציג נתון שיגיע מבסיס הנתונים: [תיאור] -->
- <!-- [MOCK_DATA] נתון דמה/דוגמה בלבד: [הסבר] -->
- <!-- [ACTOR: שם_שחקן] קטע זה מוצג רק לשחקן: [תיאור] -->
- <!-- [SCREEN_TRANSITION] לחיצה כאן עוברת למסך: [שם המסך] בתנאי: [תנאי] -->
- <!-- [CONDITIONAL_DISPLAY] קטע זה מוצג רק כאשר: [תנאי] -->
- <!-- [WORKFLOW_STEP: שם_שחקן] שלב [מספר] מתוך [סה"כ] בזרימת: [שם הזרימה] -->

**כללי ברזל:**
- החזר אך ורק את ה-HTML המלא עם ההערות, ללא טקסט נלווה לפני או אחרי
- אל תשנה את הקוד עצמו, רק הוסף הערות
- כתוב את כל ההערות בעברית
- הוסף הערות לכל אלמנט אינטראקטיבי (כפתורים, קישורים, טפסים, טאבים)
- הוסף הערות לכל טבלת נתונים, כרטיס, או רשימה
- ציין בבירור מתי נתון הוא ערך דמה לעומת שדה שיגיע מה-DB`;
}

function buildAnalysisPrompt(filename, htmlText) {
  return `אתה חוקר ממשק משתמש מומחה. קיבלת קובץ HTML של עיצוב UI שאינו מחובר לשום מערכת.

שמך: קובץ HTML "${filename}"

תוכן הקובץ:
\`\`\`html
${htmlText}
\`\`\`

## משימה — ניתוח מעמיק

בצע ניתוח מקיף של הממשק והחזר דוח JSON מובנה בלבד (ללא טקסט נלווה, ללא בלוקי קוד):

{
  "actors": [
    {
      "id": "מזהה_ייחודי",
      "name": "שם השחקן",
      "description": "תיאור קצר",
      "screens": ["שמות מסכים/קטעים השייכים לשחקן זה"],
      "workflow": [
        { "step": 1, "action": "פעולה", "screen": "מסך", "condition": "תנאי אם יש" }
      ]
    }
  ],
  "screens": [
    {
      "id": "מזהה_מסך",
      "name": "שם המסך",
      "description": "מה המסך עושה",
      "actors": ["אילו שחקנים רואים אותו"],
      "transitions": [
        { "trigger": "כפתור/אלמנט", "targetScreen": "מסך יעד", "condition": "תנאי" }
      ]
    }
  ],
  "dataFields": [
    {
      "element": "תיאור האלמנט (למשל: טבלת הרשיונות שורה 1)",
      "type": "DB_DATA | MOCK_DATA | STATIC_LABEL",
      "description": "מה הנתון הזה מייצג",
      "example": "ערך הדוגמה הנוכחי אם קיים"
    }
  ],
  "conditionalSections": [
    {
      "description": "תיאור הקטע",
      "condition": "מתי מוצג",
      "actors": ["לאילו שחקנים"]
    }
  ]
}`;
}

function buildAnnotationPrompt(filename, htmlText, analysis, depth) {
  const depthNote = depth === 'high'
    ? 'הוסף הערות לכל אלמנט, כולל אלמנטים קטנים כמו badges, תגיות סטטוס, וכפתורי פעולה בשורות טבלה.'
    : 'הוסף הערות לכל הקטעים הגדולים ולאלמנטים האינטראקטיביים המרכזיים.';

  return `אתה חוקר ממשק משתמש מומחה. עבדת על ניתוח קובץ HTML "${filename}" וקיבלת את הניתוח הבא:

${analysis}

כעת קיבלת את קובץ ה-HTML המקורי:
\`\`\`html
${htmlText}
\`\`\`

## משימה — הוספת הערות לקובץ HTML

החזר את ה-HTML המלא עם הערות מפורטות בעברית, לפי הניתוח שביצעת.

**בתחילת הקובץ** (לאחר <!DOCTYPE>), הוסף בלוק הערה ראשי:
<!--
================================================================
  חוקר ממשק המשתמש — ניתוח מלא
================================================================

📌 סוגי שחקנים:
[פרט את כל השחקנים, תפקידם, והמסכים שלהם]

🔄 זרימות עבודה:
[לכל שחקן — רצף הצעדים שלו]

🖥️ מפת מסכים:
[לכל מסך — מי רואה אותו ומתי]

💾 נתוני דמה vs. נתוני DB:
[סיכום הממצאים]
================================================================
-->

**לאורך הקוד** הוסף הערות HTML עם הפורמטים הבאים:
- <!-- [DB_DATA] שדה זה מציג נתון שיגיע מבסיס הנתונים: [תיאור] -->
- <!-- [MOCK_DATA] נתון דמה/דוגמה בלבד: [הסבר] -->
- <!-- [ACTOR: שם_שחקן] קטע זה מוצג רק לשחקן: [תיאור] -->
- <!-- [SCREEN_TRANSITION] לחיצה כאן עוברת למסך: [שם המסך] בתנאי: [תנאי] -->
- <!-- [CONDITIONAL_DISPLAY] קטע זה מוצג רק כאשר: [תנאי] -->
- <!-- [WORKFLOW_STEP: שם_שחקן] שלב [מספר] בזרימת: [שם הזרימה] -->

${depthNote}

**כללי ברזל:**
- החזר אך ורק את ה-HTML המלא, ללא טקסט נלווה לפני או אחרי
- אל תשנה את הקוד עצמו, רק הוסף הערות
- כל ההערות בעברית`;
}

function buildEnrichmentPrompt(filename, annotatedHtml, analysis) {
  return `אתה חוקר ממשק משתמש מומחה. יש לך קובץ HTML מוגדר עם הערות ראשוניות עבור "${filename}".

## הניתוח שבוצע:
${analysis}

## קובץ HTML עם הערות ראשוניות:
\`\`\`html
${annotatedHtml}
\`\`\`

## משימה — העשרה וסיכום

בצע את השיפורים הבאים:

1. **ודא שבלוק הפתיחה הראשי מלא ומפורט** — עם כל השחקנים, זרימות העבודה המלאות, ומפת המסכים המלאה.

2. **הוסף הערות חסרות** לאלמנטים שלא קיבלו הערה בקריאה הקודמת, בדגש על:
   - שדות בטפסים שטרם תועדו
   - שורות בטבלאות שמציגות נתוני DB
   - כפתורי פעולה בשורות (עריכה, מחיקה, אישור)
   - אלמנטי סטטוס (badge, תגיות, chips)

3. **הוסף הערות ניווט בין-מסכי** — בכל מקום שמסך אחד מוביל לאחר, הוסף הערה מפורטת.

4. **הוסף בסוף הקובץ**, לפני תגית הסגירה האחרונה, בלוק הערה של "סיכום זרימות":
<!--
================================================================
  סיכום זרימות עבודה — קוד
================================================================
[לכל שחקן, רשימה ממוספרת של צעדי הזרימה עם שמות האלמנטים בקוד]
================================================================
-->

**כלל:** החזר אך ורק את ה-HTML המלא, ללא טקסט נלווה.`;
}

// ── Utilities ─────────────────────────────────────────────────────────────

function extractHtml(raw) {
  if (!raw) return null;
  let s = raw.trim();
  // strip markdown code fences if present
  const fenceMatch = s.match(/^```(?:html)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) s = fenceMatch[1].trim();
  // must contain at least a doctype or an html tag
  if (/<(!DOCTYPE|html)/i.test(s)) return s;
  return null;
}

async function callWithFallback(prompt, startIdx) {
  let mIdx = startIdx;
  while (true) {
    try {
      return await deps.callGeminiForSpec(prompt, mIdx, null);
    } catch (err) {
      const msg = err.message || '';
      const quota = deps.isQuotaExceeded(msg);
      const busy  = /503|high demand|overload|temporarily|429/i.test(msg);
      if ((quota || busy) && mIdx < deps.MODEL_CHAIN.length - 1) {
        mIdx++;
        deps.setModelIdx(mIdx);
        updateLoading(`עובר למודל ${deps.MODEL_CHAIN[mIdx]} ומנסה שוב…`);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        throw err;
      }
    }
  }
}

function downloadHtml(content) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const base = (pickedFile?.name || 'ui').replace(/\.[^.]+$/, '');
  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  a.download = `${base}_explored_${ts}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Phase 3: done / error ─────────────────────────────────────────────────

function showDone(level) {
  const labels = { basic: 'בסיסית (1 קריאה)', normal: 'רגילה (2 קריאות)', high: 'גבוהה (3 קריאות)' };
  setBody(`
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:.95rem;font-weight:700;color:#4c1d95;margin-bottom:.3rem;">✅ הניתוח הושלם וההורדה החלה</div>
      <div style="font-size:.83rem;color:#6d28d9;">קובץ מקור: <strong>${deps.escHtml(pickedFile?.name || '')}</strong></div>
      <div style="font-size:.83rem;color:#6d28d9;">רמת חקירה: <strong>${labels[level] || level}</strong></div>
    </div>
    <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:9px;padding:.85rem 1rem;font-size:.82rem;color:#374151;line-height:1.6;">
      <strong>מה כולל הקובץ שהורד:</strong>
      <ul style="margin:.4rem 0 0;padding-right:1.2rem;color:#4b5563;">
        <li>בלוק פתיחה עם כל השחקנים וזרימות העבודה שלהם</li>
        <li>הערות <code>[DB_DATA]</code> לנתונים שיגיעו מבסיס נתונים</li>
        <li>הערות <code>[MOCK_DATA]</code> לנתוני דמה/דוגמה</li>
        <li>הערות <code>[ACTOR]</code> לקטעים ייחודיים לשחקן</li>
        <li>הערות <code>[SCREEN_TRANSITION]</code> למעברי מסך</li>
        <li>הערות <code>[WORKFLOW_STEP]</code> לצעדים בזרימת העבודה</li>
      </ul>
    </div>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeUiExplorerModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.openUiExplorerModal()" style="padding:.5rem 1.2rem;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">🔬 חקור קובץ נוסף</button>
    </div>`);
}

function showError(msg) {
  setBody(`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">❌ שגיאה: ${deps.escHtml(msg)}</div>`);
  setFooter(`<div style="display:flex;gap:.7rem;justify-content:space-between;">
    <button onclick="window.closeUiExplorerModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
    <button onclick="window.openUiExplorerModal()" style="padding:.48rem 1rem;background:#7c3aed;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;">נסה שוב</button>
  </div>`);
}

function showLoading(msg) {
  setBody(`<div id="uie-loading" style="display:flex;align-items:center;gap:.7rem;color:#64748b;font-size:.88rem;padding:.5rem 0;">
    <div class="uie-spinner" style="width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;flex-shrink:0;"></div>
    <span id="uie-loading-text">${msg || 'טוען…'}</span>
  </div>`);
  setFooter('');
}

function updateLoading(msg) {
  const t = document.getElementById('uie-loading-text');
  if (t) t.textContent = msg;
}

function setBody(html) {
  const el = document.getElementById('uie-body');
  if (el) el.innerHTML = html;
}

function setFooter(html) {
  const el = document.getElementById('uie-footer');
  if (el) el.innerHTML = html;
}
