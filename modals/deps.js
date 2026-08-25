// Shared dependency registry — populated by agent-chat.js at startup.
// Modal files import from here so they don't need to import agent-chat.js
// (which would create circular dependencies).
//
// ⚠️ This module MUST resolve to exactly one URL across the whole app.
// Browsers key ES modules by full URL including the query string, so adding
// a cache-busting "?v=" to one importer and not the others creates two
// separate instances: agent-chat.js fills one, every modal reads the other
// (all nulls), and every agent button dies silently on the first deps.*
// call. This has happened — see the cache section in README.md. Cache
// versions belong on the HTML script tags, never on an import specifier.
export const deps = {
  // UI
  appendMessage:  null,
  appendTyping:   null,
  removeTyping:   null,
  updateTyping:   null,
  hideEmpty:      null,
  setLoading:     null,
  escHtml:        null,
  // File
  readFile:       null,
  // API helpers
  isQuotaExceeded:    null,
  callGeminiForSpec:  null,   // callGeminiForArchitectSpec equivalent
  callGeminiForBacklog: null,
  // Mutable state accessors
  getApiKey:   null,
  getModelIdx: null,
  setModelIdx: null,
  getIsLoading: null,
  // Token accounting — reset at the start of a run, read at the end
  resetUsage: null,
  getUsage:   null,
  // Constants
  MODEL_CHAIN:       null,
  MAX_OUTPUT_TOKENS: null,
};
