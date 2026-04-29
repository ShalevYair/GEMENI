// Admin screen — localStorage backed.
// MVP gate: verify email matches the configured admin email.
// (Real auth comes when this moves to org git.)

const ADMIN_EMAIL = 'shalevya@mot.gov.il';
const STORAGE_KEY_SPECS = 'sf-architect:approved-specs';
const STORAGE_KEY_SESSION = 'sf-architect:admin-session';

// ── Gate ──
const gate = document.getElementById('gate');
const gateForm = document.getElementById('gate-form');
const gateEmail = document.getElementById('gate-email');
const gateError = document.getElementById('gate-error');
const adminShell = document.getElementById('admin-shell');
const userEmailLabel = document.getElementById('user-email');

function showGate() {
  gate.style.display = '';
  adminShell.hidden = true;
}

function showAdmin(email) {
  gate.style.display = 'none';
  adminShell.hidden = false;
  userEmailLabel.textContent = email;
  renderAll();
}

function checkSession() {
  const session = sessionStorage.getItem(STORAGE_KEY_SESSION);
  if (session === ADMIN_EMAIL) {
    showAdmin(session);
    return true;
  }
  return false;
}

if (!checkSession()) showGate();

gateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  gateError.hidden = true;
  const v = gateEmail.value.trim().toLowerCase();
  if (v !== ADMIN_EMAIL.toLowerCase()) {
    gateError.textContent = 'אין הרשאה. רק כתובת ניהול מורשת רשאית להיכנס.';
    gateError.hidden = false;
    return;
  }
  sessionStorage.setItem(STORAGE_KEY_SESSION, ADMIN_EMAIL);
  showAdmin(ADMIN_EMAIL);
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
  showGate();
});

// ── Tabs ──
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => (c.hidden = true));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).hidden = false;
  });
});

// ── Data ──
function loadSpecs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_SPECS) || '[]');
  } catch {
    return [];
  }
}

function aggregateComponents(specs, section) {
  const out = [];
  for (const spec of specs) {
    const items = spec.inflight_output?.[section] || [];
    for (const item of items) {
      out.push({ ...item, _spec: spec.spec_name, _generated_at: spec.generated_at });
    }
  }
  return out;
}

// ── Render ──
function renderAll() {
  const specs = loadSpecs();
  document.getElementById('stat-specs').textContent = specs.length;
  document.getElementById('stat-objects').textContent = aggregateComponents(specs, 'objects').length;
  document.getElementById('stat-fields').textContent = aggregateComponents(specs, 'fields').length;
  document.getElementById('stat-automations').textContent = aggregateComponents(specs, 'automations').length;

  renderSpecs(specs);
  renderComponents('objects', aggregateComponents(specs, 'objects'), [
    { key: 'api_name', label: 'API Name' },
    { key: 'label', label: 'Label' },
    { key: 'owd', label: 'OWD' },
    { key: 'domain', label: 'Domain' },
    { key: '_spec', label: 'Spec Origin' },
    { key: 'status', label: 'Status' },
  ]);
  renderComponents('fields', aggregateComponents(specs, 'fields'), [
    { key: 'object', label: 'Object' },
    { key: 'api_name', label: 'API Name' },
    { key: 'label', label: 'Label' },
    { key: 'type', label: 'Type' },
    { key: 'required', label: 'Required' },
    { key: '_spec', label: 'Spec Origin' },
  ]);
  renderComponents('automations', aggregateComponents(specs, 'automations'), [
    { key: 'type', label: 'Type' },
    { key: 'api_name', label: 'API Name' },
    { key: 'object', label: 'Object' },
    { key: 'trigger', label: 'Trigger' },
    { key: 'purpose', label: 'Purpose' },
    { key: '_spec', label: 'Spec Origin' },
  ]);
}

function renderSpecs(specs) {
  const container = document.getElementById('tab-specs');
  if (specs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <strong>עדיין אין אפיונים מאושרים</strong>
        <p style="margin-top: 0.5rem">כל אפיון שייווצר במסך הראשי יופיע כאן אוטומטית.</p>
      </div>
    `;
    return;
  }
  const rows = specs
    .map(
      (s) => `
      <tr>
        <td><code>${escapeHtml(s.spec_name || '—')}</code></td>
        <td>${escapeHtml(s.fsd_filename || '—')}</td>
        <td>${formatDate(s.generated_at)}</td>
        <td>${s.had_deployed_state ? '✅' : '—'}</td>
        <td>${s.had_inflight_state ? '✅' : '—'}</td>
        <td>${countOutputItems(s)}</td>
        <td>
          <button class="btn-ghost" data-action="download" data-idx="${specs.indexOf(s)}" type="button">⬇ JSON</button>
          <button class="btn-ghost" data-action="delete" data-idx="${specs.indexOf(s)}" type="button">🗑</button>
        </td>
      </tr>
    `
    )
    .join('');
  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>שם אפיון</th>
          <th>קובץ FSD</th>
          <th>תאריך</th>
          <th>Deployed?</th>
          <th>In-flight?</th>
          <th>רכיבים</th>
          <th>פעולות</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  container.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const action = btn.dataset.action;
      const all = loadSpecs();
      const item = all[idx];
      if (!item) return;
      if (action === 'download') {
        downloadJSON(item.inflight_output || {}, `${item.spec_name || 'spec'}-inflight.json`);
      } else if (action === 'delete') {
        if (!confirm(`למחוק את "${item.spec_name}"?`)) return;
        all.splice(idx, 1);
        localStorage.setItem(STORAGE_KEY_SPECS, JSON.stringify(all));
        renderAll();
      }
    });
  });
}

function renderComponents(section, items, columns) {
  const container = document.getElementById(`tab-${section}`);
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <strong>אין רכיבים מתוכננים בקטגוריה הזו</strong>
      </div>
    `;
    return;
  }
  const headers = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const rows = items
    .map(
      (it) =>
        `<tr>${columns
          .map((c) => `<td>${formatCell(it[c.key])}</td>`)
          .join('')}</tr>`
    )
    .join('');
  container.innerHTML = `
    <table class="admin-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatCell(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? '✅' : '—';
  if (typeof v === 'object') return `<code>${escapeHtml(JSON.stringify(v))}</code>`;
  if (String(v).length > 60) return `<code>${escapeHtml(String(v).slice(0, 60))}...</code>`;
  return `<code>${escapeHtml(String(v))}</code>`;
}

function countOutputItems(spec) {
  const out = spec.inflight_output;
  if (!out) return 0;
  return ['objects', 'fields', 'automations', 'permissions', 'integrations', 'layouts']
    .reduce((sum, k) => sum + (Array.isArray(out[k]) ? out[k].length : 0), 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('he-IL');
  } catch {
    return iso;
  }
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Export everything as a merged in-flight.json
document.getElementById('export-btn')?.addEventListener('click', () => {
  const specs = loadSpecs();
  const merged = {
    _metadata: {
      captured_at: new Date().toISOString(),
      source: 'agent-output',
      exported_by: ADMIN_EMAIL,
      spec_count: specs.length,
    },
    objects: aggregateComponents(specs, 'objects'),
    fields: aggregateComponents(specs, 'fields'),
    automations: aggregateComponents(specs, 'automations'),
    permissions: aggregateComponents(specs, 'permissions'),
    integrations: aggregateComponents(specs, 'integrations'),
    layouts: aggregateComponents(specs, 'layouts'),
  };
  downloadJSON(merged, `in-flight-merged-${Date.now()}.json`);
});
