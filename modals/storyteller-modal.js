import { deps } from './deps.js';
import { getStorytellerPrompt } from '../storyteller-prompt.js';

export function initStorytellerModal() {
  injectBacklogModal();
}

function injectBacklogModal() {
  const modal = document.createElement('div');
  modal.id = 'backlog-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:460px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">📋 צור Backlog מקובץ</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך (מסמך דרישות, תיאור פיצ'ר) וקבל Epic, Features ו-User Stories מובנים ומלאים.</p>

      <label id="backlog-dropzone" for="backlog-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="backlog-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .csv · .json</span></div>
        <input id="backlog-file-input" type="file" accept=".docx,.txt,.md,.csv,.json" style="display:none;" onchange="window.backlogFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="backlog-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="backlog-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeBacklogModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateBacklog()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור Backlog ⚡</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeBacklogModal(); });
  document.body.appendChild(modal);
}

window.openBacklogModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('backlog-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeBacklogModal = function () {
  const modal = document.getElementById('backlog-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('backlog-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('backlog-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .csv · .json</span>`;
  const dz = document.getElementById('backlog-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.backlogFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('backlog-file-label');
  lbl.innerHTML = `<strong>${deps.escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('backlog-dropzone').style.borderColor = '#0070d2';
};

window.generateBacklog = async function () {
  const fileInput = document.getElementById('backlog-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('backlog-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const lang = document.querySelector('input[name="backlog-lang"]:checked')?.value || 'en';
  window.closeBacklogModal();
  deps.hideEmpty();

  let fileData;
  try {
    fileData = await deps.readFile(file);
  } catch (e) {
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline) {
    deps.appendMessage('error', 'ליצירת Backlog נדרש קובץ טקסט (.docx, .txt, .md). קבצי PDF ותמונות אינם נתמכים במצב זה.');
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
  let bModelIdx = deps.getModelIdx();

  for (let chunk = 1; chunk <= 3; chunk++) {
    deps.updateTyping(progressId, `מייצר חלק ${chunk} מתוך 3... (${['Epic & Features', 'User Stories & AC', 'Prioritization & DoD'][chunk - 1]})`);
    const prompt = getStorytellerPrompt(fileData.text, chunk, lang);

    let done = false;
    while (!done) {
      try {
        results.push(await deps.callGeminiForBacklog(prompt, bModelIdx));
        done = true;
      } catch (err) {
        const quota = deps.isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && bModelIdx < deps.MODEL_CHAIN.length - 1) {
          bModelIdx++;
          deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[bModelIdx]} (חלק ${chunk})... 🔄`);
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

  const header = `<!-- Backlog generated by מספר הסיפורים | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `backlog-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  deps.appendMessage('assistant',
    `✅ הבאקלוג נוצר בהצלחה והורד כ-\`${filename}\`\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · Epic Overview\n` +
    `• 01 · Features\n` +
    `• 02 · User Stories (INVEST)\n` +
    `• 03 · Acceptance Criteria (Given-When-Then)\n` +
    `• 04 · Backlog Prioritization (MoSCoW + WSJF)\n` +
    `• 05 · Definition of Done & Ready\n` +
    `• 06 · Spike Stories`
  );
};
