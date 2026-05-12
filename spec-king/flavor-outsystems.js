// עקרונות ומינוח OutSystems שמשפיעים על כל פרק רלוונטי

export const OUTSYSTEMS_RULES_O11 = `
═══════════════════════════════════════════════════
כללי OutSystems O11 — חלים על כל הפרקים
═══════════════════════════════════════════════════
1. ארבע שכבות: כל מודול ממוקם בדיוק באחת מהשכבות:
   יסוד (Foundation) → ליבה (Core) → משתמש קצה (End-User) → תיאום (Orchestration)
   תלות מותרת רק כלפי מטה — לעולם לא כלפי מעלה.

2. אין הפניה ישירה בין מודולים: ישות שייכת למודול אחד בלבד.
   גישה ממודול אחר = דרך פעולת שירות (Service Action) בלבד.

3. לוגיקה עסקית בשכבת הליבה: Server Actions בשכבת הליבה בלבד.
   Screen Actions = ניווט UI ואימות קלט בלבד.

4. תהליכים ממושכים = BPT או Timer: כל תהליך שחורג מבקשה אחת.

5. מינוח: ישות, שדה, פעולת שירות, פעולת שרת, App Reactive, BPT, Timer.`;

export const OUTSYSTEMS_RULES_ODC = `
═══════════════════════════════════════════════════
כללי OutSystems ODC — חלים על כל הפרקים
═══════════════════════════════════════════════════
1. בידוד אפליקציות: כל App הוא יחידת פריסה עצמאית.
   תקשורת בין Apps = דרך Public Server Actions בלבד.

2. סוגי Apps: Library (ללא מסד נתונים) / Service App (בעל ישויות) / Web/Mobile App (ממשק בלבד).

3. לוגיקה עסקית ב-Service App בלבד: Web/Mobile App לא מחזיק ישויות.

4. תהליכים ממושכים = Timer או תיאום חיצוני (Azure Logic Apps וכו').

5. מינוח: App, Library, Service App, Public Server Action, Settings (במקום Site Properties), ODC Portal.`;

export const OUTSYSTEMS_MODULE_ARCH_PROMPT = (version) => version === 'odc'
  ? `תאר את ארכיטקטורת האפליקציות: Libraries → Service Apps → Web/Mobile Apps.
     לכל App: שם, סוג, אחריות, ישויות בבעלות, Public Server Actions חשופות.`
  : `תאר את ארכיטקטורת המודולים לפי ארבע השכבות.
     לכל מודול: שם, שכבה, אחריות, ישויות בבעלות, Service Actions חשופות, תלויות.`;
