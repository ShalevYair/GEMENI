import { deps } from './deps.js';
import { getPlatformArchitectPrompt } from '../platform-architect-prompt.js';

export function initPlatformModal() {
  injectPlatformArchitectModal();
}

function injectPlatformArchitectModal() {
  const modal = document.createElement('div');
  modal.id = 'platform-architect-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:480px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">צור אפיון פלטפורמה מקובץ אפיון עסקי</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך אפיון וקבל מסמך ארכיטקטורת פלטפורמה מלא: בנה-או-קנה עם עלות כוללת, תשתית ואבטחה, אינטגרציות, עצירת תקלות, צינור פריסה רציפה, רישומי החלטות וניהול סיכונים.</p>

      <label id="platform-architect-dropzone" for="platform-architect-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="platform-architect-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="platform-architect-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.platformArchitectFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="platform-architect-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="platform-architect-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closePlatformArchitectModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generatePlatformArchitectSpec()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור אפיון פלטפורמה</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closePlatformArchitectModal(); });
  document.body.appendChild(modal);
}

window.openPlatformArchitectModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('platform-architect-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closePlatformArchitectModal = function () {
  const modal = document.getElementById('platform-architect-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('platform-architect-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('platform-architect-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span>`;
  const dz = document.getElementById('platform-architect-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.platformArchitectFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('platform-architect-file-label');
  lbl.innerHTML = `<strong>${deps.escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('platform-architect-dropzone').style.borderColor = '#0070d2';
};

window.generatePlatformArchitectSpec = async function () {
  const fileInput = document.getElementById('platform-architect-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('platform-architect-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const lang = document.querySelector('input[name="platform-architect-lang"]:checked')?.value || 'en';
  window.closePlatformArchitectModal();
  deps.hideEmpty();

  let fileData;
  try {
    fileData = await deps.readFile(file);
  } catch (e) {
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    deps.appendMessage('error', 'ליצירת אפיון פלטפורמה נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
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
  let pModelIdx = deps.getModelIdx();

  const chunkLabels = ['Platform Decision & Infrastructure Overview', 'Environment Security & Integration Architecture', 'CI/CD Pipeline & Environment Runbook', 'ADR Log & NFR + Risk Register'];

  for (let chunk = 1; chunk <= 4; chunk++) {
    deps.updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const prompt = getPlatformArchitectPrompt(fileData.isInline ? '' : fileData.text, chunk, lang);

    let done = false;
    while (!done) {
      try {
        results.push(await deps.callGeminiForSpec(prompt, pModelIdx, fileData.isInline ? fileData : null));
        done = true;
      } catch (err) {
        const quota = deps.isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && pModelIdx < deps.MODEL_CHAIN.length - 1) {
          pModelIdx++;
          deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[pModelIdx]} (חלק ${chunk})... 🔄`);
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

  const header = `<!-- Platform Architecture Spec generated by ארכיטקט הפלטפורמות | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `platform-spec-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  deps.appendMessage('assistant',
    `✅ אפיון הפלטפורמה נוצר בהצלחה והורד כ-\`${filename}\`\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · Platform Decision (Make-or-Buy + TCO + lock-in assessment)\n` +
    `• 01 · Infrastructure Overview (topology, environments, IaC strategy)\n` +
    `• 02 · Security Architecture (IAM, network, secrets, compliance)\n` +
    `• 03 · Integration Architecture (API Gateway, integrations + circuit breakers)\n` +
    `• 04 · CI/CD Pipeline (stages, rollback, artifact management)\n` +
    `• 05 · Operations Runbook (observability, alerts, DR, cost management)\n` +
    `• 06 · ADR Log (Architecture Decision Records for every major platform decision)\n` +
    `• 07 · NFR & Risk Register (availability, security, cost, risks + mitigations)`
  );
};
