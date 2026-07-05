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

// ── Fine-grained blocks — used only for "high" depth (6 calls) ─────────────
// These re-slice the same content as SECTIONS_HIGH_2/3 + their format blocks
// above, one call per section (or small section pair), for maximum depth.

const SECTION_3_ONLY = `
## Output — חלק: זרימה לוגית (עומק מקסימלי)
(המשך — אותו קובץ Natural)

### 3. זרימה לוגית — מפורטת
רשימה ממוספרת מעמיקה. לכל שלב — גם ההיגיון העסקי.
- אתחולים → מה מאופס ולמה חשוב.
- IF/DECIDE → כל ענף עם ההיגיון העסקי, כולל edge cases.
- READ/FIND → DDM + תנאי + מה אם לא נמצא + כפילות.
- לולאה → על מה, כל איטרציה, תנאי יציאה, סיכוני לולאה אינסופית.
- STORE/UPDATE/DELETE → אילו שדות בדיוק, commit strategy.
- CALLNAT → כל פרמטר עם כיוון ומשמעות עסקית.
- INPUT/REINPUT → שם Map, מה מוזן, validations.`;

const FORMAT_3_ONLY = `
**פורמטים נדרשים בחלק זה:**
- בסיום האלגוריתם, הפק תרשים Mermaid מפורט (flowchart TD) — כולל כל ענפי IF ו-CALLNAT.
- הפק: <excel-table name="מיפוי קלט-פלט"> (עמודות: שם_מקורי, כיוון, סוג_ואורך, scope, תיאור_עסקי)`;

const SECTION_4_ONLY = `
## Output — חלק: כללים עסקיים (עומק מקסימלי)
(המשך — אותו קובץ Natural)

### 4. כללים עסקיים — מפורט
כל IF/DECIDE/WHERE/WHEN עם:
- **תנאי:** [ניסוח עסקי]
- **פעולה:** [חסימה/ניתוב/חישוב/הודעה]
- **מספרי קסם:** כל hardcoded value עם משמעות מוערכת.`;

const FORMAT_4_ONLY = `
**פורמטים נדרשים בחלק זה:**
- הפק: <excel-table name="מספרי קסם"> — כל Hardcoded value (עמודות: ערך, מיקום_בקוד, משמעות_עסקית_מוערכת)
- אם יש INPUT/MAP/REINPUT — הפק html-screen mockup בסגנון terminal ירוק.`;

const SECTION_56_ONLY = `
## Output — חלק: גישות נתונים ואינטגרציה (עומק מקסימלי)
(המשך — אותו קובץ Natural)

### 5. גישות לנתונים — מפורט
טבלה: מקור | פעולה | מפתח/תנאי | שדות נגישים | מטרה עסקית

### 6. נקודות אינטגרציה — מפורט
לכל קריאה: שם, סוג, כל פרמטר (קלט/פלט + משמעות עסקית), תפקיד, מה קורה אחרי החזרה.`;

const FORMAT_56_ONLY = `
**פורמטים נדרשים בחלק זה:**
- הפק: <excel-table name="גישות נתונים"> (עמודות: מקור, פעולה, מפתח_תנאי, שדות_נגישים, מטרה_עסקית)`;

const SECTION_78_ONLY = `
## Output — חלק: תחזוקה וטיפול בשגיאות (עומק מקסימלי)
(המשך — אותו קובץ Natural)

### 7. היסטוריית תחזוקה — מפורט
הערות עם תאריכים / BUS/BUG/Y2K/שמות/CR numbers. לכל ממצא: מה שינוי + מתי + למה.
אם אין — ציין ורשום מה ניתן להסיק מ-code smells.

### 8. טיפול בשגיאות — מפורט
ON ERROR (כולל BACKOUT), RESPONSE-CODE לכל ערך, כשל DB לכל סוג, logging, סיכון לנתונים פגומים.`;

const FORMAT_78_ONLY = `
**פורמטים נדרשים בחלק זה:**
- הפק: <excel-table name="קודי שגיאה"> (עמודות: קוד, תנאי_הפעלה, משמעות_עסקית, פעולה, יש_backout)`;

const SECTION_9_ONLY = `
## Output — חלק: ביקורת בונה (עומק מקסימלי)
(המשך — אותו קובץ Natural)

### 9. ביקורת בונה — מפורט
חוב טכני (GOTO/קוד מת/כפילויות/hardcoded/global vars/deprecated),
סיכונים תפעוליים (READ ללא LIMIT / לולאות / DB ללא RESPONSE-CODE / END TRANSACTION חסר),
חוסר בהירות (נדרש בירור), הצעות שיפור ומודרניזציה.`;

const FORMAT_9_ONLY = `
**פורמטים נדרשים בחלק זה:**
- הפק קוד פסאודו Python style מפורט לכל הלוגיקה המרכזית:
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

const SECTIONS_MIGRATION_APPENDIX = `

### 10. מוכנות למיגרציה
#### א. מיפוי Adabas → SQL
<excel-table name="מיפוי Adabas לSQL">
[{"DDM_שם": "", "שדה_Natural": "", "טיפוס_ומאפיינים": "", "טבלה_SQL_מוצעת": "", "עמודה_מוצעת": "", "הערות": ""}]
</excel-table>

#### ב. DPT / Hardcoded → קונפיגורציה
<excel-table name="ערכים להוצאה לקונפיגורציה">
[{"ערך": "", "מיקום": "", "משמעות_עסקית": "", "טיפול_מוצע": ""}]
</excel-table>

#### ג. CALLNATs → Microservices / APIs
לכל CALLNAT: שם | האם ניתן להפוך ל-API REST | קושי | הערות

#### ד. הערכת סיכוני מיגרציה
- **עסקי:** מה עלול להשתנות בהתנהגות
- **נתונים:** המרות, NULL handling, אורכי שדה
- **תפעולי:** תלויות ב-job scheduler, trigger, JCL`;

const SECTIONS_REWRITE_APPENDIX = `

### 10. Rewrite Blueprint
#### א. ממשקים (Interfaces)
<excel-table name="ממשקי קלט-פלט לכתיבה מחדש">
[{"שם_פונקציה": "", "פרמטרי_קלט": "", "פרמטרי_פלט": "", "שגיאות_אפשריות": "", "הערות_מימוש": ""}]
</excel-table>

