# אגם הסוכנים — AI Agent Platform

פלטפורמת סוכני AI לניהול מחזור חיי פיתוח תוכנה (SDLC) — כולל כלים לאפיון, דרישות, ארכיטקטורה, עיצוב, פיתוח, בדיקות ועוד.

האפליקציה פועלת **לחלוטין בדפדפן** — ללא שרת, ללא התקנה. כל עיבוד מתבצע client-side מול Gemini API ישירות.

### למה דרך API ולא דרך ממשק רגיל?

בממשק הרגיל של Gemini, תשובות מוגבלות ל-**2,000–8,000 טוקנים**. דרך ה-API מקבלים עד **65,000 טוקנים** לתשובה.

אגם הסוכנים מרחיק לכת: גנרטורים כמו מלך האפיונים מבצעים **עד 6 קריאות API** רצופות — כך שמסמך הפלט יכול להגיע ל-**390K+ טוקנים**.

### Fallback אוטומטי בין מודלים

כאשר מגיעים למגבלת quota היומית, המערכת עוברת אוטומטית:

```
gemini-3.5-flash  →  gemini-2.5-flash  →  gemini-2.5-flash-lite
```

---

## כל הסוכנים (24)

### 👑 מלך האפיונים
**`agent.html?id=spec-king`** · מודל: `modals/spec-king-modal.js` · פרומפטים: `spec-king/`

הופך דרישות עסקיות גולמיות לאפיון פונקציונלי מלא (FSD) — עד 6 פרקים בקריאות API רצופות:

| פרק | תוכן |
|-----|------|
| 1 — רקע ועסק | מטרות, בעלי עניין, הנחות, מגבלות |
| 2 — דרישות | פונקציונליות, ביצועים, אמינות, אבטחה |
| 3 — מודל ותהליכים | ERD, חוקי עסק, הרשאות, זרימות, אינטגרציות |
| 4 — UX | פרסונות, מסעות, User Stories, מסכים + HTML wireframes |
| 5 — ארכיטקטורה | ארכיטקטורת מערכת, deployment, scaling |
| 6 — בדיקות | אסטרטגיית בדיקה, תרחישים, UAT |

**פלט מכל הרצה:** Markdown מלא (`.md`) · Excel עם כל הטבלאות (`.xlsx`) · HTML עם תרשימי Mermaid · HTML עם wireframes

**תצורות מיוחדות:** Salesforce · OutSystems

**פיצ'רים:** בחירת פרקים וסעיפים גמישה · שאלות הבהרה לפני אפיון · המשך אוטומטי אם תשובה נחתכת · fallback בין מודלים תוך המשך מאותו chunk

---

### 📋 מציג האפיונים
**`spec-viewer.html`**

מציג את פלטי מלך האפיונים — נפתח אוטומטית בסיום הייצור, או בטעינת קבצים ידנית.

| לשונית | תוכן |
|--------|------|
| 📄 מסמך | Markdown עם TOC, תרשימי Mermaid inline |
| 📊 טבלאות | גיליונות Excel עם חיפוש ומיון |
| 🔀 תרשימים | ERD ו-flowcharts עם zoom |
| 🖥️ מסכים | HTML wireframes בתוך iframe |

---

### 🧠 שרגא
**`agent.html?id=shraga`** · מודל: `modals/shraga-modal.js`

מנתח קבצים מרובים לעומק ומחזיר ניתוח מאורגן בקובץ Word. עובד בשני שלבים:

- **קריאה 1 — כיול:** קורא את כל החומרים, כותב לעצמו פרומט מפורט, מחליט כמה קריאות ביצוע נדרשות (1–4)
- **קריאות 2–5 — ביצוע:** מנתח לפי התוכנית, מחזיר קובץ Word עם ממצאים ושאלות פתוחות

**קבצים נתמכים:** DOCX · DOC · TXT · MD · PDF · XLS · XLSX (עד 20 קבצים)

**פיצ'רים:** תיבת הקשר חופשית · אזהרות על תמונות (עלות גבוהה, ערך נמוך) · אזהרות על היקף כבד · פלט Word עם RTL מלא

---

### 📋 בריפר
**`agent.html?id=briefer`** · מודל: `modals/briefer-modal.js`

מפיק בריף מקצועי לתיחור ספקים במכרז הדיגיטק — ממלא שאלון קלט ומחזיר בריף מנוסח עם טבלת שו"שים לפי המבנה הרשמי של משרד התחבורה.

---

### 📋 אוסף הדרישות
**`agent.html?id=requirements`** · מודל: `modals/requirements-modal.js`

מנהל ראיונות מובנים עם בעלי עניין, ממיר צרכים עסקיים ל-User Stories, ומפיק מסמך SRS מלא. תומך בקבצים מרובים ובשפת פלט Hebrew/English.

---

### 📊 מנהל הפרויקט
**`agent.html?id=project-manager`**

מתכנן ספרינטים, עוקב אחר התקדמות, מזהה סיכונים וחסמים, מייצר דוחות סטטוס ואבני דרך.

---

### 🗂️ רכזת הפרויקטים
**`agent.html?id=project-coordinator`**

