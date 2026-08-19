import { readNdjsonStream } from "./ndjsonStream.js";

function normalizeApiBase(apiBase) {
  return (apiBase || "/api").replace(/\/$/, "");
}

async function responseError(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  const detail =
    typeof payload.detail === "string"
      ? payload.detail
      : payload.detail?.message || payload.message;
  const error = new Error(detail || fallbackMessage);
  error.status = response.status;
  return error;
}

export function createChatbotClient(apiBase) {
  const base = normalizeApiBase(apiBase);

  return {
    expireUrl(sessionId) {
      return `${base}/sessions/${sessionId}/expire`;
    },

    async expireSession(sessionId, options = {}) {
      const response = await fetch(this.expireUrl(sessionId), {
        method: "POST",
        keepalive: options.keepalive,
      });
      if (!response.ok) throw await responseError(response, "Không thể đóng phiên.");
      return response.json();
    },

    async deleteSession(sessionId) {
      const response = await fetch(`${base}/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw await responseError(response, "Không thể xóa phiên.");
      return response.json();
    },

    async uploadDocument(sessionId, file, signal) {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("file", file);
      const response = await fetch(`${base}/documents/upload`, {
        method: "POST",
        body: formData,
        signal,
      });
      if (!response.ok) {
        throw await responseError(response, "Tải tài liệu không thành công.");
      }
      return response.json();
    },

    async streamChat(payload, { signal, onEvent }) {
      const response = await fetch(`${base}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      if (!response.ok) {
        throw await responseError(response, "Yêu cầu không thành công.");
      }
      await readNdjsonStream(response.body, onEvent);
    },
  };
}
