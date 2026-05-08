# אגם הסוכנים — AI Agent Platform

פלטפורמת סוכני AI לניהול מחזור חיי פיתוח תוכנה (SDLC) מלא — מאיסוף דרישות ועד אבטחה ופריסה.

האפליקציה פועלת **לחלוטין בדפדפן** — ללא שרת, ללא התקנה. כל עיבוד מתבצע client-side מול Gemini API ישירות.

---

## מבנה המערכת

```
אגם הסוכנים (index.html)
├── מפת SDLC אינטראקטיבית (SDLCMindMap.html)
├── סוכני צ'אט — 13 סוכנים (agent.html?id=<id>)
├── Salesforce Killer — סוכן ארכיטקט (sf-agent.html)
└── מסך ניהול (admin.html)
```

---

## הסוכנים הפעילים

### 💬 סוכני צ'אט (agent.html)

ממשק שיחה אחיד לכל 13 הסוכנים. כל סוכן טוען מתוך `agents-config.js` — system prompt ייעודי, הצעות התחלה, ותיאור תפקיד.

| מזהה | שם הסוכן | תפקיד |
|------|----------|--------|
| `requirements` | 📋 אוסף הדרישות | ראיונות מובנים → User Stories → SRS |
| `project-manager` | 📊 מנהל הפרויקט | ספרינטים, סיכונים, דוחות סטטוס |
| `project-coordinator` | 🗂️ רכזת הפרויקטים | RACI, תלויות, Deliverables |
| `spec-king` | 👑 מלך האיפיונים | FSD מלא — מסכים, ERD, זרימות |
| `software-architect` | 🏗️ ארכיטקט התוכנה | ארכיטקטורת מערכת, patterns, ADR |
| `platform-architect` | ⚙️ ארכיטקט הפלטפורמות | תשתיות, אינטגרציות, CI/CD |
| `tender-writer` | 📝 כותב המכרזים | RFP, SLA, KPIs לספקים |
| `outsystems` | 🔷 OutSystems Expert | Domain Model, Service Actions |
| `storyteller` | 📖 מספר הסיפורים | User Stories עם Acceptance Criteria, Epics, DoD |
| `design-queen` | 🎨 מלכת העיצובים | Design System, Wireframes, UX |
| `dev-champ` | 💻 אלוף הפיתוחים | Code Review, פתרון בעיות, Best Practices |
| `tester` | 🔍 הבודק | תרחישי בדיקה, UAT, דוחות ממצאים |
| `security` | 🔒 המאבטח | OWASP, RBAC, Audit Log, Compliance |

**פיצ'רים של ממשק הצ'אט:**
- העלאת קבצים: `.docx`, `.pdf`, `.txt`, `.csv`, `.json`, `.md`, תמונות
- עיבוד קבצי טקסט גדולים (>50K תווים) בחלקים עם progress מובנה
- תשובות ארוכות (>3,000 תווים) מורדות אוטומטית כקובץ `.md`
- מגבלת פלט: עד 65,000 טוקנים לתשובה
- Fallback אוטומטי בין מודלים בעת מגבלת quota

**גנרטורי מסמכים — 4 חלקים:**

| סוכן | כפתור | פלט |
|------|--------|-----|
| 🏗️ ארכיטקט התוכנה | "הפק מסמך ארכיטקטורה" | Technical Architecture Document (`.md`) |
| ⚙️ ארכיטקט הפלטפורמות | "הפק מסמך פלטפורמה" | Platform Architecture Document (`.md`) |
| 🔷 OutSystems Expert | "הפק TSD מלא" | Technical Solution Design ל-O11 / ODC / שניהם (`.md`) |
| 🎨 מלכת העיצובים | "הפק Mockup HTML" | פרוטוטיפ HTML אינטראקטיבי עם כל המסכים (`.html`) |

כל גנרטור מקבל מסמך אפיון בכל פורמט ומפיק את הפלט ב-4 קריאות API מחוברות.

---

### ⚡ Salesforce Killer — סוכן ארכיטקט
**קובץ:** `sf-agent.html`

סוכן ארכיטקט Salesforce שמקבל אפיון פונקציונלי (FSD), מצליב מול המצב הקיים ב-org, ומפיק TSD ארכיטקטוני מלא.

