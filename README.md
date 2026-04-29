# SF Architect Agent — משרד התחבורה

A static, client-side web app that acts as a **stateful Salesforce Solution Architect**. It accepts a Hebrew Functional Specification Document (FSD) together with the current org state snapshot and in-flight specs, then produces a complete 8-file architectural TSD — including a critical impact analysis with REUSE/EXTEND/CREATE classification, conflict detection, and ADRs.

## What Makes This Different From a Plain TSD Generator

A standard TSD generator treats every spec as greenfield. This agent is **stateful**:

- It reads the current production org state (objects, fields, flows, permissions, integrations)
- It reads in-flight specs (approved but not yet deployed)
- For every FSD requirement it decides: ✅ REUSE · 🔧 EXTEND · 🆕 CREATE · ⚠ CONFLICT
- It surfaces conflicts and architectural risks **before** proposing a design
- It documents every non-trivial choice as an ADR

## Usage

1. Open `index.html` in a modern browser (Chrome, Firefox, Edge) — or visit the GitHub Pages URL.
2. Paste your **Gemini API key**.
3. *(Recommended)* Expand **"מצב ארגון נוכחי"** and paste the JSON state snapshot of the current org. Without this the agent designs as greenfield and marks every structural assumption with `⚠ NO-STATE`.
4. *(Optional)* Expand **"אפיונים בתהליך"** and describe specs currently in build/design.
5. Select your `.docx` or `.pdf` FSD file.
6. Click **⚡ צור TSD ארכיטקטוני**.
7. When all 3 chunks complete, click **⬇ הורד TSD** to download a single combined Markdown file.

> No build step, no npm, no server required.

## Output Files (Combined Into One MD)

| File | Content |
|------|---------|
| `00_executive_summary` | Business context, solution approach, key decisions, risks (~1 page) |
| `01_objects` | Per-object REUSE/EXTEND/CREATE classification, OWD, record types |
| `02_fields` | Per-field spec: API name (Hebrew), type, formula, FLS, RTL, business logic |
| `03_automations` | Flows, Apex, Approval Processes, Validation Rules — with declarative justification |
| `04_permissions` | Permission Sets (new/extended), sharing rules, FLS matrix |
| `05_layouts` | Page Layouts, Lightning Pages, LWC, RTL considerations |
| `06_integrations` | Named Credentials, callout patterns, error handling |
| `07_impact_analysis` | **The critical file** — reuse table, conflict table, components touched/not touched, ADRs, open questions, risk summary |

## Org State Snapshot Format

Paste a JSON object with any subset of these keys:

```json
{
  "objects": [
    { "api_name": "רישיון_רכב__c", "label": "רישיון רכב", "owd": "Private", "domain": "permits" }
  ],
  "fields": [
    { "object": "רישיון_רכב__c", "api_name": "תאריך_פקיעה__c", "type": "Date", "required": false }
  ],
  "automations": [
    { "type": "Flow", "api_name": "VehiclePermit_BeforeSave_CalculateSLA", "active": true }
  ],
  "permissions": [
    { "type": "Permission Set", "api_name": "PS_Permits_Manager" }
  ],
  "integrations": [
    { "type": "Named Credential", "api_name": "NC_Police_API" }
  ],
  "in_flight": [
    { "spec_name": "Permit_Renewal_Phase2", "status": "in-build", "objects_affected": ["רישיון_רכב__c"] }
  ]
}
```

Empty or missing sections are fine — the agent notes "Greenfield — no existing components" and continues.

## Naming Conventions (Enforced by the Agent)

| Component | Convention | Example |
|-----------|-----------|---------|
| Objects | Hebrew words + underscores + `__c` | `רישיון_רכב__c` |
| Fields | Hebrew words + underscores + `__c` | `תאריך_פקיעה__c` |
| Flows | `{Object}_{Trigger}_{Purpose}` (English) | `VehiclePermit_BeforeSave_CalculateSLA` |
| Validation Rules | `VR_{Object}_{Purpose}` | `VR_VehiclePermit_RequireExpiryDate` |
| Permission Sets | `PS_{Role}_{Scope}` | `PS_Permits_Manager` |
| Named Credentials | `NC_{SystemName}` | `NC_Police_API` |
| Apex Classes | `{Object}Service`, `{Object}TriggerHandler` | `VehiclePermitService` |

## Architecture Decisions Recorded (ADR Format)

Every non-trivial architectural choice is documented in `07_impact_analysis` as:

```
### ADR-YYYY-MM-DD-NNN: Title
- Context:
- Decision:
- Rationale:
- Alternatives considered:
- Consequences:
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell — API key input, state/in-flight textareas, file upload |
| `styles.css` | Styling (no framework) |
| `app.js` | File extraction, Gemini API calls, chunk orchestration, UI logic |
| `prompt.js` | Full SF Architect Agent system prompt + 3-chunk section factory |
| `tsd-to-salesforce/` | Separate Next.js app — takes a TSD and generates Salesforce metadata |

## Libraries (CDN, no npm)

- [mammoth.js](https://github.com/mwilliamson/mammoth.js) — `.docx` → plain text
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF → plain text

## Gemini API

- **Model:** `gemini-2.5-flash`
- **Max output tokens per call:** 65,000
- **Auth:** API key as query parameter — stored in memory only, never persisted

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| No API key or file | Hebrew validation message |
| No org state provided | Hebrew warning — agent proceeds with `⚠ NO-STATE` markers |
| Network error | Hebrew error with details |
| Non-2xx API response | Hebrew error with HTTP status and Gemini message |
| `finish_reason = MAX_TOKENS` | Hebrew warning (output kept, may be incomplete) |
| Chunk failure | Hebrew error + Retry button — completed chunks preserved |

## Security Notes

- The Gemini API key is stored only in a JavaScript variable for the session — never written to `localStorage`, `sessionStorage`, cookies, or any log.
- All processing is client-side. The only outbound request is directly to the Gemini API.
- Org state pasted into the textarea is never sent anywhere except to Gemini as part of the prompt.
