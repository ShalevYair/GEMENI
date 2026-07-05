# CLAUDE.md — Project Overview

## What this project is

**אגם הסוכנים** — a Hebrew-language, fully client-side AI agent platform for software specification and SDLC management. No server, no build step. All processing runs in the browser against the Gemini API directly.

There are **24 agents** total, accessible via `agent.html?id=<agent-id>` (or dedicated pages for Salesforce Killer and the SDLC mind-map).

---

## Architecture

**Pure vanilla JS ES modules. No framework, no bundler, no npm.**

All pages are standalone HTML files that import JS via `<script type="module">`. The sidebar/header is injected by `nav.js` into every page at runtime via DOM manipulation.

### Core files

| File | Purpose |
|------|---------|
| `index.html` | Home page — grid of all agent cards |
| `agent.html` | Shared chat UI for all agents; loads config from `agents-config.js` by `?id=` param |
| `spec-viewer.html` | Spec viewer — 4-tab layout (Markdown, Excel, Mermaid, Screens) |
| `sf-agent.html` | Salesforce Killer — separate chat page |
| `SDLCMindMap.html` | Interactive SDLC mind-map |
| `natural-mindmap.html` | NATURAL "מבט על" — standalone horizontal (top-down) mind-map of an analyzed code file, with embedded chat; no sidebar (not wrapped by `nav.js`) |
| `nav.js` | Injects sidebar + header into every page at runtime |
| `styles.css` | Global dark-mode-first CSS (CSS variables, sidebar, agent cards) |
| `agent-chat.js` | Chat logic: file reading, chunking, auto-download, model fallback, modal init |
| `agents-config.js` | System prompts, icons, descriptions, suggestions for all 24 agents |

---

## All Agents (24)

| ID | Icon | Name | Has Modal | Modal File |
|----|------|------|-----------|-----------|
| `spec-king` | 👑 | מלך האפיונים | ✅ | `spec-king-modal.js` |
| `spec-viewer` | 📋 | מציג האפיונים | — | standalone page |
| `shraga` | 🧠 | שרגא | ✅ | `shraga-modal.js` |
| `briefer` | 📋 | בריפר | ✅ | `briefer-modal.js` |
| `requirements` | 📋 | אוסף הדרישות | ✅ | `requirements-modal.js` |
| `project-manager` | 📊 | מנהל הפרויקט | — | — |
| `project-coordinator` | 🗂️ | רכזת הפרויקטים | — | — |
| `software-architect` | 🏗️ | ארכיטקט התוכנה | ✅ | `architect-modal.js` |
| `platform-architect` | ⚙️ | ארכיטקט הפלטפורמות | ✅ | `platform-modal.js` |
| `design-queen` | 🎨 | מלכת העיצובים | ✅ | `design-queen-modal.js` |
| `dev-champ` | 💻 | אלוף הפיתוחים | — | — |
| `storyteller` | 📖 | מספר הסיפורים | ✅ | `storyteller-modal.js` |
| `tester` | 🔍 | הבודק | — | — |
| `security` | 🔒 | המאבטח | — | — |
| `tender-writer` | 📝 | כותב המכרזים | — | — |
| `natural` | 🖥️ | NATURAL | ✅ | `natural-modal.js` |
| `summarizer` | 📝 | המסכם | ✅ | `summarizer-modal.js` |
| `ui-explorer` | 🔬 | חוקר ממשק המשתמש | ✅ | `ui-explorer-modal.js` |
| `json-gen` | { } | הטכנולוג | ✅ | `json-modal.js` |
| `dynamic` | 🔮 | סוכן דינמי | ✅ | `dynamic-modal.js` |
| `outsystems` | 🔷 | OutSystems Expert | ✅ | `outsystems-modal.js` |
| `salesforce` | ⚡ | Salesforce Killer | — | standalone `sf-agent.html` |
| `mindmap` | 🗺 | פיתוח תוכנה | — | standalone `SDLCMindMap.html` |

