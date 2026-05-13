import { deps } from './deps.js';

const NATURAL_SYSTEM = `אתה מומחה בשפת Natural (Software AG) ואנליסט מערכות מנוסה. קיבלת קובץ קוד Natural (תוכנית / Subprogram / Subroutine / Map / Copycode / Helproutine).

המשימה שלך: להפיק **מסמך אפיון טכני-עסקי בעברית** שמתאר את הקוד ברמה רעיונית-אלגוריתמית, לא שורה-שורה.

זהו קוד legacy ישן. ייתכן שתפגוש מבנים ארכאיים, שמות משתנים מקוצרים (#A, #WS-VAR), DEFINE DATA ישנים, פניות ל-Adabas/DB2/VSAM, ו-CALLNAT לתוכניות אחרות שאינן בהקשר. אל תניח הנחות - אם משהו לא ברור, תגיד.

כללים מחייבים:
1. **אל תתאר כל פקודה בנפרד** - תקבץ לרעיונות לוגיים.
2. **דבר בשפה עסקית-טכנית**. תרגם שמות מקוצרים למשמעות ("#CUST-NO" → "מספר לקוח (#CUST-NO)").
3. **אם משהו לא ברור / חסר הקשר / מפנה לאובייקט שלא קיים בקובץ** - תגיד זאת מפורשות. אל תמציא.
4. **שמות אובייקטים, DDM, ומשתנים - תמיד במקור** (אנגלית, כפי שמופיע בקוד), עם הסבר בעברית.
5. **אם הקובץ ריק / חתוך / לא תקין** - תגיד זאת בראש המסמך ואל תמשיך.
6. אל תכתוב Pseudocode. תכתוב פרוזה ממוספרת.
7. שמור על קומפקטיות - אם הקוד גדול, קבץ אגרסיבית. אם קטן, פרט יותר.
8. **הפלט תמיד ב-Markdown, בעברית, RTL.**`;

const SECTIONS_ALL = `
## פלט נדרש — כל הסעיפים:

### 1. Metadata
טבלה:
- **שם האובייקט** (מתוך הקובץ / שם הקובץ)
- **סוג** (Program / Subprogram / Subroutine / Map / Copycode / Helproutine / Class / Function)
- **מטרה כללית** במשפט אחד
- **קלטים** (פרמטרים ב-PARAMETER section, INPUT USING MAP, וכו')
- **פלטים** (פרמטרים מוחזרים, DISPLAY, WRITE WORK FILE, עדכוני DB)
- **תלויות חיצוניות** (CALLNAT, PERFORM, FETCH, INCLUDE, USING)
- **בסיסי נתונים / קבצים** (Adabas DDM, SQL tables, Work Files, Print Files)

### 2. תיאור עסקי
פסקה אחת (3-6 שורות) שמסבירה **מה הקוד עושה ולמה הוא קיים** מנקודת מבט עסקית. מה הבעיה שהוא פותר, מה התוצאה הסופית. נסה לחלץ את הכוונה מתוך השמות, ההערות, והלוגיקה - לא רק מהמכניקה.

### 3. אלגוריתם - שלבים מרכזיים
רשימה ממוספרת של השלבים הרעיוניים. כל שלב = פעולה לוגית משמעותית (לא כל פקודה בנפרד).

עקרונות קיבוץ:
- **אתחולים והכנת משתנים** רצופים → שלב אחד ("אתחול משתני עבודה").
- כל **IF / DECIDE ON / DECIDE FOR** משמעותי = שלב נפרד עם תתי-סעיפים לכל ענף.
- כל **READ / FIND / HISTOGRAM / SELECT** (גישה ל-DB) = שלב נפרד - ציין את ה-DDM/טבלה ואת תנאי החיפוש.
- כל **לולאה** (READ ... END-READ, REPEAT, FOR) = שלב נפרד עם תיאור על מה רצים ומה קורה בכל איטרציה.
- כל **STORE / UPDATE / DELETE / END TRANSACTION** = שלב נפרד.
- כל **CALLNAT / PERFORM subroutine** = שלב נפרד, ציין את שם הקריאה ומה מועבר/מוחזר.
- כל **INPUT / REINPUT** (אינטראקציה עם משתמש) = שלב נפרד.
- כל **WRITE / DISPLAY / WRITE WORK FILE / PRINT** = שלב נפרד.

### 4. מבני נתונים מרכזיים
טבלה של משתנים/קבוצות חשובים מתוך DEFINE DATA:
| שם | סוג (A/N/P/I + אורך) | Scope (LOCAL/GLOBAL/PARAMETER/INDEPENDENT) | תפקיד עסקי |
|----|----------------------|---------------------------------------------|-------------|
אל תכלול כל משתנה - רק את אלה שמשמעותיים ללוגיקה.

### 5. גישות לנתונים
טבלה:
| מקור (DDM / Table / Work File) | סוג גישה (READ / FIND / STORE / UPDATE / DELETE) | מפתח / תנאי | מטרה |

### 6. קריאות חיצוניות (CALLNAT / PERFORM / FETCH)
לכל קריאה:
- שם
- סוג (CALLNAT לאובייקט אחר / PERFORM ל-Subroutine פנימית / FETCH לתוכנית)
- פרמטרים שמועברים (קלט/פלט)
- מטרת הקריאה (אם ניתן להסיק)

### 7. טיפול בשגיאות
- האם יש ON ERROR block?
- האם נבדקים RESPONSE-CODE / *ERROR-NR / *ERROR-LINE?
- מה קורה בכשל DB (No records found / Duplicate / Hold)?
- האם יש BACKOUT TRANSACTION?

### 8. הערות וביקורת בונה
- **חוב טכני / ריחות קוד**: GOTO-ים, קוד מת, כפילויות, משתנים גלובליים בעייתיים, hardcoded values.
- **סיכונים**: לולאות אינסופיות פוטנציאליות, אין END TRANSACTION, READ ללא LIMIT, וכו'.
- **חוסר בהירות**: מקומות שצריך לבדוק עם מי שמכיר את המערכת (בעיקר CALLNAT-ים שלא ניתן להסיק מהם).
- **הצעות לשיפור / מודרניזציה** אם רלוונטי.`;