#### ב. תרחישי בדיקה (Test Scenarios)
| # | תיאור תרחיש | קלט לדוגמה | פלט צפוי | סוג בדיקה |
|---|------------|------------|----------|-----------|

#### ג. הצעת ארכיטקטורה מודרנית
- **שפה/Framework מוצע** (ונימוק)
- **מודל נתונים מוצע** (DB/ORM)
- **אסינכרוניות / Event-driven** — היכן רלוונטי
- **מה לשמור מהלוגיקה הקיימת** (כללים עסקיים שתוקפם נשמר)
- **מה לזרוק** (חוב טכני שאין טעם להעתיק)`;

// ── Code-change building blocks (composable into 1 / 3 / 6 calls) ─────────

const CC_META_CHANGE = (changeDesc) => `
## Output — ניתוח קוד קיים: מטאדטה והשינוי המבוקש

### 1. מטאדטה וסיכום
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | |
| מטרה כללית | |
| ישויות עסקיות | |

### 2. השינוי המבוקש
**תיאור השינוי:** ${changeDesc || '(לא צוין — נסה להסיק מהקשר)'}`;

const CC_IMPACT = `
## Output — ניתוח השפעה: משתנים ומודולים
(המשך — אותו קובץ Natural)

### 3. ניתוח השפעה — משתנים ומודולים
- **משתנים מושפעים:** כל DEFINE DATA / LOCAL / PARAMETER שקשור לשינוי
- **לוגיקה מושפעת:** IF/DECIDE/PERFORM blocks שיצטרכו שינוי
- **CALLNATs מושפעים:** תוכניות חיצוניות שיושפעו משינוי הפרמטרים
- **DDMs/קבצים מושפעים:** גישות נתונים שיושפעו`;

const CC_RULES = `
## Output — כללים עסקיים המושפעים מהשינוי
(המשך — אותו קובץ Natural)

### 4. כללים עסקיים שמשפיעים על השינוי
כל IF/DECIDE הקשור לתחום השינוי — "אם [תנאי] → [פעולה]"`;

const CC_PSEUDOCODE = `
## Output — לפני/אחרי: פסאודו-קוד
(המשך — אותו קובץ Natural)

### 5. לפני/אחרי — פסאודו-קוד
הצג את הלוגיקה הרלוונטית לפני השינוי ואחריו:
\`\`\`python
# BEFORE — קוד קיים (הלוגיקה הנוכחית)

\`\`\`
\`\`\`python
# AFTER — קוד מוצע (עם השינוי)

\`\`\``;

const CC_RISK = `
## Output — סיכון רגרסיה
(המשך — אותו קובץ Natural)

### 6. סיכון רגרסיה
<excel-table name="ניתוח סיכון רגרסיה">
[{"תחום_סיכון": "", "תרחיש_כשל": "", "רמת_סיכון": "גבוה/בינוני/נמוך", "בדיקה_מומלצת": ""}]
</excel-table>`;

const CC_STEPS_TESTS = `
## Output — יישום ובדיקות
(המשך — אותו קובץ Natural)

### 7. צעדי יישום מומלצים
רשימה ממוספרת: כל שינוי קוד נדרש, לפי סדר מומלץ לביצוע.

### 8. בדיקות נדרשות
- **יחידה:** מה לבדוק ביחידה
- **אינטגרציה:** תוכניות שיש לבדוק יחד
- **קצה:** edge cases ספציפיים לשינוי`;