**קלט:**
| קובץ | תיאור |
|------|--------|
| `deployed.json` | מצב ה-org הנוכחי (אובייקטים, שדות, אוטומציות, הרשאות, אינטגרציות) |
| `in-flight.json` | אפיונים שאושרו אך טרם פרוסים — מונע כפילויות (אופציונלי) |
| FSD | מסמך אפיון פונקציונלי (`.docx` או `.pdf`) |

**פלט — TSD ב-8 קבצים:**
| קובץ | תוכן |
|------|-------|
| `00_executive_summary` | הקשר עסקי, גישה, החלטות מפתח, 3 סיכונים עיקריים |
| `01_objects` | לכל אובייקט: REUSE / EXTEND / CREATE / CONFLICT |
| `02_fields` | שמות API בעברית, סוג, נוסחה, FLS, RTL |
| `03_automations` | Flows, Apex, Validation Rules, Approval Processes |
| `04_permissions` | Permission Sets, sharing rules, מטריצת FLS |
| `05_layouts` | Page Layouts, Lightning Pages, LWC, RTL |
| `06_integrations` | Named Credentials, callout patterns, טיפול בשגיאות |
| `07_impact_analysis` | קונפליקטים, ADRs, שאלות פתוחות, סיכוני ארכיטקטורה |

פלט נוסף: `in-flight-updated.json` — מעודכן עם הרכיבים החדשים, מוכן להרצה הבאה.

**אופי הסוכן — stateful:**
- מסווג כל דרישה: ✅ REUSE · 🔧 EXTEND · 🆕 CREATE · ⚠ CONFLICT
- מזהה קונפליקטים לפני העיצוב
- מתעד כל החלטה כ-ADR
- כלל עדיפות: אם אותו `api_name` מופיע ב-deployed וב-in-flight — in-flight גובר
- Fallback אוטומטי בין מודלים בעת מגבלת quota — ממשיך מאותו chunk, לא מתחיל מחדש

**קבצים:** `app.js`, `prompt.js`, `claude-prompt.js`

---

### 🗺 מפת SDLC אינטראקטיבית
**קובץ:** `SDLCMindMap.html`

תרשים עץ אינטראקטיבי של כל שלבי SDLC — תכנון, אפיון, עיצוב, פיתוח, בדיקות, פריסה ותחזוקה.
לחיצה על כל צומת מציגה: תיאור השלב, גורמים מעורבים, וקישור לסוכן הרלוונטי.

**פיצ'רים:**
- סינון לפי גורם מעורב
- מצב בהיר/כהה
- שינוי גודל טקסט
- צ'אט מובנה עם Gemini לשאלות על המפה
- כל הקישורים לסוכנים מפנים לדפים המקומיים (agent.html)

**קבצים:** `DSLCapp.js`, `DSLCchat.js`, `DSLCstyles.css`, `SDLCMindMap.csv`

---

### ⚙ מסך ניהול
**קובץ:** `admin.html` / `admin.js`

מסך מרוכז לצפייה בכל האפיונים שאושרו לאורך הסשנים — אובייקטים, שדות ואוטומציות. מאפשר ייצוא `in-flight.json` ממוזג.

אחסון: **localStorage בדפדפן המשתמש בלבד**.

---

## ניווט וממשק

**`nav.js`** — מזריק לכל הדפים:
- סרגל צד עם רשימת כל הסוכנים וקישורים
- כותרת עליונה עם שם הסוכן הפעיל, כפתורי +/− גודל טקסט, ומצב בהיר/כהה

**עיצוב אחיד בכל הדפים:**
- Dark mode כברירת מחדל — `body.light-mode` מפעיל מצב בהיר, ניתן להחלפה בכפתור ☾/☀
- גודל טקסט מותאם אישית מסונכרן דרך localStorage
- פלטת צבעים: `#08080f` רקע, `#5b6cf5` electric indigo, כרטיסי סוכנים עם glow על hover

---

## קבצים ותיקיות

