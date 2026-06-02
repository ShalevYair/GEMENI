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
    // מנוע כפילות: הסר את ה-label מיד, לפני קריאות Gemini הארוכות,
    // כדי שריצה חופפת לא תטפל באותו thread פעם שנייה.
    thread.removeLabel(label);

    const messages = thread.getMessages();
    const lastMsg  = messages[messages.length - 1];
    const body     = lastMsg.getPlainBody().slice(0, 12000);

    try {
      // ── שלב 1: כיול — שרגא מבין כוונה ומחליט לבד כמה עבודה צריך ──
      const calibRaw = callGemini(API_KEY, buildCalibPrompt(body));
      const calib    = parseJSON(calibRaw);

      const plan     = calib.workPlan || [{ section: 'ניתוח כללי', prompt: calib.internalPrompt || body }];
      const numCalls = Math.min(4, Math.max(1, plan.length));
      const isSimple = calib.complexity === 'simple' || numCalls === 1;

      // ── שלב 2: ביצוע — קריאה אחת או כמה, לפי החלטת הכיול ──
      let finalText;
      if (isSimple) {
        // שאלה פשוטה: קריאת הביצוע היא התשובה הסופית — בלי סינתזה מיותרת
        finalText = callGemini(API_KEY, buildExecPrompt(body, calib, plan[0]));
      } else {
        // בקשה מורכבת: כמה תוצרים גולמיים → שלב סינתזה אחד שמאחד אותם
        const sections = [];
        for (let i = 0; i < numCalls; i++) {
          sections.push(callGemini(API_KEY, buildExecPrompt(body, calib, plan[i])));
        }
        // ── שלב 3: סינתזה — תשובה אחת סופית ומלוטשת למשתמש ──
        finalText = callGemini(API_KEY, buildSynthesisPrompt(body, calib, sections));
      }

      // נושא חכם לפי תוכן
      const subject = callGemini(API_KEY,
        `תן כותרת קצרה של 5-7 מילים בעברית שמתארת את התוכן הבא. רק הכותרת, בלי שום דבר אחר:\n${body.slice(0, 500)}`
      ).trim();

      // בנה HTML — תשובה אחת זורמת, בלי פיגומים פנימיים
      let htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;">`;
      htmlBody += convertToHtml(finalText);

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

עכשיו אתה בשלב הכיול. תפקידך להבין את הפנייה ולתכנן כמה עבודה היא דורשת.

קיבלת את הפנייה הבאה:
${body}

הנחיות לכיול:
1. סווג את אופי הפנייה ב-"mode":
   - "execute" = יש כאן משימה קונקרטית לביצוע עכשיו (לנתח מסמך, לכתוב קוד, להכין תוכנית עבודה וכו').
   - "advise"  = המשתמש מתייעץ, שואל "איך כדאי", או מתאר התנהגות/יכולות שהוא רוצה ש"שרגא יעשה מעכשיו".
     שים לב: אם הפנייה מתארת איך שרגא צריך להתנהג בעתיד — אל תיישם את ההתנהגות הזו עכשיו!
     זו בקשת ייעוץ/תכנון — תתייחס לרעיון ותייעץ עליו, אל תבצע אותו על המשתמש.
2. סווג "complexity":
   - "simple"  = שאלה/בקשה שאפשר לענות עליה היטב בקריאה אחת (רוב המקרים).
   - "complex" = בקשה רחבה עם כמה תוצרים נפרדים (למשל: תוכנית עבודה + מענה משפטי + הצעת PoC).
3. קבע workPlan: סעיף אחד ל-simple, 2-4 סעיפים ל-complex — כל סעיף תוצר עצמאי.

החזר JSON בלבד (ללא טקסט נלווה):
{
  "understanding": "מה הבנת מהפנייה",
  "mode": "execute" | "advise",
  "complexity": "simple" | "complex",
  "internalPrompt": "הנחיות מפורטות לעצמך לשלב הביצוע",
  "workPlan": [{ "section": "שם סעיף", "prompt": "מה לעשות בסעיף זה" }],
  "questions": ["שאלה למשתמש אם באמת נדרש, אחרת השאר ריק"]
}`;
}

function buildExecPrompt(body, calib, section) {
  const adviseNote = calib.mode === 'advise'
    ? `\nשים לב: זו פנייה מסוג ייעוץ/תכנון. אם הפנייה מתארת איך שרגא צריך להתנהג בעתיד — אל תיישם זאת על המשתמש; תייעץ על הרעיון עצמו.\n`
    : '';
  return `${SHRAGA_IDENTITY}

עכשיו אתה בשלב הביצוע.
${adviseNote}
הנחיות שקבעת לעצמך בכיול:
${calib.internalPrompt || ''}

הבנתך: ${calib.understanding || ''}

המשימה שלך עכשיו — ${section.section}:
${section.prompt}

תוכן המקור:
${body}

כתוב תשובה ישירה, ברורה, מעשית ומלאה בעברית — בדיוק מה שהמשתמש צריך לקבל.`;
}

function buildSynthesisPrompt(body, calib, sections) {
  return `${SHRAGA_IDENTITY}

ביצעת עבודה פנימית בכמה שלבים. לפניך התוצרים הגולמיים של השלבים.
תפקידך עכשיו: לאחד אותם לתשובה אחת סופית, קוהרנטית ומלוטשת בעברית — בדיוק מה שהמשתמש יקבל במייל.

חוקים:
- אל תזכיר שלבים, סעיפים פנימיים או "תהליך עבודה". כתוב כאילו זו תשובה אחת רציפה.
- אל תחזור על אותו תוכן פעמיים; מזג חפיפות.
- שמור על מבנה ברור (כותרות, רשימות) אם זה עוזר לקריאות.

הפנייה המקורית של המשתמש:
${body}

התוצרים הגולמיים שלך:
${sections.map((s, i) => `--- תוצר ${i + 1} ---\n${s}`).join('\n\n')}

כתוב כעת את התשובה הסופית האחת למשתמש:`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
