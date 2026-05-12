import { deps } from './deps.js';
import { getDesignQueenPrompt } from '../design-queen-prompt.js';

export function initDesignQueenModal() {
  injectDesignQueenModal();
}

function injectDesignQueenModal() {
  const modal = document.createElement('div');
  modal.id = 'design-queen-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:2rem;max-width:540px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 24px 64px rgba(0,0,0,.28);font-family:Heebo,sans-serif;max-height:90vh;overflow-y:auto;">
      <h3 style="margin:0 0 .35rem;font-size:1.2rem;">צור פרוטוטייפ HTML מאפיון</h3>
      <p style="margin:0 0 1.5rem;color:#6b7a99;font-size:.88rem;line-height:1.5;">העלה כל מסמך אפיון (Word, PDF) וקבל קובץ HTML אינטראקטיבי מלא — כל המסכים, ניווט עובד, נתונים ריאליסטיים.</p>

      <label id="dq-dropzone" for="dq-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:12px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.5rem;transition:all .2s;">
        <div style="font-size:2.2rem;margin-bottom:.4rem;">🎨</div>
        <div id="dq-file-label" style="color:#6b7a99;font-size:.88rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.78rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="dq-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.dqFileSelected(this)">
      </label>

      <div style="margin-bottom:1.5rem;">
        <div style="font-weight:700;font-size:.88rem;margin-bottom:.75rem;color:#374151;">סגנון עיצוב:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="enterprise" checked style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="enterprise" style="border:2px solid #1a56db;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#fff 40%,#dbeafe 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#1e293b;margin-bottom:.2rem;">Clean Enterprise</div>
              <div style="font-size:.74rem;color:#64748b;">לבן · כחול · עסקי</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#1e3a5f;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#1a56db;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#f8fafc;border:1px solid #e2e8f0;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#059669;"></div>
              </div>
            </div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="dark" style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="dark" style="border:2px solid #475569;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#1e293b 40%,#0f172a 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#f1f5f9;margin-bottom:.2rem;">Dark Modern</div>
              <div style="font-size:.74rem;color:#94a3b8;">כהה · אינדיגו · Tech</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#0f172a;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#6366f1;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#1e293b;border:1px solid #334155;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#10b981;"></div>
              </div>
            </div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="salesforce" style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="salesforce" style="border:2px solid #475569;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#f3f2f2 40%,#d8edff 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#032d60;margin-bottom:.2rem;">Salesforce Lightning</div>
              <div style="font-size:.74rem;color:#706e6b;">נייבי · תכלת · CRM</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#032d60;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#0070d2;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#f3f2f2;border:1px solid #dddbda;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#2e844a;"></div>
              </div>
            </div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="dq-style" value="auto" style="display:none;" onchange="window.dqStyleChanged()">
            <div class="dq-style-card" data-value="auto" style="border:2px solid #475569;border-radius:10px;padding:.75rem;background:linear-gradient(135deg,#fefce8 40%,#fdf4ff 100%);transition:all .2s;" onclick="this.previousElementSibling.checked=true;window.dqStyleChanged()">
              <div style="font-weight:600;font-size:.82rem;color:#374151;margin-bottom:.2rem;">נגזר מהאפיון</div>
              <div style="font-size:.74rem;color:#6b7280;">AI בוחר לפי תחום</div>
              <div style="display:flex;gap:4px;margin-top:.5rem;">
                <div style="width:14px;height:14px;border-radius:3px;background:#7c3aed;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#0284c7;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#059669;"></div>
                <div style="width:14px;height:14px;border-radius:3px;background:#d97706;"></div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div style="margin-bottom:1.5rem;">
        <div style="font-weight:700;font-size:.88rem;margin-bottom:.5rem;color:#374151;">שפת הממשק:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="dq-lang" value="he" checked>
          <span><strong>עברית</strong> — <span style="color:#6b7a99;font-size:.82rem;">כל הכיתובים, התוויות והנתונים בעברית (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="dq-lang" value="en">
          <span><strong>English</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeDesignQueenModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.88rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateDesignQueenMockup()" style="padding:.55rem 1.35rem;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);">✨ צור פרוטוטייפ</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeDesignQueenModal(); });
  document.body.appendChild(modal);
}

