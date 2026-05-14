import { deps } from './deps.js';

// ── State ─────────────────────────────────────────────────────────────────
let phase = 'need'; // 'need' | 'verify' | 'prompt' | 'execute'
let userNeed = '';
let proposedPrompt = '';

// ── Init ──────────────────────────────────────────────────────────────────
export function initDynamicModal() {
  injectModal();
}

function injectModal() {
  const modal = document.createElement('div');
  modal.id = 'dynamic-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:900;align-items:center;justify-content:center;';

  const style = document.createElement('style');
  style.textContent = '@keyframes dyn-spin{to{transform:rotate(360deg)}} .dyn-spinner{animation:dyn-spin .7s linear infinite}';
  document.head.appendChild(style);

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:640px;width:calc(100% - 2rem);max-height:92vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">

      <!-- Header -->
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;display:flex;align-items:center;gap:.4rem;">🔮 סוכן דינמי</h3>
          <p style="margin:0;color:#64748b;font-size:.82rem;">הסוכן יבין את הצורך שלך ויבנה עבורך פרומט מושלם</p>
        </div>
        <button onclick="window.closeDynamicModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>

      <!-- Body -->
      <div id="dyn-body" style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:1rem;"></div>

      <!-- Footer -->
      <div id="dyn-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeDynamicModal(); });
  document.body.appendChild(modal);
}

// ── Open / Close ──────────────────────────────────────────────────────────

window.openDynamicModal = function () {
  if (deps.getIsLoading()) return;
  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }
  phase = 'need';
  userNeed = '';
  proposedPrompt = '';
  document.getElementById('dynamic-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showPhaseNeed();
};

