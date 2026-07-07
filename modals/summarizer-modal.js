import { deps } from './deps.js';

// ── State ─────────────────────────────────────────────────────────────────
const SUM_CHUNK   = 50000;                          // chars per chunk for large text inputs
const LEVEL_CALLS = { basic: 1, normal: 3, high: 6 };

let phase = 'pick';     // 'pick' | 'running' | 'done' | 'error'
let pickedFile = null;  // { name, mimeType, isInline, text?, base64? }
let chunks = [];        // text chunks of the picked file (single entry for small files, [] for inline)
let lastRows = [];      // last produced rows (for re-download)

// ── Init ──────────────────────────────────────────────────────────────────
export function initSummarizerModal() {
  injectModal();
}

function injectModal() {
  if (document.getElementById('summarizer-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'summarizer-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:900;align-items:center;justify-content:center;';

  const style = document.createElement('style');
  style.textContent = '@keyframes sum-spin{to{transform:rotate(360deg)}} .sum-spinner{animation:sum-spin .7s linear infinite}';
  document.head.appendChild(style);

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:640px;width:calc(100% - 2rem);max-height:92vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">

      <!-- Header -->
      <div style="padding:1.1rem 1.5rem .85rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h3 style="margin:0 0 .15rem;font-size:1.1rem;color:#1e293b;display:flex;align-items:center;gap:.4rem;">📝 המסכם</h3>
          <p style="margin:0;color:#64748b;font-size:.82rem;">העלה מסמך וקבל קובץ Excel עם סיכום היררכי</p>
        </div>
        <button onclick="window.closeSummarizerModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;padding:.2rem .45rem;border-radius:6px;line-height:1;">✕</button>
      </div>

      <!-- Body -->
      <div id="sum-body" style="flex:1;overflow-y:auto;padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:1rem;"></div>

      <!-- Footer -->
      <div id="sum-footer" style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;flex-shrink:0;"></div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeSummarizerModal(); });
  document.body.appendChild(modal);
}

// ── Open / Close ──────────────────────────────────────────────────────────

window.openSummarizerModal = function () {
  if (deps.getIsLoading()) return;
  if (!deps.getApiKey()) {
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }
  phase = 'pick';
  pickedFile = null;
  chunks = [];
  document.getElementById('summarizer-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  showPhasePick();
};

window.closeSummarizerModal = function () {
  document.getElementById('summarizer-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// ── Phase 1: pick file + level ────────────────────────────────────────────

function showPhasePick() {
  setBody(`
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:.85rem;font-weight:600;color:#1e293b;margin-bottom:.3rem;">📄 בחר מסמך לסיכום</div>
      <div style="font-size:.8rem;color:#64748b;">סוגים נתמכים: TXT, MD, PDF, DOCX, XLS, XLSX. יופק קובץ Excel עם 4 עמודות: נושא ראשי, נושא משני, תת נושא, תיאור.</div>
    </div>

    <label id="sum-drop" style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.1rem;text-align:center;cursor:pointer;background:#fff;transition:.15s;">
      <input type="file" id="sum-file-input" accept=".txt,.md,.pdf,.docx,.xls,.xlsx" hidden />
      <div id="sum-drop-label" style="font-size:.88rem;color:#475569;">
        <span style="font-size:1.6rem;display:block;margin-bottom:.25rem;">📎</span>
        לחץ לבחירת קובץ או גרור לכאן
      </div>
    </label>

    <div style="display:flex;flex-direction:column;gap:.4rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:.8rem 1rem;">
      <div style="font-size:.8rem;font-weight:700;color:#374151;margin-bottom:.15rem;">רמת עיבוד</div>
      ${[
        { v: 'basic',  checked: true,  label: 'בסיסי',  calls: '1 קריאה',  tip: 'סיכום מהיר. ברירת מחדל.' },
        { v: 'normal', checked: false, label: 'רגיל',   calls: '3 קריאות', tip: 'סיכום מורחב, כיסוי טוב יותר.' },
        { v: 'high',   checked: false, label: 'גבוה',   calls: '6 קריאות', tip: 'סיכום מעמיק עם מקסימום פירוט.' },
      ].map(o => `
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem;padding:.15rem 0;">
          <input type="radio" name="sum-level" value="${o.v}" ${o.checked ? 'checked' : ''} style="accent-color:#0891b2;">
          <span style="color:#1e293b;min-width:70px;"><strong>${o.label}</strong></span>
          <span style="color:#64748b;font-size:.76rem;">— ${o.calls}</span>
          <span title="${o.tip}" style="margin-right:auto;color:#0891b2;font-size:.78rem;cursor:help;" tabindex="0">ⓘ</span>
        </label>`).join('')}
    </div>`);

  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeSummarizerModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
      <button id="sum-run-btn" onclick="window.runSummarizer()" disabled style="padding:.5rem 1.4rem;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(8,145,178,.35);opacity:.55;">📝 הפק Excel</button>
    </div>`);

  // wire file input
  const fileInput = document.getElementById('sum-file-input');
  const drop = document.getElementById('sum-drop');
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (f) await onPickFile(f);
  });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = '#f0f9ff'; });
  drop.addEventListener('dragleave', () => { drop.style.background = '#fff'; });
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    drop.style.background = '#fff';
    const f = e.dataTransfer.files[0];
    if (f) await onPickFile(f);
  });
}

async function onPickFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['txt','md','pdf','docx','xls','xlsx'].includes(ext)) {
    showInlineError(`סוג קובץ לא נתמך: .${ext}. נסה TXT, MD, PDF, DOCX, XLS או XLSX.`);
    return;
  }
  try {
    pickedFile = await readSummarizerFile(file);
    chunks = (!pickedFile.isInline && pickedFile.text) ? splitToChunks(pickedFile.text) : [];
    const label = document.getElementById('sum-drop-label');
    if (label) {
      label.innerHTML = `
        <span style="font-size:1.6rem;display:block;margin-bottom:.25rem;">✅</span>
        <strong style="color:#0f766e;">${deps.escHtml(file.name)}</strong>
        <div style="font-size:.75rem;color:#64748b;margin-top:.2rem;">לחץ לבחירת קובץ אחר</div>`;
    }
    updateChunkNote();
    const btn = document.getElementById('sum-run-btn');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  } catch (e) {
    showInlineError('שגיאה בקריאת הקובץ: ' + (e.message || e));
  }
}

// Split large text into roughly equal chunks, breaking on line boundaries
// so CSV rows are never cut mid-line.
function splitToChunks(text) {
  if (text.length <= SUM_CHUNK) return [text];
  const numChunks = Math.ceil(text.length / SUM_CHUNK);
  const target = Math.ceil(text.length / numChunks);
  const out = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + target, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf('\n', end);
      if (nl > pos) end = nl + 1;
    }
    out.push(text.slice(pos, end));
    pos = end;
  }
  return out;
}

function updateChunkNote() {
  const drop = document.getElementById('sum-drop');
  if (!drop) return;
  let note = document.getElementById('sum-chunk-note');
  if (!note) {
    note = document.createElement('div');
    note.id = 'sum-chunk-note';
    note.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:.55rem .85rem;color:#1e40af;font-size:.8rem;';
    drop.insertAdjacentElement('afterend', note);
  }
  const numChunks = Math.max(1, chunks.length || 1);
  if (numChunks > 1) {
    const est = l => Math.max(LEVEL_CALLS[l], numChunks);
    note.textContent = `📦 הקובץ גדול ויפוצל ל-${numChunks} חלקים · קריאות בפועל: בסיסי ${est('basic')} · רגיל ${est('normal')} · גבוה ${est('high')}`;
    note.style.display = '';
  } else {
    note.style.display = 'none';
  }
}

async function readSummarizerFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['xls', 'xlsx'].includes(ext)) {
    if (typeof XLSX === 'undefined') throw new Error('ספריית XLSX לא נטענה');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const lines = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv.trim()) lines.push(`--- גיליון: ${sheetName} ---\n${csv}`);
    }
    const text = lines.join('\n\n');
    return { name: file.name, mimeType: 'text/plain', isInline: false, text };
  }
  return deps.readFile(file);
}

function showInlineError(msg) {
  let host = document.getElementById('sum-inline-err');
  if (!host) {
    host = document.createElement('div');
    host.id = 'sum-inline-err';
    host.style.cssText = 'background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.6rem .85rem;color:#b91c1c;font-size:.83rem;';
    document.getElementById('sum-body').appendChild(host);
  }
  host.textContent = '❌ ' + msg;
}

// ── Phase 2: run ──────────────────────────────────────────────────────────

window.runSummarizer = async function () {
  if (!pickedFile) return;
  const level = document.querySelector('input[name="sum-level"]:checked')?.value || 'basic';
  const levelCalls = LEVEL_CALLS[level] || 1;
  const numChunks = Math.max(1, chunks.length || 1);
  const plan = buildCallPlan(numChunks, levelCalls);
  const totalCalls = plan.length;

  phase = 'running';
  showLoading(`מעבד את הקובץ — קריאה 1 מתוך ${totalCalls}…`);

  let mIdx = deps.getModelIdx();
  const allRows = [];
  const seen = new Set();
  let contributingCalls = 0;
  try {
    for (let i = 0; i < totalCalls; i++) {
      const item = plan[i];
      updateLoading(numChunks > 1
        ? `מעבד — קריאה ${i + 1} מתוך ${totalCalls} (חלק ${item.chunkIdx + 1}/${numChunks})…`
        : `מעבד את הקובץ — קריאה ${i + 1} מתוך ${totalCalls}…`);
      const prompt = buildPrompt(item, numChunks, totalCalls, allRows);
      const text = await callWithFallback(prompt, pickedFile.isInline ? pickedFile : null, mIdx);
      mIdx = deps.getModelIdx();

      const rows = parseRows(text);
      if (rows.length === 0) {
        appendRunWarning(`⚠️ קריאה ${i + 1} לא החזירה רשומות תקינות — ממשיכים.`);
      } else {
        contributingCalls++;
      }
      for (const r of rows) {
        const k = (r.main || '') + '||' + (r.sub || '') + '||' + (r.subsub || '');
        if (!seen.has(k)) { seen.add(k); allRows.push(r); }
      }
    }
  } catch (err) {
    phase = 'error';
    showError(err.message || String(err));
    return;
  }

  if (allRows.length === 0) {
    phase = 'error';
    showError('לא נמצאו רשומות בפלט המודל. נסה שוב או החלף לעומק גבוה יותר.');
    return;
  }

  lastRows = allRows;
  phase = 'done';
  downloadXlsx(allRows);
  showDone(allRows.length, level, { totalCalls, contributingCalls, numChunks });
};

// One 'first' (skeleton) pass per chunk; remaining calls of the chosen level
// are distributed round-robin over the chunks as expansion/depth passes.
function buildCallPlan(numChunks, levelCalls) {
  const total = Math.max(levelCalls, numChunks);
  const plan = [];
  for (let c = 0; c < numChunks; c++) plan.push({ chunkIdx: c, passType: 'first' });
  const passCount = new Array(numChunks).fill(1);
  for (let i = 0; i < total - numChunks; i++) {
    const c = i % numChunks;
    passCount[c]++;
    plan.push({ chunkIdx: c, passType: passCount[c] === 2 ? 'expand' : 'deep' });
  }
  return plan;
}

function buildPrompt(item, numChunks, totalCalls, existingRows) {
  let fileBlock;
  if (pickedFile.isInline) {
    fileBlock = `הקובץ המצורף ("${pickedFile.name}") מועבר כקובץ inline למודל. נתח אותו במלואו.`;
  } else if (numChunks > 1) {
    fileBlock = `תוכן הקובץ "${pickedFile.name}" — חלק ${item.chunkIdx + 1} מתוך ${numChunks}:\n\n${chunks[item.chunkIdx]}\n\n--- סוף החלק ---`;
  } else {
    fileBlock = `תוכן הקובץ "${pickedFile.name}":\n\n${pickedFile.text || ''}\n\n--- סוף הקובץ ---`;
  }

  const baseInstruction = `נתח את התוכן הבא והפק סיכום היררכי בעברית בפורמט JSON בלבד.

${fileBlock}

הפלט הנדרש: מערך JSON של אובייקטים, ללא טקסט נלווה לפני או אחרי, ללא בלוקי קוד.
כל אובייקט: { "main": "נושא ראשי", "sub": "נושא משני", "subsub": "תת נושא", "desc": "תיאור 1–2 משפטים" }
שמור על עקביות: אם נושא ראשי כבר הופיע ברשומות קודמות — השתמש בדיוק באותו שם.`;

  if (totalCalls === 1) {
    return baseInstruction + `

זוהי קריאה אחת ויחידה — הפק מערך מלא, מקיף, בסדר גודל של 125–250 רשומות.
ענה אך ורק במערך JSON.`;
  }

  const sampleBlock = existingRows.length
    ? `\nרשומות שכבר נאספו בקריאות קודמות (שמור על עקביות שמות ואל תשכפל אותן):\n${sampleExistingForPrompt(existingRows)}\n`
    : '';

  if (item.passType === 'first') {
    return baseInstruction + `
${sampleBlock}
מקד את הניתוח בתוכן שסופק לעיל: הפק את הנושאים הראשיים והמשניים עם תתי-הנושאים המרכזיים שלהם, כ-60–120 רשומות.
ענה אך ורק במערך JSON.`;
  }

  if (item.passType === 'expand') {
    return baseInstruction + `
${sampleBlock}
זהו סבב הרחבה על תוכן זה. הוסף תתי-נושאים נוספים ונושאים משניים שטרם כוסו, כ-50–100 רשומות חדשות.
ענה אך ורק במערך JSON.`;
  }

  // 'deep'
  return baseInstruction + `
${sampleBlock}
זהו סבב עומק על תוכן זה. הוסף פרטים, דקויות, מקרי קצה ונקודות שוליות שעדיין לא כוסו, כ-50–100 רשומות חדשות.
ענה אך ורק במערך JSON.`;
}

function sampleExistingForPrompt(rows) {
  if (!rows.length) return '(אין עדיין)';
  const step = Math.max(1, Math.floor(rows.length / 20));
  const picks = [];
  for (let i = 0; i < rows.length && picks.length < 20; i += step) picks.push(rows[i]);
  return picks.map(r => `- ${r.main} / ${r.sub} / ${r.subsub}`).join('\n');
}

function parseRows(text) {
  if (!text) return [];
  let s = text.trim();
  // strip code fences if present
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // try direct parse
  try {
    const v = JSON.parse(s);
    return normalizeArray(v);
  } catch { /* fall through */ }
  // try to find first '[' and last ']'
  const first = s.indexOf('[');
  const last = s.lastIndexOf(']');
  if (first !== -1 && last !== -1 && last > first) {
    const slice = s.slice(first, last + 1);
    try {
      const v = JSON.parse(slice);
      return normalizeArray(v);
    } catch { /* ignore */ }
  }
  // salvage: extract every complete top-level {...} object from truncated
  // or concatenated output, so a broken array still contributes its rows
  return salvageRows(s);
}

function salvageRows(s) {
  const objs = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        try { objs.push(JSON.parse(s.slice(start, i + 1))); } catch { /* skip malformed */ }
        start = -1;
      }
    }
  }
  return normalizeArray(objs);
}

function normalizeArray(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map(o => ({
      main:   String(o?.main   ?? o?.['נושא ראשי']  ?? '').trim(),
      sub:    String(o?.sub    ?? o?.['נושא משני']  ?? '').trim(),
      subsub: String(o?.subsub ?? o?.['תת נושא']    ?? '').trim(),
      desc:   String(o?.desc   ?? o?.['תיאור']       ?? '').trim(),
    }))
    .filter(r => r.main || r.sub || r.subsub || r.desc);
}

async function callWithFallback(prompt, inlineFile, startIdx) {
  let mIdx = startIdx;
  while (true) {
    try {
      return await deps.callGeminiForSpec(prompt, mIdx, inlineFile, {
        genCfg: { responseMimeType: 'application/json' },
        maxContinuations: 0,
      });
    } catch (err) {
      const msg = err.message || '';
      const quota = deps.isQuotaExceeded(msg);
      const busy  = /503|high demand|overload|temporarily|429/i.test(msg);
      if ((quota || busy) && mIdx < deps.MODEL_CHAIN.length - 1) {
        mIdx++;
        deps.setModelIdx(mIdx);
        updateLoading(`עובר למודל ${deps.MODEL_CHAIN[mIdx]} ומנסה שוב…`);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        throw err;
      }
    }
  }
}

// ── Excel output ──────────────────────────────────────────────────────────

function downloadXlsx(rows) {
  if (typeof XLSX === 'undefined') {
    showError('ספריית XLSX לא נטענה — לא ניתן להפיק קובץ Excel.');
    return;
  }
  const aoa = [
    ['נושא ראשי', 'נושא משני', 'תת נושא', 'תיאור'],
    ...rows.map(r => [r.main, r.sub, r.subsub, r.desc]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, ws, 'סיכום');
  const base = (pickedFile?.name || 'summary').replace(/\.[^.]+$/, '');
  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  XLSX.writeFile(wb, `${base}_summary_${ts}.xlsx`);
}

// ── Phase 3: done / error ─────────────────────────────────────────────────

function showDone(count, level, stats = {}) {
  const labels = { basic: 'בסיסי', normal: 'רגיל', high: 'גבוה' };
  const { totalCalls = 0, contributingCalls = 0, numChunks = 1 } = stats;
  const partsLine = numChunks > 1
    ? `<div style="font-size:.83rem;color:#15803d;">הקובץ עובד ב-<strong>${numChunks}</strong> חלקים</div>`
    : '';
  const callsLine = totalCalls
    ? `<div style="font-size:.83rem;color:#15803d;">קריאות שתרמו רשומות: <strong>${contributingCalls} מתוך ${totalCalls}</strong></div>`
    : '';
  const failWarn = (totalCalls && contributingCalls < totalCalls)
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:.6rem .85rem;color:#92400e;font-size:.8rem;">⚠️ ${totalCalls - contributingCalls} קריאות לא החזירו רשומות תקינות — ייתכן שחלק מהתוכן חסר בסיכום.</div>`
    : '';
  setBody(`
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem 1.1rem;">
      <div style="font-size:.95rem;font-weight:700;color:#166534;margin-bottom:.3rem;">✅ הסיכום הופק והורד</div>
      <div style="font-size:.83rem;color:#15803d;">קובץ: <strong>${deps.escHtml(pickedFile?.name || '')}</strong></div>
      <div style="font-size:.83rem;color:#15803d;">רמת עיבוד: <strong>${labels[level] || level}</strong></div>
      ${partsLine}
      ${callsLine}
      <div style="font-size:.83rem;color:#15803d;">סה״כ רשומות: <strong>${count}</strong></div>
    </div>
    ${failWarn}
    <div style="font-size:.82rem;color:#475569;">אם הדפדפן חסם את ההורדה — לחץ על הכפתור למטה כדי לנסות שוב.</div>`);
  setFooter(`
    <div style="display:flex;gap:.7rem;justify-content:space-between;align-items:center;">
      <button onclick="window.closeSummarizerModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
      <button onclick="window.redownloadSummarizer()" style="padding:.5rem 1.2rem;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;">⬇ הורד שוב</button>
    </div>`);
}

window.redownloadSummarizer = function () {
  if (lastRows.length) downloadXlsx(lastRows);
};

function showError(msg) {
  setBody(`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:.9rem;color:#b91c1c;font-size:.85rem;">❌ שגיאה: ${deps.escHtml(msg)}</div>`);
  setFooter(`<div style="display:flex;gap:.7rem;justify-content:space-between;">
    <button onclick="window.closeSummarizerModal()" style="padding:.48rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;color:#374151;">סגור</button>
    <button onclick="window.openSummarizerModal()" style="padding:.48rem 1rem;background:#0891b2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.87rem;font-family:Heebo,sans-serif;">נסה שוב</button>
  </div>`);
}

function showLoading(msg) {
  setBody(`<div id="sum-loading" style="display:flex;align-items:center;gap:.7rem;color:#64748b;font-size:.88rem;padding:.5rem 0;">
    <div class="sum-spinner" style="width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#0891b2;border-radius:50%;flex-shrink:0;"></div>
    <span id="sum-loading-text">${msg || 'טוען…'}</span>
  </div>
  <div id="sum-run-log" style="display:flex;flex-direction:column;gap:.35rem;"></div>`);
  setFooter('');
}

function appendRunWarning(msg) {
  const log = document.getElementById('sum-run-log');
  if (!log) return;
  const el = document.createElement('div');
  el.style.cssText = 'background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.45rem .7rem;color:#92400e;font-size:.78rem;';
  el.textContent = msg;
  log.appendChild(el);
}

function updateLoading(msg) {
  const t = document.getElementById('sum-loading-text');
  if (t) t.textContent = msg;
}

function setBody(html) {
  const el = document.getElementById('sum-body');
  if (el) el.innerHTML = html;
}

function setFooter(html) {
  const el = document.getElementById('sum-footer');
  if (el) el.innerHTML = html;
}
