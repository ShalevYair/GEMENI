// All agent IDs that have a dedicated page via agent.html?id=<id>
const CHAT_AGENT_IDS = new Set([
  'requirements', 'project-manager', 'project-coordinator', 'spec-king',
  'software-architect', 'platform-architect', 'tender-writer', 'outsystems',
  'storyteller', 'design-queen', 'dev-champ', 'tester', 'security',
]);

function agentHref(id) {
  if (id === 'salesforce') return 'sf-agent.html';
  if (CHAT_AGENT_IDS.has(id)) return `agent.html?id=${id}`;
  return null;
}

const AGENTS = [
  { id: 'requirements',        name: 'אוסף הדרישות',       icon: '📋' },
  { id: 'project-manager',     name: 'מנהל הפרויקט',        icon: '📊' },
  { id: 'project-coordinator', name: 'רכזת הפרויקטים',      icon: '🗂️' },
  { id: 'spec-king',           name: 'מלך האיפיונים',        icon: '👑' },
  { id: 'software-architect',  name: 'ארכיטקט התוכנה',       icon: '🏗️' },
  { id: 'platform-architect',  name: 'ארכיטקט הפלטפורמות',   icon: '⚙️' },
  { id: 'tender-writer',       name: 'כותב המכרזים',         icon: '📝' },
  { id: 'salesforce',          name: 'Salesforce Killer',    icon: '⚡' },
  { id: 'outsystems',          name: 'OutSystems Expert',    icon: '🔷' },
  { id: 'storyteller',         name: 'מספר הסיפורים',        icon: '📖' },
  { id: 'design-queen',        name: 'מלכת העיצובים',        icon: '🎨' },
  { id: 'dev-champ',           name: 'אלוף הפיתוחים',        icon: '💻' },
  { id: 'tester',              name: 'הבודק',                icon: '🔍' },
  { id: 'security',            name: 'המאבטח',               icon: '🔒' },
];

function getActiveId() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'agent.html') return new URLSearchParams(location.search).get('id');
  if (page === 'sf-agent.html') return 'salesforce';
  if (page === 'admin.html')    return 'salesforce';
  if (page === 'SDLCMindMap.html') return 'mindmap';
  return null;
}

function buildSidebar() {
  const activeId = getActiveId();
  const toolItems = `
    <a href="SDLCMindMap.html" class="nav-item ${activeId === 'mindmap' ? 'nav-item-active' : ''}" title="מפת SDLC">
      <span class="nav-icon">🗺</span>
      <span class="nav-name">מפת SDLC</span>
    </a>`;

  const agentItems = AGENTS.map(a => {
    const href   = agentHref(a.id);
    const active = a.id === activeId;
    if (href) {
      return `
        <a href="${href}" class="nav-item ${active ? 'nav-item-active' : ''}" title="${a.name}">
          <span class="nav-icon">${a.icon}</span>
          <span class="nav-name">${a.name}</span>
        </a>`;
    }
    return `
      <span class="nav-item nav-item-disabled" title="${a.name} — בקרוב">
        <span class="nav-icon">${a.icon}</span>
        <span class="nav-name">${a.name}</span>
      </span>`;
  }).join('');

  return `
    <div class="sidebar-inner">
      <a href="index.html" class="sidebar-brand">
        <img src="favicon.svg" alt="" class="sidebar-logo" />
        <div class="sidebar-brand-text">
          <span class="sidebar-title">אגם הסוכנים</span>
        </div>
      </a>
      <div class="sidebar-section-label">כלים</div>
      <nav class="sidebar-nav sidebar-nav-tools" aria-label="ניווט כלים">
        ${toolItems}
      </nav>
      <div class="sidebar-section-label">סוכנים</div>
      <nav class="sidebar-nav" aria-label="ניווט סוכנים">
        ${agentItems}
      </nav>
    </div>`;
}

function buildSiteHeader() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'SDLCMindMap.html') return '';
  const rawTitle = document.title || 'אגם הסוכנים';
  const title = rawTitle.split('—')[0].trim();
  return `
    <header class="site-header" id="site-header">
      <span class="site-header-title" id="site-header-title">${title}</span>
      <div class="site-header-controls">
        <div id="site-header-actions" class="site-header-action-group"></div>
        <button class="site-header-btn" onclick="changeSiteFontSize(1)" title="הגדל טקסט">+</button>
        <button class="site-header-btn" onclick="changeSiteFontSize(-1)" title="הקטן טקסט">−</button>
        <button class="site-header-btn" id="site-dark-btn" onclick="toggleSiteDarkMode()" title="מצב בהיר/כהה">☾</button>
      </div>
    </header>`;
}

function applyStoredPreferences() {
  const mode = localStorage.getItem('sdlc-dark-mode');
  if (mode === 'light') document.body.classList.add('light-mode');
  const btn = document.getElementById('site-dark-btn');
  if (btn) btn.textContent = document.body.classList.contains('light-mode') ? '☀' : '☾';
  const sz = parseFloat(localStorage.getItem('sdlc-font-size') || '16');
  if (sz !== 16) document.documentElement.style.fontSize = sz + 'px';
}

window.toggleSiteDarkMode = function () {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('sdlc-dark-mode', isLight ? 'light' : 'dark');
  const btn = document.getElementById('site-dark-btn');
  if (btn) btn.textContent = isLight ? '☀' : '☾';
};

window.changeSiteFontSize = function (step) {
  const cur  = parseFloat(localStorage.getItem('sdlc-font-size') || '16');
  const next = Math.max(13, Math.min(21, cur + step));
  document.documentElement.style.fontSize = next + 'px';
  localStorage.setItem('sdlc-font-size', next);
};

function injectSidebar() {
  const existingContent = document.body.innerHTML;
  document.body.innerHTML = `
    ${buildSiteHeader()}
    <div class="app-layout">
      <aside class="sidebar" id="sidebar" aria-label="תפריט ראשי">
        ${buildSidebar()}
      </aside>
      <div class="app-content" id="app-content">
        ${existingContent}
      </div>
    </div>
    <button class="sidebar-toggle" id="sidebar-toggle" aria-label="פתח/סגור תפריט" aria-expanded="false">☰</button>
  `;
  applyStoredPreferences();
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('sidebar-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '✕' : '☰';
  });
  document.getElementById('app-content').addEventListener('click', () => {
    if (sidebar.classList.contains('sidebar-open')) {
      sidebar.classList.remove('sidebar-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSidebar);
} else {
  injectSidebar();
}