מתאמת בין צוותים, בונה מטריצות RACI, מנהלת תלויות ו-Deliverables.

---

### 🏗️ ארכיטקט התוכנה
**`agent.html?id=software-architect`** · מודל: `modals/architect-modal.js`

מתכנן ארכיטקטורת מערכת (Microservices/Monolith/Event-Driven), כותב HLD/LLD, ומתעד החלטות ב-ADR.

---

### ⚙️ ארכיטקט הפלטפורמות
**`agent.html?id=platform-architect`** · מודל: `modals/platform-modal.js`

בוחר פלטפורמות (Salesforce, OutSystems, Azure, AWS), מגדיר אינטגרציות ו-CI/CD.

---

### 🎨 מלכת העיצובים
**`agent.html?id=design-queen`** · מודל: `modals/design-queen-modal.js`

מגדירה Design System, מייצרת wireframes וקומפוננטות, מתכננת UX ונגישות (WCAG 2.1 AA).

---

### 💻 אלוף הפיתוחים
**`agent.html?id=dev-champ`**

Code Review, פתרון בעיות טכניות, best practices (SOLID, DRY), גישות מימוש.

---

### 📖 מספר הסיפורים
**`agent.html?id=storyteller`** · מודל: `modals/storyteller-modal.js`

מייצר User Stories (INVEST), Acceptance Criteria (Given-When-Then), Epic breakdown, DoD/DOR, ניהול Backlog.

---

### 🔍 הבודק
**`agent.html?id=tester`**

תרחישי בדיקה (happy/edge/error/security), UAT, regression, performance testing, דוחות באגים.

---

### 🔒 המאבטח
**`agent.html?id=security`**

מודלינג איומים (STRIDE), RBAC, OWASP Top 10, עיצוב Audit Log, עמידה בתקני ISO 27001 ו-GDPR.

---

### 📝 כותב המכרזים
**`agent.html?id=tender-writer`**

מסמכי RFP, קריטריוני הערכת ספקים, הגדרות SLA/KPI, תנאי חוזה.

---

### 🖥️ NATURAL
**`agent.html?id=natural`** · מודל: `modals/natural-modal.js`

מנתח קוד Software AG Natural (לגסי) ומפיק מסמך טכני-עסקי בעברית. תומך בקבצים מרובים שנשמרים כהקשר לשאלות המשך.

---

### 📝 המסכם
**`agent.html?id=summarizer`** · מודל: `modals/summarizer-modal.js`

מקבל מסמך (TXT/MD/PDF/DOCX), מפיק סיכום היררכי בפורמט Excel: נושא ראשי → משני → תת-נושא → תיאור. תומך ב-1–3 קריאות API לפי עומק נבחר.

---

### 🔬 חוקר ממשק המשתמש
**`agent.html?id=ui-explorer`** · מודל: `modals/ui-explorer-modal.js`

מנתח קבצי HTML עיצוביים (UI mockups), מחלץ פרסונות, זרימות עבודה, פערים בין mock לDB, ומחזיר HTML מוביל עם הערות.

---

### { } הטכנולוג
**`agent.html?id=json-gen`** · מודל: `modals/json-modal.js`

קורא אפיון מערכת ומייצר JSON מלא בפורמט Mayuvgam (entities, fields, forms, views, workflows, permissions, dashboards).

---

### 🔮 סוכן דינמי
**`agent.html?id=dynamic`** · מודל: `modals/dynamic-modal.js`

מבין את צרכי המשתמש, בונה פרומט מדויק, ומבצע בעומק שנבחר (בסיסי/רגיל/גבוה).

---

### 🔷 OutSystems Expert
**`agent.html?id=outsystems`** · מודל: `modals/outsystems-modal.js`

Domain Model, Service Actions, מבנה מודולים, הבדלי O11 מול ODC, patterns לביצועים.

---

### ⚡ Salesforce Killer
**`sf-agent.html`**

ממיר FSD ל-TSD (Technical Solution Design) לארגוני Salesforce — כולל gap analysis ו-impact assessment.

---

### 🗺 פיתוח תוכנה
**`SDLCMindMap.html`**

תרשים עץ אינטראקטיבי של כל שלבי SDLC — לחיצה על צומת מציגה תיאור, גורמים, וקישור לסוכן הרלוונטי.

---

## ארכיטקטורה

### זרימת נתונים

```
קלט משתמש (טקסט / קובץ)
    ↓
agent-chat.js: sendMessage()
    ↓ קובץ גדול מ-50K תווים?
   כן → sendChunked() — פיצול לחלקים, עיבוד רצוף, איחוד
   לא → callGemini() — קריאה אחת עם היסטוריית שיחה
    ↓
Gemini API (MODEL_CHAIN[modelIdx])
    ↓
quota חרג? → עבור למודל הבא → נסה שוב מאותו נקודה
עמוס (429)? → countdown 15 שניות → נסה שוב
    ↓
תשובה > 8,000 תווים? → הורדה אוטומטית כ-.md
אחרת → הצגה inline עם marked.js
```

### מערכת המודלים (Modals)