// ── Module state ──────────────────────────────────────────────────────────
let natFiles = [];

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
    <div style="background:#fff;border-radius:16px;max-width:660px;width:calc(100% - 2rem);max-height:92vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">

      <!-- Header -->
      <div style="padding:1.25rem 1.5rem .9rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
        <h3 style="margin:0 0 .2rem;font-size:1.15rem;display:flex;align-items:center;gap:.5rem;color:#1e293b;">🖥️ NATURAL — ניתוח קבצי Natural</h3>
        <p style="margin:0;color:#64748b;font-size:.84rem;">העלה קבצי קוד Natural (קובץ אחד או יותר) וקבל מסמך אפיון טכני-עסקי, תרשימים וטבלאות.</p>
      </div>

      <!-- Body -->
      <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:1rem;">

        <!-- File upload -->
        <div>
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.4rem;">קבצי Natural:</div>
          <label id="nat-dropzone" for="nat-file-input"
            style="display:block;border:2px dashed #c8d0e0;border-radius:9px;padding:1rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
            ondragover="event.preventDefault();this.style.borderColor='#0891b2';this.style.background='#f0f9ff';"
            ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
            ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.natHandleDrop(event);">
            <div style="font-size:1.6rem;margin-bottom:.25rem;">📂</div>
            <div style="color:#64748b;font-size:.82rem;">לחץ לבחירת קובץ/ים או גרור לכאן<br><span style="font-size:.75rem;">.nsp · .nsa · .nsd · .nsc · .nat · .txt · ניתן לבחור מספר קבצים (עד 2MB לקובץ)</span></div>
            <input id="nat-file-input" type="file" accept=".nsp,.nsa,.nsd,.nsc,.nsl,.nsg,.ncp,.nst,.nsm,.nat,.txt" multiple style="display:none;" onchange="window.natFileSelected(this.files)">
          </label>
          <div id="nat-file-display" style="margin-top:.5rem;"></div>
          <div id="nat-multifile-note" style="display:none;margin-top:.4rem;padding:.45rem .7rem;background:#fefce8;border:1px solid #fde68a;border-radius:7px;font-size:.78rem;color:#92400e;">
            💡 מצב ריבוי קבצים — יתבצע ניתוח כל קובץ בנפרד + ניתוח קשרים ותלויות בין הקבצים. בחירת מטרה ורמת עומק מתעלמות במצב זה.
          </div>
        </div>

        <!-- Optional context -->
        <div>
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.35rem;">הקשר הרצה (אופציונלי):</div>
          <textarea id="nat-context" rows="2" placeholder="לדוגמה: תוכנית זו רצה ב-Control-M לאחר PROG-A ולפני PROG-C. מטרת ההרצה: עדכון יתרות יומי." style="width:100%;padding:.55rem .7rem;border:1px solid #e2e8f0;border-radius:8px;font-family:Heebo,sans-serif;font-size:.82rem;color:#1e293b;resize:vertical;direction:rtl;box-sizing:border-box;"></textarea>
        </div>

        <!-- Purpose selector -->
        <div id="nat-purpose-section">
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.5rem;">מטרה — מה תרצה לקבל:</div>
          <div style="display:flex;flex-direction:column;gap:.55rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.65rem .9rem;">
            ${[
              { v:'general',      checked:true,  label:'ניתוח מלא',           desc:'מסמך אפיון טכני-עסקי מלא — כל 9 הסעיפים, תרשימים וטבלאות. ברירת המחדל לרוב המקרים.' },
              { v:'migration',    checked:false, label:'מוכנות למיגרציה',      desc:'ניתוח מלא + מסלול הסבה למערכת מודרנית: מיפוי Adabas→SQL, ערכים לקונפיגורציה, הערכת סיכוני מיגרציה.' },
              { v:'rewrite',      checked:false, label:'כתיבה מחדש (Rewrite)', desc:'ניתוח מלא + מפרט לכתיבת הקוד מחדש בשפה מודרנית: ממשקים, תרחישי בדיקה, הצעת ארכיטקטורה.' },
              { v:'code-change',  checked:false, label:'שינוי קוד',           desc:'מנתח השפעת שינוי נקודתי שתתאר: אילו משתנים/מודולים מושפעים, לפני/אחרי, סיכון רגרסיה.' },
              { v:'line-by-line', checked:false, label:'פירוט שורה-שורה',     desc:'עובר על כל שורת קוד ומסביר מה היא עושה. מפיק קובץ Word (עברית, RTL) — לא מסמך אפיון, אלא תרגום מלא של הקוד.' },
              { v:'overview',     checked:false, label:'מבט על',              desc:'מפת מחשבה אינטראקטיבית (אופקית) של הקוד, נפתחת ומוצגת בדף חדש עם צ׳אט לשאלות + קובץ Excel נלווה.' },
            ].map(o => `
            <label style="display:flex;align-items:flex-start;gap:.5rem;cursor:pointer;font-size:.83rem;">
              <input type="radio" name="nat-purpose" value="${o.v}" ${o.checked ? 'checked' : ''} style="accent-color:#0891b2;margin-top:.2rem;" onchange="window.natPurposeChanged()">
              <span>
                <span style="color:#1e293b;display:block;"><strong>${o.label}</strong></span>
                <span style="color:#64748b;font-size:.76rem;line-height:1.4;">${o.desc}</span>
              </span>
            </label>`).join('')}
          </div>

          <!-- Code Change: extra field -->
          <div id="nat-change-field" style="display:none;margin-top:.55rem;padding:.6rem .75rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:7px;">
            <div style="font-size:.8rem;font-weight:600;color:#92400e;margin-bottom:.3rem;">תאר את השינוי המבוקש:</div>
            <textarea id="nat-change-desc" rows="2" placeholder="לדוגמה: הוספת פטור ל-4 שנים לרכבים חשמליים רשומים אחרי 2024." style="width:100%;padding:.45rem .6rem;border:1px solid #fed7aa;border-radius:6px;font-family:Heebo,sans-serif;font-size:.81rem;direction:rtl;resize:vertical;box-sizing:border-box;"></textarea>
          </div>
        </div>

        <!-- Depth selector -->
        <div id="nat-depth-section">
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.5rem;">רמת עומק:</div>
          <div style="display:flex;flex-direction:column;gap:.4rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.65rem .9rem;">
            ${[
              { v:'low',      checked:false, label:'נמוכה',       calls:'קריאה אחת',  desc:'סקירה מהירה — כל הפרטים בבת אחת, פחות מעמיק.' },
              { v:'standard', checked:true,  label:'רגילה',       calls:'3 קריאות',   desc:'ברירת המחדל — איזון טוב בין מהירות לעומק.' },
              { v:'high',     checked:false, label:'גבוהה',       calls:'6 קריאות',   desc:'המרבי — כל סעיף/זוג סעיפים בקריאה נפרדת, הכי מפורט.' },
              { v:'auto',     checked:false, label:'✨ אוטומטי',  calls:'1–6 קריאות', desc:'הסוכן מנתח את מורכבות הקוד ומחליט בעצמו כמה קריאות נדרשות.' },
            ].map(o => `
            <label style="display:flex;align-items:center;gap:.45rem;cursor:pointer;font-size:.83rem;padding:.1rem 0;">
              <input type="radio" name="nat-depth" value="${o.v}" ${o.checked ? 'checked' : ''} style="accent-color:#0891b2;">
              <span style="color:#1e293b;min-width:75px;"><strong>${o.label}</strong></span>
              <span style="color:#64748b;font-size:.75rem;">— ${o.calls} · ${o.desc}</span>
            </label>`).join('')}
          </div>
          <div id="nat-depth-note" style="display:none;margin-top:.4rem;font-size:.75rem;color:#0891b2;">
            ℹ️ בפירוט שורה-שורה, רמת העומק קובעת את רמת הפירוט בהסבר — לא את מספר הקריאות (זה נקבע לפי אורך הקובץ).
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;display:flex;gap:.75rem;justify-content:flex-end;flex-shrink:0;">
        <button onclick="window.closeNaturalModal()" style="padding:.5rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.88rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
        <button id="nat-generate-btn" onclick="window.generateNatural()" style="padding:.5rem 1.25rem;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(8,145,178,.35);">🖥️ נתח</button>
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
  natFiles = [];
  renderNatFileDisplay();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeNaturalModal = function () {
  const modal = document.getElementById('natural-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  natFiles = [];
  const fi = document.getElementById('nat-file-input');
  if (fi) fi.value = '';
};

window.natHandleDrop = function (event) {
  const files = Array.from(event.dataTransfer.files || []);
  if (files.length) addNatFiles(files);
};

window.natFileSelected = function (fileList) {
  if (fileList && fileList.length) addNatFiles(Array.from(fileList));
  const fi = document.getElementById('nat-file-input');
  if (fi) fi.value = '';
};

function addNatFiles(files) {
  const oversized = files.filter(f => f.size > 2 * 1024 * 1024);
  if (oversized.length) {
    alert(`הקבצים הבאים גדולים מ-2MB:\n${oversized.map(f => f.name).join('\n')}\n\nאנא חתוך את הקוד לחלקים קטנים יותר.`);
    files = files.filter(f => f.size <= 2 * 1024 * 1024);
  }
  const existingNames = new Set(natFiles.map(f => f.name));
  const newFiles = files.filter(f => !existingNames.has(f.name));
  natFiles.push(...newFiles);
  renderNatFileDisplay();
}

function renderNatFileDisplay() {
  const el = document.getElementById('nat-file-display');
  if (!el) return;

  const note = document.getElementById('nat-multifile-note');
  const purposeSection = document.getElementById('nat-purpose-section');
  const depthSection = document.getElementById('nat-depth-section');

  if (!natFiles.length) {
    el.innerHTML = '';
    if (note) note.style.display = 'none';
    if (purposeSection) purposeSection.style.opacity = '1';
    if (depthSection) depthSection.style.opacity = '1';
    return;
  }

  const isMulti = natFiles.length > 1;
  if (note) note.style.display = isMulti ? '' : 'none';
  if (purposeSection) purposeSection.style.opacity = isMulti ? '0.45' : '1';
  if (depthSection) depthSection.style.opacity = isMulti ? '0.45' : '1';

  el.innerHTML = natFiles.map((f, i) => `
    <div style="display:flex;align-items:center;gap:.5rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:.4rem .65rem;font-size:.82rem;margin-bottom:.25rem;">
      <span style="color:#0891b2;">📄</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e293b;">${deps.escHtml(f.name)}</span>
      <span style="color:#94a3b8;white-space:nowrap;">${(f.size / 1024).toFixed(0)} KB</span>
      <button onclick="window.natClearFile(${i})" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.9rem;padding:0 .15rem;line-height:1;" title="הסר">✕</button>
    </div>`).join('') + (isMulti ? `
    <div style="font-size:.75rem;color:#0891b2;padding:.15rem .25rem;font-weight:600;">${natFiles.length} קבצים נבחרו</div>` : '');
}

window.natPurposeChanged = function () {
  const v = document.querySelector('input[name="nat-purpose"]:checked')?.value;
  const field = document.getElementById('nat-change-field');
  if (field) field.style.display = v === 'code-change' ? '' : 'none';
  const note = document.getElementById('nat-depth-note');
  if (note) note.style.display = v === 'line-by-line' ? '' : 'none';
};

window.natClearFile = function (idx) {
  if (idx === undefined) {
    natFiles = [];
  } else {
    natFiles.splice(idx, 1);
  }
  renderNatFileDisplay();
  if (!natFiles.length) {
    const dz = document.getElementById('nat-dropzone');
    if (dz) dz.style.borderColor = '#c8d0e0';
  }
};

// ── Generate ──────────────────────────────────────────────────────────────

window.generateNatural = async function () {
  if (!natFiles.length) {
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

  const purpose       = document.querySelector('input[name="nat-purpose"]:checked')?.value || 'general';
  const depthChoice   = document.querySelector('input[name="nat-depth"]:checked')?.value || 'standard';
  const context       = (document.getElementById('nat-context')?.value || '').trim();
  const changeDesc    = (document.getElementById('nat-change-desc')?.value || '').trim();
  const isMultiFile   = natFiles.length > 1;
  const filesToProcess = [...natFiles];
  const fileNames     = filesToProcess.map(f => f.name);

  window.closeNaturalModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

  const filesData = [];
  try {
    for (let i = 0; i < filesToProcess.length; i++) {
      const f = filesToProcess[i];
      deps.updateTyping(progressId, `קורא קובץ ${i + 1}/${filesToProcess.length}: ${f.name}…`);
      const text = await readNaturalFile(f);
      if (!text.trim()) throw new Error(`הקובץ "${f.name}" ריק.`);
      filesData.push({ name: f.name, text });
    }
  } catch (e) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (!isMultiFile && purpose === 'line-by-line') {
    await runLineByLine(progressId, filesData[0], depthChoice, context);
    return;
  }
  if (!isMultiFile && purpose === 'overview') {
    await runOverview(progressId, filesData[0], depthChoice, context);
    return;
  }

  let mIdx = deps.getModelIdx();
  let chunks;
  const DEPTH_LABELS = { low: 'נמוכה (קריאה אחת)', standard: 'רגילה (3 קריאות)', high: 'גבוהה (6 קריאות)' };
  let resolvedDepthLabel = DEPTH_LABELS[depthChoice] || depthChoice;

  if (isMultiFile) {
    chunks = buildMultiFileChunks(filesData, context);
  } else {
    const { name, text } = filesData[0];
    let fileHeader = `שם הקובץ: ${name}\n`;
    if (context) fileHeader += `\nהקשר הרצה: ${context}\n`;
    fileHeader += '\n';
    const codeBlock = `\`\`\`natural\n${text}\n\`\`\``;

    let depthLevel = depthChoice;
    if (depthChoice === 'auto') {
      deps.updateTyping(progressId, '✨ מנתח את מורכבות הקוד…');
      try {
        const analysisText = await natCallWithFallback(buildAutoDepthPromptNatural(codeBlock), mIdx);
        mIdx = deps.getModelIdx();
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const n = Math.max(1, Math.min(6, parseInt(parsed.chunks) || 3));
          depthLevel = depthLevelForCount(n);
          if (parsed.reason) {
            deps.appendMessage('assistant', `✨ **ניתוח קוד:** ${parsed.reason}\n→ נבחרה רמת עומק **${DEPTH_LABELS[depthLevel]}**`);
          }
          resolvedDepthLabel = `אוטומטי → ${DEPTH_LABELS[depthLevel]}`;
        } else {
          depthLevel = 'standard';
        }
      } catch {
        depthLevel = 'standard';
      }
    }

    chunks = buildChunks(purpose, depthLevel, fileHeader, codeBlock, changeDesc);
  }

  const results = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      deps.updateTyping(progressId, `מנתח… (${i + 1}/${chunks.length})`);
      results.push(await natCallWithFallback(chunks[i], mIdx));
      mIdx = deps.getModelIdx();
    }
  } catch (err) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה: ' + err.message);
    return;
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  if (deps.setNatContext) deps.setNatContext(filesData);

  const combined  = results.join('\n\n---\n\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  const firstName = fileNames[0].replace(/\.[^.]+$/, '');
  const baseName  = isMultiFile
    ? `natural-multi-${firstName}-${timestamp}`
    : `natural-${firstName}-${timestamp}`;
  const fileName  = fileNames[0];

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
  const mdForViewer = combined.replace(
    /<drawio-xml>[\s\S]*?<\/drawio-xml>/g,
    '\n> 🔀 **תרשים draw.io** — הורד קובץ XML לייבוא לעריכה.\n'
  );

  try {
    localStorage.setItem('spec-viewer-data', JSON.stringify({
      markdown: mdForViewer,
      tables:   viewerTables,
      screens:  viewerScreens,
      mermaidDiagrams,
      meta: {
        flavor:    'Natural (Software AG)',
        timestamp: new Date().toISOString(),
        fileNames: fileNames.join(', '),
        mode:      isMultiFile ? 'multi-file-analysis' : 'analysis',
      },
    }));
    try { new BroadcastChannel('spec-viewer').postMessage('update'); } catch {}
    window.open('spec-viewer.html', 'spec-viewer');
  } catch { /* localStorage unavailable */ }

  // ── Chat message ──────────────────────────────────────────────────────────

  const purposeLabels = { general: 'ניתוח מלא', migration: 'מוכנות למיגרציה', rewrite: 'כתיבה מחדש', 'code-change': 'שינוי קוד' };
  const purposeLabel = purposeLabels[purpose] || purpose;

  const displayName = isMultiFile ? `${fileNames.length} קבצים (${fileNames.join(', ')})` : `\`${fileNames[0]}\``;
  let summary = `✅ ניתוח ${displayName} הסתיים\n\n` +
    (isMultiFile ? `**מצב:** ריבוי קבצים — ניתוח כל קובץ + קשרים` : `**מטרה:** ${purposeLabel} · **עומק:** ${resolvedDepthLabel}`);
  if (tableCount > 0) summary += ` · **${tableCount} טבלאות** (Excel + מציג)`;
  if (mermaidDiagrams.length > 0) summary += ` · **${mermaidDiagrams.length} תרשימים** (מציג)`;
  if (drawioXml) summary += ` · **draw.io XML** הורד`;
  if (viewerScreens.length > 0) summary += ` · **${viewerScreens.length} מסכים** (מציג)`;
  summary += `\n\n📋 מציג האפיונים נפתח עם הנתונים.\n💬 הקבצים טעונים בהקשר — ניתן לשאול שאלות בצ'אט.`;
  deps.appendMessage('assistant', summary);
};

