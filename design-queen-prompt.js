const HARD_RULES = `
═══════════════════════════════════════════════════
HARD RULES — DO NOT VIOLATE
═══════════════════════════════════════════════════
1. ZERO EXTERNAL DEPENDENCIES: No CDN links, no Google Fonts requests, no external images.
   The output HTML file must work completely offline, in any browser, with no internet access.
   Use system-ui font stack. Use SVG icons inline or CSS-drawn icons. No <link> to external URLs.

2. FULL RTL SUPPORT: The entire layout is RTL (Hebrew).
   - html element: dir="rtl" lang="he"
   - Sidebar is on the RIGHT side of the screen
   - flex-direction, margin, padding — all must respect RTL
   - Text alignment: right by default
   - Icons/arrows must point in the RTL-correct direction

3. REALISTIC MOCK DATA — NO PLACEHOLDERS:
   - Hebrew first and last names (ישראל כהן, רחל לוי, אבי מזרחי, שירה פרץ, etc.)
   - Real Israeli dates (DD/MM/YYYY format)
   - Real money amounts (₪12,500, ₪1,234,000)
   - Real ID numbers, phone numbers (05X-XXXXXXX), addresses (רחוב הרצל 12, תל אביב)
   - Real status values (פעיל, ממתין לאישור, נדחה, בטיפול, הושלם)
   - Tables must contain at least 5-6 rows of real-looking data
   - NEVER write: "שם משתמש", "טקסט לדוגמה", "לחץ כאן", "Lorem", "placeholder"

4. EVERY SCREEN FROM THE SPEC MUST EXIST:
   In Chunk 1, produce a complete SCREEN MANIFEST listing every screen you plan to build.
   Every screen in the manifest must appear as a <div class="screen" id="screen-[name]"> in the HTML.
   Missing a screen from the spec is a failure.

5. WORKING NAVIGATION:
   The sidebar must list every screen.
   Clicking a nav item must show that screen and hide all others.
   The active nav item must be visually highlighted.
   Use hash-based navigation (#screen-name).
   The first screen is shown by default on load.

6. LOOKS LIKE A SHIPPED PRODUCT — NOT A WIREFRAME:
   - Cards have box-shadow, proper padding, rounded corners
   - Tables have alternating row colors or hover state
   - Buttons have proper states (hover, active, disabled)
   - Status badges use color (green=success, orange=warning, red=danger, blue=info, gray=neutral)
   - Form inputs have proper styling (border, focus ring, label)
   - Empty states have an icon and a message (no blank white space)
   - Data visualizations: use CSS-only bar charts or progress bars (no chart libraries)
   - Avatar/initials circles where user representations are needed

7. CONSISTENT DESIGN SYSTEM:
   Use CSS custom properties (variables) for all colors, spacing, font sizes.
   Every screen uses the same tokens — no hard-coded colors scattered in HTML.
   8px spacing grid: spacing-1=8px, spacing-2=16px, spacing-3=24px, spacing-4=32px.

8. MOBILE RESPONSIVE — ONE BREAKPOINT:
   At min-width: 768px → sidebar visible, full layout.
   Below 768px → sidebar collapsed (toggle button), stacked layout.

9. INTERACTIVE ELEMENTS THAT WORK:
   Modals/dialogs: open and close on button click (CSS + JS toggle class)
   Dropdown menus: open on click, close on outside click
   Search/filter: filter visible rows in tables
   Form submission: show success message (no real backend needed)
   Tabs within screens: switch between tab panels

10. OUTPUT FORMAT FOR ASSEMBLY (chunks 1–3):
    Each chunk must wrap its output in these exact markers:
    For CSS (chunk 1 only):   <!-- CSS_START --> ... <!-- CSS_END -->
    For HTML screens:          <!-- SCREENS_START --> ... <!-- SCREENS_END -->
    Chunk 4 outputs the COMPLETE assembled <!DOCTYPE html> file — no markers, just the full file.`;