const SECTIONS_PART1 = `
## פלט נדרש — חלק א' (סעיפים 1-4):

### 1. Metadata
טבלה:
- **שם האובייקט** (מתוך הקובץ / שם הקובץ)
- **סוג** (Program / Subprogram / Subroutine / Map / Copycode / Helproutine / Class / Function)
- **מטרה כללית** במשפט אחד
- **קלטים** (פרמטרים ב-PARAMETER section, INPUT USING MAP, וכו')
- **פלטים** (פרמטרים מוחזרים, DISPLAY, WRITE WORK FILE, עדכוני DB)
- **תלויות חיצוניות** (CALLNAT, PERFORM, FETCH, INCLUDE, USING)
- **בסיסי נתונים / קבצים** (Adabas DDM, SQL tables, Work Files, Print Files)

### 2. תיאור עסקי
פסקה אחת (3-6 שורות) שמסבירה **מה הקוד עושה ולמה הוא קיים** מנקודת מבט עסקית.

### 3. אלגוריתם - שלבים מרכזיים
רשימה ממוספרת של השלבים הרעיוניים. כל שלב = פעולה לוגית משמעותית.

עקרונות קיבוץ:
- **אתחולים** רצופים → שלב אחד.
- כל IF / DECIDE משמעותי = שלב נפרד עם תתי-סעיפים.
- כל READ / FIND / SELECT = שלב נפרד עם ה-DDM ותנאי החיפוש.
- כל לולאה = שלב נפרד עם מה שקורה בכל איטרציה.
- כל STORE / UPDATE / DELETE / END TRANSACTION = שלב נפרד.
- כל CALLNAT / PERFORM = שלב נפרד עם מה מועבר/מוחזר.
- כל INPUT / REINPUT = שלב נפרד.
- כל WRITE / DISPLAY = שלב נפרד.

### 4. מבני נתונים מרכזיים
טבלה של משתנים/קבוצות חשובים מתוך DEFINE DATA (רק המשמעותיים):
| שם | סוג (A/N/P/I + אורך) | Scope | תפקיד עסקי |`;