// ── Purpose: פירוט שורה-שורה ───────────────────────────────────────────────

const DETAIL_LABELS = { low: 'נמוכה', standard: 'רגילה', high: 'גבוהה' };

async function runLineByLine(progressId, fileData, depthChoice, context) {
  const { name, text } = fileData;
  let mIdx = deps.getModelIdx();
  let detailLevel = depthChoice === 'auto' ? 'standard' : depthChoice;

  if (depthChoice === 'auto') {
    deps.updateTyping(progressId, '✨ מנתח את מורכבות הקוד…');
    try {
      const analysisText = await natCallWithFallback(buildAutoDepthPromptNatural(text), mIdx);
      mIdx = deps.getModelIdx();
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const n = Math.max(1, Math.min(6, parseInt(parsed.chunks) || 3));
        detailLevel = depthLevelForCount(n);
        if (parsed.reason) {
          deps.appendMessage('assistant', `✨ **ניתוח קוד:** ${parsed.reason}\n→ נבחרה רמת פירוט **${DETAIL_LABELS[detailLevel]}**`);
        }
      }
    } catch { /* keep standard */ }
  }

  const LINES_PER_CHUNK = { low: 220, standard: 150, high: 90 }[detailLevel] || 150;
  const VERBOSITY = {
    low: 'הסבר תמציתי ביותר — עד משפט קצר אחד לכל שורת קוד או קבוצת שורות רצופות פשוטות.',
    standard: 'הסבר ברור ומדויק — משפט עד שניים לכל בלוק לוגי קטן (כ-2–5 שורות קוד).',
    high: 'הסבר מפורט — לכל שורה או בלוק קטן, כולל המשמעות העסקית, edge cases, וההשפעה על שורות אחרות.',
  }[detailLevel];

  const lines = text.split(/\r?\n/);
  const chunkTexts = [];
  for (let i = 0; i < lines.length; i += LINES_PER_CHUNK) {
    chunkTexts.push({ start: i + 1, code: lines.slice(i, i + LINES_PER_CHUNK).join('\n') });
  }

  const contextLine = context ? `\nהקשר הרצה: ${context}\n` : '';
  const results = [];
  try {
    for (let i = 0; i < chunkTexts.length; i++) {
      const c = chunkTexts[i];
      deps.updateTyping(progressId, `מפרט שורות ${c.start}–${c.start + c.code.split('\n').length - 1}… (${i + 1}/${chunkTexts.length})`);
      const prompt = `אתה אנליסט מערכות בכיר המתמחה ב-Natural (Software AG). קיבלת קטע מתוך קובץ Natural בשם "${name}", החל משורה ${c.start} בקובץ המקורי.${contextLine}
עבור על הקטע **שורה אחר שורה, לפי הסדר** והסבר בעברית מה כל שורה/פקודה עושה מבחינה טכנית ועסקית. אל תדלג על אף שורה משמעותית (ניתן לקבץ שורות ריקות/הערות טכניות זניחות).
${VERBOSITY}
פורמט הפלט: לכל שורה או קבוצת שורות — ציין את מספרי השורות המקוריים בסוגריים, ואז את ההסבר. השתמש בכותרות Markdown (###) לחלוקה לוגית אם רלוונטי. כתוב בעברית, RTL, ללא הקדמות או סיכומים — רק את הפירוט עצמו.

\`\`\`natural
${c.code}
\`\`\``;
      results.push(await natCallWithFallback(prompt, mIdx));
      mIdx = deps.getModelIdx();
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
  const html      = lineByLineToWordHtml(name, combined);
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName  = `natural-line-by-line-${name.replace(/\.[^.]+$/, '')}-${timestamp}`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${baseName}.doc`; a.click();
  URL.revokeObjectURL(url);

  deps.appendMessage('assistant',
    `✅ פירוט שורה-שורה של \`${name}\` הסתיים\n\n` +
    `**רמת פירוט:** ${DETAIL_LABELS[detailLevel]} · **${chunkTexts.length} קריאות API** (לפי אורך הקובץ)\n\n` +
    `📄 קובץ Word הורד עם ההסבר המלא לכל שורות הקוד.`);
}

