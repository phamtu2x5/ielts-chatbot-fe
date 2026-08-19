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
  const statusMessage = {
    401: "Phiên đăng nhập không hợp lệ. Vui lòng tải lại trang hoặc đăng nhập lại.",
    413: detail || "Nội dung gửi lên vượt quá giới hạn cho phép.",
    429: "Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ một chút rồi thử lại.",
    502: "Dịch vụ chatbot đang tạm thời mất kết nối.",
    503: "Dịch vụ chatbot đang bận. Vui lòng thử lại sau.",
    504: "Chatbot phản hồi quá lâu. Vui lòng thử lại.",
  }[response.status];
  const error = new Error(statusMessage || detail || fallbackMessage);
  error.status = response.status;
  return error;
}

export function userFacingError(error) {
  if (error?.name === "AbortError") return "Yêu cầu đã bị dừng.";
  if (error instanceof TypeError) {
    return "Không thể kết nối tới chatbot. Vui lòng kiểm tra mạng và thử lại.";
  }
  return error?.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
}

export function createChatbotClient(apiBase) {
  const base = normalizeApiBase(apiBase);
  const expireUrl = (sessionId) => `${base}/sessions/${sessionId}/expire`;

  return {
    expireUrl,

    async expireSession(sessionId, options = {}) {
      const response = await fetch(expireUrl(sessionId), {
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