const SECTIONS_PART2 = `
## פלט נדרש — חלק ב' (סעיפים 5-8):
(המשך הניתוח של אותו קובץ Natural)

### 5. גישות לנתונים
טבלה:
| מקור (DDM / Table / Work File) | סוג גישה (READ / FIND / STORE / UPDATE / DELETE) | מפתח / תנאי | מטרה |

### 6. קריאות חיצוניות (CALLNAT / PERFORM / FETCH)
לכל קריאה: שם, סוג, פרמטרים (קלט/פלט), מטרת הקריאה.

### 7. טיפול בשגיאות
- האם יש ON ERROR block?
- האם נבדקים RESPONSE-CODE / *ERROR-NR / *ERROR-LINE?
- מה קורה בכשל DB (No records found / Duplicate / Hold)?
- האם יש BACKOUT TRANSACTION?

### 8. הערות וביקורת בונה
- **חוב טכני / ריחות קוד**: GOTO-ים, קוד מת, כפילויות, hardcoded values.
- **סיכונים**: לולאות אינסופיות פוטנציאליות, אין END TRANSACTION, READ ללא LIMIT.
- **חוסר בהירות**: CALLNAT-ים שלא ניתן להסיק מהם.
- **הצעות לשיפור / מודרניזציה**.`;

const SECTIONS_HIGH_1 = `
## פלט נדרש — חלק א' (סעיפים 1-2):

### 1. Metadata
טבלה מפורטת:
- **שם האובייקט** (מתוך הקובץ / שם הקובץ)
- **סוג** (Program / Subprogram / Subroutine / Map / Copycode / Helproutine / Class / Function)
- **מטרה כללית** במשפט אחד
- **קלטים** — פרט כל פרמטר: שם, סוג, אורך, מקור
- **פלטים** — פרט כל פרמטר: שם, סוג, אורך, יעד
- **תלויות חיצוניות** — CALLNAT, PERFORM, FETCH, INCLUDE, USING (עם הסבר על כל אחד)
- **בסיסי נתונים / קבצים** — Adabas DDM, SQL tables, Work Files, Print Files (עם מספרי שדות אם ידוע)

### 2. תיאור עסקי
פסקה מפורטת (5-8 שורות) שמסבירה **מה הקוד עושה ולמה הוא קיים** מנקודת מבט עסקית. כלול:
- ההקשר העסקי (באיזו מחלקה/תהליך עסקי נמצאת תוכנית זו?)
- מה הבעיה שהיא פותרת
- מי הם המשתמשים / קוראים לה
- מה התוצאה הסופית`;

const SECTIONS_HIGH_2 = `
## פלט נדרש — חלק ב' (סעיף 3 — אלגוריתם מפורט):
(המשך הניתוח של אותו קובץ Natural)

### 3. אלגוריתם - שלבים מרכזיים
רשימה ממוספרת מפורטת של השלבים הרעיוניים.

עקרונות קיבוץ:
- **אתחולים** רצופים → שלב אחד עם פירוט כל המשתנים המאותחלים ולמה.
- כל **IF / DECIDE ON / DECIDE FOR** = שלב נפרד עם תתי-סעיפים לכל ענף ופירוט ההיגיון העסקי.
- כל **READ / FIND / HISTOGRAM / SELECT** = שלב נפרד עם ה-DDM/טבלה, תנאי החיפוש, מה קורה אם לא נמצא.
- כל **לולאה** (READ...END-READ, REPEAT, FOR) = שלב נפרד עם מה עוברים, מה קורה בכל איטרציה, תנאי יציאה.
- כל **STORE / UPDATE / DELETE / END TRANSACTION** = שלב נפרד עם פירוט השדות המעודכנים.
- כל **CALLNAT / PERFORM** = שלב נפרד עם כל הפרמטרים ומה הם מייצגים עסקית.
- כל **INPUT / REINPUT** = שלב נפרד עם שם ה-Map ומה המשתמש מזין.
- כל **WRITE / DISPLAY / WRITE WORK FILE** = שלב נפרד עם תיאור הפלט.

פורמט דוגמה:
1. אתחול משתני עבודה — מאפס את כל מונה הרשומות (#COUNT), משתני הצבירה (#TOTAL-AMT), ודגלי שגיאה (#ERR-FLAG).
2. קריאת פרמטרים — מקבל #CUST-NO (מספר לקוח) וטווח תאריכים (#DATE-FROM, #DATE-TO).
...`;

