import { deps } from './deps.js';
import {
  CHAPTERS,
  ALL_CHECKLIST_ITEMS,
  buildChunkPrompt,
  buildClarificationPrompt,
  getChunkLabel,
} from '../spec-king/index.js';

const SK_STORAGE_KEY = 'spec-king-v2-checklist';
let skFiles = [];

// ── localStorage helpers ──────────────────────────────────────────────────
function skGetSavedChecked() {
  try {
    const saved = localStorage.getItem(SK_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return ALL_CHECKLIST_ITEMS.filter(i => i.defaultOn).map(i => i.id);
}

function skSaveChecked(ids) {
  try { localStorage.setItem(SK_STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

function skGetCheckedIds() {
  return ALL_CHECKLIST_ITEMS
    .filter(item => {
      const cb = document.getElementById(`sk2-check-${item.id}`);
      return cb && cb.checked;
    })
    .map(item => item.id);
}

// ── Modal injection ───────────────────────────────────────────────────────
export function initSpecKingModal() {
  injectSpecKingModal();
}

function buildChecklistHtml(savedChecked) {
  return CHAPTERS.map(ch => {
    const itemsHtml = ch.items.map(item => {
      const isChecked = savedChecked.includes(item.id);
      return `
        <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;padding:.2rem .3rem;border-radius:5px;font-size:.8rem;transition:background .15s;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background=''">
          <input type="checkbox" id="sk2-check-${deps.escHtml(item.id)}" ${isChecked ? 'checked' : ''} style="accent-color:#7c3aed;width:13px;height:13px;flex-shrink:0;">
          <span style="color:${item.defaultOn ? '#1e293b' : '#64748b'}">${deps.escHtml(item.label)}</span>
        </label>`;
    }).join('');

    return `
      <div style="margin-bottom:.75rem;">
        <div style="font-weight:700;font-size:.78rem;color:#7c3aed;margin-bottom:.25rem;padding:.15rem .3rem;background:#faf5ff;border-radius:4px;">${deps.escHtml(ch.label)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.05rem;padding-right:.25rem;">
          ${itemsHtml}
        </div>
      </div>`;
  }).join('');
}

function injectSpecKingModal() {
  const savedChecked = skGetSavedChecked();

  const modal = document.createElement('div');
  modal.id = 'spec-king-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:600px;width:100%;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;margin:auto;">
      <h3 style="margin:0 0 .35rem;font-size:1.2rem;display:flex;align-items:center;gap:.5rem;">👑 מלך האפיונים — יצירת מסמך</h3>
      <p style="margin:0 0 1.35rem;color:#6b7a99;font-size:.88rem;">העלה עד 10 קבצי דרישות, אפיון או פרוטוקולים — וקבל מסמך אפיון מלא בעברית.</p>

      <!-- ── Multi-file upload ── -->
      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">קבצי מקור (עד 10 קבצים):</div>
        <label id="sk2-dropzone" for="sk2-file-input"
          style="display:block;border:2px dashed #c8d0e0;border-radius:10px;padding:1.25rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
          ondragover="event.preventDefault();this.style.borderColor='#7c3aed';this.style.background='#faf5ff';"
          ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
          ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.sk2HandleDrop(event);">
          <div style="font-size:1.6rem;margin-bottom:.3rem;">📂</div>
          <div style="color:#6b7a99;font-size:.88rem;">לחץ לבחירת קבצים או גרור לכאן<br><span style="font-size:.78rem;">.docx · .txt · .md · .pdf (מקסימום 10 קבצים, 10MB כל אחד)</span></div>
          <input id="sk2-file-input" type="file" accept=".docx,.txt,.md,.pdf" multiple style="display:none;" onchange="window.sk2FilesSelected(this.files)">
        </label>
        <div id="sk2-files-list" style="margin-top:.6rem;display:flex;flex-direction:column;gap:.3rem;"></div>
      </div>

      <!-- ── Flavor ── -->
      <div style="margin-bottom:1.1rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">טעם האפיון:</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <label style="cursor:pointer;flex:1;min-width:120px;">
            <input type="radio" name="sk2-flavor" value="general" checked style="display:none;" onchange="window.sk2FlavorChanged()">
            <div class="sk2-flavor-card" data-flavor="general"
              style="border:2px solid #7c3aed;border-radius:9px;padding:.6rem .9rem;text-align:center;background:linear-gradient(135deg,#faf5ff,#ede9fe);transition:all .2s;cursor:pointer;"
              onclick="this.previousElementSibling.checked=true;window.sk2FlavorChanged()">
              <div style="font-size:1.2rem;">📋</div>
              <div style="font-weight:700;font-size:.82rem;color:#5b21b6;margin-top:.2rem;">כללי</div>
            </div>
          </label>
          <label style="cursor:pointer;flex:1;min-width:120px;">
            <input type="radio" name="sk2-flavor" value="salesforce" style="display:none;" onchange="window.sk2FlavorChanged()">
            <div class="sk2-flavor-card" data-flavor="salesforce"
              style="border:2px solid #e2e8f0;border-radius:9px;padding:.6rem .9rem;text-align:center;background:#fff;transition:all .2s;cursor:pointer;"
              onclick="this.previousElementSibling.checked=true;window.sk2FlavorChanged()">
              <div style="font-size:1.2rem;">☁️</div>
              <div style="font-weight:700;font-size:.82rem;color:#032d60;margin-top:.2rem;">Salesforce</div>
            </div>
          </label>
          <label style="cursor:pointer;flex:1;min-width:120px;">
            <input type="radio" name="sk2-flavor" value="outsystems" style="display:none;" onchange="window.sk2FlavorChanged()">
            <div class="sk2-flavor-card" data-flavor="outsystems"
              style="border:2px solid #e2e8f0;border-radius:9px;padding:.6rem .9rem;text-align:center;background:#fff;transition:all .2s;cursor:pointer;"
              onclick="this.previousElementSibling.checked=true;window.sk2FlavorChanged()">
              <div style="font-size:1.2rem;">🔴</div>
              <div style="font-weight:700;font-size:.82rem;color:#cc1e00;margin-top:.2rem;">OutSystems</div>
            </div>
          </label>
        </div>

        <!-- OutSystems version sub-selection -->
        <div id="sk2-os-version" style="display:none;margin-top:.65rem;padding:.65rem .85rem;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;">
          <div style="font-size:.82rem;font-weight:600;color:#991b1b;margin-bottom:.4rem;">גרסת OutSystems:</div>
          <label style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem;cursor:pointer;font-size:.85rem;">
            <input type="radio" name="sk2-os-ver" value="o11" checked>
            <span><strong>O11</strong> — <span style="color:#6b7a99;">4-Layer Canvas</span></span>
          </label>
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.85rem;">
            <input type="radio" name="sk2-os-ver" value="odc">
            <span><strong>ODC</strong> — <span style="color:#6b7a99;">OutSystems Developer Cloud</span></span>
          </label>
        </div>
      </div>

      <!-- ── Mode ── -->
      <div style="margin-bottom:1.1rem;">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem;">מה תרצה לקבל?</div>
        <label style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;cursor:pointer;">
          <input type="radio" name="sk2-mode" value="spec" checked style="margin-top:.2rem;" onchange="window.sk2ModeChanged()">
          <span><strong>אפיון מלא</strong> <span style="color:#6b7a99;font-size:.82rem;">— מסמך אפיון מובנה לפי הפרקים שבחרת (3 קריאות API)</span></span>
        </label>
        <label style="display:flex;align-items:flex-start;gap:.5rem;cursor:pointer;">
          <input type="radio" name="sk2-mode" value="questions" style="margin-top:.2rem;" onchange="window.sk2ModeChanged()">
          <span><strong>שאלות הבהרה</strong> <span style="color:#6b7a99;font-size:.82rem;">— רשימת שאלות ממוקדות לפני האפיון (קריאה אחת)</span></span>
        </label>
      </div>

      <!-- ── Checklist (spec mode only) ── -->
      <div id="sk2-checklist-section" style="margin-bottom:1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
          <div style="font-weight:600;font-size:.9rem;">פרקים לכלול באפיון:</div>
          <div style="display:flex;gap:.4rem;">
            <button onclick="window.sk2SelectAll()" style="font-size:.75rem;padding:.2rem .55rem;border:1px solid #c8d0e0;border-radius:5px;background:#fff;cursor:pointer;font-family:Heebo,sans-serif;">בחר הכל</button>
            <button onclick="window.sk2SelectDefaults()" style="font-size:.75rem;padding:.2rem .55rem;border:1px solid #c8d0e0;border-radius:5px;background:#fff;cursor:pointer;font-family:Heebo,sans-serif;">ברירת מחדל</button>
          </div>
        </div>
        <div id="sk2-checklist-body" style="border:1px solid #e2e8f0;border-radius:8px;padding:.65rem .5rem;">
          ${buildChecklistHtml(savedChecked)}
        </div>
      </div>

      <!-- ── Buttons ── -->
      <div style="display:flex;gap:.75rem;justify-content:flex-end;">
        <button onclick="window.closeSpecKingModal()" style="padding:.55rem 1.1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;font-family:Heebo,sans-serif;">ביטול</button>
        <button id="sk2-generate-btn" onclick="window.generateSpecKing()" style="padding:.55rem 1.35rem;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(124,58,237,.35);">👑 צור מסמך</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeSpecKingModal(); });
  document.body.appendChild(modal);
}

// ── Window functions ──────────────────────────────────────────────────────

window.openSpecKingModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('spec-king-modal');
  if (!modal) return;
  skFiles = [];
  sk2RenderFilesList();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  window.sk2FlavorChanged();
};

window.closeSpecKingModal = function () {
  const modal = document.getElementById('spec-king-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  skFiles = [];
  const fi = document.getElementById('sk2-file-input');
  if (fi) fi.value = '';
};

window.sk2FlavorChanged = function () {
  const flavor = document.querySelector('input[name="sk2-flavor"]:checked')?.value || 'general';
  // Update card borders
  document.querySelectorAll('.sk2-flavor-card').forEach(card => {
    const isSelected = card.dataset.flavor === flavor;
    card.style.borderColor = isSelected ? '#7c3aed' : '#e2e8f0';
    card.style.background  = isSelected
      ? (flavor === 'salesforce' ? 'linear-gradient(135deg,#f0f8ff,#d8edff)'
        : flavor === 'outsystems' ? 'linear-gradient(135deg,#fff5f5,#fee2e2)'
        : 'linear-gradient(135deg,#faf5ff,#ede9fe)')
      : '#fff';
  });
  // Show/hide OutSystems version picker
  const osVer = document.getElementById('sk2-os-version');
  if (osVer) osVer.style.display = flavor === 'outsystems' ? '' : 'none';
};

window.sk2ModeChanged = function () {
  const mode = document.querySelector('input[name="sk2-mode"]:checked')?.value;
  const sec  = document.getElementById('sk2-checklist-section');
  if (sec) sec.style.display = mode === 'spec' ? '' : 'none';
};

window.sk2SelectAll = function () {
  ALL_CHECKLIST_ITEMS.forEach(item => {
    const cb = document.getElementById(`sk2-check-${item.id}`);
    if (cb) cb.checked = true;
  });
};

window.sk2SelectDefaults = function () {
  ALL_CHECKLIST_ITEMS.forEach(item => {
    const cb = document.getElementById(`sk2-check-${item.id}`);
    if (cb) cb.checked = item.defaultOn;
  });
};

window.sk2HandleDrop = function (event) {
  sk2AddFiles(Array.from(event.dataTransfer.files || []));
};

window.sk2FilesSelected = function (fileList) {
  sk2AddFiles(Array.from(fileList || []));
  const fi = document.getElementById('sk2-file-input');
  if (fi) fi.value = '';
};

function sk2AddFiles(files) {
  const allowed = ['.docx', '.txt', '.md', '.pdf'];
  for (const f of files) {
    if (skFiles.length >= 10) break;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) continue;
    if (f.size > 10 * 1024 * 1024) continue;
    if (skFiles.find(x => x.name === f.name)) continue;
    skFiles.push(f);
  }
  sk2RenderFilesList();
}

function sk2RenderFilesList() {
  const list = document.getElementById('sk2-files-list');
  if (!list) return;
  if (skFiles.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = skFiles.map((f, idx) => `
    <div style="display:flex;align-items:center;gap:.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:.4rem .65rem;font-size:.82rem;">
      <span style="color:#7c3aed;">📄</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${deps.escHtml(f.name)}</span>
      <span style="color:#94a3b8;white-space:nowrap;">${(f.size / 1024).toFixed(0)} KB</span>
      <button onclick="window.sk2RemoveFile(${idx})" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.9rem;padding:0 .15rem;line-height:1;" title="הסר">✕</button>
    </div>`).join('');
}

window.sk2RemoveFile = function (idx) {
  skFiles.splice(idx, 1);
  sk2RenderFilesList();
};

// ── Generate ──────────────────────────────────────────────────────────────

window.generateSpecKing = async function () {
  if (skFiles.length === 0) {
    const dz = document.getElementById('sk2-dropzone');
    if (dz) { dz.style.borderColor = '#e53e3e'; setTimeout(() => { dz.style.borderColor = '#c8d0e0'; }, 2000); }
    return;
  }
  if (!deps.getApiKey()) {
    window.closeSpecKingModal();
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  const mode     = document.querySelector('input[name="sk2-mode"]:checked')?.value || 'spec';
  const flavor   = document.querySelector('input[name="sk2-flavor"]:checked')?.value || 'general';
  const osVer    = document.querySelector('input[name="sk2-os-ver"]:checked')?.value || 'o11';
  const checkedIds = mode === 'spec' ? skGetCheckedIds() : [];
  skSaveChecked(checkedIds);

  const filesToProcess = [...skFiles];
  const fileNames = filesToProcess.map(f => f.name).join(', ');

  window.closeSpecKingModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

  // Read all source files into combined text
  let combinedText = '';
  try {
    for (const file of filesToProcess) {
      deps.updateTyping(progressId, `קורא קובץ: ${file.name}…`);
      const fileData = await deps.readFile(file);
      const content = fileData.isInline
        ? `[קובץ ${file.name} הועבר כקובץ בינארי — תוכן מעובד על ידי AI]`
        : (fileData.text || '');
      combinedText += `\n\n${'═'.repeat(60)}\nמסמך: ${file.name}\n${'═'.repeat(60)}\n\n${content}`;
    }
  } catch (e) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה בקריאת קבצים: ' + e.message);
    return;
  }

  const results = [];
  let skModelIdx = deps.getModelIdx();

  try {
    if (mode === 'questions') {
      deps.updateTyping(progressId, 'מנתח חומרים ומייצר שאלות הבהרה…');
      const prompt = buildClarificationPrompt(combinedText, flavor, osVer);
      results.push(await callWithFallback(prompt, skModelIdx));
    } else {
      for (let chunkNum = 1; chunkNum <= 3; chunkNum++) {
        const label = getChunkLabel(chunkNum);
        deps.updateTyping(progressId, `מייצר חלק ${chunkNum} מתוך 3… (${label})`);
        const prompt = buildChunkPrompt(combinedText, chunkNum, checkedIds, flavor, osVer);
        if (!prompt) continue;
        results.push(await callWithFallback(prompt, skModelIdx));
      }
    }
  } catch (err) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה: ' + err.message);
    return;
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  if (results.length === 0) {
    deps.appendMessage('error', 'לא נוצר תוכן. ודא שבחרת סעיפים בצ\'קליסט.');
    return;
  }

  // Build output files
  const timestamp   = new Date().toISOString().slice(0, 10);
  const isQuestions = mode === 'questions';
  const combined    = (isQuestions ? '# שאלות הבהרה\n\n' : '') + results.join('\n\n---\n\n');
  const baseName    = `spec-king-${isQuestions ? 'questions' : 'spec'}-${flavor}-${timestamp}`;

  let finalMarkdown = combined;
  const wb = XLSX.utils.book_new();
  let tableCount = 0;

  const excelRegex = /<excel-table name="(.*?)">([\s\S]*?)<\/excel-table>/g;
  let match;
  while ((match = excelRegex.exec(combined)) !== null) {
    const tableName = match[1];
    const jsonData  = match[2].trim();
    try {
      const data = JSON.parse(jsonData);
      if (Array.isArray(data) && data.length > 0) {
        tableCount++;
        const ws = XLSX.utils.json_to_sheet(data);
        const sheetName = tableName.replace(/[\\*?:\[\]\/]/g, '').substring(0, 31) || `Sheet ${tableCount}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const placeholder = `\n> 📊 **טבלה: ${tableName}** — הנתונים המלאים בקובץ האקסל המצורף.\n`;
        finalMarkdown = finalMarkdown.replace(match[0], placeholder);
      }
    } catch { /* skip malformed tables */ }
  }

  // Download .md
  const mdBlob = new Blob([finalMarkdown], { type: 'text/markdown;charset=utf-8' });
  const mdUrl  = URL.createObjectURL(mdBlob);
  const mdLink = document.createElement('a');
  mdLink.href = mdUrl; mdLink.download = `${baseName}.md`; mdLink.click();
  URL.revokeObjectURL(mdUrl);

  // Download .xlsx if tables exist
  if (tableCount > 0) {
    XLSX.writeFile(wb, `${baseName}.xlsx`);
  }

  const flavorLabel = flavor === 'salesforce' ? 'Salesforce'
    : flavor === 'outsystems' ? `OutSystems ${osVer.toUpperCase()}`
    : 'כללי';

  deps.appendMessage('assistant',
    isQuestions
      ? `✅ שאלות ההבהרה הורדו כ-\`${baseName}.md\`\n\n**טעם:** ${flavorLabel} · **מקורות:** ${fileNames}`
      : `✅ מסמך האפיון הורד כ-\`${baseName}.md\`${tableCount > 0 ? ` + \`${baseName}.xlsx\` (${tableCount} גיליונות)` : ''}\n\n**טעם:** ${flavorLabel} · **מקורות:** ${fileNames}`
  );
};

// ── Internal: Gemini call with model fallback ─────────────────────────────
async function callWithFallback(prompt, startModelIdx) {
  let mIdx = startModelIdx;
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
