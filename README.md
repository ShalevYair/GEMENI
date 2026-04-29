# SF Architect Agent — משרד התחבורה

A static, client-side web app that acts as a **stateful Salesforce Solution Architect**. It accepts a Hebrew Functional Specification Document (FSD), the current org state (`deployed.json`), and approved-but-not-yet-deployed work (`in-flight.json`), then produces a complete 8-file architectural TSD plus an updated `in-flight.json` for the next session.

## What Makes This Different

A standard TSD generator treats every spec as greenfield. This agent is **stateful**:

- Reads the current production state (objects, fields, flows, permissions, integrations, layouts)
- Reads in-flight specs (approved but not yet deployed)
- For every FSD requirement classifies: ✅ REUSE · 🔧 EXTEND · 🆕 CREATE · ⚠ CONFLICT
- Surfaces conflicts and architectural risks **before** proposing a design
- Documents every non-trivial choice as an ADR
- Outputs an updated `in-flight.json` so the next session sees this spec's components

## Architecture in One Picture

```
┌──────────────────────┐    ┌────────────────────────┐
│  deployed.json       │───▶│                        │
│  (from SF, via       │    │   SF Architect Agent   │───▶ TSD (8 files)
│   Claude Desktop +   │    │   (Gemini 2.5 Flash)   │───▶ in-flight-updated.json
│   SF MCP)            │    │                        │
└──────────────────────┘    │                        │
┌──────────────────────┐    │                        │
│  in-flight.json      │───▶│                        │
│  (output of last run)│    │                        │
└──────────────────────┘    │                        │
┌──────────────────────┐    │                        │
│  FSD (.docx / .pdf)  │───▶│                        │
└──────────────────────┘    └────────────────────────┘
```

## Usage

1. Open `index.html` in a modern browser (or visit GitHub Pages URL).
2. **Step 1** — Drop your `deployed.json`. Don't have one? Click **"הפק deployed.json דרך Claude Desktop"** to copy a ready-made prompt for Claude Desktop with SF MCP that will produce the file for you.
3. **Step 2** — Drop your `in-flight.json` (from a previous run, or download from the Admin screen).
4. **Step 3** — Drop your FSD (`.docx` or `.pdf`).
5. **Step 4** — Click **⚡ צור TSD ארכיטקטוני**. You'll be asked for a Gemini API key (free at [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)).
6. When done — download the TSD and the updated `in-flight.json`.

## Output Files (combined into one MD)

| File | Content |
|------|---------|
| `00_executive_summary` | Business context, approach, key decisions, top 3 risks |
| `01_objects` | Per-object: REUSE/EXTEND/CREATE/CONFLICT, OWD, record types |
| `02_fields` | Per-field: API name (Hebrew), type, formula, FLS, RTL, business logic |
| `03_automations` | Flows, Apex, Approval Processes, Validation Rules + declarative justification |
| `04_permissions` | Permission Sets (new/extended), sharing rules, FLS matrix |
| `05_layouts` | Page Layouts, Lightning Pages, LWC, RTL considerations |
| `06_integrations` | Named Credentials, callout patterns, error handling |
| `07_impact_analysis` | **The critical file** — reuse, conflicts, ADRs, open questions, risks |

Plus a separate downloadable `in-flight-updated.json` for the next session.

## State File Schema

Both `deployed.json` and `in-flight.json` share the same JSON schema (see [`schema/state-schema.json`](schema/state-schema.json)). Sections: `objects`, `fields`, `automations`, `permissions`, `integrations`, `layouts`.

`in-flight.json` items additionally carry:
- `spec_origin` — name of the spec that introduced this item
- `status` — `approved` or `in-build`

**Precedence rule:** if the same `api_name` appears in both files, the in-flight version wins (it's the most recent design intent).

## Naming Conventions (enforced by the agent)

| Component | Convention | Example |
|-----------|-----------|---------|
| Objects | Hebrew + `__c` | `רישיון_רכב__c` |
| Fields | Hebrew + `__c` | `תאריך_פקיעה__c` |
| Flows | English `{Object}_{Trigger}_{Purpose}` | `VehiclePermit_BeforeSave_CalculateSLA` |
| Validation Rules | `VR_{Object}_{Purpose}` | `VR_VehiclePermit_RequireExpiry` |
| Permission Sets | `PS_{Role}_{Scope}` | `PS_Permits_Manager` |
| Named Credentials | `NC_{SystemName}` | `NC_Police_API` |
| Apex Classes | `{Object}Service` | `VehiclePermitService` |

## Admin Screen

`admin.html` — separate page protected by an email gate (`shalevya@mot.gov.il` for now). Shows aggregated approved specs, all designed objects/fields/automations across all sessions, and lets you export a merged `in-flight.json`.

Storage: **localStorage on the browser** (will move to organizational git later — auth and storage will both be upgraded then).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main app — file uploads, generation flow |
| `admin.html` / `admin.js` | Admin screen for approved specs |
| `app.js` | File handling, Gemini calls, chunk orchestration, history save |
| `prompt.js` | SF Architect Agent system prompt + 3-chunk factory |
| `styles.css` | Styling |
| `schema/state-schema.json` | JSON Schema reference for both state files |
| `prompts/extract-deployed-state.md` | Prompt for Claude Desktop to produce `deployed.json` |
| `tsd-to-salesforce/` | Separate Next.js app — TSD → SF metadata (next phase) |

## Libraries (CDN, no npm)

- [mammoth.js](https://github.com/mwilliamson/mammoth.js) — `.docx` → text
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF → text
- [Heebo](https://fonts.google.com/specimen/Heebo) — Hebrew-friendly typography

## Gemini API

- **Model:** `gemini-2.5-flash`
- **Max output tokens per call:** 65,000
- **Auth:** API key as query parameter — stored in memory only, never persisted

## Security & Privacy

- Gemini API key lives in a JS variable for the session — never in `localStorage`, `sessionStorage`, cookies, or logs.
- All processing is client-side. Only outbound request: directly to the Gemini API.
- State JSONs are read into memory and sent to Gemini only as part of the prompt.
- Admin screen uses localStorage on the user's browser only — no server, no sync.

## Roadmap

- [ ] Move admin storage from localStorage to organizational git
- [ ] Real Google OAuth on the admin screen
- [ ] Snapshot Builder (automated `deployed.json` refresh on a schedule)
- [ ] Cross-session deduplication when the same component is approved twice
