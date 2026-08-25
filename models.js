// ── Gemini model registry — single source of truth ────────────────────────
// Every agent in the app resolves its model through this file. Before it
// existed the model ID was hardcoded in agent-chat.js, app.js and each
// standalone mind-map chat, so a model deprecation meant hunting down nine
// separate string literals.
//
// Engine choice is global and user-facing: the header selector writes
// `gemini-engine` to localStorage and every agent picks it up on its next
// call. Flash is the default; Pro is opt-in.
//
// Classic (non-module) scripts can't import this file — DSLCchat.js,
// natural-mindmap-chat.js and summarizer-mindmap-chat.js each keep their own
// literal and carry a "keep in sync with models.js" comment.

const ENGINE_KEY = 'gemini-engine';

// Fallback chains, most capable first. A quota or overload error advances one
// step; running past the end of the chain is a hard failure.
//
// gemini-2.5-flash and gemini-2.5-flash-lite were removed here: both are
// deprecated with a shutdown date of 2026-10-16, and there are reports of
// them failing ahead of it. Keeping them as fallback targets meant the
// safety net itself was on a timer.
export const FLASH_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];

// Pro is preview-only and unavailable on the free tier, so its chain drops
// back to Flash rather than dead-ending — a user without billing still gets
// a working run, just not on Pro.
export const PRO_CHAIN = ['gemini-3.1-pro-preview', 'gemini-3.6-flash', 'gemini-3.5-flash'];

export const ENGINES = {
  flash: {
    id:    'flash',
    label: 'מהיר',
    icon:  '⚡',
    desc:  'Flash — מהיר וזול, מתאים לרוב העבודה',
    chain: FLASH_CHAIN,
  },
  pro: {
    id:    'pro',
    label: 'מדויק',
    icon:  '🎯',
    desc:  'Pro — איכות גבוהה יותר, איטי ויקר משמעותית. דורש חשבון עם חיוב מופעל',
    chain: PRO_CHAIN,
  },
};

// ── Thinking level ────────────────────────────────────────────────────────
// Gemini 3 exposes a reasoning budget as an enum. Thinking tokens are billed
// as output and count against maxOutputTokens, so HIGH costs real budget —
// but for spec and tender writing the reasoning quality is the whole point.
export const THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];
export const DEFAULT_THINKING_LEVEL = 'HIGH';

// Calls whose only job is to emit parseable JSON don't benefit from deep
// reasoning and are the ones most likely to break when the model "thinks"
// its way into prose around the payload.
export const JSON_THINKING_LEVEL = 'MEDIUM';

// The exact request shape for thinkingLevel could not be verified against
// primary documentation (see TENDER_WRITER_IMPROVEMENT_PLAN.md, appendix B):
// nested under thinkingConfig is the likely form, matching 2.5's
// thinkingConfig.thinkingBudget. Rather than bet the whole app on it, the
// call sites treat rejection as recoverable — see thinkingUnsupported below.
let thinkingSupported = true;

export function thinkingCfg(level = DEFAULT_THINKING_LEVEL) {
  if (!thinkingSupported || !level) return {};
  return { thinkingConfig: { thinkingLevel: level } };
}

// Called by the API layer when a request is rejected for the thinking field.
// Latches off for the rest of the session so one probe costs one retry, not
// a retry on every subsequent call.
export function markThinkingUnsupported() {
  thinkingSupported = false;
}

export function isThinkingSupported() {
  return thinkingSupported;
}

// An error that names the thinking field means this model or API version
// doesn't accept it — distinct from a quota or overload failure, and cured
// by dropping the field rather than by switching models.
export function isThinkingFieldError(msg) {
  return /thinking(_?level|_?config|_?budget)/i.test(msg || '') &&
         /unknown|invalid|unsupported|not supported|cannot|unrecognized/i.test(msg || '');
}

// ── Engine preference ─────────────────────────────────────────────────────
export function getEngine() {
  try {
    const v = localStorage.getItem(ENGINE_KEY);
    return ENGINES[v] ? v : 'flash';
  } catch {
    return 'flash';
  }
}

export function setEngine(id) {
  if (!ENGINES[id]) return false;
  try { localStorage.setItem(ENGINE_KEY, id); } catch { /* private mode */ }
  return true;
}

// The active chain. Read fresh on every call rather than cached at import
// time, so switching engines in the header takes effect immediately without
// a page reload.
export function getModelChain() {
  return ENGINES[getEngine()].chain;
}

export function isProEngine() {
  return getEngine() === 'pro';
}

// ── Error classification ──────────────────────────────────────────────────
// Pro was removed from the free tier, so a user who pastes a key without
// billing enabled gets a permission failure, not a quota failure. Falling
// back silently to Flash would leave them paying attention to a "מדויק"
// badge while Flash does the work, so this is surfaced rather than swallowed.
export function isBillingRequiredError(msg) {
  const m = msg || '';
  return /billing|not available on the free tier|free tier is not|requires? a paid|PERMISSION_DENIED/i.test(m);
}

// A model ID the API doesn't recognise — the signature of a deprecation that
// landed while the app was pinned to an old chain.
export function isUnknownModelError(msg) {
  const m = msg || '';
  return /is not found|not found for API version|is not supported|no longer available|models\/[\w.-]+ is not/i.test(m);
}

// ── Availability probe ────────────────────────────────────────────────────
// The only trustworthy answer to "which models can this key actually use" is
// the API's own list. Cached for a day so it costs one request, not one per
// page load.
const AVAIL_KEY = 'gemini-models-available';
const AVAIL_TTL_MS = 24 * 60 * 60 * 1000;

export async function fetchAvailableModels(apiKey, { force = false } = {}) {
  if (!apiKey) return null;
  if (!force) {
    try {
      const raw = JSON.parse(localStorage.getItem(AVAIL_KEY) || 'null');
      if (raw && Date.now() - raw.at < AVAIL_TTL_MS && Array.isArray(raw.ids)) return raw.ids;
    } catch { /* fall through to a live fetch */ }
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const ids = (data.models || [])
      .map(m => (m.name || '').replace(/^models\//, ''))
      .filter(Boolean);
    if (!ids.length) return null;
    try { localStorage.setItem(AVAIL_KEY, JSON.stringify({ at: Date.now(), ids })); } catch { /* ignore */ }
    return ids;
  } catch {
    return null;
  }
}

// Drop chain entries the key can't reach. Returns the chain unchanged when
// the probe failed — an unreachable listing endpoint must not disarm the
// fallback chain.
export function pruneChain(chain, availableIds) {
  if (!Array.isArray(availableIds) || !availableIds.length) return chain;
  const kept = chain.filter(m => availableIds.includes(m));
  return kept.length ? kept : chain;
}
