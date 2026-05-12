import { deps } from './deps.js';
import {
  getRequirementsClarificationPrompt,
  getRequirementsChunkPrompt,
  REQUIREMENTS_CHECKLIST,
  INTERVIEW_QUESTIONS,
} from '../requirements-prompt.js';

const RQ_STORAGE_KEY = 'requirements-checklist-v1';
let requirementsFiles = [];

// ── localStorage helpers ──────────────────────────────────────────────────
function rqGetSavedChecked() {
  try {
    const saved = localStorage.getItem(RQ_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return REQUIREMENTS_CHECKLIST.filter(i => i.defaultOn).map(i => i.id);
}

function rqSaveChecked(ids) {
  try { localStorage.setItem(RQ_STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

function rqGetCheckedIds() {
  return REQUIREMENTS_CHECKLIST
    .filter(item => {
      const cb = document.getElementById(`rq-check-${item.id}`);
      return cb && cb.checked;
    })
    .map(item => item.id);
}

// ── Modal injection ───────────────────────────────────────────────────────
export function initRequirementsModal() {
  injectRequirementsModal();
}

function injectRequirementsModal() {
  const savedChecked = rqGetSavedChecked();

  const checklistHtml = REQUIREMENTS_CHECKLIST.map(item => {
    const isChecked = savedChecked.includes(item.id);
    return `
      <label style="display:flex;align-items:center;gap:.45rem;cursor:pointer;padding:.25rem .35rem;border-radius:6px;transition:background .15s;font-size:.82rem;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background=''">
        <input type="checkbox" id="rq-check-${deps.escHtml(item.id)}" ${isChecked ? 'checked' : ''} style="accent-color:#059669;width:14px;height:14px;flex-shrink:0;">
        <span style="color:${item.defaultOn ? '#1e293b' : '#475569'}">${deps.escHtml(item.label)}</span>
      </label>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'requirements-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:560px;width:100%;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;margin:auto;">
      <h3 style="margin:0 0 .35rem;font-size:1.15rem;display:flex;align-items:center;gap:.5rem;">📋 אוסף הדרישות — יצירת מסמך</h3>
      <p style="margin:0 0 1.35rem;color:#6b7a99;font-size:.88rem;">העלה פרוטוקולי ישיבה, אימיילים, מסמכים גולמיים — וקבל מפרט דרישות תוכנה מובנה או שאלות הבהרה.</p>

      <!-- Multi-file upload -->
      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">חומרי מקור (עד 10 קבצים):</div>
        <label id="rq-dropzone" for="rq-file-input"
          style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.25rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
          ondragover="event.preventDefault();this.style.borderColor='#059669';this.style.background='#f0fdf4';"
          ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
          ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.rqHandleDrop(event);">
          <div style="font-size:1.6rem;margin-bottom:.3rem;">📂</div>
          <div style="color:#6b7a99;font-size:.88rem;">לחץ לבחירת קבצים או גרור לכאן<br><span style="font-size:.78rem;">.docx · .txt · .md · .pdf (מקסימום 10 קבצים)</span></div>
          <input id="rq-file-input" type="file" accept=".docx,.txt,.md,.pdf" multiple style="display:none;" onchange="window.rqFilesSelected(this.files)">
        </label>
        <div id="rq-files-list" style="margin-top:.6rem;display:flex;flex-direction:column;gap:.3rem;"></div>
      </div>

      <!-- Mode -->
      <div style="margin-bottom:1.1rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">מה תרצה לקבל?</div>
        <label style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;cursor:pointer;">
          <input type="radio" name="rq-mode" value="srs" checked style="margin-top:.2rem;" onchange="window.rqModeChanged()">
          <span><strong>מסמך מפרט דרישות תוכנה</strong> <span style="color:#6b7a99;font-size:.82rem;">— מסמך מובנה עם ניתוח פערים (3 חלקים)</span></span>
        </label>
        <label style="display:flex;align-items:flex-start;gap:.5rem;cursor:pointer;">
          <input type="radio" name="rq-mode" value="questions" style="margin-top:.2rem;" onchange="window.rqModeChanged()">
          <span><strong>שאלות הבהרה</strong> <span style="color:#6b7a99;font-size:.82rem;">— שאלות ממוקדות לישיבת ההמשך</span></span>
        </label>
      </div>

      <!-- Language -->
      <div id="rq-lang-section" style="margin-bottom:1.1rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">שפת הפלט:</div>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer;">
          <input type="radio" name="rq-lang" value="he" checked>
          <span><strong>עברית</strong> <span style="color:#6b7a99;font-size:.82rem;">(ברירת מחדל — מומלץ לפרויקטים ממשלתיים)</span></span>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="radio" name="rq-lang" value="en">
          <span><strong>English</strong> <span style="color:#6b7a99;font-size:.82rem;">— חוסך טוקנים, פלט עמוק יותר</span></span>
        </label>
      </div>

      <!-- Checklist -->
      <div id="rq-checklist-section" style="margin-bottom:1.35rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
          <div style="font-weight:600;font-size:.9rem;">מה לכלול במסמך:</div>
          <div style="display:flex;gap:.4rem;">
            <button onclick="window.rqSelectAll()" style="font-size:.75rem;padding:.2rem .55rem;border:1px solid #c8d0e0;border-radius:5px;background:#fff;cursor:pointer;font-family:Heebo,sans-serif;">בחר הכל</button>
            <button onclick="window.rqSelectDefaults()" style="font-size:.75rem;padding:.2rem .55rem;border:1px solid #c8d0e0;border-radius:5px;background:#fff;cursor:pointer;font-family:Heebo,sans-serif;">ברירת מחדל</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.1rem;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem;">
          ${checklistHtml}
        </div>
      </div>

      <!-- Buttons -->
      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeRequirementsModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button onclick="window.generateRequirements()" style="padding:.55rem 1.35rem;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(5,150,105,.35);">📋 צור מסמך</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeRequirementsModal(); });
  document.body.appendChild(modal);
}

// ── Window functions ──────────────────────────────────────────────────────

window.openRequirementsModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('requirements-modal');
  if (!modal) return;
  requirementsFiles = [];
  rqRenderFilesList();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeRequirementsModal = function () {
  const modal = document.getElementById('requirements-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  requirementsFiles = [];
  const fi = document.getElementById('rq-file-input');
  if (fi) fi.value = '';
};

window.rqModeChanged = function () {
  const mode = document.querySelector('input[name="rq-mode"]:checked')?.value;
  const langSection  = document.getElementById('rq-lang-section');
  const checkSection = document.getElementById('rq-checklist-section');
  if (langSection)  langSection.style.display  = mode === 'srs' ? '' : 'none';
  if (checkSection) checkSection.style.display = mode === 'srs' ? '' : 'none';
};

window.rqSelectAll = function () {
  REQUIREMENTS_CHECKLIST.forEach(item => {
    const cb = document.getElementById(`rq-check-${item.id}`);
    if (cb) cb.checked = true;
  });
};

window.rqSelectDefaults = function () {
  REQUIREMENTS_CHECKLIST.forEach(item => {
    const cb = document.getElementById(`rq-check-${item.id}`);
    if (cb) cb.checked = item.defaultOn;
  });
};

window.rqHandleDrop = function (event) {
  rqAddFiles(Array.from(event.dataTransfer.files || []));
};

window.rqFilesSelected = function (fileList) {
  rqAddFiles(Array.from(fileList || []));
  const fi = document.getElementById('rq-file-input');
  if (fi) fi.value = '';
};

function rqAddFiles(files) {
  const allowed = ['.docx', '.txt', '.md', '.pdf'];
  for (const f of files) {
    if (requirementsFiles.length >= 10) break;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) continue;
    if (f.size > 10 * 1024 * 1024) continue;
    if (requirementsFiles.find(x => x.name === f.name)) continue;
    requirementsFiles.push(f);
  }
  rqRenderFilesList();
}

function rqRenderFilesList() {
  const list = document.getElementById('rq-files-list');
  if (!list) return;
  list.innerHTML = requirementsFiles.map((f, idx) => `
    <div style="display:flex;align-items:center;gap:.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:.4rem .65rem;font-size:.82rem;">
      <span style="color:#059669;">📄</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${deps.escHtml(f.name)}</span>
      <span style="color:#94a3b8;white-space:nowrap;">${(f.size / 1024).toFixed(0)} KB</span>
      <button onclick="window.rqRemoveFile(${idx})" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.9rem;padding:0 .15rem;" title="הסר">✕</button>
    </div>`).join('');
}

window.rqRemoveFile = function (idx) {
  requirementsFiles.splice(idx, 1);
  rqRenderFilesList();
};

window.generateRequirements = async function () {
  if (requirementsFiles.length === 0) {
    const dz = document.getElementById('rq-dropzone');
    if (dz) { dz.style.borderColor = '#e53e3e'; setTimeout(() => { dz.style.borderColor = '#c8d0e0'; }, 2000); }
    return;
  }
  if (!deps.getApiKey()) {
    window.closeRequirementsModal();
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  const mode = document.querySelector('input[name="rq-mode"]:checked')?.value || 'srs';
  const lang = document.querySelector('input[name="rq-lang"]:checked')?.value || 'he';
  const checkedIds = mode === 'srs' ? rqGetCheckedIds() : [];
  rqSaveChecked(checkedIds);

  window.closeRequirementsModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

  let combinedText = '';
  try {
    for (const file of requirementsFiles) {
      deps.updateTyping(progressId, `קורא קובץ: ${file.name}…`);
      const fileData = await deps.readFile(file);
      const content = fileData.isInline ? `[קובץ PDF — תוכן נשלח כקובץ בינארי ל-AI]` : (fileData.text || '');
      combinedText += `\n\n${'═'.repeat(60)}\nמסמך: ${file.name}\n${'═'.repeat(60)}\n\n${content}`;
    }
  } catch (e) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה בקריאת קבצים: ' + e.message);
    return;
  }

  const fileNames = requirementsFiles.map(f => f.name).join(', ');
  const results = [];
  let rqModelIdx = deps.getModelIdx();

  if (mode === 'questions') {
    deps.updateTyping(progressId, 'מנתח חומרים ומייצר שאלות הבהרה…');
    const prompt = getRequirementsClarificationPrompt(combinedText, lang);
    let done = false;
    while (!done) {
      try {
        results.push(await deps.callGeminiForSpec(prompt, rqModelIdx));
        done = true;
      } catch (err) {
        const quota = deps.isQuotaExceeded(err.message);
        const busy  = /503|high demand|overload|temporarily/i.test(err.message);
        if ((quota || busy) && rqModelIdx < deps.MODEL_CHAIN.length - 1) {
          rqModelIdx++;
          deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[rqModelIdx]}… 🔄`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          deps.removeTyping(progressId);
          deps.setLoading(false);
          deps.appendMessage('error', 'שגיאה: ' + err.message);
          return;
        }
      }
    }
  } else {
    const labels = lang === 'he'
      ? ['מבוא, בעלי עניין והנחות', 'דרישות פונקציונליות וניתוח פערים', 'סיכונים, דרישות נוספות וגלוסרי']
      : ['Overview, Stakeholders & Assumptions', 'Functional Requirements & Gap Analysis', 'Risks, Additional Requirements & Glossary'];

    for (let chunk = 1; chunk <= 3; chunk++) {
      const prompt = getRequirementsChunkPrompt(combinedText, chunk, lang, checkedIds);
      if (!prompt) continue;
      deps.updateTyping(progressId, `מייצר חלק ${chunk} מתוך 3… (${labels[chunk - 1]})`);
      let done = false;
      while (!done) {
        try {
          results.push(await deps.callGeminiForSpec(prompt, rqModelIdx));
          done = true;
        } catch (err) {
          const quota = deps.isQuotaExceeded(err.message);
          const busy  = /503|high demand|overload|temporarily/i.test(err.message);
          if ((quota || busy) && rqModelIdx < deps.MODEL_CHAIN.length - 1) {
            rqModelIdx++;
            deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[rqModelIdx]} (חלק ${chunk})… 🔄`);
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
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  if (results.length === 0) {
    deps.appendMessage('error', 'לא נבחרו סעיפים לייצור. אנא סמן לפחות סעיף אחד.');
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const isQ = mode === 'questions';
  const header = isQ
    ? `<!-- שאלות הבהרה — אוסף הדרישות | ${timestamp} | מקורות: ${fileNames} -->\n\n# שאלות הבהרה לאיסוף דרישות\n\n`
    : `<!-- מפרט דרישות תוכנה — אוסף הדרישות | ${lang.toUpperCase()} | ${timestamp} | מקורות: ${fileNames} -->\n\n`;
  const combined = header + results.join('\n\n---\n\n');
  const filename = isQ
    ? `requirements-questions-${timestamp}.md`
    : `srs-${lang}-${timestamp}.md`;

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);

  deps.appendMessage('assistant', isQ
    ? `✅ שאלות ההבהרה הורדו כ-\`${filename}\`\n\n**מקורות שנותחו (${requirementsFiles.length}):** ${fileNames}\n\nהשאלות מאורגנות לפי קטגוריות עם עדיפות. לאחר קבלת תשובות — העלה שוב לייצור מסמך מפרט.`
    : `✅ מסמך המפרט הורד כ-\`${filename}\`\n\n**שפה:** ${lang === 'he' ? 'עברית' : 'English'} · **מקורות (${requirementsFiles.length}):** ${fileNames}\n\n**חלקים שנוצרו:** ${results.length} מתוך 3\n\nלאחר אישור — ניתן להעביר למלך האפיונים לייצור מסמך אפיון מפורט.`
  );
};

// ── Download interview questions ──────────────────────────────────────────
window.downloadInterviewQuestions = function () {
  const timestamp = new Date().toISOString().slice(0, 10);

  let htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; direction: rtl; font-size: 12pt; color: #1e293b; margin: 2cm; }
  h1 { font-size: 18pt; color: #059669; border-bottom: 2px solid #059669; padding-bottom: 8px; }
  h2 { font-size: 13pt; color: #0f172a; background: #f0fdf4; padding: 6px 10px; border-right: 4px solid #059669; margin-top: 24px; }
  p.intro { color: #475569; font-size: 11pt; margin-bottom: 20px; }
  ol { margin: 8px 0 16px 0; padding-right: 20px; }
  li { margin-bottom: 8px; line-height: 1.6; }
  .note { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 8px 12px; font-size: 10pt; color: #92400e; margin-top: 24px; }
  .footer { margin-top: 32px; font-size: 9pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>
<h1>📋 שאלות ראיון ראשוניות לאיסוף דרישות</h1>
<p class="intro">מסמך זה מכיל שאלות גנריות לפגישת איסוף דרישות עם בעלי עניין. יש להתאים לפרויקט הספציפי.<br>
תאריך: ${timestamp}</p>`;

  INTERVIEW_QUESTIONS.sections.forEach(section => {
    htmlContent += `<h2>${deps.escHtml(section.title)}</h2><ol>`;
    section.questions.forEach(q => { htmlContent += `<li>${deps.escHtml(q)}</li>`; });
    htmlContent += `</ol>`;
  });

  htmlContent += `
<div class="note">
  💡 <strong>טיפ:</strong> שלח מסמך זה לבעלי העניין לפני הישיבה כדי שיגיעו מוכנים.
  לאחר הישיבה — העלה את הפרוטוקול לסוכן "אוסף הדרישות" לקבלת מסמך מפרט מובנה.
</div>
<div class="footer">נוצר על ידי אוסף הדרישות — אגם הסוכנים</div>
</body></html>`;

  try {
    const blob = new Blob(['﻿' + htmlContent], { type: 'application/vnd.ms-word;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `interview-questions-${timestamp}.doc`; a.click();
    URL.revokeObjectURL(url);
    deps.appendMessage('assistant',
      `✅ שאלות הראיון הורדו כ-\`interview-questions-${timestamp}.doc\`\n\n` +
      `המסמך מכיל ${INTERVIEW_QUESTIONS.sections.reduce((n, s) => n + s.questions.length, 0)} שאלות ב-${INTERVIEW_QUESTIONS.sections.length} קטגוריות.\n\n` +
      `**המלצה:** שלח את המסמך לבעלי העניין לפני הפגישה.`
    );
  } catch {
    let md = `# שאלות ראיון ראשוניות לאיסוף דרישות\n\n> תאריך: ${timestamp}\n\n`;
    INTERVIEW_QUESTIONS.sections.forEach(section => {
      md += `## ${section.title}\n\n`;
      section.questions.forEach((q, i) => { md += `${i + 1}. ${q}\n`; });
      md += '\n';
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `interview-questions-${timestamp}.md`; a.click();
    URL.revokeObjectURL(url);
    deps.appendMessage('assistant', `✅ שאלות הראיון הורדו כ-\`interview-questions-${timestamp}.md\``);
  }
};
