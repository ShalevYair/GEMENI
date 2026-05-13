import { deps } from './deps.js';

// Natural file extensions treated as plain text
const NATURAL_EXTS = new Set(['nsp','nsa','nsd','nsc','nsl','nsg','ncp','nst','nsm','nat']);

const NATURAL_SYSTEM = `You are a Senior System Analyst specialized in Natural (Software AG) and Adabas databases, with deep expertise in legacy mainframe systems.

You received a Natural source file (Program / Subprogram / Subroutine / Map / Copycode / Helproutine).

**Your mission:** Produce a **Hebrew Functional Specification** that explains the WHAT and WHY — not a line-by-line translation. Think like a business analyst who needs to hand this document to a developer who has never seen this system.

**About this code:** It is legacy. Expect archaic constructs, cryptic variable names (#A, #WS-VAR, RC-MISPAR-RECHEV), old-style DEFINE DATA, Adabas/DB2/VSAM access, and CALLNAT to programs not present in this file. If something is unclear — say so explicitly. Never invent.

**Mandatory rules:**
1. Group related statements into logical steps — never describe each command separately.
2. Translate technical names to business terms: "RC-MISPAR-RECHEV" → "מספר רכב (RC-MISPAR-RECHEV)". Always keep the original name in parentheses.
3. If the file is empty, truncated, or malformed — state that at the top and stop.
4. Object names, DDMs, and variables always appear in their original form (English/uppercase), with a Hebrew explanation.
5. Hebrew comments or strings in the code are valuable context — use them to understand business intent.
6. Write flowing numbered prose — no pseudocode.
7. Scale depth to code size: large files → aggressive grouping; small files → more detail.
8. **Output: Markdown, Hebrew, RTL.**`;

// ── Prompt section blocks ─────────────────────────────────────────────────

const SECTIONS_ALL = `
## Output Structure — All Sections:

### 1. מטאדטה (Metadata)
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | Program / Subprogram / Subroutine / Map / Copycode / Helproutine |
| מטרה כללית | (משפט אחד) |
| ישויות עסקיות מרכזיות | (Vehicles, Owners, Licenses — מה הקוד נוגע בו עסקית) |
| קלטים | (פרמטרים, INPUT USING MAP) |
| פלטים | (פרמטרים מוחזרים, DISPLAY, WRITE WORK FILE, עדכוני DB) |
| תלויות חיצוניות | (CALLNAT, FETCH, INCLUDE) |
| בסיסי נתונים / קבצים | (Adabas DDM, SQL tables, Work Files, Print Files) |

### 2. תיאור עסקי
3-6 שורות המסבירות **מה הקוד עושה ולמה הוא קיים** מנקודת מבט עסקית: איזו בעיה פותר, מי משתמש בו, מה התוצאה הסופית. השתמש בהערות ובשמות הקוד כדי לחלץ כוונה — לא רק מכניקה.

### 3. זרימה לוגית — שלבים מרכזיים
רשימה ממוספרת של שלבים רעיוניים (לא פקודות). כל שלב = פעולה לוגית משמעותית.

כללי קיבוץ:
- אתחולים רצופים → שלב אחד: "אתחול משתני עבודה".
- כל IF / DECIDE ON / DECIDE FOR משמעותי → שלב נפרד עם תת-סעיפים לכל ענף.
- כל READ / FIND / HISTOGRAM / SELECT → שלב נפרד: ציין DDM/טבלה + תנאי חיפוש + מה קורה אם לא נמצא.
- כל לולאה (READ...END-READ, REPEAT, FOR) → שלב נפרד: על מה רצים, מה קורה בכל איטרציה, תנאי יציאה.
- כל STORE / UPDATE / DELETE / END TRANSACTION → שלב נפרד.
- כל CALLNAT / PERFORM → שלב נפרד: שם + מה מועבר + מה מוחזר.
- כל INPUT / REINPUT → שלב נפרד.
- כל WRITE / DISPLAY / WRITE WORK FILE → שלב נפרד.

### 4. כללים עסקיים מרכזיים
בלוק זה הוא לב-ליבו של המסמך. זהה ורשום בפירוש את **כל כלל עסקי** המוטמע בקוד.
חפש בעיקר ב: IF, DECIDE ON/FOR, WHERE, WHEN.
פורמט לכל כלל: "אם [תנאי] → אז [פעולה/חסימה/מסלול חלופי]"
דוגמה: "אם סוג הרכב הוא X ותוקף הרישיון פג → העברת הבעלות חסומה, מוצגת הודעת שגיאה Y."

### 5. גישות לנתונים (CRUD)
טבלה:
| מקור (DDM / Table / Work File) | פעולה (READ/FIND/STORE/UPDATE/DELETE) | מפתח / תנאי | מטרה עסקית |

### 6. נקודות אינטגרציה (CALLNAT / FETCH / CALL)
לכל קריאה חיצונית:
- **שם:** ...
- **סוג:** CALLNAT / FETCH / CALL
- **פרמטרים:** קלט → פלט
- **תפקיד עסקי:** מה השירות הזה מספק לתוכנית הקוראת?

### 7. היסטוריית תחזוקה
חפש הערות המכילות: תאריכים, "BUS", "BUG", "Y2K", שמות מפתחים, מספרי גרסה, או כל אינדיקציה לשינוי היסטורי.
סכם: מה השתנה, מתי, ולמה (לפי מה שניתן להסיק).
אם אין הערות כאלה — ציין זאת.

### 8. טיפול בשגיאות
- האם יש ON ERROR block? מה קורה בו?
- האם נבדקים RESPONSE-CODE / *ERROR-NR / *ERROR-LINE?
- כשל DB: No records found / Duplicate / Hold — מה קורה?
- האם יש BACKOUT TRANSACTION?

### 9. הערות וביקורת בונה
- **חוב טכני:** GOTO, קוד מת, כפילויות, hardcoded values, משתנים גלובליים בעייתיים.
- **סיכונים:** READ ללא LIMIT, לולאות ללא תנאי יציאה, פעולות DB ללא בדיקת RESPONSE-CODE, אין END TRANSACTION.
- **חוסר בהירות:** CALLNAT-ים שתפקידם לא ניתן להסקה ללא הקוד החיצוני.
- **הצעות לשיפור / מודרניזציה.**`;

