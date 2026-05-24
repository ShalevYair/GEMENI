import { deps } from './deps.js';

// ── Chunk maps ──────────────────────────────────────────────────────────────

const CHUNK_MAP_FAST = {
  1: { sections: 'all', label: 'כל הסעיפים' },
};

const CHUNK_MAP_NORMAL = {
  1: { sections: ['entities'], label: 'ישויות ושדות' },
  2: { sections: ['workflows', 'email_templates'], label: 'זרימות עבודה ותבניות מייל' },
  3: { sections: ['forms', 'views', 'permissions'], label: 'טפסים, תצוגות והרשאות' },
};

const CHUNK_MAP_DEEP = {
  1: { sections: ['entities'], label: 'ישויות ושדות' },
  2: { sections: ['forms'], label: 'טפסים' },
  3: { sections: ['views'], label: 'תצוגות' },
  4: { sections: ['workflows'], label: 'זרימות עבודה' },
  5: { sections: ['permissions'], label: 'הרשאות ותפקידים' },
  6: { sections: ['email_templates'], label: 'תבניות מייל' },
};

// ── Reference file cache ────────────────────────────────────────────────────

let cachedInstructions = null;
let cachedExamples     = null;

async function loadReferenceFiles() {
  if (!cachedInstructions) {
    try { cachedInstructions = await (await fetch('AI_INSTRUCTIONS.md')).text(); }
    catch { cachedInstructions = ''; }
  }
  if (!cachedExamples) {
    try { cachedExamples = await (await fetch('mayuvgam-examples.json')).text(); }
    catch { cachedExamples = '{}'; }
  }
}

// ── State ───────────────────────────────────────────────────────────────────

let jgSpecFiles        = [];
let jgCurrentBundleFile = null;

// ── Init ────────────────────────────────────────────────────────────────────

export function initJsonModal() {
  injectJsonModal();
  loadReferenceFiles();
}

// ── Modal HTML ──────────────────────────────────────────────────────────────