```
├── index.html              דף בית — פורטל הסוכנים
├── agent.html              ממשק צ'אט אחיד לכל 13 הסוכנים
├── sf-agent.html           Salesforce Killer
├── SDLCMindMap.html        מפת SDLC אינטראקטיבית
├── admin.html              מסך ניהול
│
├── nav.js                  סרגל צד + כותרת עליונה משותפים
├── styles.css              עיצוב גלובלי
│
├── agent-chat.js           לוגיקת צ'אט (chunking, download, fallback, גנרטורים)
├── agents-config.js        הגדרות כל 13 הסוכנים (system prompt, suggestions)
│
├── architect-prompt.js          פרומפט גנרטור ארכיטקטורת תוכנה (4 chunks)
├── platform-architect-prompt.js פרומפט גנרטור ארכיטקטורת פלטפורמות (4 chunks)
├── outsystems-prompt.js         פרומפט גנרטור TSD ל-OutSystems — O11/ODC/Both (4 chunks)
├── design-queen-prompt.js       פרומפט גנרטור פרוטוטיפ HTML (4 chunks)
│
├── app.js                  לוגיקת SF Killer (קריאות Gemini, uploads, היסטוריה)
├── prompt.js               פרומפט סוכן הארכיטקט (3 chunks)
├── claude-prompt.js        פרומפט ל-Claude Desktop להפקת deployed.json
├── admin.js                לוגיקת מסך הניהול
│
├── DSLCapp.js              לוגיקת מפת ה-SDLC (ECharts, CSV, פילטרים)
├── DSLCchat.js             צ'אט Gemini למפת ה-SDLC
├── DSLCstyles.css          עיצוב מפת ה-SDLC
├── SDLCMindMap.csv         נתוני SDLC — שלבים, תת-שלבים, גורמים, סוכנים
│
├── schema/
│   └── state-schema.json   JSON Schema לקבצי deployed/in-flight
├── prompts/
│   └── extract-deployed-state.md   פרומפט ל-Claude Desktop
└── tsd-to-salesforce/      אפליקציית Next.js — המרת TSD למטאדאטה SF (שלב הבא)
```

---

## טכנולוגיות

| ספרייה | שימוש |
|--------|--------|
| [Gemini 2.5 Flash](https://aistudio.google.com) | מודל ראשי — כל הסוכנים |
| [Gemini 3 Flash Preview](https://ai.google.dev) | מודל fallback ראשון |
| [Gemini 2.5 Flash Lite](https://ai.google.dev) | מודל fallback שני |
| [ECharts](https://echarts.apache.org) | תרשים העץ האינטראקטיבי של SDLC |
| [PapaParse](https://www.papaparse.com) | פרסינג ה-CSV של מפת ה-SDLC |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | חילוץ טקסט מ-.docx |
| [pdf.js](https://mozilla.github.io/pdf.js) | חילוץ טקסט מ-PDF |
| [Heebo](https://fonts.google.com/specimen/Heebo) | פונט עברי |

ללא npm, ללא build step — הכל דרך CDN.

---

## מפתח API

כל הסוכנים עובדים עם **Gemini API key** (חינמי ב-[aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)).
המפתח נשמר ב-localStorage — מתמיד בין סשנים ומשותף לכל הסוכנים.

**Fallback אוטומטי בין מודלים:**
כאשר מגיעים למגבלת quota היומית, המערכת עוברת אוטומטית:
`gemini-2.5-flash` → `gemini-3-flash-preview` → `gemini-2.5-flash-lite`

ב-SF agent: המעבר מתרחש תוך המשך מאותו chunk — ללא צורך בהתחלה מחדש.

---

## אבטחה ופרטיות

- כל העיבוד client-side
- הבקשה היחידה החוצה: ישירות ל-Gemini API
- אין שרת ביניים
- מפתח API נשמר ב-localStorage בלבד (לא נשלח לשום מקום אחר)

---

## Roadmap

- [ ] מעבר אחסון ניהול מ-localStorage ל-git ארגוני
- [ ] OAuth אמיתי למסך הניהול
- [ ] Snapshot Builder — רענון `deployed.json` אוטומטי מ-Salesforce
- [ ] streaming responses — הצגת תשובות בזמן אמת תוך כדי קבלה מה-API
