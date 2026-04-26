# TSD → Salesforce

אפליקציית Next.js להמרת מסמך TSD (Technical Specification Document) בפורמט Markdown למערכת Salesforce פועלת, באמצעות Gemini API ו-Salesforce Metadata API.

---

## זרימת השימוש

1. העלה קובץ TSD בפורמט `.md`
2. חבר את חשבון ה-Salesforce שלך דרך OAuth
3. לחץ **צור קבצים** בכל שלב — Gemini יבנה את קבצי ה-XML
4. לחץ **Deploy** לכל שלב — הקבצים יועלו ישירות ל-Salesforce
5. הורד ZIP לגיבוי ידני בכל שלב

### שלבי היצירה

| שלב | תוכן |
|-----|------|
| 1 | Custom Objects + Custom Fields |
| 2 | Validation Rules |
| 3 | Flows (Screen / Auto-launch) |
| 4 | Permission Sets + Page Layouts |

---

## התקנה מקומית

```bash
git clone <repo-url>
cd tsd-to-salesforce
npm install
cp .env.local.example .env.local
# מלא את המשתנים ב-.env.local
npm run dev
```

פתח: http://localhost:3000

---

## הגדרת Salesforce Connected App (חד-פעמי)

1. נכנס ל-Salesforce Setup
2. חפש **App Manager** → **New Connected App**
3. מלא:
   - **Connected App Name:** TSD Deployer
   - **Enable OAuth Settings:** ✅
   - **Callback URL:** `https://your-domain.com/api/auth/salesforce/callback`
   - **Selected OAuth Scopes:** `full`, `refresh_token`
4. שמור → המתן 2-10 דקות → קבל **Client ID** + **Client Secret**
5. הכנס ערכים אלה ל-`.env.local`

---

## משתני סביבה

| משתנה | תיאור |
|-------|-------|
| `SF_CLIENT_ID` | Client ID מה-Connected App |
| `SF_CLIENT_SECRET` | Client Secret מה-Connected App |
| `SF_REDIRECT_URI` | כתובת ה-callback (צריכה להתאים לזו שהוגדרה ב-SF) |
| `NEXT_PUBLIC_APP_URL` | ה-URL המלא של האפליקציה |
| `NEXTAUTH_SECRET` | מחרוזת אקראית לאבטחה |

---

## Deploy ל-Vercel

```bash
npm install -g vercel
vercel --prod
```

הוסף את כל משתני הסביבה ב-Vercel Dashboard → Settings → Environment Variables.

עדכן `SF_REDIRECT_URI` ו-`NEXT_PUBLIC_APP_URL` לכתובת ה-Vercel שלך,
ועדכן את ה-Callback URL גם ב-Salesforce Connected App.

---

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI:** Gemini 2.5 Flash (free tier)
- **Salesforce:** Metadata API v59.0 + OAuth 2.0
- **ZIP:** jszip