const SECTIONS_HIGH_3 = `
## פלט נדרש — חלק ג' (סעיפים 4-8 ומסקנות):
(המשך הניתוח של אותו קובץ Natural)

### 4. מבני נתונים מרכזיים
טבלה מפורטת של **כל** המשתנים/קבוצות החשובים מתוך DEFINE DATA:
| שם | סוג (A/N/P/I + אורך) | Scope (LOCAL/GLOBAL/PARAMETER/INDEPENDENT) | תפקיד עסקי |
|----|----------------------|---------------------------------------------|-------------|

### 5. גישות לנתונים
טבלה מפורטת:
| מקור (DDM / Table / Work File) | סוג גישה | מפתח / תנאי | מטרה |

### 6. קריאות חיצוניות (CALLNAT / PERFORM / FETCH)
לכל קריאה: שם, סוג, כל פרמטר עם כיוון (קלט/פלט), מטרת הקריאה, מה קורה אחריה.

### 7. טיפול בשגיאות
- האם יש ON ERROR block? אם כן, מה קורה בו?
- האם נבדקים RESPONSE-CODE / *ERROR-NR / *ERROR-LINE? היכן?
- מה קורה בכשל DB (No records found / Duplicate / Hold)?
- האם יש BACKOUT TRANSACTION? על אילו פעולות?
- האם יש מנגנון logging?

### 8. הערות וביקורת בונה
**חוב טכני / ריחות קוד:**
- GOTO-ים, קוד מת, כפילויות, משתנים גלובליים בעייתיים, hardcoded values
- פקודות מיושנות שיש להן תחליף מודרני ב-Natural

**סיכונים:**
- לולאות אינסופיות פוטנציאליות
- אין END TRANSACTION
- READ ללא LIMIT
- פעולות DB ללא טיפול ב-RESPONSE-CODE

**חוסר בהירות:**
- CALLNAT-ים שלא ניתן להסיק מהם ללא קוד החיצוני
- לוגיקה שדורשת בירור עם מי שמכיר את המערכת

**הצעות לשיפור / מודרניזציה:**
- מה ניתן לשפר ב-Natural עצמה
- מה ניתן להמיר לשפה מודרנית ואיזה שכבות לשמור`;

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
            <div style="color:#64748b;font-size:.82rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.75rem;">.nsp · .nsa · .nsd · .nsc · .nsl · .nsg · .txt (עד 2MB)</span></div>
            <input id="nat-file-input" type="file" accept=".nsp,.nsa,.nsd,.nsc,.nsl,.nsg,.txt,.ncp,.nst,.nsm" style="display:none;" onchange="window.natFileSelected(this.files)">
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

  const depth = document.querySelector('input[name="nat-depth"]:checked')?.value || 'normal';
  const fileName = natFile.name;

  window.closeNaturalModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

  let codeText = '';
  try {
    deps.updateTyping(progressId, `קורא קובץ: ${fileName}…`);
    const fileData = await deps.readFile(natFile);
    codeText = fileData.text || '';
    if (!codeText.trim()) {
      throw new Error('הקובץ ריק או לא ניתן לקרוא אותו כטקסט.');
    }
  } catch (e) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  const fileHeader = `שם הקובץ: ${fileName}\n\n`;
  const codeBlock  = `\`\`\`natural\n${codeText}\n\`\`\``;

  const chunks = buildChunks(depth, fileHeader, codeBlock);
  const results = [];
  let mIdx = deps.getModelIdx();

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

  const combined = results.join('\n\n---\n\n');
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

function buildChunks(depth, fileHeader, codeBlock) {
  const intro = `${NATURAL_SYSTEM}\n\n---\n\n## הקובץ לניתוח:\n\n${fileHeader}${codeBlock}\n\n---\n\n`;

  if (depth === 'basic') {
    return [intro + SECTIONS_ALL + '\n\nהתחל לעבוד על הקובץ המצורף.'];
  }

  if (depth === 'normal') {
    return [
      intro + SECTIONS_PART1 + '\n\nהתחל לעבוד על הקובץ המצורף. פלט **חלק א\' בלבד** (סעיפים 1-4).',
      intro + SECTIONS_PART2 + '\n\nהמשך ניתוח הקובץ. פלט **חלק ב\' בלבד** (סעיפים 5-8).',
    ];
  }

  // high — 3 chunks
  return [
    intro + SECTIONS_HIGH_1 + '\n\nהתחל לעבוד על הקובץ המצורף. פלט **חלק א\' בלבד** (סעיפים 1-2).',
    intro + SECTIONS_HIGH_2 + '\n\nהמשך ניתוח הקובץ. פלט **חלק ב\' בלבד** (סעיף 3 — האלגוריתם המפורט).',
    intro + SECTIONS_HIGH_3 + '\n\nהמשך ניתוח הקובץ. פלט **חלק ג\' בלבד** (סעיפים 4-8 ומסקנות).',
  ];
}

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