const SECTIONS_PART1 = `
## Output — Part A (Sections 1–4):

### 1. מטאדטה (Metadata)
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | Program / Subprogram / Subroutine / Map / Copycode / Helproutine |
| מטרה כללית | (משפט אחד) |
| ישויות עסקיות מרכזיות | |
| קלטים | |
| פלטים | |
| תלויות חיצוניות | |
| בסיסי נתונים / קבצים | |

### 2. תיאור עסקי
3-6 שורות: מה הקוד עושה ולמה קיים, מנקודת מבט עסקית.

### 3. זרימה לוגית — שלבים מרכזיים
רשימה ממוספרת. כל שלב = פעולה לוגית משמעותית (לא פקודה).
- אתחולים → שלב אחד.
- IF/DECIDE → שלב נפרד עם תת-סעיפים לכל ענף.
- READ/FIND/SELECT → שלב נפרד: DDM + תנאי + מה אם לא נמצא.
- לולאה → שלב נפרד: על מה + מה בכל איטרציה + יציאה.
- STORE/UPDATE/DELETE/END TRANSACTION → שלב נפרד.
- CALLNAT/PERFORM → שלב נפרד: שם + קלט/פלט.
- INPUT/REINPUT → שלב נפרד.
- WRITE/DISPLAY → שלב נפרד.

### 4. כללים עסקיים מרכזיים
זהה כל כלל עסקי מ-IF / DECIDE / WHERE / WHEN.
פורמט: "אם [תנאי] → [פעולה/חסימה/מסלול]"`;