window.dqFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('dq-file-label');
  lbl.innerHTML = `<strong>${deps.escHtml(file.name)}</strong><br><span style="font-size:.78rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('dq-dropzone').style.borderColor = '#7c3aed';
};

window.dqStyleChanged = function () {
  document.querySelectorAll('.dq-style-card').forEach(card => {
    const radio = document.querySelector(`input[name="dq-style"][value="${card.dataset.value}"]`);
    if (radio && radio.checked) {
      card.style.outline = '3px solid #7c3aed';
      card.style.outlineOffset = '2px';
    } else {
      card.style.outline = 'none';
    }
  });
};

window.openDesignQueenModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('design-queen-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  window.dqStyleChanged();
};

window.closeDesignQueenModal = function () {
  const modal = document.getElementById('design-queen-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('dq-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('dq-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.78rem;">.docx · .txt · .md · .pdf</span>`;
  document.getElementById('dq-dropzone').style.borderColor = '#c8d0e0';
};

window.generateDesignQueenMockup = async function () {
  const fileInput = document.getElementById('dq-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    document.getElementById('dq-dropzone').style.borderColor = '#e53e3e';
    return;
  }

  const style = document.querySelector('input[name="dq-style"]:checked')?.value || 'enterprise';
  const lang  = document.querySelector('input[name="dq-lang"]:checked')?.value || 'he';
  window.closeDesignQueenModal();
  deps.hideEmpty();

  let fileData;
  try {
    fileData = await deps.readFile(file);
  } catch (e) {
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    deps.appendMessage('error', 'ליצירת פרוטוטייפ נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
    return;
  }

  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  deps.setLoading(true);
  const progressId = deps.appendTyping();
  const results = [];
  let dqModelIdx = deps.getModelIdx();
  const docText = fileData.isInline ? '' : fileData.text;
  const inlineFile = fileData.isInline ? fileData : null;

  const chunkLabels = [
    'Design System + Navigation + מסכים 1–4',
    'מסכים 5–9',
    'מסכים 10+',
    'JavaScript + הרכבת קובץ HTML סופי',
  ];

  for (let chunk = 1; chunk <= 4; chunk++) {
    deps.updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const previousChunks = results.length > 0 ? results.join('\n\n') : null;
    const prompt = getDesignQueenPrompt(docText, chunk, lang, style, previousChunks);

    let done = false;
    while (!done) {
      try {
        results.push(await deps.callGeminiForSpec(prompt, dqModelIdx, inlineFile));
        done = true;
      } catch (err) {
        const quota = deps.isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && dqModelIdx < deps.MODEL_CHAIN.length - 1) {
          dqModelIdx++;
          deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[dqModelIdx]} (חלק ${chunk})... 🔄`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          deps.removeTyping(progressId);
          deps.setLoading(false);
          deps.appendMessage('error', `שגיאה בחלק ${chunk}: ${err.message}`);
          return;
        }
      }
    }
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  // Extract complete HTML from chunk 4 response
  let htmlOutput = results[3];
  const htmlMatch = htmlOutput.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  if (htmlMatch) {
    htmlOutput = htmlMatch[0];
  } else {
    htmlOutput = htmlOutput.replace(/^```html\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!htmlOutput.toLowerCase().startsWith('<!doctype')) {
      const cssMatch  = results[0].match(/<!-- CSS_START -->([\s\S]*?)<!-- CSS_END -->/);
      const allScreens = [results[0], results[1], results[2]]
        .map(r => { const m = r.match(/<!-- SCREENS_START -->([\s\S]*?)<!-- SCREENS_END -->/); return m ? m[1] : ''; })
        .join('\n');
      const css    = cssMatch ? cssMatch[1] : '';
      const jsClean = results[3].replace(/^```[\w]*\s*/i, '').replace(/\s*```\s*$/, '').trim();
      htmlOutput = `<!DOCTYPE html>
<html dir="rtl" lang="${lang === 'he' ? 'he' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prototype</title>
  <style>${css}</style>
</head>
<body>
${allScreens}
<script>${jsClean}</script>
</body>
</html>`;
    }
  }

  const baseName  = file.name.replace(/\.[^.]+$/, '');
  const styleSlug = { enterprise: 'enterprise', dark: 'dark', salesforce: 'sf', auto: 'auto' }[style] || style;
  const filename  = `prototype-${styleSlug}-${baseName}.html`;

  const blob = new Blob([htmlOutput], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  deps.appendMessage('assistant',
    `✅ הפרוטוטייפ נוצר והורד כ-\`${filename}\`\n\n` +
    `פתח את הקובץ בדפדפן — תמצא:\n` +
    `• כל המסכים מהאפיון עם ניווט עובד\n` +
    `• נתונים ריאליסטיים בטבלאות\n` +
    `• חיפוש וסינון בטבלאות\n` +
    `• מודאלים, dropdowns, tabs\n` +
    `• Toast notifications\n` +
    `• Responsive — עובד על מובייל\n\n` +
    `אם משהו חסר או דורש שינוי — שאל אותי כאן ואוסיף/אתקן.`
  );
};
