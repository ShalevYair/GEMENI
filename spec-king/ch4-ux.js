export const CH4_LABEL = 'פרק 4 — משתמש וחוויה';

export const CH4_SECTIONS = {
  'personas': {
    label: 'פרסונות משתמש',
    template: `## פרסונות משתמש
### [שם הפרסונה]
- **תפקיד**: [תפקיד בארגון]
- **מטרות**: [מה הפרסונה רוצה להשיג עם המערכת]
- **כאבים**: [מה מפריע לה כיום]
- **רמת ידע טכני**: [גבוה / בינוני / נמוך]
- **תדירות שימוש**: [יומי / שבועי / חד-פעמי]`,
  },
  'journeys': {
    label: 'מסעות משתמש',
    template: `## מסעות משתמש
### [שם המסע] — [שם פרסונה]
**מטרה**: [מה המשתמש מנסה להשיג]

[טבלת אקסל — שם: "מסע: [שם]"]
עמודות: שלב, פעולת משתמש, תגובת מערכת, רגש/נקודת כאב
<excel-table name="מסע משתמש">
[{"שלב":"","פעולת משתמש":"","תגובת מערכת":"","רגש/נקודת כאב":""}]
</excel-table>`,
  },
  'user-stories': {
    label: 'סיפורי משתמש וקריטריוני קבלה',
    template: `## סיפורי משתמש וקריטריוני קבלה
**סמ-001**: כ[תפקיד] אני רוצה ש[פעולה] כדי ש[ערך עסקי]

**קריטריוני קבלה**:
- קק-001-1: בהינתן [הקשר] כאשר [פעולה] אז [תוצאה]
- קק-001-2: ...

**עדיפות**: [חובה / חשוב / רצוי]
**נקודות**: [1 / 2 / 3 / 5 / 8 / 13]`,
  },
  'screens': {
    label: 'מסכים ועיצוב',
    template: `## מסכים ועיצוב
### מלאי מסכים
[טבלת אקסל — שם: "מסכים"]
עמודות: שם מסך, תיאור, קהל יעד, תפקיד נדרש, מקורות נתון, פעולות עיקריות
<excel-table name="מסכים">
[{"שם מסך":"","תיאור":"","קהל יעד":"","תפקיד נדרש":"","מקורות נתון":"","פעולות עיקריות":""}]
</excel-table>

### פירוט לכל מסך
#### [שם המסך]
**מטרה**: [מה המשתמש משיג במסך זה]

**שדות ורכיבים**:
[טבלת אקסל — שם: "שדות: [שם מסך]"]
עמודות: שם שדה, סוג רכיב, חובה, ולידציה, ערך ברירת מחדל, הערות
<excel-table name="שדות מסך">
[{"שם שדה":"","סוג רכיב":"","חובה":"","ולידציה":"","ערך ברירת מחדל":"","הערות":""}]
</excel-table>

**כפתורים ופעולות**:
| כפתור | פעולה | תנאי הצגה |
|---|---|---|

**הודעות למשתמש**: [שגיאות, אישורים, מצבים ריקים]

### פרוטוטייפ HTML — מסכים מרכזיים
עבור כל אחד מ-5 המסכים המרכזיים ביותר, הפק פרוטוטייפ HTML עצמאי בפורמט הבא.
חובה: HTML ו-CSS מוטבע בלבד, RTL, עברית, ללא תלויות חיצוניות.

<html-screen name="[שם המסך הראשון]">
<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>[שם]</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#f8fafc;direction:rtl;color:#1e293b;font-size:14px}
.topbar{background:#1e40af;color:#fff;padding:12px 20px;font-weight:bold;display:flex;align-items:center;gap:10px}
.container{max-width:960px;margin:20px auto;padding:0 16px}
h2{font-size:1rem;margin-bottom:12px;color:#1e293b;font-weight:700}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px}
label{display:block;font-weight:600;margin-bottom:4px;color:#374151;font-size:.85rem}
input,select,textarea{width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:4px;font-family:inherit;font-size:.85rem;margin-bottom:10px}
.actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.btn{background:#2563eb;color:#fff;padding:7px 18px;border:none;border-radius:4px;cursor:pointer;font-size:.85rem}
.btn-sec{background:#fff;color:#374151;border:1px solid #d1d5db;padding:7px 18px;border-radius:4px;font-size:.85rem}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th{background:#f1f5f9;padding:8px;text-align:right;border-bottom:2px solid #e2e8f0;font-weight:600}
td{padding:7px 8px;border-bottom:1px solid #f1f5f9}
tr:hover td{background:#f8fafc}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:600}
.green{background:#d1fae5;color:#065f46}.yellow{background:#fef3c7;color:#92400e}.red{background:#fee2e2;color:#991b1b}
</style></head><body>
<div class="topbar">🏢 [שם המערכת] › [שם המסך]</div>
<div class="container">
<!-- [הפק כאן את תוכן המסך: טפסים, טבלאות, כפתורים — לפי הפירוט שלעיל] -->
</div>
</body></html>
</html-screen>

[המשך עם שאר המסכים באותו פורמט]`,
  },
  'ux-requirements': {
    label: 'דרישות ממשק ונגישות',
    template: `## דרישות ממשק ונגישות
- **שפה וכיוון**: [עברית ימין-לשמאל / אנגלית / דו-לשוני]
- **נגישות**: [רמת תאימות WCAG נדרשת]
- **מכשירים נתמכים**: [מחשב / טאבלט / מובייל]
- **דפדפנים נתמכים**: [רשימה]
- **דרישות עיצוב מיוחדות**: [מיתוג, ספריית עיצוב נדרשת]`,
  },
};

export const CH4_ITEMS = [
  { id: 'personas',        label: 'פרסונות משתמש',                   defaultOn: false },
  { id: 'journeys',        label: 'מסעות משתמש',                     defaultOn: false },
  { id: 'user-stories',    label: 'סיפורי משתמש וקריטריוני קבלה',   defaultOn: true  },
  { id: 'screens',         label: 'מסכים ועיצוב',                    defaultOn: true  },
  { id: 'ux-requirements', label: 'דרישות ממשק ונגישות',            defaultOn: false },
];
