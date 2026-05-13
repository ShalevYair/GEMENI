import { deps } from './deps.js';

const NATURAL_EXTS = new Set(['nsp','nsa','nsd','nsc','nsl','nsg','ncp','nst','nsm','nat']);

// ── System prompt ─────────────────────────────────────────────────────────

const NATURAL_SYSTEM = `You are a Senior System Analyst specialized in Natural (Software AG) and Adabas databases, with deep expertise in legacy mainframe systems.

You received a Natural source file (Program / Subprogram / Subroutine / Map / Copycode / Helproutine).

**Your mission:** Produce a Hebrew technical-business specification document. Explain the WHAT and WHY — not a line-by-line translation. Think like a business analyst handing this document to a developer who has never seen this system.

**About this code:** It is legacy. Expect archaic constructs, cryptic variable names, DEFINE DATA, Adabas/DB2/VSAM access, CALLNATs to absent programs. Translate technical names to business terms — always keep the original in parentheses. Hebrew comments/strings in the code are valuable context.

**Output format rules:**
1. **Markdown, Hebrew, RTL** — always.
2. Group related statements into logical steps — never describe each command separately.
3. If something is unclear or references an absent object — say so explicitly. Never invent.
4. Scale depth to code size: large → aggressive grouping; small → more detail.
5. Do NOT write pseudocode unless section 6 explicitly requests it.

**Special output formats — MANDATORY when requested:**

**Mermaid flowcharts** (wrap exactly like this):
\`\`\`mermaid
flowchart TD
    A[התחלה] --> B[...]
\`\`\`
Use flowchart TD, short Hebrew labels, rhombus for decisions, subprocess shape for CALLNATs.

**Excel tables** (wrap exactly like this — valid JSON array only):
<excel-table name="שם הטבלה">
[{"עמודה1": "ערך", "עמודה2": "ערך"}]
</excel-table>

**Draw.io XML** (wrap exactly like this):
<drawio-xml>
<mxGraphModel>...</mxGraphModel>
</drawio-xml>

**Terminal screen mockups** (only for programs with INPUT/MAP — wrap exactly like this):
<html-screen name="שם המסך">
<!DOCTYPE html><html>...</html>
</html-screen>`;

// ── Prompt section blocks ─────────────────────────────────────────────────

const OUTPUT_FORMATS_BASIC = `
**פורמטים נדרשים בפלט זה:**
- בסיום סעיף 3, הפק תרשים Mermaid של זרימת התהליך הראשית (flowchart TD).
- הפק את הטבלאות הבאות בפורמט excel-table:
  - <excel-table name="מיפוי קלט-פלט"> — כל פרמטר קלט ופלט (עמודות: שם_מקורי, כיוון, סוג_ואורך, תיאור_עסקי)
  - <excel-table name="קודי שגיאה"> — כל RESPONSE-CODE/ON ERROR (עמודות: קוד, תנאי_הפעלה, משמעות_עסקית, פעולה)
  - <excel-table name="גישות נתונים"> — כל READ/FIND/STORE/UPDATE/DELETE (עמודות: מקור, פעולה, מפתח_תנאי, מטרה_עסקית)`;

const OUTPUT_FORMATS_PART1 = `
**פורמטים נדרשים בחלק א':**
- בסיום סעיף 3, הפק תרשים Mermaid של זרימת התהליך (flowchart TD).
- הפק: <excel-table name="מיפוי קלט-פלט"> (עמודות: שם_מקורי, כיוון, סוג_ואורך, תיאור_עסקי)`;

const OUTPUT_FORMATS_PART2 = `
**פורמטים נדרשים בחלק ב':**
- הפק: <excel-table name="קודי שגיאה"> (עמודות: קוד, תנאי_הפעלה, משמעות_עסקית, פעולה)
- הפק: <excel-table name="גישות נתונים"> (עמודות: מקור, פעולה, מפתח_תנאי, מטרה_עסקית)
- בסוף סעיף 9, הפק קוד פסאודו Python/Java style עבור הלוגיקה המרכזית:
  \`\`\`python
  # pseudo-code
  \`\`\``;

