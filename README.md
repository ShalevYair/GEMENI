# Hebrew FSD → Salesforce TSD Converter

A static, client-side web app that converts a Hebrew Functional Specification Document (FSD) into a complete Salesforce Technical Specification Document (TSD) in English, delivered as a downloadable Markdown file.

## Features

- Upload a Hebrew FSD as a Word (`.docx`) or PDF file
- Extracts text entirely in-browser (no server, no data upload except to Gemini)
- Sends the FSD to Gemini 2.5 Pro in **3 sequential chunks**, each covering a distinct set of TSD sections
- Assembles all 19 TSD sections into a single `.md` file for download
- Progress bar shows which chunk is being processed
- Error messages in Hebrew; retry individual failed chunks without restarting
- Warns in Hebrew if a response was truncated due to token limits
- Gemini API key is held in memory only — never persisted or logged

## Usage

1. Open `index.html` in a modern browser (Chrome, Firefox, Edge).
2. Paste your Gemini API key into the key field.
3. Select your `.docx` or `.pdf` FSD file.
4. Click **צור TSD**.
5. When all 3 chunks complete, click **הורד TSD.md**.

> No build step, no npm, no server required.

## TSD Sections Generated

| Chunk | Sections |
|-------|----------|
| 1 | Document Control, Executive Summary, Scope, Solution Overview, Architecture Diagram (Mermaid), Data Model |
| 2 | Security Model, Automation Design, User Interface, Reports & Dashboards, Integration Design, Data Migration |
| 3 | Testing Strategy, Deployment & Environment Strategy, Non-Functional Requirements, License Requirements, Governor Limits Impact Analysis, Gaps & Risks, Appendices |

## Files

| File | Purpose |
|------|---------|
| `index.html` | Application shell and UI |
| `styles.css` | All styling (no framework) |
| `app.js` | File extraction, Gemini API calls, chunk orchestration, UI logic |
| `prompt.js` | `SYSTEM_PROMPT_BASE` constant and `getSectionPrompt(fsdText, chunkNumber)` factory |
| `README.md` | This file |

## Libraries (CDN, no npm)

- [mammoth.js](https://github.com/mwilliamson/mammoth.js) — `.docx` → plain text
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF → plain text

## Gemini API

- **Model:** `gemini-2.5-pro`
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
- **Auth:** API key as query parameter
- **Max output tokens per call:** 65,000

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Missing API key or file | Hebrew validation message |
| Network error | Hebrew error with details |
| Non-2xx API response | Hebrew error with HTTP status and message |
| `finish_reason = MAX_TOKENS` | Hebrew warning (output kept, may be incomplete) |
| Chunk failure | Hebrew error showing which chunk failed + Retry button |
| Retry | Resumes from failed chunk; completed chunks are preserved |

## Security Notes

- The Gemini API key is stored only in a JavaScript variable for the duration of the session and is never written to `localStorage`, `sessionStorage`, cookies, or any log.
- All processing happens client-side. The only outbound request is directly to the Gemini API.