function injectJsonModal() {
  const modal = document.createElement('div');
  modal.id = 'json-gen-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:860px;width:calc(100% - 2rem);max-height:90vh;direction:rtl;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Heebo,sans-serif;display:flex;flex-direction:column;overflow:hidden;">

      <!-- ── Header ── -->
      <div style="padding:1.25rem 1.5rem .9rem;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
        <h3 style="margin:0 0 .2rem;font-size:1.15rem;display:flex;align-items:center;gap:.5rem;color:#1e293b;">{ } מחולל JSON — Mayuvgam</h3>
        <p style="margin:0;color:#64748b;font-size:.84rem;">העלה אפיון מערכת וקבל קובץ JSON מוכן להעלאה ל-Builder של Mayuvgam — ישויות, טפסים, תצוגות, זרימות עבודה והרשאות.</p>
      </div>

      <!-- ── Body ── -->
      <div style="display:flex;flex:1;overflow:hidden;">

        <!-- Left column: file uploads -->
        <div style="flex:0 0 360px;padding:1.1rem 1.4rem;overflow-y:auto;border-left:1px solid #f1f5f9;">

          <!-- Spec files -->
          <div style="margin-bottom:.9rem;">
            <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.4rem;">קבצי אפיון (עד 10 קבצים):</div>
            <label id="jg-dropzone" for="jg-spec-input"
              style="display:block;border:2px dashed #c8d0e0;border-radius:9px;padding:.9rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
              ondragover="event.preventDefault();this.style.borderColor='#0070d2';this.style.background='#f0f9ff';"
              ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
              ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.jgHandleDrop(event);">
              <div style="font-size:1.4rem;margin-bottom:.2rem;">📂</div>
              <div style="color:#64748b;font-size:.82rem;">לחץ לבחירת קבצים או גרור לכאן<br><span style="font-size:.75rem;">.docx · .xlsx · .txt · .md · .pdf</span></div>
              <input id="jg-spec-input" type="file" accept=".docx,.xlsx,.txt,.md,.pdf" multiple style="display:none;" onchange="window.jgSpecFilesSelected(this.files)">
            </label>
            <div id="jg-spec-list" style="margin-top:.45rem;display:flex;flex-direction:column;gap:.25rem;"></div>
          </div>

          <!-- Optional current bundle -->
          <div>
            <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.25rem;">Bundle קיים — אופציונלי:</div>
            <div style="font-size:.78rem;color:#64748b;margin-bottom:.4rem;">הורד מה-Builder — הסוכן ירחיב אותו במקום לבנות מאפס.</div>
            <label id="jg-bundle-label" for="jg-bundle-input"
              style="display:block;border:2px dashed #c8d0e0;border-radius:9px;padding:.7rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;"
              ondragover="event.preventDefault();this.style.borderColor='#0070d2';this.style.background='#f0f9ff';"
              ondragleave="this.style.borderColor='#c8d0e0';this.style.background='';"
              ondrop="event.preventDefault();this.style.borderColor='#c8d0e0';this.style.background='';window.jgHandleBundleDrop(event);">
              <div id="jg-bundle-placeholder" style="color:#64748b;font-size:.82rem;">📋 הוסף mayuvgam-current.json</div>
              <div id="jg-bundle-display" style="display:none;"></div>
              <input id="jg-bundle-input" type="file" accept=".json" style="display:none;" onchange="window.jgBundleSelected(this.files)">
            </label>
          </div>

        </div>

        <!-- Right column: depth selector -->
        <div style="flex:1;padding:1.1rem 1.4rem;overflow-y:auto;">
          <div style="font-weight:600;font-size:.87rem;color:#1e293b;margin-bottom:.55rem;">רמת עומק ומספר קריאות API:</div>

          <div style="display:flex;flex-direction:column;gap:.5rem;">

            <label style="cursor:pointer;">
              <input type="radio" name="jg-depth" value="auto" style="display:none;" onchange="window.jgDepthChanged()">
              <div class="jg-depth-card" data-depth="auto"
                style="border:2px solid #e2e8f0;border-radius:10px;padding:.75rem 1rem;background:#fff;transition:all .2s;cursor:pointer;"
                onclick="document.querySelector('input[name=jg-depth][value=auto]').checked=true;window.jgDepthChanged()">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;">
                  <span>✨</span>
                  <span style="font-weight:700;font-size:.9rem;color:#1e293b;">חכם — AI מחליט</span>
                  <span style="font-size:.72rem;background:#fef9c3;color:#854d0e;padding:.1rem .45rem;border-radius:99px;font-weight:600;margin-right:auto;">1–6 קריאות</span>
                </div>
                <div style="font-size:.78rem;color:#64748b;">מנתח את מורכבות האפיון ומחליט בעצמו כמה קריאות נדרשות.</div>
              </div>
            </label>

            <label style="cursor:pointer;">
              <input type="radio" name="jg-depth" value="deep" style="display:none;" onchange="window.jgDepthChanged()">
              <div class="jg-depth-card" data-depth="deep"
                style="border:2px solid #e2e8f0;border-radius:10px;padding:.75rem 1rem;background:#fff;transition:all .2s;cursor:pointer;"
                onclick="document.querySelector('input[name=jg-depth][value=deep]').checked=true;window.jgDepthChanged()">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;">
                  <span>🔬</span>
                  <span style="font-weight:700;font-size:.9rem;color:#1e293b;">מעמיק</span>
                  <span style="font-size:.72rem;background:#dbeafe;color:#1e40af;padding:.1rem .45rem;border-radius:99px;font-weight:600;margin-right:auto;">6 קריאות</span>
                </div>
                <div style="font-size:.78rem;color:#64748b;">כל סוג (ישויות / טפסים / תצוגות / זרימות / הרשאות / מיילים) בקריאה נפרדת.</div>
              </div>
            </label>

            <label style="cursor:pointer;">
              <input type="radio" name="jg-depth" value="normal" checked style="display:none;" onchange="window.jgDepthChanged()">
              <div class="jg-depth-card" data-depth="normal"
                style="border:2px solid #0070d2;border-radius:10px;padding:.75rem 1rem;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);transition:all .2s;cursor:pointer;"
                onclick="document.querySelector('input[name=jg-depth][value=normal]').checked=true;window.jgDepthChanged()">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;">
                  <span>⚡</span>
                  <span style="font-weight:700;font-size:.9rem;color:#1e293b;">רגיל</span>
                  <span style="font-size:.72rem;background:#dcfce7;color:#15803d;padding:.1rem .45rem;border-radius:99px;font-weight:600;margin-right:auto;">ברירת מחדל · 3 קריאות</span>
                </div>
                <div style="font-size:.78rem;color:#64748b;">ישויות ושדות ← זרימות ומיילים ← טפסים, תצוגות והרשאות.</div>
              </div>
            </label>

            <label style="cursor:pointer;">
              <input type="radio" name="jg-depth" value="fast" style="display:none;" onchange="window.jgDepthChanged()">
              <div class="jg-depth-card" data-depth="fast"
                style="border:2px solid #e2e8f0;border-radius:10px;padding:.75rem 1rem;background:#fff;transition:all .2s;cursor:pointer;"
                onclick="document.querySelector('input[name=jg-depth][value=fast]').checked=true;window.jgDepthChanged()">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;">
                  <span>🚀</span>
                  <span style="font-weight:700;font-size:.9rem;color:#1e293b;">מהיר</span>
                  <span style="font-size:.72rem;background:#f3f4f6;color:#374151;padding:.1rem .45rem;border-radius:99px;font-weight:600;margin-right:auto;">קריאה אחת</span>
                </div>
                <div style="font-size:.78rem;color:#64748b;">כל התצורה בקריאה אחת. מהיר יותר, פחות מפורט.</div>
              </div>
            </label>

          </div>
        </div>
      </div>

      <!-- ── Footer ── -->
      <div style="padding:.9rem 1.5rem;border-top:1px solid #f1f5f9;display:flex;gap:.75rem;justify-content:flex-end;align-items:center;flex-shrink:0;">
        <span style="font-size:.78rem;color:#94a3b8;margin-left:auto;">הקובץ יורד אוטומטית לאחר היצירה</span>
        <button onclick="window.closeJsonModal()" style="padding:.5rem 1rem;border:1px solid #c8d0e0;background:#fff;border-radius:8px;cursor:pointer;font-size:.88rem;font-family:Heebo,sans-serif;color:#374151;">ביטול</button>
        <button id="jg-generate-btn" onclick="window.generateJson()" style="padding:.5rem 1.25rem;background:linear-gradient(135deg,#0070d2,#0052cc);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:700;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(0,112,210,.35);">{ } צור JSON</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) window.closeJsonModal(); });
  document.body.appendChild(modal);
}