const SECTIONS_PART2 = `
## Output — Part B (Sections 5–9):
(המשך ניתוח אותו קובץ Natural)

### 5. גישות לנתונים (CRUD)
| מקור | פעולה | מפתח / תנאי | מטרה עסקית |

### 6. נקודות אינטגרציה (CALLNAT / FETCH / CALL)
לכל קריאה: שם, סוג, פרמטרים (קלט/פלט), תפקיד עסקי.

### 7. היסטוריית תחזוקה
חפש הערות עם תאריכים, "BUS"/"BUG"/"Y2K"/שמות מפתחים. סכם שינויים היסטוריים. אם אין — ציין זאת.

### 8. טיפול בשגיאות
- ON ERROR block?
- בדיקת RESPONSE-CODE / *ERROR-NR / *ERROR-LINE?
- כשל DB (No records / Duplicate / Hold)?
- BACKOUT TRANSACTION?

### 9. הערות וביקורת בונה
- **חוב טכני:** GOTO, קוד מת, כפילויות, hardcoded values.
- **סיכונים:** READ ללא LIMIT, לולאות ללא יציאה, DB ללא RESPONSE-CODE.
- **חוסר בהירות:** CALLNAT-ים שלא ניתן להסיק.
- **הצעות לשיפור / מודרניזציה.**`;

const SECTIONS_HIGH_1 = `
## Output — Part A (Sections 1–2, deep):

### 1. מטאדטה (Metadata) — מפורטת
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | |
| מטרה כללית | |
| ישויות עסקיות מרכזיות | (פרט: Vehicles / Owners / Licenses וכד') |
| קלטים | (כל פרמטר: שם מקורי → משמעות עסקית, סוג, אורך) |
| פלטים | (כל פרמטר: שם מקורי → משמעות עסקית, יעד) |
| תלויות חיצוניות | (CALLNAT, FETCH, INCLUDE — עם הסבר לכל אחד) |
| בסיסי נתונים / קבצים | (DDM + מספרי שדות אם ידוע) |

### 2. תיאור עסקי — מפורט
5-8 שורות. כלול:
- ההקשר העסקי: באיזה תהליך/מחלקה נמצאת תוכנית זו?
- מה הבעיה שהיא פותרת.
- מי קורא לה / מי המשתמש הסופי.
- מה התוצאה הסופית ומה השפעתה על המערכת.
- האם ניתן להסיק מה הניע את יצירתה (לפי הערות, שמות, לוגיקה)?`;

const SECTIONS_HIGH_2 = `
## Output — Part B (Sections 3–4, deep):
(המשך ניתוח אותו קובץ Natural)

### 3. זרימה לוגית — שלבים מרכזיים (מעמיק)
רשימה ממוספרת מפורטת. לכל שלב — הסבר גם את ההיגיון העסקי, לא רק הפעולה.

- אתחולים → שלב אחד: פרט אילו משתנים מאופסים ולמה זה חשוב.
- IF/DECIDE → תת-סעיפים לכל ענף עם ההיגיון העסקי של כל בחירה.
- READ/FIND → DDM + תנאי חיפוש + מה אם לא נמצא + מה אם יש כפילות.
- לולאה → על מה רצים, מה קורה בכל איטרציה, תנאי יציאה, סיכוני לולאה אינסופית.
- STORE/UPDATE/DELETE → אילו שדות בדיוק מתעדכנים, מה ה-commit strategy.
- CALLNAT/PERFORM → כל פרמטר עם כיוון (קלט/פלט) ומשמעות עסקית.
- INPUT/REINPUT → שם ה-Map, מה המשתמש מזין, validations.
- WRITE/DISPLAY → תיאור הפלט ומי מקבל אותו.

### 4. כללים עסקיים מרכזיים (מעמיק)
זה לב-ליבו של המסמך. רשום **כל** כלל עסקי מ-IF/DECIDE/WHERE/WHEN.
לכל כלל:
- **תנאי:** [הפרמטרים המעורבים בניסוח עסקי]
- **פעולה:** [מה קורה — חסימה / ניתוב / חישוב / הודעה]
- **מקור בקוד:** [שורות / שמות משתנים רלוונטיים]`;