const OUTPUT_FORMATS_HIGH_2 = `
**פורמטים נדרשים בחלק ב':**
- בסיום האלגוריתם, הפק תרשים Mermaid מפורט (flowchart TD) — כולל כל ענפי IF ו-CALLNAT.
- הפק: <excel-table name="מיפוי קלט-פלט"> (עמודות: שם_מקורי, כיוון, סוג_ואורך, scope, תיאור_עסקי)
- אם יש INPUT/MAP/REINPUT — הפק html-screen mockup בסגנון terminal ירוק.`;

const OUTPUT_FORMATS_HIGH_3 = `
**פורמטים נדרשים בחלק ג':**
- הפק: <excel-table name="קודי שגיאה"> (עמודות: קוד, תנאי_הפעלה, משמעות_עסקית, פעולה, יש_backout)
- הפק: <excel-table name="גישות נתונים"> (עמודות: מקור, פעולה, מפתח_תנאי, שדות_נגישים, מטרה_עסקית)
- הפק: <excel-table name="מספרי קסם"> — כל Hardcoded value (עמודות: ערך, מיקום_בקוד, משמעות_עסקית_מוערכת)
- בסוף, הפק קוד פסאודו Python style מפורט לכל הלוגיקה המרכזית:
  \`\`\`python
  # pseudo-code
  \`\`\`
- לבסוף, הפק קוד draw.io XML של תרשים הזרימה המלא (כולל צמתי החלטה, CALLNAT, DB):
  <drawio-xml>
  <mxGraphModel>...</mxGraphModel>
  </drawio-xml>`;

// ── Section text blocks ───────────────────────────────────────────────────

const SECTIONS_ALL = `
## Output — All Sections:

### 1. מטאדטה
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | Program / Subprogram / Subroutine / Map / Copycode / Helproutine |
| מטרה כללית | (משפט אחד) |
| ישויות עסקיות | (Vehicles / Owners / Licenses — מה הקוד נוגע בו) |
| קלטים | |
| פלטים | |
| תלויות חיצוניות | |
| בסיסי נתונים / קבצים | |

### 2. תיאור עסקי
3-6 שורות: מה הקוד עושה ולמה, מנקודת מבט עסקית. ההקשר התהליכי, הבעיה שנפתרת, המשתמש הסופי.

### 3. זרימה לוגית — שלבים מרכזיים
רשימה ממוספרת. כל שלב = פעולה לוגית משמעותית.
- אתחולים רצופים → שלב אחד.
- IF/DECIDE → שלב נפרד + תת-סעיפים לכל ענף.
- READ/FIND/SELECT → שלב נפרד: DDM + תנאי + מה אם לא נמצא.
- לולאה → שלב נפרד: מה עוברים + כל איטרציה + יציאה.
- STORE/UPDATE/DELETE/END TRANSACTION → שלב נפרד.
- CALLNAT/PERFORM → שלב נפרד: שם + קלט/פלט.
- INPUT/REINPUT → שלב נפרד.
- WRITE/DISPLAY → שלב נפרד.

### 4. כללים עסקיים מרכזיים
כל כלל עסקי מ-IF/DECIDE/WHERE/WHEN. פורמט: "אם [תנאי] → [פעולה/חסימה/מסלול]"
כלול גם מספרי קסם (Hardcoded values) ומשמעותם העסקית.

### 5. גישות לנתונים (CRUD)
טבלה: מקור | פעולה | מפתח/תנאי | מטרה עסקית

### 6. נקודות אינטגרציה
לכל CALLNAT/FETCH/CALL: שם, סוג, פרמטרים (קלט/פלט), תפקיד עסקי.

### 7. היסטוריית תחזוקה
חפש הערות עם תאריכים, "BUS"/"BUG"/"Y2K"/שמות מפתחים. אם אין — ציין.

### 8. טיפול בשגיאות
ON ERROR? RESPONSE-CODE? כשל DB? BACKOUT TRANSACTION?

### 9. ביקורת בונה
חוב טכני, סיכונים, חוסר בהירות, הצעות שיפור.`;