function lineByLineToWordHtml(fileName, markdownText) {
  let bodyHtml = '';
  if (window.marked) {
    try { bodyHtml = window.marked.parse(markdownText, { breaks: true, gfm: true }); }
    catch { bodyHtml = deps.escHtml(markdownText).replace(/\n/g, '<br>'); }
  } else {
    bodyHtml = deps.escHtml(markdownText).replace(/\n/g, '<br>');
  }
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>פירוט שורה-שורה — ${deps.escHtml(fileName)}</title>
  <style>
    body  { font-family: Arial, sans-serif; direction: rtl; font-size: 11pt; margin: 2cm; color: #1a202c; }
    h1,h2,h3 { color: #1a365d; }
    hr    { border: none; border-top: 1px solid #e2e8f0; margin: 12pt 0; }
    code  { font-family: Consolas, monospace; background: #f7fafc; padding: 1pt 4pt; font-size: 10pt; }
    pre   { background: #f7fafc; padding: 8pt; border-radius: 4pt; direction: ltr; }
  </style>
</head>
<body>
  <h1>פירוט שורה-שורה — ${deps.escHtml(fileName)}</h1>
  ${bodyHtml}
</body>
</html>`;
}

// ── Purpose: מבט על (mind map) ─────────────────────────────────────────────

async function runOverview(progressId, fileData, depthChoice, context) {
  const { name, text } = fileData;
  let mIdx = deps.getModelIdx();
  let numCalls;
  let autoReason = '';

  const codeBlock = `\`\`\`natural\n${text}\n\`\`\``;

  if (depthChoice === 'auto') {
    deps.updateTyping(progressId, '✨ מנתח את מורכבות הקוד…');
    try {
      const analysisText = await natCallWithFallback(buildAutoDepthPromptNatural(codeBlock), mIdx);
      mIdx = deps.getModelIdx();
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        numCalls = Math.max(1, Math.min(6, parseInt(parsed.chunks) || 3));
        autoReason = parsed.reason || '';
      } else {
        numCalls = 3;
      }
    } catch {
      numCalls = 3;
    }
  } else {
    numCalls = { low: 1, standard: 3, high: 6 }[depthChoice] || 3;
  }

  const contextLine = context ? `\nהקשר הרצה: ${context}\n` : '';

  let tree = null;
  try {
    for (let i = 0; i < numCalls; i++) {
      deps.updateTyping(progressId, `בונה מפת מחשבה… (${i + 1}/${numCalls})`);
      const prompt = buildOverviewPrompt(name, codeBlock, contextLine, tree, i, numCalls);
      const resultText = await natCallWithFallback(prompt, mIdx);
      mIdx = deps.getModelIdx();
      const parsed = parseOverviewTree(resultText);
      if (parsed) tree = parsed;
    }
  } catch (err) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה: ' + err.message);
    return;
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  if (!tree) {
    deps.appendMessage('error', 'לא ניתן היה לבנות מפת מחשבה מהקוד. נסה שוב.');
    return;
  }

  if (autoReason) deps.appendMessage('assistant', `✨ **ניתוח קוד:** ${autoReason}\n→ נבנו ${numCalls} שכבות פירוט`);

  // Flatten to Excel
  const rows = [];
  flattenTree(tree, [], rows);
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName  = `natural-overview-${name.replace(/\.[^.]+$/, '')}-${timestamp}`;
  if (typeof XLSX !== 'undefined' && rows.length) {
    const wb  = XLSX.utils.book_new();
    const aoa = [['רמה 1', 'רמה 2', 'רמה 3', 'רמה 4', 'תיאור'], ...rows];
    const ws  = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, 'מבט על');
    XLSX.writeFile(wb, `${baseName}.xlsx`);
  }

  try {
    localStorage.setItem('natural-mindmap-data', JSON.stringify({
      tree,
      meta: { fileName: name, timestamp: new Date().toISOString() },
    }));
    try { new BroadcastChannel('natural-mindmap').postMessage('update'); } catch {}
    window.open('natural-mindmap.html', 'natural-mindmap');
  } catch { /* localStorage unavailable */ }

  deps.appendMessage('assistant',
    `✅ מבט על עבור \`${name}\` הופק\n\n` +
    `**${numCalls} קריאות API** · קובץ Excel הורד\n\n` +
    `🗺️ מפת המחשבה נפתחה בדף חדש — לחץ על "שאל" בתוכה כדי לשאול שאלות על הקוד.`);
}

function buildOverviewPrompt(fileName, codeBlock, contextLine, existingTree, callIdx, totalCalls) {
  const base = `אתה אנליסט מערכות בכיר המתמחה בקוד Natural (Software AG). קיבלת את הקובץ "${fileName}".${contextLine}
המשימה: להפיק מפת מחשבה (עץ) של הקוד — בעברית — שמתארת את הזרימה העסקית והטכנית בצורה היררכית: מהתמונה הכללית ועד לפרטים.

הפלט הנדרש: אובייקט JSON יחיד בלבד (ללא טקסט נלווה, ללא code fence), במבנה:
{"name": "שם התוכנית/התהליך", "desc": "תיאור קצר (1-2 משפטים)", "children": [ { "name": "...", "desc": "...", "children": [...] }, ... ]}
כל node חייב "name" ו-"desc". "children" הוא מערך (יכול להיות ריק).

\`\`\`natural
${codeBlock}
\`\`\``;

  if (totalCalls === 1 || !existingTree) {
    return base + `

זוהי קריאה יחידה — הפק עץ מלא בעל 3–4 רמות עומק: התוכנית עצמה בשורש, שלבי התהליך המרכזיים כילדים ישירים, ותתי-פרטים (כללים עסקיים, גישות נתונים, אינטגרציות) כילדי-ילדים. השב אך ורק ב-JSON.`;
  }

  return base + `

הנה העץ שנבנה עד כה (מקריאות קודמות):
${JSON.stringify(existingTree)}

זוהי קריאה ${callIdx + 1} מתוך ${totalCalls}. **החזר את העץ המלא והמעודכן** — הוסף עוד רמות עומק, עוד ילדים לכל node קיים שרלוונטי, ופרטים נוספים (edge cases, כללי ולידציה, גישות נתונים ספציפיות, אינטגרציות). אל תמחק מידע קיים — רק הרחב והעמק. השב אך ורק ב-JSON של העץ המלא.`;
}

function parseOverviewTree(text) {
  if (!text) return null;
  const s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && v.name) return normalizeTreeNode(v);
  } catch { /* try to extract */ }
  const first = s.indexOf('{');
  const last  = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try {
      const v = JSON.parse(s.slice(first, last + 1));
      if (v && typeof v === 'object' && v.name) return normalizeTreeNode(v);
    } catch { /* ignore */ }
  }
  return null;
}