const SECTIONS_HIGH_3 = `
## Output — Part C (Sections 5–9, deep):
(המשך ניתוח אותו קובץ Natural)

### 5. גישות לנתונים (CRUD) — מפורט
| מקור (DDM / Table / Work File) | פעולה | מפתח / תנאי | שדות נגישים | מטרה עסקית |

### 6. נקודות אינטגרציה (CALLNAT / FETCH / CALL) — מפורט
לכל קריאה:
- **שם:** ...
- **סוג:** CALLNAT / FETCH / CALL
- **פרמטרי קלט:** ...
- **פרמטרי פלט:** ...
- **תפקיד עסקי:** מה השירות הזה מספק? מה קורה אחרי החזרה?
- **האם ידוע מה האובייקט הנקרא עושה?** (כן/לא/חלקית)

### 7. היסטוריית תחזוקה — מעמיק
חפש הערות המכילות: תאריכים, "BUS"/"BUG"/"Y2K"/"FIX", שמות מפתחים, מספרי CR/PR/ticket.
לכל ממצא: מה השתנה, מתי (אם ידוע), ולמה.
אם אין הערות היסטוריות — ציין זאת ורשום מה ניתן להסיק מהקוד עצמו (code smells, deprecated patterns).

### 8. טיפול בשגיאות — מעמיק
- ON ERROR block: קיים? מה קורה בו? האם כולל BACKOUT?
- RESPONSE-CODE: היכן נבדק? מה קורה לכל ערך?
- *ERROR-NR / *ERROR-LINE: האם נלכד ומתועד?
- כשל DB: No records found / Duplicate key / Record hold — מה קורה בכל מצב?
- האם יש מנגנון logging / reporting של שגיאות?
- האם יש סיכון לנתונים פגומים במקרה של כשל באמצע עסקה?

### 9. הערות וביקורת בונה — מעמיק
**חוב טכני:**
- GOTO-ים, קוד מת, כפילויות, hardcoded values, משתנים גלובליים בעייתיים.
- פקודות מיושנות עם חלופה מודרנית ב-Natural.

**סיכונים תפעוליים:**
- READ ללא LIMIT (סיכון ביצועים).
- לולאות ללא תנאי יציאה מפורש.
- DB ללא בדיקת RESPONSE-CODE.
- END TRANSACTION חסר / BACKOUT לא מכוסה.

**חוסר בהירות — נדרש בירור:**
- CALLNAT-ים שתפקידם לא ניתן להסקה.
- הנחות שנעשו בניתוח זה — ציין אותן במפורש.

**הצעות שיפור:**
- מה ניתן לשפר ב-Natural עצמה.
- אילו חלקים מועמדים למודרניזציה ובאיזו גישה.`;

// ── Module state ──────────────────────────────────────────────────────────
let natFile = null;

export function initNaturalModal() {
  injectNaturalModal();
}

