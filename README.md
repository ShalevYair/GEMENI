# אגם הסוכנים — AI Agent Platform

פלטפורמת סוכני AI לניהול מחזור חיי פיתוח תוכנה (SDLC) מלא — מאיסוף דרישות ועד אבטחה ופריסה.

האפליקציה פועלת **לחלוטין בדפדפן** — ללא שרת, ללא התקנה. כל עיבוד מתבצע client-side מול Gemini API ישירות.

---

## מבנה המערכת

```
אגם הסוכנים (index.html)
├── מפת SDLC אינטראקטיבית (SDLCMindMap.html)
├── Salesforce Killer — סוכן ארכיטקט (sf-agent.html)
└── מסך ניהול (admin.html)
```

---

## הכלים הפעילים

### 🗺 מפת SDLC אינטראקטיבית
**קובץ:** `SDLCMindMap.html`

תרשים עץ אינטראקטיבי של כל שלבי SDLC — תכנון, אפיון, עיצוב, פיתוח, בדיקות, פריסה ותחזוקה.
לחיצה על כל צומת מציגה: תיאור השלב, גורמים מעורבים, וסוכני AI רלוונטיים עם קישור ישיר ל-Gemini Gem.

**פיצ'רים:**
- סינון לפי גורם מעורב
- מצב בהיר/כהה
- שינוי גודל טקסט
- צ'אט מובנה עם Gemini לשאלות על המפה

**קבצים:** `DSLCapp.js`, `DSLCchat.js`, `DSLCstyles.css`, `SDLCMindMap.csv`

---

### ⚡ Salesforce Killer — סוכן ארכיטקט
**קובץ:** `sf-agent.html`

סוכן ארכיטקט Salesforce שמקבל אפיון פונקציונלי (FSD), מצליב מול המצב הקיים ב-org, ומפיק TSD ארכיטקטוני מלא.

**קלט:**
| קובץ | תיאור |
|------|--------|
| `deployed.json` | מצב ה-org הנוכחי (אובייקטים, שדות, אוטומציות, הרשאות, אינטגרציות) |
| `in-flight.json` | אפיונים שאושרו אך טרם פרוסים — מונע כפילויות |
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

**קבצים:** `app.js`, `prompt.js`, `claude-prompt.js`

---

### ⚙ מסך ניהול
**קובץ:** `admin.html` / `admin.js`

מסך מרוכז לצפייה בכל האפיונים שאושרו לאורך הסשנים — אובייקטים, שדות ואוטומציות. מאפשר ייצוא `in-flight.json` ממוזג.

אחסון: **localStorage בדפדפן המשתמש בלבד**.

---

## ניווט וממשק

**`nav.js`** — סרגל צד משותף לכל הדפים. מציג כלים ורשימת הסוכנים (הפעילים ובקרוב).

**`index.html`** — דף הבית: מציג את כל הסוכנים, מפת SDLC, צ'אט עזרה מובנה, ושליטה במצב תצוגה (בהיר/כהה, גודל טקסט).

---

## קבצים ותיקיות

```
├── index.html              דף בית — פורטל הסוכנים
├── sf-agent.html           Salesforce Killer
├── SDLCMindMap.html        מפת SDLC אינטראקטיבית
├── admin.html              מסך ניהול
├── nav.js                  סרגל צד משותף
├── styles.css              עיצוב גלובלי
│
├── app.js                  לוגיקת SF Killer (קריאות Gemini, uploads, היסטוריה)
├── prompt.js               פרומפט סוכן הארכיטקט (3 chunks)
├── claude-prompt.js        פרומפט ל-Claude Desktop להפקת deployed.json
├── admin.js                לוגיקת מסך הניהול
│
├── DSLCapp.js              לוגיקת מפת ה-SDLC (ECharts, CSV, פילטרים)
├── DSLCchat.js             צ'אט Gemini למפת ה-SDLC
├── DSLCstyles.css          עיצוב מפת ה-SDLC (dark theme, CSS variables)
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
| [Gemini 2.5 Flash](https://aistudio.google.com) | מודל ה-AI לכל הסוכנים |
| [ECharts](https://echarts.apache.org) | תרשים העץ האינטראקטיבי של SDLC |
| [PapaParse](https://www.papaparse.com) | פרסינג ה-CSV של מפת ה-SDLC |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | חילוץ טקסט מ-.docx |
| [pdf.js](https://mozilla.github.io/pdf.js) | חילוץ טקסט מ-PDF |
| [Heebo](https://fonts.google.com/specimen/Heebo) | פונט עברי |

ללא npm, ללא build step — הכל דרך CDN.

---

## מפתח API

כל הסוכנים עובדים עם **Gemini API key** (חינמי ב-[aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)).
המפתח נשמר בזיכרון הסשן בלבד — לא ב-localStorage, לא בקוקיז, לא בלוגים.

---

## אבטחה ופרטיות

- כל העיבוד client-side
- הבקשה היחידה החוצה: ישירות ל-Gemini API
- אין שרת ביניים
- מפתח API אינו נשמר בשום אחסון קבוע

---

## Roadmap

- [ ] סוכנים נוספים: אוסף הדרישות, מנהל הפרויקט, מלך האיפיונים, ואחרים
- [ ] מעבר אחסון ניהול מ-localStorage ל-git ארגוני
- [ ] OAuth אמיתי למסך הניהול
- [ ] Snapshot Builder — רענון `deployed.json` אוטומטי מ-Salesforce
