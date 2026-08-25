// Shared dependency registry — populated by agent-chat.js at startup.
// Modal files import from here so they don't need to import agent-chat.js
// (which would create circular dependencies).
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