function injectNaturalModal() {
  const modal = document.createElement('div');
  modal.id = 'natural-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:560px;width:calc(100% - 2rem);max-height:90vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">

      <!-- Header -->
      <div style="padding:1.25rem 1.5rem .9rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
        <h3 style="margin:0 0 .2rem;font-size:1.15rem;display:flex;align-items:center;gap:.5rem;color:#1e293b;">🖥️ NATURAL — ניתוח קובץ Natural</h3>
        <p style="margin:0;color:#64748b;font-size:.84rem;">העלה קובץ קוד Natural וקבל מסמך אפיון טכני-עסקי בעברית.</p>
      </div>

      <!-- Body -->
      <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1;">

        <!-- File upload -->
        <div style="margin-bottom:1.1rem;">
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.4rem;">קובץ Natural:</div>
          <label id="nat-dropzone" for="nat-file-input"
            style="display:block;border:2px dashed #c8d0e0;border-radius:9px;padding:1rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
            ondragover="event.preventDefault();this.style.borderColor='#0891b2';this.style.background='#f0f9ff';"
            ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
            ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.natHandleDrop(event);">
            <div style="font-size:1.6rem;margin-bottom:.25rem;">📄</div>
            <div style="color:#64748b;font-size:.82rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.75rem;">.nsp · .nsa · .nsd · .nsc · .nsl · .nsg · .nat · .txt (עד 2MB)</span></div>
            <input id="nat-file-input" type="file" accept=".nsp,.nsa,.nsd,.nsc,.nsl,.nsg,.ncp,.nst,.nsm,.nat,.txt" style="display:none;" onchange="window.natFileSelected(this.files)">
          </label>
          <div id="nat-file-display" style="margin-top:.5rem;"></div>
        </div>

        <!-- Depth selector -->
        <div>
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.5rem;">רמת עומק הניתוח:</div>
          <div style="display:flex;flex-direction:column;gap:.4rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.7rem .9rem;">

            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.84rem;">
              <input type="radio" name="nat-depth" value="high" style="accent-color:#0891b2;">
              <span style="color:#1e293b;"><strong>גבוהה</strong></span>
              <span style="color:#64748b;font-size:.76rem;">— 3 קריאות API, ניתוח מעמיק לכל סעיף</span>
            </label>

            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.84rem;">
              <input type="radio" name="nat-depth" value="normal" checked style="accent-color:#0891b2;">
              <span style="color:#1e293b;"><strong>רגילה</strong></span>
              <span style="color:#64748b;font-size:.76rem;">— 2 קריאות API (ברירת מחדל)</span>
            </label>

            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.84rem;">
              <input type="radio" name="nat-depth" value="basic" style="accent-color:#0891b2;">
              <span style="color:#1e293b;"><strong>בסיסית</strong></span>
              <span style="color:#64748b;font-size:.76rem;">— קריאה אחת, כל הסעיפים בבת אחת</span>
            </label>

          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;display:flex;gap:.75rem;justify-content:flex-end;flex-shrink:0;">
        <button onclick="window.closeNaturalModal()" style="padding:.5rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.88rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
        <button id="nat-generate-btn" onclick="window.generateNatural()" style="padding:.5rem 1.25rem;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(8,145,178,.35);">🖥️ נתח קובץ</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeNaturalModal(); });
  document.body.appendChild(modal);
}

// ── Window API ────────────────────────────────────────────────────────────

