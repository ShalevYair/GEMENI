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
//   6. (זיכרון) צור Google Sheet בשם "ShragaMemory" עם כותרות בשורה 1:
//      email | full_name | role | manager_email | team | projects | notes
//      העתק את ה-ID שלו (מה-URL) ל-Script Property בשם MEMORY_SHEET_ID
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

    // קריאת קבצים מצורפים
    const attachmentTexts = [];
    lastMsg.getAttachments().forEach(att => {
      const mime = att.getContentType();
      const name = att.getName();
      try {
        if (mime.startsWith('text/') || mime === 'application/json') {
          attachmentTexts.push(`[קובץ: ${name}]\n${att.getDataAsString().slice(0, 8000)}`);
        } else if (
          mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          mime === 'application/vnd.ms-powerpoint' ||
          mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          mime === 'application/pdf'
        ) {
          // המרה ל-Google Slides/Docs דרך Drive ואז ייצוא כטקסט
          const text = _extractTextFromBinaryAttachment(att, mime);
          if (text) attachmentTexts.push(`[קובץ: ${name}]\n${text.slice(0, 8000)}`);
        }
      } catch(_) {}
    });
    const fullBody = attachmentTexts.length
      ? body + '\n\n--- קבצים מצורפים ---\n' + attachmentTexts.join('\n\n')
      : body;

    // ── זיכרון: מי המשתמש שפנה, ומה שרגא כבר יודע עליו ──
    const userEmail = extractEmail(lastMsg.getFrom());
    const profile   = lookupProfile(userEmail);

    try {
      // ── שלב 1: כיול — שרגא מבין כוונה ומחליט לבד כמה עבודה צריך ──
      const calibRaw = callGemini(API_KEY, buildCalibPrompt(fullBody, profile));
      const calib    = parseJSON(calibRaw);

      // עדכון זיכרון: אם המשתמש מסר פרטים חדשים על עצמו, שמור אותם
      if (calib.profileUpdates && Object.keys(calib.profileUpdates).length) {
        saveProfile(userEmail, profile, calib.profileUpdates);
      }

      const plan     = calib.workPlan || [{ section: 'ניתוח כללי', prompt: calib.internalPrompt || fullBody }];
      const numCalls = Math.min(4, Math.max(1, plan.length));
      const isSimple = calib.complexity === 'simple' || numCalls === 1;

      // ── שלב 2: ביצוע — קריאה אחת או כמה, לפי החלטת הכיול ──
      let finalText;
      if (isSimple) {
        finalText = callGemini(API_KEY, buildExecPrompt(fullBody, calib, plan[0], profile));
      } else {
        const sections = [];
        for (let i = 0; i < numCalls; i++) {
          sections.push(callGemini(API_KEY, buildExecPrompt(fullBody, calib, plan[i], profile)));
        }
        finalText = callGemini(API_KEY, buildSynthesisPrompt(fullBody, calib, sections, profile));
      }

      // נושא: טקסט נקי בלבד, בלי קידומת "שרגא:" ובלי markdown
      const rawSubject = callGemini(API_KEY,
        `כתוב כותרת מייל בעברית בלבד — עד 5 מילים — שתגרום למקבל להבין מה הוא מקבל. טקסט רגיל בלבד, ללא כוכביות, ללא פסיק, ללא קידומת. רק הכותרת:\n${body.slice(0, 500)}`
      ).trim();
      const subject = rawSubject
        .replace(/^(THOUGHT|thinking|thought):[\s\S]*$/i, '')
        .replace(/\*+/g, '')
        .replace(/^שרגא[:\s]*/i, '')
        .trim()
        .slice(0, 200) || 'תשובת שרגא';

      // בנה HTML גוף מייל
      let htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;">`;

      const isPresentation = calib.outputFormat === 'presentation';
      if (isPresentation) {
        htmlBody += `<p>המצגת מצורפת כקובץ PowerPoint (.pptx).</p>`;
      } else {
        htmlBody += convertToHtml(finalText);
      }

      if (calib.questions && calib.questions.length) {
        htmlBody += `<h2>שאלות פתוחות</h2><ol>`;
        calib.questions.forEach(q => { htmlBody += `<li>${q}</li>`; });
        htmlBody += `</ol>`;
      }

      htmlBody += `<hr><p>שרגא</p></div>`;

      // שלח תשובה לשולח המקורי, עם CC לעצמך למעקב
      const myEmail = Session.getActiveUser().getEmail();
      const replyTo = userEmail !== myEmail ? userEmail : myEmail;
      const emailOptions = { htmlBody, cc: replyTo !== myEmail ? myEmail : '' };

      // אם זו מצגת — צרף קובץ PPTX
      if (isPresentation) {
        emailOptions.attachments = [buildPptxBlob(finalText, subject)];
      }

      GmailApp.sendEmail(replyTo, subject, '', emailOptions);

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

function buildCalibPrompt(body, profile) {
  return `${SHRAGA_IDENTITY}
${profileContext(profile)}
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
4. קבע "outputFormat":
   - "presentation" = המשתמש ביקש מצגת / שקפים / PowerPoint / Slides
   - "text" = כל שאר המקרים
5. אם המשתמש מסר בפנייה פרטים חדשים על עצמו (תפקיד, מנהל, צוות, פרויקטים וכו') —
   החזר אותם ב-"profileUpdates" כדי שנשמור אותם לזיכרון. אחרת השאר אובייקט ריק.
   שדות אפשריים: full_name, role, manager_email, team, projects, notes.

החזר JSON בלבד (ללא טקסט נלווה):
{
  "understanding": "מה הבנת מהפנייה",
  "mode": "execute" | "advise",
  "complexity": "simple" | "complex",
  "internalPrompt": "הנחיות מפורטות לעצמך לשלב הביצוע",
  "workPlan": [{ "section": "שם סעיף", "prompt": "מה לעשות בסעיף זה" }],
  "outputFormat": "text" | "presentation",
  "profileUpdates": { },
  "questions": ["שאלה למשתמש אם באמת נדרש, אחרת השאר ריק"]
}`;
}

function buildExecPrompt(body, calib, section, profile) {
  const adviseNote = calib.mode === 'advise'
    ? `\nשים לב: זו פנייה מסוג ייעוץ/תכנון. אל תיישם שינויים על המשתמש — תייעץ על הרעיון עצמו.\n`
    : '';
  const presentationNote = calib.outputFormat === 'presentation'
    ? `\nפורמט נדרש: החזר JSON בלבד (ללא טקסט נלווה) לפי הסכמה הבאה:
{
  "theme": "dark-tech" | "light-corp" | "warm-energy" | "green-future",
  "slides": [
    { "type": "cover",      "title": "...", "subtitle": "..." },
    { "type": "section",    "title": "..." },
    { "type": "content",    "title": "...", "bullets": ["..."] },
    { "type": "comparison", "title": "...", "left": {"label":"...","points":["..."]}, "right": {"label":"...","points":["..."]} },
    { "type": "quote",      "text": "...", "source": "..." },
    { "type": "summary",    "title": "סיכום", "bullets": ["..."] }
  ]
}
כללים:
- בחר theme לפי טון הבקשה: dark-tech=טכנולוגי, light-corp=עסקי/ניהולי, warm-energy=שיווקי/יצירתי, green-future=עתידני/סביבתי
- תמיד התחל ב-cover אחד
- הוסף שקפי section להפרדת פרקים
- השתמש ב-comparison כשיש השוואה בין שני דברים
- השתמש ב-quote כשיש מסר חזק לציטוט
- סיים ב-summary
- סה"כ עד 14 שקפים, עד 5 bullets בשקף content\n`
    : '';
  // כשזו מצגת — הוראת הפורמט קודמת לכל השאר
  if (presentationNote) {
    return `${presentationNote}

${SHRAGA_IDENTITY}
${profileContext(profile)}
הנחיות שקבעת לעצמך: ${calib.internalPrompt || ''}
הבנתך: ${calib.understanding || ''}
המשימה: ${section.section} — ${section.prompt}

תוכן המקור:
${body}

חשוב: החזר JSON בלבד כמו שהוגדר למעלה. אל תוסיף ברכות, הסברים, או כל טקסט מחוץ ל-JSON.`;
  }

  return `${SHRAGA_IDENTITY}
${profileContext(profile)}
עכשיו אתה בשלב הביצוע.
${adviseNote}
הנחיות שקבעת לעצמך בכיול:
${calib.internalPrompt || ''}

הבנתך: ${calib.understanding || ''}

המשימה שלך עכשיו — ${section.section}:
${section.prompt}

תוכן המקור:
${body}

כתוב תשובה ישירה, ברורה, מעשית ומלאה בעברית.`;
}

function buildSynthesisPrompt(body, calib, sections, profile) {
  const isPresentation = calib.outputFormat === 'presentation';
  const formatInstruction = isPresentation
    ? `חשוב ביותר: הפלט הסופי חייב להיות JSON בלבד לפי הסכמה הבאה, ללא שום טקסט לפני או אחרי:
{
  "theme": "dark-tech" | "light-corp" | "warm-energy" | "green-future",
  "slides": [
    { "type": "cover", "title": "...", "subtitle": "..." },
    { "type": "section", "title": "..." },
    { "type": "content", "title": "...", "bullets": ["..."] },
    { "type": "comparison", "title": "...", "left": {"label":"...","points":["..."]}, "right": {"label":"...","points":["..."]} },
    { "type": "quote", "text": "...", "source": "..." },
    { "type": "summary", "title": "סיכום", "bullets": ["..."] }
  ]
}
אל תכתוב תיאור של המצגת — בנה אותה ישירות ב-JSON.`
    : 'כתוב תשובה סופית אחת, רציפה, ברורה, מעשית ומלאה בעברית. אל תזכיר שלבים פנימיים.';

  return `${SHRAGA_IDENTITY}
${profileContext(profile)}
ביצעת עבודה פנימית בכמה שלבים. לפניך התוצרים הגולמיים.

הפנייה המקורית:
${body}

התוצרים הגולמיים:
${sections.map((s, i) => `--- תוצר ${i + 1} ---\n${s}`).join('\n\n')}

${formatInstruction}`;
}

// ── Memory (Google Sheets) ──────────────────────────────────────────────────
// טבלה אחת, שורה לכל משתמש. כותרות בשורה 1:
// email | full_name | role | manager_email | team | projects | notes

const MEMORY_FIELDS = ['email', 'full_name', 'role', 'manager_email', 'team', 'projects', 'notes'];

function memorySheet() {
  const id = PropertiesService.getScriptProperties().getProperty('MEMORY_SHEET_ID');
  if (!id) return null;                       // זיכרון לא מוגדר — שרגא פשוט ירוץ בלי פרופיל
  return SpreadsheetApp.openById(id).getSheets()[0];
}

// מחזיר אובייקט פרופיל למשתמש, או null אם אינו מוכר
function lookupProfile(email) {
  const sheet = memorySheet();
  if (!sheet || !email) return null;
  const rows = sheet.getDataRange().getValues();
  for (let r = 1; r < rows.length; r++) {     // דלג על שורת הכותרות
    if (String(rows[r][0]).trim().toLowerCase() === email.toLowerCase()) {
      const p = {};
      MEMORY_FIELDS.forEach((f, c) => { p[f] = rows[r][c] || ''; });
      p._row = r + 1;
      return p;
    }
  }
  return null;
}

// יוצר/מעדכן שורת פרופיל עם הפרטים החדשים שהמשתמש מסר
function saveProfile(email, existing, updates) {
  const sheet = memorySheet();
  if (!sheet || !email) return;
  const merged = Object.assign({ email }, existing || {}, updates);
  const rowValues = MEMORY_FIELDS.map(f => merged[f] || '');
  if (existing && existing._row) {
    sheet.getRange(existing._row, 1, 1, MEMORY_FIELDS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// מזריק את מה ששרגא יודע על המשתמש לתוך הקונטקסט של כל קריאה
function profileContext(profile) {
  if (!profile) {
    return `\nהמשתמש שפנה אליך אינו מוכר לך עדיין — אין לך פרופיל עליו. אם רלוונטי, בקש פרטים בסיסיים (שם, תפקיד) בעדינות, אך ענה על שאלתו בכל מקרה.\n`;
  }
  const known = MEMORY_FIELDS.filter(f => f !== 'email' && profile[f])
    .map(f => `${f}: ${profile[f]}`).join(', ');
  return `\nמה שאתה כבר יודע על המשתמש שפנה אליך (${profile.email}): ${known || 'פרטים חלקיים בלבד'}.\nהשתמש במידע הזה כדי להתאים את תשובתך. אל תבקש שוב פרטים שכבר ידועים לך.\n`;
}

// חילוץ כתובת מייל נקייה מתוך שדה From (למשל: "יאיר שלו <yair@x.com>")
function extractEmail(from) {
  const m = String(from).match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

// ── Helpers ────────────────────────────────────────────────────────────────

// ממיר קובץ בינארי מצורף (PPTX/DOCX/PDF) לטקסט דרך Drive export
function _extractTextFromBinaryAttachment(att, mime) {
  const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const PDF_MIME  = 'application/pdf';

  let googleMime;
  if (mime === PPTX_MIME || mime === 'application/vnd.ms-powerpoint') {
    googleMime = 'application/vnd.google-apps.presentation';
  } else if (mime === DOCX_MIME || mime === 'application/msword') {
    googleMime = 'application/vnd.google-apps.document';
  } else if (mime === PDF_MIME) {
    googleMime = 'application/vnd.google-apps.document';
  } else {
    return null;
  }

  // העלאה ל-Drive עם המרה אוטומטית
  const token   = ScriptApp.getOAuthToken();
  const boundary = '----GASBoundary';
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: att.getName(), mimeType: googleMime }) + '\r\n';
  const dataPart = `--${boundary}\r\nContent-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
    Utilities.base64Encode(att.getBytes()) + `\r\n--${boundary}--`;

  const uploadResp = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'post',
      contentType: `multipart/related; boundary="${boundary}"`,
      payload: metaPart + dataPart,
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    }
  );
  if (uploadResp.getResponseCode() !== 200) return null;

  const fileId   = JSON.parse(uploadResp.getContentText()).id;
  const exportMime = googleMime === 'application/vnd.google-apps.presentation'
    ? 'text/plain'
    : 'text/plain';

  const textResp = UrlFetchApp.fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
  );

  // ניקוי — מחק את הקובץ מ-Drive
  DriveApp.getFileById(fileId).setTrashed(true);

  return textResp.getResponseCode() === 200 ? textResp.getContentText() : null;
}

function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
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

// ── Presentation renderer ─────────────────────────────────────────────────────

const PRES_THEMES = {
  'dark-tech':    { bg: '#0f172a', accent: '#6366f1', text: '#f8fafc', sub: '#94a3b8', sectionBg: '#1e1b4b' },
  'light-corp':   { bg: '#f8fafc', accent: '#2563eb', text: '#1e293b', sub: '#64748b', sectionBg: '#dbeafe' },
  'warm-energy':  { bg: '#1c0a00', accent: '#f97316', text: '#fef3c7', sub: '#fdba74', sectionBg: '#431407' },
  'green-future': { bg: '#022c22', accent: '#10b981', text: '#ecfdf5', sub: '#6ee7b7', sectionBg: '#064e3b' },
};

// יוצר Google Slides מ-JSON מובנה, מייצא ל-PPTX, מחזיר Blob, ומוחק מ-Drive
function buildPptxBlob(raw, title) {
  // פרסר: חילוץ JSON גמיש — מתעלם מטקסט לפני/אחרי ה-JSON
  let presData;
  try {
    let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    // נסה ישיר
    try { presData = JSON.parse(s); } catch(_) {}
    // חלץ את ה-{ ... } הראשון-אחרון אם יש טקסט מסביב
    if (!presData || !presData.slides) {
      const first = s.indexOf('{'), last = s.lastIndexOf('}');
      if (first !== -1 && last > first) presData = JSON.parse(s.slice(first, last + 1));
    }
    if (!presData || !presData.slides) throw new Error('no slides');
  } catch(_) {
    presData = { theme: 'dark-tech', slides: _parseMdSlides(raw) };
  }

  const t = PRES_THEMES[presData.theme] || PRES_THEMES['dark-tech'];
  const W = 720, H = 405; // נקודות, יחס 16:9

  const pres = SlidesApp.create(title);
  const firstSlides = pres.getSlides();

  presData.slides.forEach((sd, i) => {
    let slide;
    if (i === 0) {
      slide = firstSlides[0];
      slide.getShapes().forEach(s => s.remove());
    } else {
      slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    }
    slide.getBackground().setSolidFill(t.bg);

    switch (sd.type) {
      case 'cover':      _renderCover(slide, sd, t, W, H);      break;
      case 'section':    _renderSection(slide, sd, t, W, H);    break;
      case 'comparison': _renderComparison(slide, sd, t, W, H); break;
      case 'quote':      _renderQuote(slide, sd, t, W, H);      break;
      case 'summary':    _renderSummary(slide, sd, t, W, H);    break;
      default:           _renderContent(slide, sd, t, W, H);    break;
    }
  });

  pres.saveAndClose();

  const fileId = pres.getId();
  const resp = UrlFetchApp.fetch(
    `https://docs.google.com/presentation/d/${fileId}/export/pptx`,
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
  );
  DriveApp.getFileById(fileId).setTrashed(true);
  if (resp.getResponseCode() !== 200) throw new Error('PPTX export failed: ' + resp.getResponseCode());
  return resp.getBlob().setName(title + '.pptx');
}

function _rect(slide, x, y, w, h, color) {
  const r = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, w, h);
  r.getFill().setSolidFill(color);
  r.getBorder().setTransparent();
  return r;
}

// מוסיף טקסט עם תמיכת RTL ועיבוד bold (**טקסט**)
function _textBox(slide, text, x, y, w, h, fontSize, color, bold, italic, align) {
  const box = slide.insertTextBox('', x, y, w, h);
  const tr  = box.getText();

  // RLM (U+200F) at the start of each line forces BiDi to treat every paragraph as RTL,
  // fixing period placement and bullet side without touching slide structure.
  const rtlText = (text || '').split('\n').map(l => '‏' + l).join('\n');
  const segments = _parseBold(rtlText);
  segments.forEach(seg => {
    const before = tr.asString().length;
    const insertAt = Math.max(0, before - 1); // לפני ה-\n הסופי
    tr.insertText(insertAt, seg.text);
    const start = insertAt;
    const end   = start + seg.text.length;
    const range = tr.getRange(start, end);
    const ts = range.getTextStyle();
    ts.setFontSize(fontSize).setForegroundColor(color);
    ts.setBold(bold || seg.bold);
    if (italic) ts.setItalic(true);
  });

  // Apply alignment per-paragraph — calling on a multi-paragraph TextRange
  // returns a merged style that silently fails on paragraphs beyond the first.
  const alignment = align === 'center' ? SlidesApp.ParagraphAlignment.CENTER : SlidesApp.ParagraphAlignment.END;
  tr.getParagraphs().forEach(p => {
    p.getRange().getParagraphStyle().setParagraphAlignment(alignment);
  });

  return box;
}

// מחלק מחרוזת לפלחי { text, bold } לפי סימוני **
function _parseBold(str) {
  const parts = [], re = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) parts.push({ text: str.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = re.lastIndex;
  }
  if (last < str.length) parts.push({ text: str.slice(last), bold: false });
  return parts.length ? parts : [{ text: str, bold: false }];
}

function _renderCover(slide, d, t, W, H) {
  _rect(slide, 0, H - 8, W, 8, t.accent);   // פס תחתון
  _rect(slide, 0, 0, W, 6, t.accent);        // פס עליון דק
  _textBox(slide, d.title,    40, H * 0.22, W - 80, 130, 40, t.text,  true,  false, 'center')
    .setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  if (d.subtitle) {
    _textBox(slide, d.subtitle, 60, H * 0.62, W - 120, 60, 20, t.sub, false, true,  'center');
  }
}

function _renderSection(slide, d, t, W, H) {
  slide.getBackground().setSolidFill(t.sectionBg);
  _rect(slide, 0, 0, 10, H, t.accent);
  _textBox(slide, d.title, 40, 0, W - 50, H, 34, t.text, true, false, 'start')
    .setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
}

function _renderContent(slide, d, t, W, H) {
  _rect(slide, 0, 0, 6, H, t.accent);
  _textBox(slide, d.title, 26, 18, W - 36, 58, 27, t.accent, true, false, 'start');
  const bullets = (d.bullets || []).map(b => '• ' + b).join('\n');
  if (bullets) {
    const bx = _textBox(slide, bullets, 26, 88, W - 46, H - 103, 18, t.text, false, false, 'start');
    bx.getText().getParagraphStyle().setLineSpacing(150);
  }
}

function _renderComparison(slide, d, t, W, H) {
  _textBox(slide, d.title, 20, 12, W - 40, 52, 25, t.accent, true, false, 'start');
  const half = (W - 60) / 2;
  const left = d.left || {}, right = d.right || {};
  _textBox(slide, left.label  || '', 20,        72, half, 38, 17, t.sub, true, false, 'start');
  _textBox(slide, right.label || '', W/2 + 10,  72, half, 38, 17, t.sub, true, false, 'start');
  _rect(slide, W/2 - 1, 68, 2, H - 80, t.accent);
  const lText = (left.points  || []).map(p => '• ' + p).join('\n');
  const rText = (right.points || []).map(p => '• ' + p).join('\n');
  if (lText) _textBox(slide, lText, 20,       115, half,    H - 128, 16, t.text, false, false, 'start');
  if (rText) _textBox(slide, rText, W/2 + 10, 115, half,    H - 128, 16, t.text, false, false, 'start');
}

function _renderQuote(slide, d, t, W, H) {
  _textBox(slide, '“', 24, 10, 70, 90, 80, t.accent, true, false, 'start');
  _textBox(slide, d.text || '', 55, 85, W - 90, H - 155, 22, t.text, false, true, 'center')
    .setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  if (d.source) {
    _textBox(slide, '— ' + d.source, 55, H - 58, W - 90, 40, 16, t.sub, false, false, 'center');
  }
}

function _renderSummary(slide, d, t, W, H) {
  _rect(slide, 0, 0, W, 6, t.accent);
  _textBox(slide, d.title || 'סיכום', 26, 18, W - 36, 56, 27, t.accent, true, false, 'start');
  const bullets = (d.bullets || []).map(b => '✓  ' + b).join('\n');
  if (bullets) {
    const bx = _textBox(slide, bullets, 26, 86, W - 46, H - 100, 18, t.text, false, false, 'start');
    bx.getText().getParagraphStyle().setLineSpacing(155);
  }
}

// fallback: מפרסר markdown ישן (## כותרת + bullets)
function _parseMdSlides(md) {
  return md.split(/\n(?=## )/).map(block => {
    const lines   = block.trim().split('\n');
    const heading = lines[0].replace(/^##\s*/, '').trim();
    const bullets = lines.slice(1)
      .filter(l => /^[\s]*[-*]/.test(l))
      .map(l => l.replace(/^[\s*-]+/, '').trim())
      .filter(Boolean);
    return { type: bullets.length ? 'content' : 'section', title: heading, bullets };
  }).filter(s => s.title);
}

function convertToHtml(md) {
  // קבץ רצפי bullet רצופים ל-<ul> אחד לפני כל המרה אחרת
  const grouped = md.replace(/((?:^[*-] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n')
      .map(l => `<li>${l.replace(/^[*-] /, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>\n`;
  });
  return grouped
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // שחזר תגיות HTML שהוגנו בטעות
    .replace(/&lt;(\/?(ul|li|h[123]|strong|em|hr|p|br)[^&]*)&gt;/g, '<$1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
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