const STYLE_CONFIGS = {
  enterprise: {
    label: 'Clean Enterprise',
    cssVars: `
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-sidebar-bg: #1e3a5f;
  --color-sidebar-text: #e2e8f0;
  --color-sidebar-active: #3b82f6;
  --color-sidebar-hover: rgba(255,255,255,0.08);
  --color-primary: #1a56db;
  --color-primary-hover: #1345b7;
  --color-primary-light: #dbeafe;
  --color-secondary: #64748b;
  --color-success: #059669;
  --color-success-light: #d1fae5;
  --color-warning: #d97706;
  --color-warning-light: #fef3c7;
  --color-danger: #dc2626;
  --color-danger-light: #fee2e2;
  --color-info: #0284c7;
  --color-info-light: #e0f2fe;
  --color-border: #e2e8f0;
  --color-text: #1e293b;
  --color-text-secondary: #64748b;
  --color-text-muted: #94a3b8;
  --color-header-bg: #ffffff;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --sidebar-width: 240px;`,
  },
  dark: {
    label: 'Dark Modern',
    cssVars: `
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-sidebar-bg: #0f172a;
  --color-sidebar-text: #94a3b8;
  --color-sidebar-active: #6366f1;
  --color-sidebar-hover: rgba(99,102,241,0.12);
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-light: rgba(99,102,241,0.15);
  --color-secondary: #475569;
  --color-success: #10b981;
  --color-success-light: rgba(16,185,129,0.15);
  --color-warning: #f59e0b;
  --color-warning-light: rgba(245,158,11,0.15);
  --color-danger: #ef4444;
  --color-danger-light: rgba(239,68,68,0.15);
  --color-info: #38bdf8;
  --color-info-light: rgba(56,189,248,0.15);
  --color-border: rgba(255,255,255,0.08);
  --color-text: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #475569;
  --color-header-bg: #1e293b;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --sidebar-width: 240px;`,
  },
  salesforce: {
    label: 'Salesforce Lightning',
    cssVars: `
  --color-bg: #f3f2f2;
  --color-surface: #ffffff;
  --color-sidebar-bg: #032d60;
  --color-sidebar-text: #b0d0ef;
  --color-sidebar-active: #1589ee;
  --color-sidebar-hover: rgba(21,137,238,0.15);
  --color-primary: #0070d2;
  --color-primary-hover: #005fb2;
  --color-primary-light: #d8edff;
  --color-secondary: #706e6b;
  --color-success: #2e844a;
  --color-success-light: #cdefc4;
  --color-warning: #dd7a01;
  --color-warning-light: #fde8c0;
  --color-danger: #ba0517;
  --color-danger-light: #feded9;
  --color-info: #0070d2;
  --color-info-light: #d8edff;
  --color-border: #dddbda;
  --color-text: #080707;
  --color-text-secondary: #706e6b;
  --color-text-muted: #aeadab;
  --color-header-bg: #032d60;
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.12);
  --shadow-lg: 0 8px 16px rgba(0,0,0,0.14);
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --sidebar-width: 256px;`,
  },
  auto: {
    label: 'נגזר מהאפיון',
    cssVars: null,
  },
};

const CHUNK_LABELS = [
  'Design System + Navigation Shell + Screens 1–4',
  'Screens 5–9',
  'Screens 10–end',
  'JavaScript + Complete HTML Assembly',
];

function getStyleInstruction(style) {
  const cfg = STYLE_CONFIGS[style];
  if (!cfg || !cfg.cssVars) {
    return `Choose a color palette that fits the domain described in the spec.
- Government / legal / municipal → navy sidebar (#1e3a5f), white main area, blue primary
- Healthcare → teal/green sidebar, clean white cards
- Finance / banking → dark navy or dark gray, gold/green accents
- HR / operations → purple or indigo, clean white
- Tech / SaaS → dark modern (dark bg, indigo/purple accent)
Use the CSS variable structure below but fill in the colors yourself based on your choice.
Whatever you choose, commit to it consistently across all screens.`;
  }
  return `Use EXACTLY these CSS custom properties. Do not invent new color values — reference these variables everywhere:
\`\`\`css
:root {${cfg.cssVars}
  /* Spacing — 8px grid */
  --space-1: 8px; --space-2: 16px; --space-3: 24px;
  --space-4: 32px; --space-5: 48px; --space-6: 64px;
  /* Typography */
  --font-family: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-size-xs: 11px; --font-size-sm: 13px; --font-size-base: 14px;
  --font-size-md: 15px; --font-size-lg: 18px; --font-size-xl: 22px;
  --font-size-2xl: 28px;
  --font-weight-normal: 400; --font-weight-medium: 500; --font-weight-semibold: 600; --font-weight-bold: 700;
  --line-height: 1.6;
}
\`\`\``;
}