function normalizeTreeNode(node) {
  return {
    name:     String(node.name || '').trim() || 'ללא שם',
    desc:     String(node.desc || '').trim(),
    children: Array.isArray(node.children) ? node.children.map(normalizeTreeNode) : [],
  };
}

function flattenTree(node, path, rows, depth = 0) {
  const newPath = [...path, node.name];
  const cols = ['', '', '', ''];
  for (let i = 0; i < Math.min(newPath.length, 4); i++) cols[i] = newPath[i];
  if (!node.children || node.children.length === 0 || depth > 0) {
    rows.push([...cols, node.desc || '']);
  }
  (node.children || []).forEach(c => flattenTree(c, newPath, rows, depth + 1));
}

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

// ── Multi-file prompt builder ─────────────────────────────────────────────

function buildMultiFileChunks(filesData, context) {
  const fileList = filesData.map((f, i) => `${i + 1}. \`${f.name}\``).join('\n');
  const contextLine = context ? `\nהקשר הרצה: ${context}\n` : '';

  const fileBlocks = filesData.map(({ name, text }, i) =>
    `### קובץ ${i + 1}: \`${name}\`\n\`\`\`natural\n${text}\n\`\`\``
  ).join('\n\n');

  const intro = `${NATURAL_SYSTEM}\n\n---\n\n## קבצים לניתוח (${filesData.length} קבצים):${contextLine}\n\n${fileList}\n\n---\n\n${fileBlocks}\n\n---\n\n`;

  const part1 = intro + `
## Output — חלק א': ניתוח כל קובץ בנפרד

עבור כל קובץ, הפק את הסעיפים הבאים לפי הסדר (קובץ 1, קובץ 2, וכן הלאה).
השתמש בפורמט הזה בדיוק לכל קובץ:

---

### 📄 \`<שם_הקובץ>\`

#### 1. מטאדטה
| שדה | ערך |
|-----|-----|
| שם האובייקט | |
| סוג | Program / Subprogram / Subroutine / Map / Copycode / Helproutine |
| מטרה כללית | (משפט אחד) |
| ישויות עסקיות | |
| קלטים | |
| פלטים | |
| תלויות חיצוניות | (CALLNAT/FETCH לתוכניות אחרות ברשימה — ציין במפורש) |
| בסיסי נתונים / קבצים | |

#### 2. תיאור עסקי
2-4 שורות: מה הקוד עושה ולמה, מנקודת מבט עסקית.

#### 3. זרימה לוגית — עיקרי
שלבים עיקריים בלבד (מקוצר). רק הזרימה המרכזית — לא לרדת לפרטי פרטים.

#### 4. כללים עסקיים מרכזיים
כל IF/DECIDE/WHERE מרכזי — "אם [תנאי] → [פעולה]"

#### 5. CALLNAT / FETCH לתוכניות אחרות
רשימה: שם התוכנית הנקראת | פרמטרים קלט | פרמטרים פלט | מטרה עסקית
(ציין אם היא מופיעה ברשימת הקבצים שהועלו)

---

חזור על הפורמט הזה לכל קובץ ברשימה.`;

  const part2 = intro + `
## Output — חלק ב': ניתוח קשרים ותלויות בין הקבצים

בחלק זה ניתח את הקשר בין כל הקבצים שקיבלת.

### 1. מפת קריאות בין תוכניות
<excel-table name="מפת קריאות בין תוכניות">
[{"קורא": "", "נקרא": "", "סוג_קריאה": "CALLNAT/FETCH/PERFORM", "פרמטרים_קלט": "", "פרמטרים_פלט": "", "מטרה_עסקית": ""}]
</excel-table>

### 2. תרשים זרימה משולב
\`\`\`mermaid
flowchart TD
    %% הצג את כל הקבצים כצמתים וקשרי הקריאה ביניהם
    %% השתמש בצורת subprocess לכל קובץ
\`\`\`

### 3. נתונים / DDMs משותפים
אילו DDMs, COPYCODE, Global/Local Data Areas משותפים בין הקבצים.

<excel-table name="נתונים משותפים">
[{"שם_DDM_COPYCODE": "", "קבצים_שמשתמשים": "", "תפקיד_עסקי": ""}]
</excel-table>

### 4. תהליך עסקי משולב
תאר את התהליך העסקי הכולל — כיצד הקבצים יחדיו מממשים פונקציה עסקית שלמה.
מה הסדר הצפוי של הרצה? מי "המנהל" ומי "השירות"?

### 5. תלויות וסדר שינוי מומלץ
<excel-table name="תלויות קריטיות">
[{"קובץ": "", "תלוי_ב": "", "סוג_תלות": "קורא/נקרא/DDM משותף", "השפעה_בשינוי": ""}]
</excel-table>

### 6. נקודות סיכון ואינטגרציה
- **תלויות קריטיות:** אילו קבצים לא יכולים לפעול ללא אחרים
- **נקודות כשל:** מה קורה אם קובץ אחד נכשל — האם קיים BACKOUT / rollback?
- **חוסרים:** CALLNAT לתוכניות שאינן ברשימת הקבצים שהועלו
- **סדר שינוי מומלץ:** אם יש לשנות משהו, מה לשנות קודם`;

  return [part1, part2];
}