window.openNaturalModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('natural-modal');
  if (!modal) return;
  natFile = null;
  renderNatFileDisplay();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeNaturalModal = function () {
  const modal = document.getElementById('natural-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  natFile = null;
  const fi = document.getElementById('nat-file-input');
  if (fi) fi.value = '';
};

window.natHandleDrop = function (event) {
  const files = Array.from(event.dataTransfer.files || []);
  if (files[0]) setNatFile(files[0]);
};

window.natFileSelected = function (fileList) {
  if (fileList && fileList[0]) setNatFile(fileList[0]);
  const fi = document.getElementById('nat-file-input');
  if (fi) fi.value = '';
};

function setNatFile(file) {
  if (file.size > 2 * 1024 * 1024) {
    alert('הקובץ גדול מ-2MB. אנא חתוך את הקוד לחלקים קטנים יותר.');
    return;
  }
  natFile = file;
  renderNatFileDisplay();
}

function renderNatFileDisplay() {
  const el = document.getElementById('nat-file-display');
  if (!el) return;
  if (!natFile) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.5rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:.4rem .65rem;font-size:.82rem;">
      <span style="color:#0891b2;">📄</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e293b;">${deps.escHtml(natFile.name)}</span>
      <span style="color:#94a3b8;white-space:nowrap;">${(natFile.size / 1024).toFixed(0)} KB</span>
      <button onclick="window.natClearFile()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.9rem;padding:0 .15rem;line-height:1;" title="הסר">✕</button>
    </div>`;
}

window.natClearFile = function () {
  natFile = null;
  renderNatFileDisplay();
  const dz = document.getElementById('nat-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

// ── Generate ──────────────────────────────────────────────────────────────

window.generateNatural = async function () {
  if (!natFile) {
    const dz = document.getElementById('nat-dropzone');
    if (dz) { dz.style.borderColor = '#e53e3e'; setTimeout(() => { dz.style.borderColor = '#c8d0e0'; }, 2000); }
    return;
  }
  if (!deps.getApiKey()) {
    window.closeNaturalModal();
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  const depth        = document.querySelector('input[name="nat-depth"]:checked')?.value || 'normal';
  const fileToProcess = natFile;   // capture before closeNaturalModal clears natFile
  const fileName     = fileToProcess.name;

  window.closeNaturalModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

  // Read file — support Natural extensions as plain text
  let codeText = '';
  try {
    deps.updateTyping(progressId, `קורא קובץ: ${fileName}…`);
    codeText = await readNaturalFile(fileToProcess);
    if (!codeText.trim()) throw new Error('הקובץ ריק.');
  } catch (e) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  const fileHeader = `שם הקובץ: ${fileName}\n\n`;
  const codeBlock  = `\`\`\`natural\n${codeText}\n\`\`\``;
  const chunks     = buildChunks(depth, fileHeader, codeBlock);
  const results    = [];
  let mIdx         = deps.getModelIdx();

  try {
    for (let i = 0; i < chunks.length; i++) {
      deps.updateTyping(progressId, `מנתח… (${i + 1}/${chunks.length})`);
      results.push(await natCallWithFallback(chunks[i], mIdx));
    }
  } catch (err) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה: ' + err.message);
    return;
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  const combined  = results.join('\n\n---\n\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName  = `natural-analysis-${fileName.replace(/\.[^.]+$/, '')}-${timestamp}`;

  const mdBlob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const mdUrl  = URL.createObjectURL(mdBlob);
  const mdLink = document.createElement('a');
  mdLink.href = mdUrl; mdLink.download = `${baseName}.md`; mdLink.click();
  URL.revokeObjectURL(mdUrl);

  const depthLabel = depth === 'high' ? 'גבוהה (3 קריאות)' : depth === 'basic' ? 'בסיסית (קריאה אחת)' : 'רגילה (2 קריאות)';
  deps.appendMessage('assistant',
    `✅ ניתוח הקובץ \`${fileName}\` הורד כ-\`${baseName}.md\`\n\n**רמת עומק:** ${depthLabel}`
  );
};

// ── File reader ───────────────────────────────────────────────────────────

async function readNaturalFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (NATURAL_EXTS.has(ext) || ext === 'txt' || ext === 'csv' || ext === 'md') {
    return file.text();
  }
  // Try to use the shared readFile for docx etc., fall back to raw text
  try {
    const result = await deps.readFile(file);
    if (result.text) return result.text;
  } catch {}
  // Last resort: treat as UTF-8 text
  return file.text();
}

// ── Prompt assembly ───────────────────────────────────────────────────────

function buildChunks(depth, fileHeader, codeBlock) {
  const intro = `${NATURAL_SYSTEM}\n\n---\n\n## הקובץ לניתוח:\n\n${fileHeader}${codeBlock}\n\n---\n\n`;

  if (depth === 'basic') {
    return [intro + SECTIONS_ALL + '\n\nהתחל לעבוד על הקובץ המצורף.'];
  }

  if (depth === 'normal') {
    return [
      intro + SECTIONS_PART1 + '\n\nנתח את הקובץ המצורף. פלט **Part A בלבד** (סעיפים 1–4).',
      intro + SECTIONS_PART2 + '\n\nהמשך ניתוח הקובץ. פלט **Part B בלבד** (סעיפים 5–9).',
    ];
  }

  // high — 3 chunks
  return [
    intro + SECTIONS_HIGH_1 + '\n\nנתח את הקובץ המצורף. פלט **Part A בלבד** (סעיפים 1–2).',
    intro + SECTIONS_HIGH_2 + '\n\nהמשך ניתוח הקובץ. פלט **Part B בלבד** (סעיפים 3–4).',
    intro + SECTIONS_HIGH_3 + '\n\nהמשך ניתוח הקובץ. פלט **Part C בלבד** (סעיפים 5–9).',
  ];
}

// ── Gemini call with model fallback ──────────────────────────────────────

async function natCallWithFallback(prompt, startModelIdx) {
  let mIdx = startModelIdx;
  while (true) {
    try {
      return await deps.callGeminiForSpec(prompt, mIdx);
    } catch (err) {
      const quota = deps.isQuotaExceeded(err.message);
      const busy  = /503|high demand|overload|temporarily/i.test(err.message);
      if ((quota || busy) && mIdx < deps.MODEL_CHAIN.length - 1) {
        mIdx++;
        deps.setModelIdx(mIdx);
        deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[mIdx]}… 🔄`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
}