// ── Window helpers ───────────────────────────────────────────────────────────

window.openJsonModal = function () {
  if (deps.getIsLoading()) return;
  const modal = document.getElementById('json-gen-modal');
  if (!modal) return;
  jgSpecFiles = [];
  jgCurrentBundleFile = null;
  jgRenderSpecList();
  jgRenderBundleStatus();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  window.jgDepthChanged();
};

window.closeJsonModal = function () {
  const modal = document.getElementById('json-gen-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
};

window.jgHandleDrop = function (e) {
  jgAddSpecFiles(Array.from(e.dataTransfer.files || []));
};

window.jgSpecFilesSelected = function (fileList) {
  jgAddSpecFiles(Array.from(fileList || []));
  const fi = document.getElementById('jg-spec-input');
  if (fi) fi.value = '';
};

window.jgRemoveSpecFile = function (idx) {
  jgSpecFiles.splice(idx, 1);
  jgRenderSpecList();
};

window.jgHandleBundleDrop = function (e) {
  const f = Array.from(e.dataTransfer.files || []).find(f => f.name.endsWith('.json'));
  if (f) { jgCurrentBundleFile = f; jgRenderBundleStatus(); }
};

window.jgBundleSelected = function (fileList) {
  const f = Array.from(fileList || []).find(f => f.name.endsWith('.json'));
  if (f) { jgCurrentBundleFile = f; jgRenderBundleStatus(); }
  const fi = document.getElementById('jg-bundle-input');
  if (fi) fi.value = '';
};

window.jgRemoveBundle = function () {
  jgCurrentBundleFile = null;
  jgRenderBundleStatus();
};

window.jgDepthChanged = function () {
  const depth = document.querySelector('input[name="jg-depth"]:checked')?.value || 'normal';
  document.querySelectorAll('.jg-depth-card').forEach(card => {
    const sel = card.dataset.depth === depth;
    card.style.borderColor = sel ? '#0070d2' : '#e2e8f0';
    card.style.background  = sel ? 'linear-gradient(135deg,#f0f9ff,#e0f2fe)' : '#fff';
  });
};

// ── Internal helpers ─────────────────────────────────────────────────────────

function jgAddSpecFiles(files) {
  const allowed = ['.docx', '.xlsx', '.txt', '.md', '.pdf'];
  for (const f of files) {
    if (jgSpecFiles.length >= 10) break;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) continue;
    if (f.size > 10 * 1024 * 1024) continue;
    if (jgSpecFiles.find(x => x.name === f.name)) continue;
    jgSpecFiles.push(f);
  }
  jgRenderSpecList();
}

