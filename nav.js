// Shared navigation module — injected into every page.
// Import this as <script type="module" src="nav.js"></script>.

const AGENTS = [
  { id: 'requirements',        name: 'אוסף הדרישות',          icon: '📋', href: null },
  { id: 'project-manager',     name: 'מנהל הפרויקט',           icon: '📊', href: null },
  { id: 'project-coordinator', name: 'רכזת הפרויקטים',         icon: '🗂️', href: null },
  { id: 'spec-king',           name: 'מלך האיפיונים',           icon: '👑', href: null },
  { id: 'software-architect',  name: 'ארכיטקט התוכנה',          icon: '🏗️', href: null },
  { id: 'platform-architect',  name: 'ארכיטקט הפלטפורמות',      icon: '⚙️', href: null },
  { id: 'salesforce',          name: 'תותח הסיילספורס',         icon: '⚡', href: 'sf-agent.html' },
  { id: 'tender-writer',       name: 'כותב המכרזים',            icon: '📝', href: null },
  { id: 'design-queen',        name: 'מלכת העיצובים',           icon: '🎨', href: null },
  { id: 'storyteller',         name: 'מספר הסיפורים',           icon: '📖', href: null },
  { id: 'dev-champ',           name: 'אלוף הפיתוחים',           icon: '💻', href: null },
  { id: 'tester',              name: 'הבודק',                   icon: '🔍', href: null },
  { id: 'security',            name: 'המאבטח',                  icon: '🔒', href: null },
];

function getActiveId() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'sf-agent.html') return 'salesforce';
  if (page === 'admin.html')    return 'salesforce'; // admin is part of the SF agent
  return null; // home page
}

function buildSidebar() {
  const activeId = getActiveId();

  const items = AGENTS.map((a) => {
    const active = a.id === activeId;
    const available = !!a.href;
    const tag = available
      ? `<span class="nav-badge nav-badge-active">פעיל</span>`
      : `<span class="nav-badge nav-badge-soon">בקרוב</span>`;

    if (available) {
      return `
        <a href="${a.href}" class="nav-item ${active ? 'nav-item-active' : ''}" title="${a.name}">
          <span class="nav-icon">${a.icon}</span>
          <span class="nav-name">${a.name}</span>
          ${tag}
        </a>`;
    }
    return `
      <span class="nav-item nav-item-disabled" title="${a.name} — בקרוב">
        <span class="nav-icon">${a.icon}</span>
        <span class="nav-name">${a.name}</span>
        ${tag}
      </span>`;
  }).join('');

  return `
    <div class="sidebar-inner">
      <a href="index.html" class="sidebar-brand">
        <img src="favicon.svg" alt="" class="sidebar-logo" />
        <div class="sidebar-brand-text">
          <span class="sidebar-title">Agent Suite</span>
          <span class="sidebar-subtitle">משרד התחבורה</span>
        </div>
      </a>
      <div class="sidebar-section-label">סוכנים</div>
      <nav class="sidebar-nav" aria-label="ניווט סוכנים">
        ${items}
      </nav>
      <div class="sidebar-footer">
        <a href="admin.html" class="sidebar-admin-link" target="_blank">⚙ מסך ניהול</a>
      </div>
    </div>`;
}

function injectSidebar() {
  // Wrap existing body content in .app-layout
  const existingContent = document.body.innerHTML;
  document.body.innerHTML = `
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

  // Mobile toggle
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('sidebar-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '✕' : '☰';
  });

  // Close sidebar when clicking outside on mobile
  document.getElementById('app-content').addEventListener('click', () => {
    if (sidebar.classList.contains('sidebar-open')) {
      sidebar.classList.remove('sidebar-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    }
  });
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSidebar);
} else {
  injectSidebar();
}
