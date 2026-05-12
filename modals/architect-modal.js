import { deps } from './deps.js';
import { getArchitectPrompt } from '../architect-prompt.js';

export function initArchitectModal() {
  injectArchitectModal();
}

function injectArchitectModal() {
  const modal = document.createElement('div');
  modal.id = 'architect-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:480px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">צור אפיון טכני מקובץ אפיון עסקי</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך אפיון וקבל מסמך ארכיטקטורה מלא: הקשר מערכת, סגנון ארכיטקטורה, רכיבים, מודל נתונים, חוזי ממשק, אינטגרציות, רישומי החלטות וניהול סיכונים.</p>

      <label id="architect-dropzone" for="architect-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="architect-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="architect-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.architectFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="architect-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="architect-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeArchitectModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateArchitectSpec()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור אפיון טכני</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeArchitectModal(); });
  document.body.appendChild(modal);
}

window.openArchitectModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('architect-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeArchitectModal = function () {
  const modal = document.getElementById('architect-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('architect-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('architect-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span>`;
  const dz = document.getElementById('architect-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.architectFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('architect-file-label');
  lbl.innerHTML = `<strong>${deps.escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('architect-dropzone').style.borderColor = '#0070d2';
};

window.generateArchitectSpec = async function () {
  const fileInput = document.getElementById('architect-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('architect-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const lang = document.querySelector('input[name="architect-lang"]:checked')?.value || 'en';
  window.closeArchitectModal();
  deps.hideEmpty();

  let fileData;
  try {
    fileData = await deps.readFile(file);
  } catch (e) {
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    deps.appendMessage('error', 'ליצירת אפיון טכני נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
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
  let aModelIdx = deps.getModelIdx();

  const chunkLabels = ['System Context & Architecture Style', 'Components & Data Architecture', 'API Contracts & Integration Map', 'ADR Log & NFR + Risks'];

  for (let chunk = 1; chunk <= 4; chunk++) {
    deps.updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const prompt = getArchitectPrompt(fileData.isInline ? '' : fileData.text, chunk, lang);

    let done = false;
    while (!done) {
      try {
        results.push(await deps.callGeminiForSpec(prompt, aModelIdx, fileData.isInline ? fileData : null));
        done = true;
      } catch (err) {
        const quota = deps.isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && aModelIdx < deps.MODEL_CHAIN.length - 1) {
          aModelIdx++;
          deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[aModelIdx]} (חלק ${chunk})... 🔄`);
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

  const header = `<!-- Architecture Spec generated by ארכיטקט התוכנה | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `architecture-spec-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  deps.appendMessage('assistant',
    `✅ האפיון הטכני נוצר בהצלחה והורד כ-\`${filename}\`\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · System Context (C4 Context Diagram, actors, external systems)\n` +
    `• 01 · Architecture Style (chosen pattern + 3 rejected alternatives + trade-offs)\n` +
    `• 02 · Component Design (HLD, interfaces, failure modes)\n` +
    `• 03 · Data Architecture (entity ownership, DB decisions, consistency model)\n` +
    `• 04 · API Contracts (endpoints, request/response, error codes, async events)\n` +
    `• 05 · Integration Map (external integrations, circuit breakers, error handling)\n` +
    `• 06 · ADR Log (Architecture Decision Records for every major decision)\n` +
    `• 07 · NFR & Risk Register (performance, security, scalability, risks + mitigations)`
  );
};