const SECTIONS_PART1 = `
## Output — Part A (Sections 1–4):

### 1. מטאדטה
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | |
| מטרה כללית | |
| ישויות עסקיות | |
| קלטים | |
| פלטים | |
| תלויות חיצוניות | |
| בסיסי נתונים / קבצים | |

### 2. תיאור עסקי
3-6 שורות: מה הקוד עושה ולמה, מנקודת מבט עסקית.

### 3. זרימה לוגית — שלבים מרכזיים
רשימה ממוספרת. כל שלב = פעולה לוגית. כלל: אתחולים → שלב אחד; IF/DECIDE → תת-סעיפים לכל ענף; READ/FIND/LOOP/CALLNAT/STORE/DISPLAY → שלבים נפרדים.

### 4. כללים עסקיים מרכזיים
כל IF/DECIDE/WHERE → "אם [תנאי] → [פעולה]". כלול מספרי קסם (Hardcoded).`;

const SECTIONS_PART2 = `
## Output — Part B (Sections 5–9):
(המשך — אותו קובץ Natural)

### 5. גישות לנתונים (CRUD)
טבלה: מקור | פעולה | מפתח/תנאי | מטרה עסקית

### 6. נקודות אינטגרציה
לכל CALLNAT/FETCH: שם, סוג, פרמטרים קלט/פלט, תפקיד.

### 7. היסטוריית תחזוקה
הערות עם תאריכים / BUS/BUG/Y2K. סיכום שינויים. אם אין — ציין.

### 8. טיפול בשגיאות
ON ERROR, RESPONSE-CODE, כשל DB, BACKOUT.

### 9. ביקורת בונה
חוב טכני, סיכונים, חוסר בהירות, הצעות שיפור.`;

const SECTIONS_HIGH_1 = `
## Output — Part A (Sections 1–2, deep):

### 1. מטאדטה — מפורטת
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | |
| מטרה כללית | |
| ישויות עסקיות | (מפורט: Vehicles / Owners / Licenses וכד') |
| קלטים | (כל פרמטר: שם מקורי → משמעות, סוג, אורך) |
| פלטים | (כל פרמטר: שם מקורי → משמעות, יעד) |
| תלויות חיצוניות | (CALLNAT/FETCH/INCLUDE — הסבר לכל אחד) |
| בסיסי נתונים / קבצים | (DDM + שדות מרכזיים אם ידוע) |

### 2. תיאור עסקי — מפורט
5-8 שורות. ההקשר העסקי, הבעיה, המשתמש, התוצאה, הניע ליצירה (מהערות/לוגיקה).`;

const SECTIONS_HIGH_2 = `
## Output — Part B (Sections 3–4, deep):
(המשך — אותו קובץ Natural)

### 3. זרימה לוגית — מפורטת
רשימה ממוספרת מעמיקה. לכל שלב — גם ההיגיון העסקי.
- אתחולים → מה מאופס ולמה חשוב.
- IF/DECIDE → כל ענף עם ההיגיון העסקי, כולל edge cases.
- READ/FIND → DDM + תנאי + מה אם לא נמצא + כפילות.
- לולאה → על מה, כל איטרציה, תנאי יציאה, סיכוני לולאה אינסופית.
- STORE/UPDATE/DELETE → אילו שדות בדיוק, commit strategy.
- CALLNAT → כל פרמטר עם כיוון ומשמעות עסקית.
- INPUT/REINPUT → שם Map, מה מוזן, validations.

### 4. כללים עסקיים — מפורט
כל IF/DECIDE/WHERE/WHEN עם:
- **תנאי:** [ניסוח עסקי]
- **פעולה:** [חסימה/ניתוב/חישוב/הודעה]
- **מספרי קסם:** כל hardcoded value עם משמעות מוערכת.`;

