const SESSION_STORAGE_KEY = "ielts-chatbot-session-id";
const SESSION_LIST_STORAGE_KEY = "ielts-chatbot-sessions-v1";
const SESSION_DATA_PREFIX = "ielts-chatbot-session-v1:";
const SESSION_CLEANUP_STORAGE_KEY = "ielts-chatbot-session-cleanup-v1";

export const SESSION_HARD_TTL_MS = 30 * 60 * 1000;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function storedCleanupIds() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SESSION_CLEANUP_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((id) => UUID_PATTERN.test(id)) : [];
  } catch {
    return [];
  }
}

function saveCleanupIds(ids) {
  try {
    window.localStorage.setItem(
      SESSION_CLEANUP_STORAGE_KEY,
      JSON.stringify([...new Set(ids.filter((id) => UUID_PATTERN.test(id)))])
    );
  } catch {
    // The backend TTL still cleans sessions when browser storage is unavailable.
  }
}

export function queueSessionCleanup(sessionId) {
  if (UUID_PATTERN.test(sessionId || "")) {
    saveCleanupIds([...storedCleanupIds(), sessionId]);
  }
}

export function completeSessionCleanup(sessionId) {
  saveCleanupIds(storedCleanupIds().filter((id) => id !== sessionId));
}

export function storeCurrentSession(sessionId) {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // The session remains valid for the mounted component.
  }
}

export function startEphemeralSession(initialSessionId) {
  const staleIds = new Set(storedCleanupIds());
  try {
    const tabSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    const legacySessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (UUID_PATTERN.test(tabSessionId || "")) staleIds.add(tabSessionId);
    if (UUID_PATTERN.test(legacySessionId || "")) staleIds.add(legacySessionId);
    const legacySessions = JSON.parse(
      window.localStorage.getItem(SESSION_LIST_STORAGE_KEY) || "[]"
    );
    for (const session of Array.isArray(legacySessions) ? legacySessions : []) {
      if (UUID_PATTERN.test(session?.id || "")) staleIds.add(session.id);
    }
    for (const sessionId of staleIds) {
      window.localStorage.removeItem(`${SESSION_DATA_PREFIX}${sessionId}`);
    }
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_LIST_STORAGE_KEY);
  } catch {
    // A fresh in-memory session still works when browser storage is unavailable.
  }

  const currentId = UUID_PATTERN.test(initialSessionId || "")
    ? initialSessionId
    : window.crypto.randomUUID();
  staleIds.delete(currentId);
  storeCurrentSession(currentId);
  saveCleanupIds([...staleIds]);
  return { currentId, staleIds: [...staleIds] };
}
