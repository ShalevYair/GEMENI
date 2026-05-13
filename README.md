# אגם הסוכנים — AI Agent Platform

פלטפורמת סוכני AI לניהול מחזור חיי פיתוח תוכנה (SDLC) — ממוקדת כיום בכלי האפיון.

האפליקציה פועלת **לחלוטין בדפדפן** — ללא שרת, ללא התקנה. כל עיבוד מתבצע client-side מול Gemini API ישירות.

### למה דרך API ולא דרך ממשק רגיל?

בממשק הרגיל של Gemini, תשובות מוגבלות ל-**2,000–8,000 טוקנים**. דרך ה-API מקבלים עד **64,000 טוקנים** לתשובה.

אגם הסוכנים מרחיק לכת: כל גנרטור מבצע **4 קריאות API** רצופות, כל אחת עד 64K — כך שמסמך הפלט יכול להכיל עד **256K טוקנים**.

### Fallback אוטומטי בין מודלים

כאשר מגיעים למגבלת quota היומית, המערכת עוברת אוטומטית:

```
gemini-2.5-flash  →  gemini-2.5-flash-preview-04-17  →  gemini-2.5-flash-lite
```

---

## 👑 מלך האפיונים — הכלי המרכזי

**קובץ:** `agent.html?id=spec-king` | **מודל-ייצור:** `modals/spec-king-modal.js` | **פרומפטים:** `spec-king/`

מלך האפיונים הופך דרישות עסקיות גולמיות לאפיון פונקציונלי מלא (FSD) — ב-4 קריאות API רצופות:

| חלק | תוכן |
|-----|------|
| פרק 1 — רקע ועסק | מטרות, בעלי עניין, הנחות, מגבלות |
| פרק 2 — דרישות | פונקציונליות, ביצועים, אמינות, אבטחה |
| פרק 3 — מודל ותהליכים | ERD, חוקי עסק, הרשאות, זרימות |
| פרק 4 — UX | פרסונות, מסעות, User Stories, מסכים + HTML wireframes |

**פלט של כל הרצה:**
- מסמך Markdown מלא (`.md`) — נפתח אוטומטית במציג האפיונים
- קובץ Excel עם כל הטבלאות (`.xlsx`)
- קובץ HTML עם כל תרשימי Mermaid (ERD, flowcharts)
- קובץ HTML עם כל המסכים (wireframes)

**תצורות מיוחדות:** Salesforce · OutSystems

**פיצ'רים:**
- שאלות הבהרה לפני האפיון (אופציונלי)
- בחירת פרקים וסעיפים גמישה
- Fallback אוטומטי בין מודלים תוך המשך מאותו chunk

---

## 📋 מציג האפיונים

**קובץ:** `spec-viewer.html`

מציג את פלטי מלך האפיונים בממשק נוח — נפתח אוטומטית כשסיום הייצור, או בטעינת קבצים ידנית.

**4 לשוניות:**
| לשונית | תוכן |
|--------|------|
| 📄 מסמך | Markdown עם TOC, תרשימי Mermaid inline, כפתורי טבלה |
| 📊 טבלאות | גיליונות Excel עם חיפוש ומיון |
| 🔀 תרשימים | ERD ו-flowcharts עם zoom, מסך מלא, הסתרת שדות |
| 🖥️ מסכים | HTML wireframes בתוך iframe |

---

## 🗺 פיתוח תוכנה

**קובץ:** `SDLCMindMap.html`

תרשים עץ אינטראקטיבי של כל שלבי SDLC — לחיצה על כל צומת מציגה תיאור, גורמים מעורבים, וקישור לסוכן הרלוונטי.

---

## שאר הסוכנים (נגישים דרך agent.html)

| מזהה | שם | תפקיד |
|------|----|--------|
| `requirements` | 📋 אוסף הדרישות | ראיונות מובנים → User Stories → SRS |
| `project-manager` | 📊 מנהל הפרויקט | ספרינטים, סיכונים, דוחות סטטוס |
| `project-coordinator` | 🗂️ רכזת הפרויקטים | RACI, תלויות, Deliverables |
| `software-architect` | 🏗️ ארכיטקט התוכנה | ארכיטקטורת מערכת, patterns, ADR |
| `platform-architect` | ⚙️ ארכיטקט הפלטפורמות | תשתיות, אינטגרציות, CI/CD |
| `tender-writer` | 📝 כותב המכרזים | RFP, SLA, KPIs לספקים |
| `outsystems` | 🔷 OutSystems Expert | Domain Model, Service Actions |
| `storyteller` | 📖 מספר הסיפורים | User Stories, Epics, DoD |
| `design-queen` | 🎨 מלכת העיצובים | Design System, Wireframes, UX |
| `dev-champ` | 💻 אלוף הפיתוחים | Code Review, פתרון בעיות |
| `tester` | 🔍 הבודק | תרחישי בדיקה, UAT |
| `security` | 🔒 המאבטח | OWASP, RBAC, Audit Log |
| `salesforce` | ⚡ Salesforce Killer | FSD → TSD ארכיטקטוני מלא (sf-agent.html) |

---

## קבצים ותיקיות

```
├── index.html              דף בית — כניסה לכלים
├── agent.html              ממשק צ'אט אחיד לכל הסוכנים
├── spec-viewer.html        מציג האפיונים
├── sf-agent.html           Salesforce Killer
├── SDLCMindMap.html        מפת פיתוח תוכנה אינטראקטיבית
│
├── nav.js                  סרגל צד + כותרת עליונה משותפים
├── styles.css              עיצוב גלובלי
├── agent-chat.js           לוגיקת צ'אט (chunking, download, fallback, גנרטורים)
├── agents-config.js        הגדרות כל הסוכנים (system prompt, suggestions)
│
├── spec-king/              פרומפטים וסעיפים של מלך האפיונים
│   ├── index.js            מאסף כל הפרקים
│   ├── ch1-background.js   פרק 1 — רקע ועסק
│   ├── ch2-requirements.js פרק 2 — דרישות
│   ├── ch3-model.js        פרק 3 — מודל ותהליכים (ERD, שדות, זרימות)
│   ├── ch4-ux.js           פרק 4 — UX ומסכים
│   └── ...
├── modals/
│   └── spec-king-modal.js  ממשק מלך האפיונים (בחירת פרקים, הפקה, שליחה למציג)
│
├── app.js / prompt.js      לוגיקה ופרומפטים של SF Killer
├── DSLCapp.js / DSLCchat.js לוגיקת מפת SDLC
└── schema/                 JSON Schema לקבצי deployed/in-flight
```

---

## טכנולוגיות

| ספרייה | שימוש |
|--------|--------|
| Gemini 2.5 Flash (API) | מודל ראשי לכל הסוכנים |
| marked.js | המרת Markdown לHTML |
| mermaid.js v10 | תרשימי ERD ו-flowchart |
| xlsx.js (SheetJS) | ייצוא/ייבוא Excel |
| ECharts | תרשים עץ SDLC |
| Heebo (Google Fonts) | פונט עברי |

ללא npm, ללא build step — הכל דרך CDN.

---

## מפתח API

כל הסוכנים עובדים עם **Gemini API key** (חינמי ב-[aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)).
המפתח נשמר ב-localStorage — מתמיד בין סשנים ומשותף לכל הסוכנים.
