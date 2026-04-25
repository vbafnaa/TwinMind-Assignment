const STORAGE_KEY = "twinmind_assignment_v1";

export function loadTwinMindSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveTwinMindSettings(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function buildPromptPayload(stored) {
  if (!stored) return null;
  const s = stored.prompts || {};
  return {
    live_suggestions_system: s.live_suggestions_system || null,
    live_suggestions_user_template: s.live_suggestions_user_template || null,
    detail_system: s.detail_system || null,
    detail_user_template: s.detail_user_template || null,
    chat_system: s.chat_system || null,
    context_suggestions_chars: stored.context_suggestions_chars ?? null,
    context_detail_chars: stored.context_detail_chars ?? null,
    context_chat_chars: stored.context_chat_chars ?? null,
    suggestion_temperature: stored.suggestion_temperature ?? null,
    chat_temperature: stored.chat_temperature ?? null,
  };
}