// ── Single-file prompt assembly ────────────────────────────────────────────

function buildChunks(purpose, depthLevel, fileHeader, codeBlock, changeDesc) {
  const intro = `${NATURAL_SYSTEM}\n\n---\n\n## הקובץ לניתוח:\n\n${fileHeader}${codeBlock}\n\n---\n\n`;

  const appendix = purpose === 'migration' ? SECTIONS_MIGRATION_APPENDIX
    : purpose === 'rewrite' ? SECTIONS_REWRITE_APPENDIX
    : '';
  const appendixLabel = purpose === 'migration' ? ' + סעיף 10 מוכנות למיגרציה'
    : purpose === 'rewrite' ? ' + סעיף 10 Rewrite Blueprint'
    : '';

  if (purpose === 'code-change') {
    if (depthLevel === 'low') {
      return [
        intro + CC_META_CHANGE(changeDesc) + CC_IMPACT + CC_RULES + CC_PSEUDOCODE + CC_RISK + CC_STEPS_TESTS +
        '\n\nפלט מלא — כל הסעיפים (1–8) בקריאה אחת.',
      ];
    }
    if (depthLevel === 'high') {
      return [
        intro + CC_META_CHANGE(changeDesc) + '\n\nפלט **סעיפים 1–2 בלבד**.',
        intro + CC_IMPACT + '\n\nפלט **סעיף 3 בלבד**.',
        intro + CC_RULES + '\n\nפלט **סעיף 4 בלבד**.',
        intro + CC_PSEUDOCODE + '\n\nפלט **סעיף 5 בלבד**.',
        intro + CC_RISK + '\n\nפלט **סעיף 6 בלבד**.',
        intro + CC_STEPS_TESTS + '\n\nפלט **סעיפים 7–8 בלבד**.',
      ];
    }
    // standard (3 calls) — default
    return [
      intro + CC_META_CHANGE(changeDesc) + CC_IMPACT + CC_RULES + '\n\nפלט **סעיפים 1–4 בלבד** — ניתוח השפעה.',
      intro + CC_PSEUDOCODE + '\n\nפלט **סעיף 5 בלבד** — פסאודו-קוד לפני/אחרי.',
      intro + CC_RISK + CC_STEPS_TESTS + '\n\nפלט **סעיפים 6–8 בלבד** — סיכונים ויישום.',
    ];
  }

  // general / migration / rewrite
  if (depthLevel === 'low') {
    return [
      intro + SECTIONS_ALL + appendix + '\n\n' + OUTPUT_FORMATS_BASIC +
      `\n\nפלט מלא — כל הסעיפים (1–9${appendix ? '+10' : ''}) בקריאה אחת.`,
    ];
  }

  if (depthLevel === 'high') {
    return [
      intro + SECTIONS_HIGH_1 + '\n\nפלט **סעיפים 1–2 בלבד**.',
      intro + SECTION_3_ONLY + '\n\n' + FORMAT_3_ONLY + '\n\nפלט **סעיף 3 בלבד** + Mermaid + טבלת I/O.',
      intro + SECTION_4_ONLY + '\n\n' + FORMAT_4_ONLY + '\n\nפלט **סעיף 4 בלבד** + טבלת מספרי קסם.',
      intro + SECTION_56_ONLY + '\n\n' + FORMAT_56_ONLY + '\n\nפלט **סעיפים 5–6 בלבד** + טבלת גישות נתונים.',
      intro + SECTION_78_ONLY + '\n\n' + FORMAT_78_ONLY + '\n\nפלט **סעיפים 7–8 בלבד** + טבלת קודי שגיאה.',
      intro + SECTION_9_ONLY + '\n\n' + FORMAT_9_ONLY + appendix +
      `\n\nפלט **סעיף 9${appendixLabel} בלבד** + פסאודו-קוד + draw.io XML.`,
    ];
  }

  // standard (3 calls) — default
  return [
    intro + SECTIONS_HIGH_1 + '\n\nפלט **Part A בלבד** (סעיפים 1–2).',
    intro + SECTIONS_HIGH_2 + '\n\n' + OUTPUT_FORMATS_HIGH_2 + '\n\nפלט **Part B בלבד** (סעיפים 3–4 + Mermaid + טבלת I/O).',
    intro + SECTIONS_HIGH_3 + '\n\n' + OUTPUT_FORMATS_HIGH_3 + appendix +
    `\n\nפלט **Part C בלבד** (סעיפים 5–9${appendixLabel} + טבלאות + פסאודו-קוד + draw.io XML).`,
  ];
}

