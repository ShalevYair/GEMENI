// ============================================================
// שרגא — Gmail POC
// Google Apps Script
// הוראות:
//   1. script.google.com → פרויקט חדש בשם POCShraga
//   2. הדבק את הקוד הזה
//   3. Project Settings → Script Properties → הוסף:
//      שם: GEMINI_KEY  ערך: המפתח שלך
//   4. הגדר Trigger: processShraga → Time-driven → Every 5 minutes
//   5. ב-Gmail: Settings → Filters → צור חוק:
//      Subject: Shraga → Apply label "ממתין לשרגא" + Skip Inbox
// ============================================================

const SHRAGA_IDENTITY = `אתה שרגא — סוכן AI מקצועי בעברית. אתה מסוגל לבצע כל משימה: ניתוח מסמכים, כתיבת קוד, ניהול פרויקטים, פסיכולוגיה, אסטרטגיה, יעוץ עסקי, ועוד. אין תחום שאתה מסרב לעסוק בו. אתה עונה בעברית, בצורה ישירה, מעמיקה ומעשית.`;

function processShraga() {
  const API_KEY      = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  const WAITING_LABEL = 'ממתין לשרגא';

  const label = GmailApp.getUserLabelByName(WAITING_LABEL);
  if (!label) { Logger.log('Label לא נמצא'); return; }

  const threads = label.getThreads();
  if (!threads.length) { Logger.log('אין מיילים ממתינים'); return; }

  for (const thread of threads) {
    const messages = thread.getMessages();
    const lastMsg  = messages[messages.length - 1];
    const body     = lastMsg.getPlainBody().slice(0, 12000);

    try {
      // קריאה 1 — כיול
      const calibRaw = callGemini(API_KEY, buildCalibPrompt(body));
      const calib    = parseJSON(calibRaw);

      // קריאות 2–N — ביצוע
      const plan     = calib.workPlan || [{ section: 'ניתוח כללי', prompt: calib.internalPrompt || body }];
      const numCalls = Math.min(3, Math.max(1, plan.length));
      const sections = [];

      for (let i = 0; i < numCalls; i++) {
        const result  = callGemini(API_KEY, buildExecPrompt(body, calib, plan[i]));
        const summary = extractSummary(result);
        sections.push(`<h2>${plan[i].section}</h2>${convertToHtml(summary)}`);
      }

      // נושא חכם לפי תוכן
      const subject = callGemini(API_KEY,
        `תן כותרת קצרה של 5-7 מילים בעברית שמתארת את התוכן הבא. רק הכותרת, בלי שום דבר אחר:\n${body.slice(0, 500)}`
      ).trim();

      // בנה HTML
      let htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;">`;
      htmlBody += sections.join('<hr>');

      if (calib.questions && calib.questions.length) {
        htmlBody += `<h2>שאלות פתוחות</h2><ol>`;
        calib.questions.forEach(q => { htmlBody += `<li>${q}</li>`; });
        htmlBody += `</ol>`;
      }

      htmlBody += `<hr><p>שרגא 🧠</p></div>`;

      // שלח מייל חדש
      GmailApp.sendEmail(
        Session.getActiveUser().getEmail(),
        'שרגא: ' + subject,
        'ניתוח שרגא מצורף',
        { htmlBody }
      );

      // מחק את המקור
      thread.moveToTrash();
      Logger.log('טופל: ' + subject);

    } catch (e) {
      GmailApp.sendEmail(
        Session.getActiveUser().getEmail(),
        'שרגא — שגיאה',
        'שרגא נתקל בשגיאה: ' + e.message
      );
      thread.moveToTrash();
      Logger.log('שגיאה: ' + e.message);
    }
  }
}

// ── Prompt builders ────────────────────────────────────────────────────────

function buildCalibPrompt(body) {
  return `${SHRAGA_IDENTITY}

עכשיו בשלב הכיול. קיבלת את הפנייה הבאה:
${body}

החזר JSON בלבד (ללא טקסט נלווה):
{
  "understanding": "מה הבנת מהפנייה",
  "numExecutionCalls": <1-3>,
  "internalPrompt": "פרומט מפורט לעצמך לביצוע",
  "workPlan": [{ "section": "שם סעיף", "prompt": "מה לעשות בסעיף זה" }],
  "questions": ["שאלה אם נדרש"]
}`;
}

function buildExecPrompt(body, calib, section) {
  return `${SHRAGA_IDENTITY}

עכשיו בשלב הביצוע.

הנחיות שקבעת לעצמך בכיול:
${calib.internalPrompt || ''}

הבנתך: ${calib.understanding || ''}

המשימה שלך עכשיו — ${section.section}:
${section.prompt}

תוכן המקור:
${body}

כתוב את הניתוח המלא שלך.
בסוף כתוב בדיוק:
---סיכום ותגובה מומלצת---
[כאן רק מה שהמשתמש צריך לראות — תשובה ישירה, ברורה, מעשית, בעברית]`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractSummary(text) {
  const marker = '---סיכום ותגובה מומלצת---';
  const idx    = text.indexOf(marker);
  return idx !== -1 ? text.slice(idx + marker.length).trim() : text;
}

function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8000, temperature: 0.2 }
    })
  });
  return JSON.parse(res.getContentText()).candidates[0].content.parts[0].text;
}

function convertToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/^\* (.+)$/gm,  '<li>$1</li>')
    .replace(/^- (.+)$/gm,   '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function parseJSON(raw) {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch {}
  const first = s.indexOf('{'), last = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch {}
  }
  return {
    understanding: '',
    numExecutionCalls: 1,
    internalPrompt: raw,
    workPlan: [{ section: 'ניתוח', prompt: raw }],
    questions: []
  };
}
