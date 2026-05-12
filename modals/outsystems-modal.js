import { deps } from './deps.js';
import { getOutSystemsPrompt } from '../outsystems-prompt.js';

export function initOutSystemsModal() {
  injectOutSystemsModal();
}

function injectOutSystemsModal() {
  const modal = document.createElement('div');
  modal.id = 'outsystems-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:500px;width:calc(100% - 2rem);direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;">
      <h3 style="margin:0 0 .5rem;font-size:1.15rem;">צור מסמך מפרט טכני מפורט ב-OutSystems מקובץ אפיון עסקי</h3>
      <p style="margin:0 0 1.25rem;color:#6b7a99;font-size:.9rem;">העלה מסמך אפיון וקבל מסמך טכני מלא: ארכיטקטורת מודולים, מודל תחום, Service Actions, אינטגרציות, תהליכים, אבטחה ופריסה.</p>

      <label id="outsystems-dropzone" for="outsystems-file-input" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:border-color .2s;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div id="outsystems-file-label" style="color:#6b7a99;font-size:.9rem;">לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span></div>
        <input id="outsystems-file-input" type="file" accept=".docx,.txt,.md,.pdf" style="display:none;" onchange="window.outsystemsFileSelected(this)">
      </label>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">גרסת OutSystems:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="outsystems-version" value="o11" checked>
          <span><strong>O11</strong> — <span style="color:#6b7a99;font-size:.85rem;">4-Layer Canvas, Service Center, LifeTime</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="outsystems-version" value="odc">
          <span><strong>ODC</strong> — <span style="color:#6b7a99;font-size:.85rem;">OutSystems Developer Cloud, Apps & Libraries</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="outsystems-version" value="both">
          <span><strong>שתיהן</strong> — <span style="color:#6b7a99;font-size:.85rem;">השוואה O11 ו-ODC בנפרד</span></span>
        </label>
      </div>

      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="outsystems-lang" value="en" checked>
          <span><strong>English</strong> — <span style="color:#6b7a99;font-size:.85rem;">מפורט ועמוק יותר (מומלץ)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="outsystems-lang" value="he">
          <span><strong>עברית</strong></span>
        </label>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeOutSystemsModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateOutSystemsTSD()" style="padding:.55rem 1.25rem;background:#0070d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;font-family:Heebo,sans-serif;">צור מסמך טכני</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeOutSystemsModal(); });
  document.body.appendChild(modal);
}

window.openOutSystemsModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('outsystems-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeOutSystemsModal = function () {
  const modal = document.getElementById('outsystems-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const fi = document.getElementById('outsystems-file-input');
  if (fi) fi.value = '';
  const lbl = document.getElementById('outsystems-file-label');
  if (lbl) lbl.innerHTML = `לחץ לבחירת קובץ או גרור לכאן<br><span style="font-size:.8rem;">.docx · .txt · .md · .pdf</span>`;
  const dz = document.getElementById('outsystems-dropzone');
  if (dz) dz.style.borderColor = '#c8d0e0';
};

window.outsystemsFileSelected = function (input) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('outsystems-file-label');
  lbl.innerHTML = `<strong>${deps.escHtml(file.name)}</strong><br><span style="font-size:.8rem;color:#6b7a99;">${(file.size / 1024).toFixed(1)} KB</span>`;
  document.getElementById('outsystems-dropzone').style.borderColor = '#0070d2';
};

window.generateOutSystemsTSD = async function () {
  const fileInput = document.getElementById('outsystems-file-input');
  const file = fileInput?.files[0];
  if (!file) {
    const dz = document.getElementById('outsystems-dropzone');
    if (dz) dz.style.borderColor = '#e53e3e';
    return;
  }

  const version = document.querySelector('input[name="outsystems-version"]:checked')?.value || 'o11';
  const lang    = document.querySelector('input[name="outsystems-lang"]:checked')?.value || 'en';
  window.closeOutSystemsModal();
  deps.hideEmpty();

  let fileData;
  try {
    fileData = await deps.readFile(file);
  } catch (e) {
    deps.appendMessage('error', 'שגיאה בקריאת הקובץ: ' + e.message);
    return;
  }

  if (fileData.isInline && fileData.mimeType !== 'application/pdf') {
    deps.appendMessage('error', 'ליצירת מסמך טכני נדרש קובץ טקסט (.docx, .txt, .md, .pdf). קבצי תמונה אינם נתמכים.');
    return;
  }

  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  const versionLabel = version === 'o11' ? 'O11' : version === 'odc' ? 'ODC' : 'O11+ODC';
  deps.setLoading(true);
  const progressId = deps.appendTyping();
  const results = [];
  let osModelIdx = deps.getModelIdx();

  const chunkLabels = ['Application Context & Module Architecture', 'Domain Model & Process Logic', 'Service Actions & Integration Catalog', 'Processes, Security & Deployment'];

  for (let chunk = 1; chunk <= 4; chunk++) {
    deps.updateTyping(progressId, `מייצר חלק ${chunk} מתוך 4... (${chunkLabels[chunk - 1]})`);
    const prompt = getOutSystemsPrompt(fileData.isInline ? '' : fileData.text, chunk, lang, version);

    let done = false;
    while (!done) {
      try {
        results.push(await deps.callGeminiForSpec(prompt, osModelIdx, fileData.isInline ? fileData : null));
        done = true;
      } catch (err) {
        const quota = deps.isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && osModelIdx < deps.MODEL_CHAIN.length - 1) {
          osModelIdx++;
          deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[osModelIdx]} (חלק ${chunk})... 🔄`);
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

  const header = `<!-- OutSystems TSD generated by OutSystems Expert | ${versionLabel} | ${new Date().toISOString()} | Source: ${file.name} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const filename  = `outsystems-tsd-${versionLabel}-${baseName}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  const versionNote = version === 'both' ? ' (O11 ו-ODC בנפרד)' : ` (${versionLabel})`;
  deps.appendMessage('assistant',
    `✅ המסמך הטכני נוצר בהצלחה והורד כ-\`${filename}\`${versionNote}\n\n` +
    `הקובץ מכיל:\n` +
    `• 00 · Application Context (גרסה, סביבות, personas, NFRs)\n` +
    `• 01 · Module Architecture (4-Layer Canvas / ODC App structure + dependency map)\n` +
    `• 02 · Domain Model (Entities, attributes, indexes, relationships, Site Properties)\n` +
    `• 03 · Screen Logic (screens, Server Actions catalog, business flows)\n` +
    `• 04 · Service Actions (contracts, inputs/outputs, exceptions, versioning)\n` +
    `• 05 · Integration Catalog (timeout, retry, circuit breaker, fallback לכל אינטגרציה)\n` +
    `• 06 · Processes & Timers (BPT / async patterns, email notifications)\n` +
    `• 07 · Security & Deployment (roles, permissions matrix, pipeline, health checklist)`
  );
};
