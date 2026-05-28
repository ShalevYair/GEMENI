import { deps } from './deps.js';
import { AGENTS } from '../agents-config.js';

let brieferFile = null;

export function initBrieferModal() {
  injectModal();
}

function injectModal() {
  if (document.getElementById('briefer-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'briefer-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:900;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:580px;width:calc(100% - 2rem);max-height:92vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">

      <!-- Header -->
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;display:flex;align-items:center;gap:.4rem;">📋 בריפר — הפקת בריף דיגיטק</h3>
          <p style="margin:0;color:#64748b;font-size:.82rem;">מלא שאלון קלט, העלה אותו וקבל בריף מנוסח ומלא</p>
        </div>
        <button onclick="window.closeBrieferModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>

      <!-- Body -->
      <div id="brf-body" style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:1rem;"></div>

      <!-- Footer -->
      <div id="brf-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeBrieferModal(); });
  document.body.appendChild(modal);
}

// ── Open / Close ──────────────────────────────────────────────────────────

window.openBrieferModal = function () {
  if (deps.getIsLoading()) return;
  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }
  brieferFile = null;
  document.getElementById('briefer-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showPhasePick();
};

window.closeBrieferModal = function () {
  document.getElementById('briefer-modal').style.display = 'none';
  document.body.style.overflow = '';
  brieferFile = null;
};

// ── Phase 1: download questionnaire + upload filled ───────────────────────

function showPhasePick() {
  setBody(`
    <!-- Step 1: Download blank questionnaire -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:.85rem;font-weight:700;color:#166534;margin-bottom:.35rem;">שלב 1 — הורד שאלון קלט ריק</div>
      <div style="font-size:.8rem;color:#15803d;margin-bottom:.65rem;">השאלון מכיל 6 חלקים. מלא אותו בפרטי הפרויקט שלך ושמור.</div>
      <a href="שאלון_קלט_לבריף.docx" download="שאלון_קלט_לבריף.docx"
        style="display:inline-flex;align-items:center;gap:.4rem;background:linear-gradient(135deg,#166534,#15803d);color:#fff;padding:.45rem 1.1rem;border-radius:8px;text-decoration:none;font-size:.87rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(22,101,52,.3);">
        ⬇ הורד שאלון קלט לבריף
      </a>
    </div>

    <!-- Step 2: Upload filled questionnaire -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:.85rem;font-weight:700;color:#1e293b;margin-bottom:.35rem;">שלב 2 — העלה שאלון מלא</div>
      <div style="font-size:.8rem;color:#64748b;margin-bottom:.65rem;">לאחר שמילאת את השאלון, העלה אותו לכאן. הסוכן יפיק ממנו בריף מנוסח.</div>
      <label id="brf-drop" for="brf-file-input"
        style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.1rem;text-align:center;cursor:pointer;background:#fff;transition:.15s;"
        ondragover="event.preventDefault();this.style.borderColor='#0d9488';this.style.background='#f0fdf4';"
        ondragleave="this.style.borderColor='#c8d0e0';this.style.background='#fff';"
        ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='#fff';window.brfHandleDrop(event);">
        <input type="file" id="brf-file-input" accept=".docx" hidden />
        <div id="brf-drop-label" style="font-size:.88rem;color:#475569;">
          <span style="font-size:1.6rem;display:block;margin-bottom:.25rem;">📎</span>
          לחץ לבחירת קובץ DOCX או גרור לכאן
        </div>
      </label>
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeBrieferModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button id="brf-run-btn" onclick="window.runBriefer()" disabled style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(13,148,136,.35);opacity:.55;">📋 הפק בריף</button>
    </div>`);

  const fileInput = document.getElementById('brf-file-input');
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (f) await onPickFile(f);
  });
}

window.brfHandleDrop = async function (event) {
  const f = event.dataTransfer.files[0];
  if (f) await onPickFile(f);
};

async function onPickFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext !== 'docx') {
    showInlineError('יש להעלות קובץ DOCX בלבד.');
    return;
  }
  try {
    brieferFile = await deps.readFile(file);
    const label = document.getElementById('brf-drop-label');
    if (label) {
      label.innerHTML = `
        <span style="font-size:1.6rem;display:block;margin-bottom:.25rem;">✅</span>
        <strong style="color:#0f766e;">${deps.escHtml(file.name)}</strong>
        <div style="font-size:.75rem;color:#64748b;margin-top:.2rem;">לחץ לבחירת קובץ אחר</div>`;
    }
    const btn = document.getElementById('brf-run-btn');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  } catch (e) {
    showInlineError('שגיאה בקריאת הקובץ: ' + (e.message || e));
  }
}

function showInlineError(msg) {
  let host = document.getElementById('brf-inline-err');
  if (!host) {
    host = document.createElement('div');
    host.id = 'brf-inline-err';
    host.style.cssText = 'background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.6rem .85rem;color:#b91c1c;font-size:.83rem;';
    document.getElementById('brf-body').appendChild(host);
  }
  host.textContent = '❌ ' + msg;
}

// ── Phase 2: generate brief ───────────────────────────────────────────────

window.runBriefer = async function () {
  if (!brieferFile || !brieferFile.text) return;

  const prompt = buildBrieferPrompt(brieferFile.text, brieferFile.name);

  window.closeBrieferModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const typingId = deps.appendTyping();
  deps.updateTyping(typingId, 'מנתח את השאלון ומפיק בריף…');

  let mIdx = deps.getModelIdx();
  let brief = '';
  try {
    while (true) {
      try {
        brief = await deps.callGeminiForSpec(prompt, mIdx);
        break;
      } catch (err) {
        const msg = err.message || '';
        const quota = deps.isQuotaExceeded(msg);
        const busy  = /503|high demand|overload|temporarily|429/i.test(msg);
        if ((quota || busy) && mIdx < deps.MODEL_CHAIN.length - 1) {
          mIdx++;
          deps.setModelIdx(mIdx);
          deps.updateTyping(typingId, `עובר למודל ${deps.MODEL_CHAIN[mIdx]} ומנסה שוב…`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    deps.removeTyping(typingId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה בהפקת הבריף: ' + (err.message || err));
    return;
  }

  deps.removeTyping(typingId);
  deps.setLoading(false);

  const ts = new Date().toISOString().slice(0, 10);
  const filename = `בריף_${ts}.md`;
  const blob = new Blob([brief], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);

  deps.appendMessage('assistant',
    `✅ הבריף הופק והורד כ-\`${filename}\`\n\n` +
    `**שאלון שנותח:** ${deps.escHtml(brieferFile.name)}\n\n` +
    `עברו על הבריף, מלאו את הפריטים המסומנים \`[להשלמה]\`, ואז העבירו לאישור מנהל הרכש לפני פרסום במערכת התיחורים.`
  );
};

// ── Prompt construction ───────────────────────────────────────────────────

function buildBrieferPrompt(questionnaireText, filename) {
  const systemPrompt = AGENTS['briefer'].systemPrompt;
  return `${systemPrompt}

---

להלן תוכן השאלון שמילא המשתמש (קובץ: "${filename}"):

${questionnaireText}

---

בצע את כל שלבי העבודה שלך לפי הסדר (קליטה ← השלמת חסרים ← בדיקות תקינות ← כתיבה ← סיכום) והפק בריף מלא לפי שלושת הפרקים. כתוב בעברית מקצועית.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function setBody(html) {
  const el = document.getElementById('brf-body');
  if (el) el.innerHTML = html;
}

function setFooter(html) {
  const el = document.getElementById('brf-footer');
  if (el) el.innerHTML = html;
}