window.closeDynamicModal = function () {
  document.getElementById('dynamic-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ── Phase 1: Capture need ─────────────────────────────────────────────────

function showPhaseNeed() {
  setBody(`
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:.85rem;font-weight:600;color:#1e293b;margin-bottom:.3rem;">🔮 מה אתה צריך?</div>
      <div style="font-size:.8rem;color:#64748b;">ספר לי בכמה מילים מה הצורך שלך — אנתח, אבין ואבנה עבורך פרומט מושלם.</div>
    </div>
    <textarea id="dyn-need-input" rows="4" placeholder="לדוגמה: רוצה להבין איך לבנות מערכת CRM פשוטה לעסק קטן"
      style="width:100%;padding:.65rem .8rem;border:1.5px solid #e2e8f0;border-radius:9px;font-family:Heebo,sans-serif;font-size:.9rem;color:#1e293b;resize:vertical;direction:rtl;box-sizing:border-box;"
      onkeydown="if(event.key==='Enter'&&event.ctrlKey){window.submitDynamicNeed();}"></textarea>
    <div style="font-size:.73rem;color:#94a3b8;">Ctrl+Enter לשליחה</div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:flex-end;">
      <button onclick="window.closeDynamicModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button onclick="window.submitDynamicNeed()" style="padding:.48rem 1.3rem;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">המשך →</button>
    </div>`);

  setTimeout(() => document.getElementById('dyn-need-input')?.focus(), 80);
}

window.submitDynamicNeed = async function () {
  const val = (document.getElementById('dyn-need-input')?.value || '').trim();
  if (!val) return;
  userNeed = val;
  showLoading('מנתח את הצורך שלך…');

  const prompt = `המשתמש ציין שהוא צריך: "${userNeed}"

כתוב 2–3 פסקאות בעברית שמבארות ומרחיבות את הצורך הזה. הצג את ההבנה שלך לגבי:
- מה בדיוק המשתמש מחפש
- מה יהיו התוצרים הצפויים
- אילו היבטים חשוב לכסות

אל תציע פתרון — רק הצג את ההבנה שלך לגבי הצורך.`;

  try {
    const elaboration = await dynCall(prompt);
    showPhaseVerify(elaboration);
  } catch (e) {
    showError(e.message);
  }
};

// ── Phase 2: Verify understanding ─────────────────────────────────────────

function showPhaseVerify(elaboration) {
  phase = 'verify';
  setBody(`
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.85rem 1rem;">
      <div style="font-size:.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem;">הצורך שלך</div>
      <div style="font-size:.88rem;color:#1e293b;">${deps.escHtml(userNeed)}</div>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:.9rem 1.1rem;">
      <div style="font-size:.78rem;font-weight:700;color:#1d4ed8;margin-bottom:.45rem;">🤖 ההבנה שלי:</div>
      <div style="font-size:.85rem;color:#1e293b;line-height:1.65;white-space:pre-wrap;">${deps.escHtml(elaboration)}</div>
    </div>
    <div style="font-size:.84rem;font-weight:600;color:#374151;">האם זה מה שאתה מחפש?</div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:flex-end;">
      <button onclick="window.rejectDynamicNeed()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">לא, נסה שוב</button>
      <button onclick="window.confirmDynamicNeed()" style="padding:.48rem 1.3rem;background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">כן, זה נכון ✓</button>
    </div>`);
}

window.rejectDynamicNeed = function () {
  showPhaseNeed();
  setTimeout(() => {
    const ta = document.getElementById('dyn-need-input');
    if (ta) { ta.value = userNeed; ta.focus(); ta.select(); }
  }, 50);
};

window.confirmDynamicNeed = async function () {
  showLoading('בונה פרומט מושלם עבורך…');

  const prompt = `המשתמש צריך: "${userNeed}"

בנה פרומט מקצועי ומפורט בעברית שיניב תוצאה מצוינת לצורך הזה.
הפרומט חייב להיות:
- מפורט עם הנחיות ברורות ומדויקות
- כולל דרישות לפורמט הפלט
- מציין את רמת הפירוט הנדרשת
- מכוון לקבלת תוצאה מעשית ושימושית

כתוב רק את הפרומט עצמו, ללא הסברים נוספים.`;

  try {
    proposedPrompt = await dynCall(prompt);
    showPhasePrompt(proposedPrompt);
  } catch (e) {
    showError(e.message);
  }
};

// ── Phase 3: Show proposed prompt ─────────────────────────────────────────

function showPhasePrompt(prompt) {
  phase = 'prompt';
  setBody(`
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:.85rem 1rem;">
      <div style="font-size:.78rem;font-weight:700;color:#92400e;margin-bottom:.3rem;">✨ הפרומט המוצע:</div>
      <div style="font-size:.75rem;color:#78350f;">תוכל לערוך לפני האישור</div>
    </div>
    <textarea id="dyn-prompt-textarea" rows="8"
      style="width:100%;padding:.65rem .8rem;border:1.5px solid #fde68a;border-radius:9px;font-family:Heebo,sans-serif;font-size:.83rem;color:#1e293b;resize:vertical;direction:rtl;box-sizing:border-box;background:#fffdf0;"
    >${deps.escHtml(prompt)}</textarea>
    <div style="font-size:.78rem;color:#64748b;">ניתן לערוך את הפרומט לפני האישור. האישור יפעיל את הסוכן עם הפרומט הזה.</div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.rejectDynamicNeed()" style="padding:.48rem .9rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.84rem;font-family:Heebo,sans-serif;color:#374151;">← חזור לצורך</button>
      <button onclick="window.approveDynamicPrompt()" style="padding:.48rem 1.3rem;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">אשר ובחר עומק →</button>
    </div>`);
}

window.approveDynamicPrompt = function () {
  proposedPrompt = (document.getElementById('dyn-prompt-textarea')?.value || '').trim() || proposedPrompt;
  showPhaseExecute();
};

// ── Phase 4: Choose depth & execute ───────────────────────────────────────

function showPhaseExecute() {
  phase = 'execute';
  setBody(`
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:.85rem 1rem;">
      <div style="font-size:.78rem;font-weight:700;color:#166534;margin-bottom:.25rem;">✅ הפרומט אושר</div>
      <div style="font-size:.8rem;color:#15803d;">כעת בחר את רמת העומק של הניתוח</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:.4rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:.8rem 1rem;">
      ${[
        { v: 'basic',  checked: false, label: 'בסיסי',  calls: '1 קריאה',  tip: 'תשובה מהירה וממוקדת לצורך המרכזי.' },
        { v: 'normal', checked: true,  label: 'רגיל',   calls: '2 קריאות', tip: 'תשובה מפורטת עם דוגמאות וניתוח. מומלץ לרוב המקרים.' },
        { v: 'high',   checked: false, label: 'גבוה',   calls: '3 קריאות', tip: 'ניתוח מעמיק עם תרשימים, טבלאות ומסקנות מפורטות.' },
      ].map(o => `
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem;padding:.15rem 0;">
          <input type="radio" name="dyn-depth" value="${o.v}" ${o.checked ? 'checked' : ''} style="accent-color:#7c3aed;">
          <span style="color:#1e293b;min-width:70px;"><strong>${o.label}</strong></span>
          <span style="color:#64748b;font-size:.76rem;">— ${o.calls}</span>
          <span title="${o.tip}" style="margin-right:auto;color:#7c3aed;font-size:.78rem;cursor:help;" tabindex="0">ⓘ</span>
        </label>`).join('')}
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.approveDynamicPrompt()" style="padding:.48rem .9rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.84rem;font-family:Heebo,sans-serif;color:#374151;">← ערוך פרומט</button>
      <button onclick="window.executeDynamic()" style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);">🔮 הפעל סוכן</button>
    </div>`);
}

window.executeDynamic = async function () {
  const depth = document.querySelector('input[name="dyn-depth"]:checked')?.value || 'normal';
  const numCalls = { basic: 1, normal: 2, high: 3 }[depth] || 2;

  window.closeDynamicModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

  const prompts = buildDynamicPrompts(proposedPrompt, numCalls);
  const results = [];
  let mIdx = deps.getModelIdx();

  try {
    for (let i = 0; i < prompts.length; i++) {
      deps.updateTyping(progressId, `מפעיל סוכן… (${i + 1}/${prompts.length})`);
      results.push(await dynCallWithFallback(prompts[i], mIdx));
    }
  } catch (err) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה: ' + err.message);
    return;
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  const depthLabels = { basic: 'בסיסי (קריאה אחת)', normal: 'רגיל (2 קריאות)', high: 'גבוה (3 קריאות)' };
  deps.appendMessage('assistant',
    `✅ הסוכן הדינמי סיים — **עומק:** ${depthLabels[depth]}\n\n---\n\n` +
    results.join('\n\n---\n\n')
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────

function buildDynamicPrompts(approvedPrompt, numCalls) {
  if (numCalls === 1) return [approvedPrompt];
  if (numCalls === 2) {
    return [
      approvedPrompt + '\n\n**הוראה:** ענה בצורה מלאה ומפורטת. פרק את התשובה לחלק ראשון — מהות, רקע ותשובה ישירה.',
      approvedPrompt + '\n\n**הוראה:** זהו חלק שני ומשלים. הוסף עומק — דוגמאות מפורטות, ניתוח, המלצות מעשיות, ותרשימי Mermaid אם רלוונטי.',
    ];
  }
  return [
    approvedPrompt + '\n\n**הוראה (חלק א):** ענה על הבקשה — מהות, רקע, תשובה ישירה.',
    approvedPrompt + '\n\n**הוראה (חלק ב):** הוסף עומק — דוגמאות, ניתוח מפורט, תרשימי Mermaid אם רלוונטי.',
    approvedPrompt + '\n\n**הוראה (חלק ג):** סיכום מקיף — המלצות מעשיות, טבלאות השוואה, מסקנות ושלבים הבאים.',
  ];
}

async function dynCall(prompt) {
  return deps.callGeminiForSpec(prompt, deps.getModelIdx());
}

async function dynCallWithFallback(prompt, startIdx) {
  let mIdx = startIdx;
  while (true) {
    try {
      return await deps.callGeminiForSpec(prompt, mIdx);
    } catch (err) {
      const quota = deps.isQuotaExceeded(err.message);
      const busy  = /503|high demand|overload|temporarily/i.test(err.message);
      if ((quota || busy) && mIdx < deps.MODEL_CHAIN.length - 1) {
        mIdx++;
        deps.setModelIdx(mIdx);
        deps.appendMessage('error', `⚠️ עובר למודל ${deps.MODEL_CHAIN[mIdx]}… 🔄`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
}

function showLoading(msg) {
  setBody(`<div style="display:flex;align-items:center;gap:.7rem;color:#64748b;font-size:.88rem;padding:.5rem 0;">
    <div class="dyn-spinner" style="width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;flex-shrink:0;"></div>
    <span>${msg || 'טוען…'}</span>
  </div>`);
  setFooter('');
}

function showError(msg) {
  setBody(`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">❌ שגיאה: ${deps.escHtml(msg)}</div>`);
  setFooter(`<div style="display:flex;justify-content:flex-end;">
    <button onclick="window.closeDynamicModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
  </div>`);
}

function setBody(html) {
  const el = document.getElementById('dyn-body');
  if (el) el.innerHTML = html;
}

function setFooter(html) {
  const el = document.getElementById('dyn-footer');
  if (el) el.innerHTML = html;
}