const SECTIONS_HIGH_3 = `
## Output — Part C (Sections 5–9, deep):
(המשך — אותו קובץ Natural)

### 5. גישות לנתונים — מפורט
טבלה: מקור | פעולה | מפתח/תנאי | שדות נגישים | מטרה עסקית

### 6. נקודות אינטגרציה — מפורט
לכל קריאה: שם, סוג, כל פרמטר (קלט/פלט + משמעות עסקית), תפקיד, מה קורה אחרי החזרה.

### 7. היסטוריית תחזוקה — מפורט
הערות עם תאריכים / BUS/BUG/Y2K/שמות/CR numbers. לכל ממצא: מה שינוי + מתי + למה.
אם אין — ציין ורשום מה ניתן להסיק מ-code smells.

### 8. טיפול בשגיאות — מפורט
ON ERROR (כולל BACKOUT), RESPONSE-CODE לכל ערך, כשל DB לכל סוג, logging, סיכון לנתונים פגומים.

### 9. ביקורת בונה — מפורט
חוב טכני (GOTO/קוד מת/כפילויות/hardcoded/global vars/deprecated),
סיכונים תפעוליים (READ ללא LIMIT / לולאות / DB ללא RESPONSE-CODE / END TRANSACTION חסר),
חוסר בהירות (נדרש בירור), הצעות שיפור ומודרניזציה.`;

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
    <div style="background:#fff;border-radius:16px;max-width:580px;width:calc(100% - 2rem);max-height:92vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">

      <!-- Header -->
      <div style="padding:1.25rem 1.5rem .9rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
        <h3 style="margin:0 0 .2rem;font-size:1.15rem;display:flex;align-items:center;gap:.5rem;color:#1e293b;">🖥️ NATURAL — ניתוח קובץ Natural</h3>
        <p style="margin:0;color:#64748b;font-size:.84rem;">העלה קובץ קוד Natural וקבל מסמך אפיון טכני-עסקי, תרשימים וטבלאות.</p>
      </div>

      <!-- Body -->
      <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:1rem;">

        <!-- File upload -->
        <div>
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.4rem;">קובץ Natural:</div>
          <label id="nat-dropzone" for="nat-file-input"
            style="display:block;border:2px dashed #c8d0e0;border-radius:9px;padding:1rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
            ondragover="event.preventDefault();this.style.borderColor='#0891b2';this.style.background='#f0f9ff';"
            ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
            ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.natHandleDrop(event);">
            <div style="font-size:1.6rem;margin-bottom:.25rem;">📄</div>
            <div style="color:#64748b;font-size:.82rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.75rem;">.nsp · .nsa · .nsd · .nsc · .nat · .txt (עד 2MB)</span></div>
            <input id="nat-file-input" type="file" accept=".nsp,.nsa,.nsd,.nsc,.nsl,.nsg,.ncp,.nst,.nsm,.nat,.txt" style="display:none;" onchange="window.natFileSelected(this.files)">
          </label>
          <div id="nat-file-display" style="margin-top:.5rem;"></div>
        </div>

        <!-- Optional context -->
        <div>
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.35rem;">הקשר הרצה (אופציונלי):</div>
          <textarea id="nat-context" rows="2" placeholder="לדוגמה: תוכנית זו רצה ב-Control-M לאחר PROG-A ולפני PROG-C. מטרת ההרצה: עדכון יתרות יומי." style="width:100%;padding:.55rem .7rem;border:1px solid #e2e8f0;border-radius:8px;font-family:Heebo,sans-serif;font-size:.82rem;color:#1e293b;resize:vertical;direction:rtl;box-sizing:border-box;"></textarea>
        </div>

        <!-- Depth selector -->
        <div>
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.5rem;">רמת עומק הניתוח:</div>
          <div style="display:flex;flex-direction:column;gap:.4rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.7rem .9rem;">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.84rem;">
              <input type="radio" name="nat-depth" value="high" style="accent-color:#0891b2;">
              <span style="color:#1e293b;"><strong>גבוהה</strong></span>
              <span style="color:#64748b;font-size:.76rem;">— 3 קריאות API · פסאודו-קוד · draw.io XML · מסכים</span>
            </label>
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.84rem;">
              <input type="radio" name="nat-depth" value="normal" checked style="accent-color:#0891b2;">
              <span style="color:#1e293b;"><strong>רגילה</strong></span>
              <span style="color:#64748b;font-size:.76rem;">— 2 קריאות API · Mermaid · טבלאות Excel (ברירת מחדל)</span>
            </label>
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.84rem;">
              <input type="radio" name="nat-depth" value="basic" style="accent-color:#0891b2;">
              <span style="color:#1e293b;"><strong>בסיסית</strong></span>
              <span style="color:#64748b;font-size:.76rem;">— קריאה אחת · Mermaid · טבלאות Excel</span>
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

  const depth         = document.querySelector('input[name="nat-depth"]:checked')?.value || 'normal';
  const context       = (document.getElementById('nat-context')?.value || '').trim();
  const fileToProcess = natFile;
  const fileName      = fileToProcess.name;

  window.closeNaturalModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

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

  let fileHeader = `שם הקובץ: ${fileName}\n`;
  if (context) fileHeader += `\nהקשר הרצה: ${context}\n`;
  fileHeader += '\n';

  const codeBlock = `\`\`\`natural\n${codeText}\n\`\`\``;
  const chunks    = buildChunks(depth, fileHeader, codeBlock);
  const results   = [];
  let mIdx        = deps.getModelIdx();

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
  const baseName  = `natural-${fileName.replace(/\.[^.]+$/, '')}-${timestamp}`;

  // ── Extract structured outputs ──────────────────────────────────────────

  // Screens (html-screen blocks)
  const viewerScreens = [];
  let cleanedMd = combined.replace(
    /<html-screen name="(.*?)">([\s\S]*?)<\/html-screen>/g,
    (_, name, html) => {
      viewerScreens.push({ name: name.trim(), html: html.trim() });
      return `\n> 🖥️ **מסך: ${name.trim()}** — מוצג במציג האפיונים.\n`;
    }
  );

  // Draw.io XML
  let drawioXml = '';
  cleanedMd = cleanedMd.replace(
    /<drawio-xml>([\s\S]*?)<\/drawio-xml>/g,
    (_, xml) => {
      drawioXml = xml.trim();
      return `\n> 🔀 **תרשים draw.io** — הורד קובץ XML לייבוא לעריכה.\n`;
    }
  );

  // Excel tables
  const viewerTables = [];
  const wb = typeof XLSX !== 'undefined' ? XLSX.utils.book_new() : null;
  let tableCount = 0;
  const excelRegex = /<excel-table name="(.*?)">([\s\S]*?)<\/excel-table>/g;
  let match;
  while ((match = excelRegex.exec(combined)) !== null) {
    const tableName = match[1];
    try {
      const data = JSON.parse(match[2].trim());
      if (Array.isArray(data) && data.length > 0) {
        tableCount++;
        viewerTables.push({ name: tableName, data });
        if (wb) {
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, tableName.replace(/[\\*?:\[\]\/]/g, '').substring(0, 31) || `Sheet ${tableCount}`);
        }
        cleanedMd = cleanedMd.replace(match[0], `\n> 📊 **טבלה: ${tableName}** — מוצגת במציג האפיונים ובקובץ Excel.\n`);
      }
    } catch { /* skip malformed */ }
  }

  // Mermaid diagrams
  const mermaidDiagrams = [];
  const mmRx = /```mermaid\n([\s\S]*?)```/g;
  let mm;
  while ((mm = mmRx.exec(combined)) !== null) {
    const before      = combined.slice(0, mm.index);
    const headMatches = [...before.matchAll(/^#{1,4}\s+\**(.+?)\**\s*$/gm)];
    const lastHead    = headMatches.at(-1);
    mermaidDiagrams.push({
      title: lastHead ? lastHead[1].trim() : `תרשים ${mermaidDiagrams.length + 1}`,
      code:  mm[1].trim(),
    });
  }

  // ── Downloads ────────────────────────────────────────────────────────────

  // Markdown
  const mdBlob = new Blob([cleanedMd], { type: 'text/markdown;charset=utf-8' });
  const mdUrl  = URL.createObjectURL(mdBlob);
  const mdLink = document.createElement('a');
  mdLink.href = mdUrl; mdLink.download = `${baseName}.md`; mdLink.click();
  URL.revokeObjectURL(mdUrl);

  // Excel
  if (tableCount > 0 && wb) {
    XLSX.writeFile(wb, `${baseName}.xlsx`);
  }

  // Draw.io XML
  if (drawioXml) {
    const xmlBlob = new Blob([drawioXml], { type: 'text/xml;charset=utf-8' });
    const xmlUrl  = URL.createObjectURL(xmlBlob);
    const xmlLink = document.createElement('a');
    xmlLink.href = xmlUrl; xmlLink.download = `${baseName}.drawio`; xmlLink.click();
    URL.revokeObjectURL(xmlUrl);
  }

  // ── Open spec-viewer ──────────────────────────────────────────────────────

  try {
    localStorage.setItem('spec-viewer-data', JSON.stringify({
      markdown: cleanedMd,
      tables:   viewerTables,
      screens:  viewerScreens,
      mermaidDiagrams,
      meta: {
        flavor:    'Natural (Software AG)',
        timestamp: new Date().toISOString(),
        fileNames: fileName,
        mode:      'analysis',
      },
    }));
    try { new BroadcastChannel('spec-viewer').postMessage('update'); } catch {}
    window.open('spec-viewer.html', 'spec-viewer');
  } catch { /* localStorage unavailable */ }

  // ── Chat message ──────────────────────────────────────────────────────────

  const depthLabel = depth === 'high' ? 'גבוהה (3 קריאות)' : depth === 'basic' ? 'בסיסית (קריאה אחת)' : 'רגילה (2 קריאות)';
  let summary = `✅ ניתוח \`${fileName}\` הסתיים\n\n**עומק:** ${depthLabel}`;
  if (tableCount > 0) summary += ` · **${tableCount} טבלאות** (Excel + מציג)`;
  if (mermaidDiagrams.length > 0) summary += ` · **${mermaidDiagrams.length} תרשימים** (מציג)`;
  if (drawioXml) summary += ` · **draw.io XML** הורד`;
  if (viewerScreens.length > 0) summary += ` · **${viewerScreens.length} מסכים** (מציג)`;
  summary += `\n\n📋 מציג האפיונים נפתח עם הנתונים.`;
  deps.appendMessage('assistant', summary);
};

// ── File reader ───────────────────────────────────────────────────────────

async function readNaturalFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (NATURAL_EXTS.has(ext) || ['txt','csv','md'].includes(ext)) {
    return file.text();
  }
  try {
    const result = await deps.readFile(file);
    if (result.text) return result.text;
  } catch {}
  return file.text();
}