---

## Modal System

The modal system is the core pattern for agents that do more than a simple chat:

1. Each modal is a **separate ES module** in `modals/`
2. `modals/deps.js` is a shared registry populated by `agent-chat.js` at startup — it holds references to `appendMessage`, `callGeminiForSpec`, `getApiKey`, `MODEL_CHAIN`, etc. This prevents circular dependencies.
3. Every modal exports `initXxxModal()` — called in `agent-chat.js` during `DOMContentLoaded`
4. Modals inject their HTML into the DOM dynamically (not pre-rendered in HTML)
5. Modals call `deps.callGeminiForSpec(prompt, modelIdx, inlineFile)` for API calls

Adding a new modal: create the file, export `initXxxModal`, import it in `agent-chat.js`, add `if (agentId === 'xxx') initXxxModal()`, and add the trigger button in `renderEmptyState()`.

---

## Data Flow: Spec King → Spec Viewer

1. User fills in project details in `modals/spec-king-modal.js`
2. Modal makes up to 6 API calls (one per chapter), streaming progress into UI
3. Spec object is written to `localStorage('spec-viewer-data')` as JSON: `{ meta, markdown, tables, mermaidDiagrams, screens }`
4. A `BroadcastChannel('spec-viewer')` message is sent
5. `spec-viewer.html` reads localStorage on load (or listens for broadcast if already open)

---

## Data Flow: שרגא (Two-Phase Analysis)

1. User uploads up to 20 files (DOCX/DOC/TXT/MD/PDF/XLS/XLSX) and optionally writes context
2. **Call 1 — Calibration:** reads all content, produces JSON `{ understanding, internalPrompt, numExecutionCalls (1–4), workPlan, questions }`
3. **Calls 2–5 — Execution:** for each section in `workPlan`, one API call with the section-specific prompt and the internal prompt as base context
4. All sections assembled into a Word-compatible HTML document and downloaded as `.doc`

---

## Spec King Folder (`spec-king/`)

| File | Purpose |
|------|---------|
| `index.js` | Assembles all chapters into final prompts; manages flavors (Salesforce, OutSystems, generic) |
| `base-rules.js` | Universal FSD writing rules (format, structure, style) |
| `ch1-background.js` | Chapter 1: background & business context |
| `ch2-requirements.js` | Chapter 2: functional & non-functional requirements |
| `ch3-model.js` | Chapter 3: data model (ERD), business rules, permissions, flows, integrations |
| `ch4-ux.js` | Chapter 4: personas, journeys, user stories, screens + HTML wireframes |
| `ch5-architecture.js` | Chapter 5: system architecture, deployment, scaling, security |
| `ch6-testing.js` | Chapter 6: test plan, scenarios, UAT |
| `flavor-salesforce.js` | Salesforce-specific additions (objects, Apex, Lightning) |
| `flavor-outsystems.js` | OutSystems-specific additions (O11 vs ODC, module structure) |
| `clarification.js` | Pre-spec clarification questions generator |

Each chapter exports `CH{N}_LABEL`, `CH{N}_SECTIONS`, and `CH{N}_ITEMS` — used by the modal's chapter/section selector UI.

---

## File Reading

`agent-chat.js: readFile(file)` handles:

