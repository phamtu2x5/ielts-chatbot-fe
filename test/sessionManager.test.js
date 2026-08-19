import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSessionCleanup,
  queueSessionCleanup,
  startEphemeralSession,
  storedCleanupIds,
} from "../src/session/sessionManager.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("starts an isolated session and queues the previous tab session for cleanup", () => {
  const previousWindow = globalThis.window;
  const previousId = "0f30bc84-9912-4d7f-b0d5-00a53d8d5f40";
  const nextId = "fe98bf0d-7d22-47aa-87ed-b669cf2d99c1";
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  sessionStorage.setItem("ielts-chatbot-session-id", previousId);
  globalThis.window = {
    localStorage,
    sessionStorage,
    crypto: { randomUUID: () => nextId },
  };

  try {
    const session = startEphemeralSession();
    assert.equal(session.currentId, nextId);
    assert.deepEqual(session.staleIds, [previousId]);
    assert.deepEqual(storedCleanupIds(), [previousId]);

    queueSessionCleanup(nextId);
    assert.deepEqual(storedCleanupIds(), [previousId, nextId]);
    completeSessionCleanup(previousId);
    assert.deepEqual(storedCleanupIds(), [nextId]);
  } finally {
    globalThis.window = previousWindow;
  }
});