function jgRenderSpecList() {
  const list = document.getElementById('jg-spec-list');
  if (!list) return;
  if (!jgSpecFiles.length) { list.innerHTML = ''; return; }
  list.innerHTML = jgSpecFiles.map((f, idx) => `
    <div style="display:flex;align-items:center;gap:.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:.4rem .65rem;font-size:.82rem;">
      <span style="color:#0070d2;">📄</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${deps.escHtml(f.name)}</span>
      <span style="color:#94a3b8;white-space:nowrap;">${(f.size / 1024).toFixed(0)} KB</span>
      <button onclick="window.jgRemoveSpecFile(${idx})" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.9rem;padding:0 .15rem;line-height:1;" title="הסר">✕</button>
    </div>`).join('');
}

function jgRenderBundleStatus() {
  const ph  = document.getElementById('jg-bundle-placeholder');
  const disp = document.getElementById('jg-bundle-display');
  if (!ph || !disp) return;
  if (jgCurrentBundleFile) {
    ph.style.display   = 'none';
    disp.style.display = '';
    disp.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;">
        <span style="color:#0070d2;">📋</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${deps.escHtml(jgCurrentBundleFile.name)}</span>
        <button onclick="window.jgRemoveBundle()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:.9rem;padding:0 .15rem;line-height:1;" title="הסר">✕</button>
      </div>`;
  } else {
    ph.style.display   = '';
    disp.style.display = 'none';
  }
}

async function readXlsxFile(file) {
  if (!window.XLSX) return '[Excel: XLSX library not available]';
  const buf  = await file.arrayBuffer();
  const wb   = window.XLSX.read(buf, { type: 'array' });
  const parts = wb.SheetNames.map(name =>
    `Sheet: ${name}\n${window.XLSX.utils.sheet_to_csv(wb.Sheets[name])}`
  );
  return parts.join('\n\n---\n\n');
}

function extractJson(text) {
  try { return JSON.parse(text.trim()); } catch {}
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (blockMatch) { try { return JSON.parse(blockMatch[1].trim()); } catch {} }
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
  return null;
}

function buildAnalysisPrompt(specText) {
  return `Analyze the following system specification and determine how many API calls are needed to generate a complete Mayuvgam configuration bundle.

Consider:
- Simple system (1-3 entities, minimal workflows) → 1 call
- Small system (3-5 entities, some workflows) → 3 calls
- Medium system (5-10 entities, moderate workflows and permissions) → 4-5 calls
- Complex system (10+ entities, many workflows, complex permissions) → 6 calls

Return ONLY a JSON object (no explanation, no code block):
{"chunks": <number 1-6>, "reason": "<brief Hebrew explanation>"}

## Specification
${specText}`;
}

const SECTION_GUIDE = {
  entities:        'entities/*.yaml — all entities/tables with all their fields. Every entity must include a title/name string field, a status picklist, and a created_at datetime field as minimum.',
  forms:           'forms/*.yaml — at least one default form per entity, with logical sections grouping related fields.',
  views:           'views/*.yaml — at least one table view (is_default: true) per entity. Add kanban views for entities with status picklists, calendar views for entities with date fields.',
  workflows:       'workflows/*.yaml — all automation rules: validations (before_save), notifications (on_create/on_update), field calculations, visibility rules (on_form_load/on_field_change).',
  permissions:     'permissions/*.yaml — all user roles with read/create/update/delete permissions per entity. Use levels: none, own, team, all.',
  email_templates: 'email_templates/*.yaml — email templates referenced in workflow send_notification actions.',
};

function buildChunkPrompt(specText, currentBundle, sections, instructions, examples) {
  const isAll = sections === 'all';
  const sectionList = isAll ? Object.values(SECTION_GUIDE) : sections.map(s => SECTION_GUIDE[s] || s);

  return `# Mayuvgam Platform Configuration Generator

## Platform Reference Guide
${instructions}

## Working Examples (study these formats carefully)
${examples}

## System Specification to Implement
${specText}${currentBundle ? `

## Existing Bundle (preserve ALL existing entries, only add new ones)
${currentBundle}` : ''}

## Your Task
Generate ONLY the following configuration sections:
${sectionList.map(s => `- ${s}`).join('\n')}

## Rules
1. Return ONLY a valid JSON object — no explanation, no markdown, no code blocks, no comments
2. All entity/field/role names: snake_case English (e.g., customer_order, project_manager)
3. All labels: Hebrew (e.g., "הזמנת לקוח", "מנהל פרויקט")
4. Every workflow must have: schema_version, entity, name, enabled, priority, trigger, actions
5. Make the configuration comprehensive and production-ready
6. JSON keys pattern: "section/name.yaml" → YAML string value

Start your response with { and end with }`;
}

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

// ── Main generation ──────────────────────────────────────────────────────────

window.generateJson = async function () {
  if (!jgSpecFiles.length) {
    const dz = document.getElementById('jg-dropzone');
    if (dz) { dz.style.borderColor = '#e53e3e'; setTimeout(() => { dz.style.borderColor = '#c8d0e0'; }, 2000); }
    return;
  }
  if (!deps.getApiKey()) {
    window.closeJsonModal();
    document.getElementById('api-banner').hidden = false;
    document.getElementById('api-key-input').focus();
    return;
  }

  const depth = document.querySelector('input[name="jg-depth"]:checked')?.value || 'normal';
  let chunkMap = depth === 'deep' ? CHUNK_MAP_DEEP
    : depth === 'fast' ? CHUNK_MAP_FAST
    : depth === 'auto' ? null
    : CHUNK_MAP_NORMAL;

  window.closeJsonModal();
  deps.hideEmpty();
  deps.setLoading(true);
  const progressId = deps.appendTyping();

  // Load reference files
  deps.updateTyping(progressId, 'טוען קבצי הפניה…');
  await loadReferenceFiles();

  // Read spec files
  let specText = '';
  const fileNames = jgSpecFiles.map(f => f.name).join(', ');
  try {
    for (const file of jgSpecFiles) {
      deps.updateTyping(progressId, `קורא קובץ: ${file.name}…`);
      const ext = file.name.split('.').pop().toLowerCase();
      let content = '';
      if (ext === 'xlsx') {
        content = await readXlsxFile(file);
      } else {
        const fd = await deps.readFile(file);
        content = fd.isInline ? `[Binary: ${file.name}]` : (fd.text || '');
      }
      specText += `\n\n${'═'.repeat(60)}\nFile: ${file.name}\n${'═'.repeat(60)}\n\n${content}`;
    }
  } catch (e) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה בקריאת קבצים: ' + e.message);
    return;
  }

  // Read current bundle if provided
  let currentBundleText = '';
  if (jgCurrentBundleFile) {
    try { currentBundleText = await jgCurrentBundleFile.text(); } catch {}
  }

  const instructions = cachedInstructions || '';
  const examples     = cachedExamples     || '{}';
  let jgModelIdx     = deps.getModelIdx();
  const allChunks    = {};

  try {
    // Auto depth: analysis call
    if (depth === 'auto') {
      deps.updateTyping(progressId, '✨ מנתח מורכבות האפיון…');
      const analysisRaw = await callWithFallback(buildAnalysisPrompt(specText), jgModelIdx);
      const m = analysisRaw.match(/\{[\s\S]*?\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          const n = Math.max(1, Math.min(6, parseInt(parsed.chunks) || 3));
          chunkMap = n <= 1 ? CHUNK_MAP_FAST : n <= 3 ? CHUNK_MAP_NORMAL : CHUNK_MAP_DEEP;
          const actual = Object.keys(chunkMap).length;
          deps.appendMessage('assistant', `✨ **ניתוח:** ${parsed.reason || ''}\n→ נבחרו **${actual} קריאות API**`);
        } catch { chunkMap = CHUNK_MAP_NORMAL; }
      } else {
        chunkMap = CHUNK_MAP_NORMAL;
      }
    }

    const total = Object.keys(chunkMap).length;

    for (let i = 1; i <= total; i++) {
      const chunk = chunkMap[i];
      deps.updateTyping(progressId, `מייצר ${i} מתוך ${total}… (${chunk.label})`);
      const prompt  = buildChunkPrompt(specText, currentBundleText, chunk.sections, instructions, examples);
      const rawText = await callWithFallback(prompt, jgModelIdx);
      const parsed  = extractJson(rawText);
      if (parsed && typeof parsed === 'object') {
        Object.assign(allChunks, parsed);
      } else {
        deps.appendMessage('error', `⚠️ חלק ${i} (${chunk.label}) לא הוחזר כ-JSON תקין — דולג.`);
      }
    }
  } catch (err) {
    deps.removeTyping(progressId);
    deps.setLoading(false);
    deps.appendMessage('error', 'שגיאה ביצירת JSON: ' + err.message);
    return;
  }

  deps.removeTyping(progressId);
  deps.setLoading(false);

  const finalBundle = Object.fromEntries(
    Object.entries(allChunks).filter(([k]) => !k.startsWith('_'))
  );

  if (!Object.keys(finalBundle).length) {
    deps.appendMessage('error', 'לא נוצר תוכן. נסה שוב עם עומק גבוה יותר.');
    return;
  }

  // Auto download
  const ts       = new Date().toISOString().slice(0, 10);
  const filename = `mayuvgam-${ts}.json`;
  const blob     = new Blob([JSON.stringify(finalBundle, null, 2)], { type: 'application/json;charset=utf-8' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);

  // Build summary
  const count = prefix => Object.keys(finalBundle).filter(k => k.startsWith(prefix + '/')).length;
  const entityC = count('entities'), formC  = count('forms'),     viewC  = count('views');
  const wfC     = count('workflows'), permC  = count('permissions'), emailC = count('email_templates');

  const depthLabel = { fast: 'מהיר (1 קריאה)', deep: 'מעמיק (6 קריאות)', auto: 'חכם', normal: 'רגיל (3 קריאות)' }[depth] || depth;

  deps.appendMessage('assistant',
    `✅ קובץ JSON הורד: \`${filename}\`\n\n` +
    `**תוכן הקובץ:**\n` +
    (entityC ? `- 🗂️ **${entityC}** ישויות\n` : '') +
    (formC   ? `- 📋 **${formC}** טפסים\n`    : '') +
    (viewC   ? `- 👁️ **${viewC}** תצוגות\n`   : '') +
    (wfC     ? `- 🔀 **${wfC}** זרימות עבודה\n` : '') +
    (permC   ? `- 🔐 **${permC}** הרשאות\n`    : '') +
    (emailC  ? `- 📧 **${emailC}** תבניות מייל\n` : '') +
    `\n**קבצי מקור:** ${fileNames} · **עומק:** ${depthLabel}`
  );
};
