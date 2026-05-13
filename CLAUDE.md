# CLAUDE.md — Project Overview

## What this project is

**אגם הסוכנים** — a Hebrew-language, fully client-side AI agent platform for software specification. No server, no build step. All processing runs in the browser against the Gemini API directly.

The core product is two linked tools:
- **מלך האפיונים** ("Spec King") — generates full functional spec documents (FSD) from user requirements via 4 sequential Gemini API calls
- **מציג האפיונים** ("Spec Viewer") — renders the spec output in 4 tabs: Markdown document, Excel tables, Mermaid diagrams, HTML wireframes

---

## Architecture

**Pure vanilla JS ES modules. No framework, no bundler, no npm.**

All pages are standalone HTML files that import JS via `<script type="module">`. The sidebar/header is injected by `nav.js` into every page at runtime via DOM manipulation.

### Data flow: Spec King → Spec Viewer
1. User fills in project details in `modals/spec-king-modal.js` (rendered inside `agent.html?id=spec-king`)
2. Modal makes 4 API calls, streaming output into a single spec object
3. Spec object is written to `localStorage('spec-viewer-data')` and a `BroadcastChannel('spec-viewer')` message is sent
4. `spec-viewer.html` reads localStorage on load (or listens for broadcast if already open)
5. Spec viewer renders: markdown→marked.js, tables→xlsx.js, diagrams→mermaid.js v10, screens→iframe srcdoc

### State storage
- Gemini API key: `localStorage('gemini-api-key')`
- Spec data: `localStorage('spec-viewer-data')` — JSON with `{ meta, markdown, tables, mermaidDiagrams, screens }`
- Dark mode / font size: `localStorage('sdlc-dark-mode')`, `localStorage('sdlc-font-size')`

---

## Important files

| File | Purpose |
|------|---------|
| `index.html` | Home page — entry point, shows 2 cards (Spec King + Spec Viewer) |
| `agent.html` | Shared chat UI for all agents; loads config from `agents-config.js` |
| `spec-viewer.html` | Spec viewer — 4-tab layout, self-contained, no external deps beyond CDN |
| `nav.js` | Injects sidebar + header into every page. Sidebar shows: מלך האפיונים, מציג האפיונים, פיתוח תוכנה |
| `styles.css` | Global dark-mode-first CSS (CSS variables, sidebar, agent cards) |
| `agent-chat.js` | Chat logic: chunking long files, auto-download long responses, model fallback |
| `agents-config.js` | System prompts + starter suggestions for all agents |
| `modals/spec-king-modal.js` | Spec King generation UI — chapter/section selection, 4-chunk generation, localStorage write |
| `spec-king/index.js` | Assembles all chapters into final prompt |
| `spec-king/ch1-background.js` | Chapter 1: background & business context |
| `spec-king/ch2-requirements.js` | Chapter 2: functional & non-functional requirements |
| `spec-king/ch3-model.js` | Chapter 3: data model (ERD), business rules, permissions, flows, integrations |
| `spec-king/ch4-ux.js` | Chapter 4: personas, journeys, user stories, screens + HTML wireframes |
| `spec-king/ch5-architecture.js` | Chapter 5: architecture |
| `spec-king/ch6-testing.js` | Chapter 6: test plan |
| `sf-agent.html` | Salesforce Killer — separate agent for SF org TSD generation |
| `SDLCMindMap.html` | Interactive SDLC mind-map ("פיתוח תוכנה") |

---

## Key constraints

- **Never delete JS files** — even hidden agents must keep their JS. Only hide from UI.
- **RTL Hebrew UI** — all user-facing text is Hebrew, `dir="rtl"`, Heebo font
- **No external state** — everything is localStorage + BroadcastChannel
- **Mermaid v10 programmatic API** — use `mermaid.render(id, code)` returning `{ svg }`, never `startOnLoad`
- **marked.js v5+ token API** — `renderer.code` receives a token object `{ text, lang }`, not `(string, lang)`
- The spec viewer's document tab uses two independent scroll columns (TOC + content), with `html, body { overflow: hidden }` to prevent page-level scroll

---

## Gemini model fallback chain

```
gemini-2.5-flash  →  gemini-2.5-flash-preview-04-17  →  gemini-2.5-flash-lite
```

Each generator retries with the next model on quota errors, continuing from the same chunk without restarting.

---

## Branch

Active development branch: `claude/consolidate-agents-refactor-VT2EX`
Target: `main`