| Extension | Method |
|-----------|--------|
| `.docx` | mammoth.js → plain text |
| `.txt`, `.csv`, `.json`, `.md` | `file.text()` |
| `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | FileReader base64 → inline data |

`modals/shraga-modal.js: readShragaFile(file)` additionally handles:

| Extension | Method |
|-----------|--------|
| `.xls`, `.xlsx` | XLSX.read() → CSV text |
| `.doc` | binary read → printable ASCII (partial, lossy) |

**Large file strategy:** plain text files > 50,000 chars are split into 50K chunks via `sendChunked()`. Each chunk is processed independently via `callGeminiOnceWithFallback()`, results joined with `---`.

---

## State Storage

| Key | Type | Purpose |
|-----|------|---------|
| `gemini_api_key` | String | Gemini API key — shared across all agents |
| `spec-viewer-data` | JSON | Full spec output: `{ meta, markdown, tables, mermaidDiagrams, screens }` |
| `sdlc-dark-mode` | `'light'` \| `'dark'` | Theme preference |
| `sdlc-font-size` | Number (default 16) | Global font size in px |

---

## Gemini API Patterns

**Standard conversational call (most agents):**
```js
POST /v1beta/models/{model}:generateContent?key={API_KEY}
{
  system_instruction: { parts: [{ text: agent.systemPrompt }] },
  contents: [ ...chatHistory, { role: 'user', parts: userParts } ],
  generationConfig: { maxOutputTokens: 65000, temperature: 0.2 }
}
```

**Single-shot call (generators, no history update):**
```js
callGeminiForSpec(promptText, modelIdx, inlineFile?)
```
Includes auto-continuation: if `finishReason === 'MAX_TOKENS'`, automatically continues the conversation up to 3 times by sending "continue from where you stopped."

**Chunked call (large files):**
```js
sendChunked(userText, file, typingId)
// Splits file.text into 50K chunks, calls callGeminiOnceWithFallback() per chunk
```

---

## Gemini Model Fallback Chain

```
gemini-2.5-flash  →  gemini-3-flash-preview  →  gemini-2.5-flash-lite
```

- Quota errors → increment `modelIdx`, retry same request, show "Switching to X..." message
- 429 overload → 15-second countdown, retry, "Retry now" button
- All models exhausted → show link to rate-limit page

For generators (modals), fallback is handled inside `callWithFallback()` in each modal, using `deps.setModelIdx()` to keep the header in sync.

---

## Key Constraints

- **Never delete JS files** — even hidden agents must keep their JS. Only hide from UI.
- **RTL Hebrew UI** — all user-facing text is Hebrew, `dir="rtl"`, Heebo font
- **No external state** — everything is localStorage + BroadcastChannel
- **Mermaid v10 programmatic API** — use `mermaid.render(id, code)` returning `{ svg }`, never `startOnLoad`
- **marked.js v5+ token API** — `renderer.code` receives a token object `{ text, lang }`, not `(code, lang, escaped)`
- The spec viewer's document tab uses two independent scroll columns (TOC + content), with `html, body { overflow: hidden }` to prevent page-level scroll
- Word output (שרגא, requirements) uses HTML-as-DOC: `Blob(['﻿', htmlString], { type: 'application/msword' })` downloaded as `.doc`
- Max file size: 10MB per file in standard chat

---

## nav.js: Adding a New Agent

1. Add agent ID to `CHAT_AGENT_IDS` set
2. Add entry to `NAV_ITEMS` array (with `id`, `name`, `icon`, `href`)
3. Add agent config to `agents-config.js`
4. If it has a modal: import in `agent-chat.js`, add `if (agentId === 'xxx') initXxxModal()`, add chip button in `renderEmptyState()`
5. Add card to `index.html`

---

## Output Formats by Agent

| Agent | Output |
|-------|--------|
| מלך האפיונים | `.md` + `.xlsx` + `.html` (Mermaid) + `.html` (wireframes) |
| שרגא | `.doc` (Word-compatible HTML, RTL) |
| המסכם | `.xlsx` (hierarchical summary) |
| אוסף הדרישות | `.md` or `.doc` |
| NATURAL — ניתוח מלא/מיגרציה/כתיבה מחדש/שינוי קוד | `.md` + `.xlsx` + optional `.drawio` (spec-viewer) |
| NATURAL — פירוט שורה-שורה | `.doc` (Word-compatible HTML, RTL) |
| NATURAL — מבט על | `.xlsx` + live mind-map page (`natural-mindmap.html`) with embedded chat |
| Most chat agents | inline (auto-download `.md` if > 8,000 chars) |