כל סוכן עם מודל מיוחד הוא מודול ES נפרד בתיקיית `modals/`. הקובץ `modals/deps.js` הוא registry משותף שמחזיק הפניות לפונקציות הבסיס (appendMessage, callGemini, getApiKey, וכו') — מונע circular dependencies.

כל מודל:
1. מייצא `initXxxModal()` — נקרא ב-DOMContentLoaded
2. מזריק HTML של הדיאלוג ל-DOM
3. מתקשר ל-Gemini דרך `deps.callGeminiForSpec()`
4. מפיק פלט (הורדה, localStorage, chat)

### קריאת קבצים

| פורמט | טיפול |
|--------|--------|
| DOCX | חילוץ טקסט via mammoth.js |
| PDF | base64 inline |
| TXT, CSV, JSON, MD | plain text |
| XLS, XLSX | המרה ל-CSV via xlsx.js |
| PNG, JPG, GIF, WEBP | base64 inline |
| DOC (ישן) | ניסיון קריאה בינארית, חלקי |

גודל מקסימלי: 10MB לקובץ. קבצי טקסט מעל 50K תווים מפוצלים לחלקים.

### State Management

| מפתח localStorage | מטרה |
|---|---|
| `gemini_api_key` | מפתח API — משותף לכל הסוכנים |
| `spec-viewer-data` | פלט מלך האפיונים (JSON עם markdown, tables, diagrams, screens) |
| `sdlc-dark-mode` | מצב תצוגה (light/dark) |
| `sdlc-font-size` | גודל גופן גלובלי |

תקשורת בין-לשוניות: `BroadcastChannel('spec-viewer')` — מלך האפיונים כותב למציג שכבר פתוח.

---

## מבנה קבצים

```
├── index.html              דף בית — רשת כל הסוכנים
├── agent.html              ממשק צ'אט אחיד לכל הסוכנים
├── spec-viewer.html        מציג האפיונים (4 לשוניות)
├── sf-agent.html           Salesforce Killer
├── SDLCMindMap.html        מפת SDLC אינטראקטיבית
│
├── nav.js                  סרגל צד + כותרת — מוזרקים לכל עמוד
├── styles.css              עיצוב גלובלי (dark-mode first, RTL)
├── agent-chat.js           לוגיקת צ'אט (send, file, chunking, fallback, download)
├── agents-config.js        הגדרות 24 הסוכנים (icon, desc, suggestions, systemPrompt)
│
├── spec-king/              פרמוטים ומבנה פרקי מלך האפיונים
│   ├── index.js            מאסף פרקים + ניהול flavors
│   ├── base-rules.js       כללי כתיבת FSD אוניברסליים
│   ├── ch1-background.js   פרק 1 — רקע ועסק
│   ├── ch2-requirements.js פרק 2 — דרישות
│   ├── ch3-model.js        פרק 3 — מודל, ERD, זרימות
│   ├── ch4-ux.js           פרק 4 — UX ומסכים
│   ├── ch5-architecture.js פרק 5 — ארכיטקטורה
│   ├── ch6-testing.js      פרק 6 — בדיקות
│   ├── flavor-salesforce.js תוספות Salesforce
│   ├── flavor-outsystems.js תוספות OutSystems
│   └── clarification.js    שאלות הבהרה לפני אפיון
│
└── modals/
    ├── deps.js             registry פונקציות משותפות
    ├── spec-king-modal.js  UI ייצור FSD
    ├── shraga-modal.js     ניתוח קבצים דו-שלבי → Word
    ├── briefer-modal.js    ייצור בריף דיגיטק
    ├── requirements-modal.js  ראיונות → SRS
    ├── storyteller-modal.js   User Stories ו-Epics
    ├── architect-modal.js     אפיון טכני
    ├── platform-modal.js      אפיון פלטפורמה
    ├── outsystems-modal.js    עיצוב OutSystems
    ├── design-queen-modal.js  wireframes ו-Design System
    ├── natural-modal.js       ניתוח קוד Natural
    ├── dynamic-modal.js       סוכן דינמי
    ├── json-modal.js          ייצור JSON Mayuvgam
    ├── summarizer-modal.js    סיכום → Excel
    └── ui-explorer-modal.js   ניתוח HTML UI
```

---

## טכנולוגיות

| ספרייה | שימוש |
|--------|--------|
| Gemini 2.5 Flash (API) | מודל ראשי לכל הסוכנים |
| mammoth.js | חילוץ טקסט מ-DOCX |
| marked.js v5+ | המרת Markdown ל-HTML |
| mermaid.js v10 | תרשימי ERD ו-flowchart |
| xlsx.js (SheetJS) | ייצוא/ייבוא Excel, קריאת XLS/XLSX |
| ECharts | תרשים עץ SDLC |
| Heebo (Google Fonts) | פונט עברי |

ללא npm, ללא build step — הכל דרך CDN.

---

## מפתח API

כל הסוכנים עובדים עם **Gemini API key** (חינמי ב-[aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)).
המפתח נשמר ב-localStorage — מתמיד בין סשנים ומשותף לכל הסוכנים.