// ── Prompt assembly ───────────────────────────────────────────────────────

function buildChunks(depth, fileHeader, codeBlock) {
  const intro = `${NATURAL_SYSTEM}\n\n---\n\n## הקובץ לניתוח:\n\n${fileHeader}${codeBlock}\n\n---\n\n`;

  if (depth === 'basic') {
    return [intro + SECTIONS_ALL + '\n\n' + OUTPUT_FORMATS_BASIC + '\n\nנתח את הקובץ. פלט את כל הסעיפים + הפורמטים המיוחדים.'];
  }

  if (depth === 'normal') {
    return [
      intro + SECTIONS_PART1 + '\n\n' + OUTPUT_FORMATS_PART1 + '\n\nפלט **Part A בלבד** (סעיפים 1–4).',
      intro + SECTIONS_PART2 + '\n\n' + OUTPUT_FORMATS_PART2 + '\n\nפלט **Part B בלבד** (סעיפים 5–9).',
    ];
  }

  return [
    intro + SECTIONS_HIGH_1 + '\n\nפלט **Part A בלבד** (סעיפים 1–2).',
    intro + SECTIONS_HIGH_2 + '\n\n' + OUTPUT_FORMATS_HIGH_2 + '\n\nפלט **Part B בלבד** (סעיפים 3–4 + Mermaid + טבלת I/O).',
    intro + SECTIONS_HIGH_3 + '\n\n' + OUTPUT_FORMATS_HIGH_3 + '\n\nפלט **Part C בלבד** (סעיפים 5–9 + טבלאות + פסאודו-קוד + draw.io XML).',
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