export function getDesignQueenPrompt(docText, chunkNumber, language, style, previousChunks = null) {
  const styleInstruction = getStyleInstruction(style);
  const styleLabel = STYLE_CONFIGS[style]?.label || 'Auto';
  const isHebrew = language === 'he';

  const langBlock = isHebrew
    ? `OUTPUT LANGUAGE FOR UI TEXT: HEBREW
All labels, button text, menu items, table headers, form labels, screen titles, status values, and mock data must be in Hebrew.
Technical HTML/CSS/JS identifiers (class names, IDs, variable names) remain in English.`
    : `OUTPUT LANGUAGE FOR UI TEXT: ENGLISH
All labels, button text, menu items, table headers, form labels, screen titles, status values, and mock data must be in English.
Technical HTML/CSS/JS identifiers remain in English as well.`;

  const baseContext = `You are a Senior UI/UX Engineer and Visual Designer who produces beautiful, realistic, production-quality HTML mockups.
You receive a product specification document and build a complete, interactive, single-file HTML prototype.
The prototype must look like a real, shipped product — not a wireframe, not a design sketch.

${HARD_RULES}

${'═'.repeat(60)}
DESIGN STYLE: ${styleLabel}
${styleInstruction}

${'═'.repeat(60)}
${langBlock}

${'═'.repeat(60)}
## Source Document:

${docText || 'The source document is attached as a PDF file in this message. Read it in full.'}`;

  if (chunkNumber === 1) {
    return `${baseContext}

${'═'.repeat(60)}
## CHUNK 1 of 4 — ${CHUNK_LABELS[0]}

### Your output MUST contain exactly these sections in this order:

---
### SECTION A — SCREEN MANIFEST
List every screen you will build across all 4 chunks.
Format as an HTML comment at the very top of your output:
\`\`\`
<!-- SCREEN_MANIFEST
  screen-dashboard: לוח בקרה
  screen-[id]: [שם המסך]
  ...
-->
\`\`\`
Be exhaustive — every screen mentioned in the spec must appear here.
Assign screens 1–4 to Chunk 1, screens 5–9 to Chunk 2, screens 10+ to Chunk 3.

---
### SECTION B — COMPLETE CSS DESIGN SYSTEM
Wrap with: <!-- CSS_START --> and <!-- CSS_END -->

Must include:
- :root with all CSS custom properties (from the style config above)
- CSS reset (box-sizing, margin, padding, font)
- Typography scale
- Layout: .app-shell (flex container), .sidebar, .main-content, .header
- RTL-correct sidebar on the RIGHT side
- Navigation list: .nav-item, .nav-item.active, .nav-item:hover, .nav-section-label
- Screen container: .screen (hidden by default: display:none), .screen.active (display:block or flex)
- Card: .card, .card-header, .card-body, .card-footer
- Table: .data-table, thead, tbody tr:hover, th, td
- Badges: .badge, .badge-success, .badge-warning, .badge-danger, .badge-info, .badge-neutral
- Buttons: .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-danger, .btn-sm, .btn-lg
  - All hover and active states
- Forms: .form-group, .form-label, .form-input, .form-select, .form-textarea, .form-hint, .form-error
  - Focus states with var(--color-primary) outline
- Modal: .modal-overlay, .modal, .modal-header, .modal-body, .modal-footer
- Stat card: .stat-card, .stat-value, .stat-label, .stat-icon, .stat-trend (up/down)
- Avatar: .avatar (circle with initials, background color derived from name)
- Breadcrumb: .breadcrumb, .breadcrumb-item
- Tabs: .tabs, .tab, .tab.active, .tab-content, .tab-panel
- Page header: .page-header, .page-title, .page-actions
- Filter bar: .filter-bar, .search-input
- Empty state: .empty-state, .empty-icon, .empty-title, .empty-description
- Progress bar: .progress, .progress-bar
- Alert/notification bar: .alert, .alert-success, .alert-warning, .alert-danger
- Responsive: @media (max-width: 768px) rules for mobile
- Utility classes: .text-muted, .text-success, .text-danger, .fw-semibold, .mt-1 through .mt-4, .gap-2, .flex, .flex-between, .flex-center

---
### SECTION C — APP SHELL + SIDEBAR
Wrap with: <!-- SCREENS_START --> and <!-- SCREENS_END -->

Build the full app shell HTML:
\`\`\`html
<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-header">...</div>
    <nav class="sidebar-nav">
      <!-- one .nav-item per screen from the manifest -->
    </nav>
  </aside>
  <div class="main-area">
    <header class="header">
      <!-- app header with search, notifications, user avatar -->
    </header>
    <main class="main-content">
      <!-- all screen divs go here (Chunks 1–3 will fill this) -->
    </main>
  </div>
</div>
<!-- MOBILE SIDEBAR TOGGLE button -->
\`\`\`

Then immediately build screens 1–4 inside <!-- SCREENS_START --> ... <!-- SCREENS_END -->:
Each screen is: <div class="screen" id="screen-[id]" data-title="[Hebrew title]">

**Screen requirements:**
- Dashboard (screen 1): stat cards (4 KPIs), a table preview, a chart (CSS-only bar chart), recent activity list
- Main list screen (screen 2): full data table with search/filter bar, action buttons per row, status badges
- Detail/view screen (screen 3): side-by-side info panels, related data sections, action buttons
- One more screen relevant to the spec (screen 4)

Every screen must have a .page-header with breadcrumb + page title + action buttons.
Tables must have real Hebrew mock data (min 6 rows).
No empty white space — every section has content.`;
  }

  if (chunkNumber === 2) {
    const ctx = previousChunks || '[Chunk 1 output will appear here]';
    return `${baseContext}

${'═'.repeat(60)}
## CHUNK 2 of 4 — ${CHUNK_LABELS[1]}

### Context: Output from Chunk 1
${ctx}

${'═'.repeat(60)}
### Your task:
Build screens 5–9 from the SCREEN_MANIFEST defined in Chunk 1.

Output ONLY the screen HTML divs. No <style> block. No JavaScript. No <html> wrapper.
Wrap your entire output with: <!-- SCREENS_START --> and <!-- SCREENS_END -->

For each screen:
\`\`\`html
<div class="screen" id="screen-[id]" data-title="[title]">
  <div class="page-header">
    <div class="breadcrumb">...</div>
    <h1 class="page-title">[title]</h1>
    <div class="page-actions">...</div>
  </div>
  <!-- screen content -->
</div>
\`\`\`

**Screen content requirements:**
- Forms must have all fields from the spec, properly grouped, with realistic placeholder values
- Management screens must have search, filters, and a data table with real Hebrew mock data
- Report screens: CSS-only charts (bar charts using div widths), summary cards, data tables
- Settings screens: grouped sections, toggle switches, save buttons
- Use the SAME CSS class names from Chunk 1 — do not invent new styles
- Every screen must look complete — no blank areas, no TBD sections

Use realistic Hebrew data in every table and form.
Include at least one modal trigger per screen where it makes sense (edit, delete confirmation, detail view).`;
  }

  if (chunkNumber === 3) {
    const ctx = previousChunks || '[Chunks 1–2 output will appear here]';
    return `${baseContext}

${'═'.repeat(60)}
## CHUNK 3 of 4 — ${CHUNK_LABELS[2]}

### Context: Output from Chunks 1 + 2
${ctx}

${'═'.repeat(60)}
### Your task:
Build ALL remaining screens (10 onward) from the SCREEN_MANIFEST.
If the manifest has fewer than 10 screens total, ensure every remaining screen is covered here.

Output ONLY the screen HTML divs.
Wrap with: <!-- SCREENS_START --> and <!-- SCREENS_END -->

Same requirements as Chunk 2.

Additionally, in this chunk build:
- Any modal HTML that is shared across screens (wrapped as hidden divs at the end):
  <div class="modal-overlay" id="modal-[name]" style="display:none">
    <div class="modal">...</div>
  </div>
- Notification/toast container: <div id="toast-container" class="toast-container"></div>

Use realistic Hebrew data. All screens must look complete and production-ready.`;
  }

  if (chunkNumber === 4) {
    const ctx = previousChunks || '[Chunks 1–3 output will appear here]';
    return `${baseContext}

${'═'.repeat(60)}
## CHUNK 4 of 4 — ${CHUNK_LABELS[3]}

### Context: Complete output from Chunks 1, 2, and 3:
${ctx}

${'═'.repeat(60)}
### Your task:
Assemble everything into a single, complete, working HTML file.

**CRITICAL**: Your entire output must be ONE complete HTML file starting with \`<!DOCTYPE html>\` and ending with \`</html>\`.
Do NOT wrap it in a markdown code block. Do NOT add explanatory text before or after. Just the HTML file.

**Assembly instructions:**

1. Extract the <!-- CSS_START --> ... <!-- CSS_END --> block from Chunk 1 → put inside <style>
2. Extract ALL <!-- SCREENS_START --> ... <!-- SCREENS_END --> blocks from Chunks 1, 2, 3 → place inside the app shell's <main class="main-content">
3. Add modals and toast containers (from Chunk 3) AFTER the main content, before </body>
4. Add the complete JavaScript block before </body>

**JavaScript MUST implement:**

\`\`\`javascript
// 1. SCREEN NAVIGATION
// Read hash from URL, show matching screen, hide others, highlight active nav item
// On hashchange event, update active screen
// Default to first screen if no hash

// 2. SIDEBAR TOGGLE (mobile)
// Toggle .sidebar-open class on .app-shell

// 3. MODAL MANAGEMENT
// openModal(modalId) — show overlay
// closeModal(modalId) — hide overlay
// Click outside modal → close
// Escape key → close

// 4. DROPDOWN MENUS
// Toggle visibility on button click
// Close on outside click

// 5. DATA TABLE SEARCH/FILTER
// For each .filter-bar input, filter rows in the associated .data-table
// Case-insensitive, searches all columns

// 6. TABS WITHIN SCREENS
// Click .tab → activate tab panel, deactivate others

// 7. TOAST NOTIFICATIONS
// showToast(message, type) → append toast, auto-remove after 3s
// Types: success, error, warning, info

// 8. FORM INTERACTIONS
// On .btn-primary click in a form → show success toast, reset form
// Prevent default submit

// 9. CONFIRMATION DIALOGS
// Elements with data-confirm="..." → open confirmation modal before action

// 10. SORTABLE TABLE HEADERS
// Click <th> → sort table rows ascending/descending
// Show sort indicator (▲/▼)
\`\`\`

**Final checks before outputting:**
- [ ] All screens from the SCREEN_MANIFEST are present as <div class="screen" id="screen-...">
- [ ] Sidebar nav has a link for every screen (href="#screen-[id]")
- [ ] Navigation JavaScript correctly shows/hides screens
- [ ] dir="rtl" on <html>
- [ ] No external URLs in <link>, <script src>, <img src> (except data: URIs)
- [ ] File is complete — no truncation, no "// ... rest of code"

Output the COMPLETE HTML file. Start immediately with <!DOCTYPE html>. No preamble.`;
  }

  throw new Error(`Invalid chunk number: ${chunkNumber}`);
}