// ── Auto-depth: ניתוח קוד לבחירת מספר קריאות ───────────────────────────────

function buildAutoDepthPromptNatural(codeBlock) {
  return `אתה מנתח קוד Natural. קרא את הקוד הבא והחלט כמה קריאות API נדרשות כדי לייצר מסמך אפיון מלא ומדויק.

קריטריונים להחלטה:
- 1 קריאה: תוכנית קצרה ופשוטה, לוגיקה מעטה
- 2-3 קריאות: תוכנית בינונית, מספר תהליכים וגישות נתונים
- 4-5 קריאות: תוכנית מורכבת, הרבה ענפי לוגיקה, אינטגרציות וטבלאות
- 6 קריאות: תוכנית ארוכה ומורכבת מאוד — אל תגיע ל-6 אלא אם באמת נדרש

החלטה מקסימלית: 6 קריאות.

השב אך ורק ב-JSON הבא, ללא שום טקסט נוסף:
{"chunks": <מספר שלם בין 1 ל-6>, "reason": "<סיבה קצרה בעברית, עד 20 מילה>"}

═══════════════════════════════════════════════════
הקוד לניתוח
═══════════════════════════════════════════════════
${codeBlock}`;
}

function depthLevelForCount(n) {
  if (n <= 1) return 'low';
  if (n >= 5) return 'high';
  return 'standard';
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
