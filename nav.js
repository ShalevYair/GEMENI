// All agent IDs that have a dedicated page via agent.html?id=<id>
const CHAT_AGENT_IDS = new Set([
  'json-gen', 'briefer', 'dynamic', 'shraga',
  'requirements', 'project-manager', 'project-coordinator', 'spec-king',
  'software-architect', 'platform-architect', 'tender-writer', 'outsystems',
  'storyteller', 'design-queen', 'dev-champ', 'tester', 'security', 'natural',
  'summarizer',
  'ui-explorer',
]);

// All nav items in priority order — spec-viewer and mindmap use custom hrefs
const NAV_ITEMS = [
  { id: 'spec-king',           name: 'מלך האפיונים',          icon: '👑',  href: 'agent.html?id=spec-king' },
  { id: 'spec-viewer',         name: 'מציג האפיונים',          icon: '📋',  href: 'spec-viewer.html' },
  { id: 'shraga',               name: 'שרגא',                   icon: '🧠',  href: 'agent.html?id=shraga' },
  { id: 'briefer',             name: 'בריפר',                  icon: '📋',  href: 'agent.html?id=briefer' },
  { id: 'requirements',        name: 'אוסף הדרישות',           icon: '📋',  href: 'agent.html?id=requirements' },
  { id: 'project-manager',     name: 'מנהל הפרויקט',           icon: '📊',  href: 'agent.html?id=project-manager' },
  { id: 'project-coordinator', name: 'רכזת הפרויקטים',         icon: '🗂️', href: 'agent.html?id=project-coordinator' },
  { id: 'software-architect',  name: 'ארכיטקט התוכנה',         icon: '🏗️', href: 'agent.html?id=software-architect' },
  { id: 'platform-architect',  name: 'ארכיטקט הפלטפורמות',     icon: '⚙️', href: 'agent.html?id=platform-architect' },
  { id: 'design-queen',        name: 'מלכת העיצובים',          icon: '🎨',  href: 'agent.html?id=design-queen' },
  { id: 'dev-champ',           name: 'אלוף הפיתוחים',          icon: '💻',  href: 'agent.html?id=dev-champ' },
  { id: 'storyteller',         name: 'מספר הסיפורים',          icon: '📖',  href: 'agent.html?id=storyteller' },
  { id: 'tester',              name: 'הבודק',                  icon: '🔍',  href: 'agent.html?id=tester' },
  { id: 'security',            name: 'המאבטח',                 icon: '🔒',  href: 'agent.html?id=security' },
  { id: 'tender-writer',       name: 'כותב המכרזים',           icon: '📝',  href: 'agent.html?id=tender-writer' },
  { id: 'natural',             name: 'NATURAL',                icon: '🖥️', href: 'agent.html?id=natural' },
  { id: 'summarizer',          name: 'המסכם',                  icon: '📝',  href: 'agent.html?id=summarizer' },
  { id: 'ui-explorer',        name: 'חוקר ממשק המשתמש',      icon: '🔬',  href: 'agent.html?id=ui-explorer' },
  { id: 'json-gen',            name: 'הטכנולוג',               icon: '{ }', href: 'agent.html?id=json-gen' },
  { id: 'dynamic',             name: 'סוכן דינמי',             icon: '🔮',  href: 'agent.html?id=dynamic' },
  { id: 'salesforce',          name: 'Salesforce Killer',      icon: '⚡',  href: 'sf-agent.html' },
  { id: 'outsystems',          name: 'OutSystems Expert',      icon: '🔷',  href: 'agent.html?id=outsystems' },
  { id: 'mindmap',             name: 'פיתוח תוכנה',            icon: '🗺',  href: 'SDLCMindMap.html' },
];

function getActiveId() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'agent.html') return new URLSearchParams(location.search).get('id');
  if (page === 'sf-agent.html') return 'salesforce';
  if (page === 'admin.html')    return 'salesforce';
  if (page === 'spec-viewer.html') return 'spec-viewer';
  if (page === 'SDLCMindMap.html') return 'mindmap';
  return null;
}

function buildSidebar() {
  const activeId = getActiveId();

  const navItems = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="nav-item ${item.id === activeId ? 'nav-item-active' : ''}" title="${item.name}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-name">${item.name}</span>
    </a>`).join('');

  return `
    <div class="sidebar-inner">
      <a href="index.html" class="sidebar-brand">
        <img src="favicon.svg" alt="" class="sidebar-logo" />
        <div class="sidebar-brand-text">
          <span class="sidebar-title">אגם הסוכנים</span>
        </div>
      </a>
      <nav class="sidebar-nav" aria-label="ניווט ראשי">
        ${navItems}
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
        <button class="site-header-btn" onclick="toggleHelpModal()" title="עזרה">?</button>
      </div>
    </header>`;
}

function buildHelpModal() {
  return `
    <div class="modal" id="help-modal" hidden role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <div class="modal-backdrop" onclick="toggleHelpModal(false)"></div>
      <div class="modal-dialog modal-dialog-large">
        <h3 id="help-modal-title">👋 מה זה אגם הסוכנים?</h3>
        <p>
          <strong>אגם הסוכנים</strong> היא פלטפורמת סוכני AI הפועלת כולה בצד הלקוח (בדפדפן),
          ללא שרת וללא צורך בהתקנה — מיועדת לניהול מחזור החיים של תוכנה (SDLC):
          מאיסוף דרישות, דרך כתיבת מסמכי אפיון (FSD), עיצוב ארכיטקטורה וממשק,
          ועד בדיקות, אבטחה וכתיבת מכרזים.
        </p>
        <p>
          הפלטפורמה כוללת <strong>24 סוכנים</strong> ייעודיים, כל אחד מתמחה בתחום משלו —
          לדוגמה <strong>מלך האפיונים</strong> שמייצר מסמך אפיון מלא, <strong>שרגא</strong>
          שמנתח מסמכים קיימים, <strong>NATURAL</strong> לניתוח קוד קיים, ועוד.
          כל שיחה עם סוכן פונה ישירות ל-Gemini API באמצעות מפתח ה-API שלך,
          ללא שמירת מידע בשום שרת חיצוני — כל הנתונים נשמרים מקומית בדפדפן בלבד.
        </p>
        <p class="modal-hint">💡 טיפ: לחצו על שם סוכן בתפריט הצד כדי לפתוח איתו שיחה.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="toggleHelpModal(false)" type="button">הבנתי, סגור</button>
        </div>
      </div>
    </div>`;
}

window.toggleHelpModal = function (force) {
  const modal = document.getElementById('help-modal');
  if (!modal) return;
  const show = typeof force === 'boolean' ? force : modal.hidden;
  modal.hidden = !show;
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.toggleHelpModal(false);
});

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
    ${buildHelpModal()}
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
