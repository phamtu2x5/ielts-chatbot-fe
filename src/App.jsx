import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  FileText,
  Paperclip,
  Send,
  Sparkles,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createChatbotClient, userFacingError } from "./api/chatbotClient.js";
import {
  completeSessionCleanup,
  queueSessionCleanup,
  SESSION_HARD_TTL_MS,
  startEphemeralSession,
  storeCurrentSession,
} from "./session/sessionManager.js";
import "./styles.css";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào, mình là trợ lý IELTS của bạn. Bạn có thể hỏi về Reading, Listening, Writing, Speaking hoặc tải tài liệu lên để mình hỗ trợ phân tích nội dung.",
  route_used: "welcome",
};

const routeLabels = {
  base_model: "Model chính",
  vector_rag: "Tài liệu RAG",
  vector_rag_static: "Tài liệu RAG",
  vector_rag_no_match: "Tài liệu RAG",
  vector_rag_ambiguous_document: "Tài liệu RAG",
  route_undetermined: "Chưa xác định luồng",
  upload: "Tài liệu",
  error: "Lỗi",
};

function routeLabel(route) {
  if (!route || route === "welcome") return "";
  return routeLabels[route] || route;
}

function normalizeMarkdown(content) {
  const normalized = (content || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>\s*<li>/gi, "\n- ")
    .replace(/<ul>\s*<li>/gi, "- ")
    .replace(/<\/li>\s*<\/ul>/gi, "")
    .replace(/<\/?ul>/gi, "")
    .replace(/<\/?li>/gi, "");
  return repairMultilineMarkdownTables(normalized);
}

function repairMultilineMarkdownTables(content) {
  const lines = content.split("\n");
  const repaired = [];

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].trim();
    const separator = lines[index + 1]?.trim() || "";
    const isTableHeader =
      header.startsWith("|") &&
      header.endsWith("|") &&
      /^\|(?:\s*:?-{3,}:?\s*\|){2,}$/.test(separator);
    if (!isTableHeader) {
      repaired.push(lines[index]);
      continue;
    }

    const expectedPipes = (header.match(/\|/g) || []).length;
    if (repaired.length && repaired[repaired.length - 1].trim()) {
      repaired.push("");
    }
    repaired.push(header, separator);
    index += 2;
    while (index < lines.length && lines[index].trim()) {
      let row = lines[index].trim();
      if (!row.startsWith("|")) break;

      while (
        (!row.endsWith("|") || (row.match(/\|/g) || []).length !== expectedPipes) &&
        index + 1 < lines.length &&
        lines[index + 1].trim()
      ) {
        index += 1;
        const continuation = lines[index].trim().replace(/^[-*•]\s*/, "");
        row = `${row}; ${continuation}`;
      }
      repaired.push(row);
      index += 1;
    }
    index -= 1;
  }

  return repaired.join("\n");
}

function MessageContent({ message }) {
  const content = message.content || "";

  if (message.role === "user") {
    const attachments = message.attachments || (message.attachment ? [message.attachment] : []);
    return (
      <>
        {content && <div className="messageText plainText">{content}</div>}
        {attachments.length > 0 && (
          <div className="messageAttachments">
            {attachments.map((attachment) => (
              <AttachmentCard key={attachment.id || attachment.name} attachment={attachment} />
            ))}
          </div>
        )}
      </>
    );
  }

  const showStatus = !content && message.streamingStatus;
  const showEmptyFallback = !content && !message.streaming && !message.streamingStatus;

  return (
    <div className="messageText markdownText">
      {showStatus && (
        <span className="inlineStatus">
          <span className="typingDots compact" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {message.streamingStatus}
        </span>
      )}
      {content && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className="tableScroll">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {normalizeMarkdown(content)}
        </ReactMarkdown>
      )}
      {showEmptyFallback && <span className="emptyAnswer">Chưa nhận được nội dung trả lời.</span>}
    </div>
  );
}

function AttachmentCard({ attachment, onRemove }) {
  const statusText = {
    queued: "Sẵn sàng gửi",
    uploading: "Đang tải lên...",
    ready: `${attachment.chunks || 0} đoạn đã được lập chỉ mục`,
    error: attachment.error || "Không thể tải tệp",
  }[attachment.status];

  return (
    <div className={`attachmentCard ${attachment.status}`}>
      <span className="attachmentIcon">
        <FileText size={20} />
      </span>
      <div className="attachmentMeta">
        <strong>{attachment.name}</strong>
        <span>{statusText}</span>
      </div>
      {attachment.status === "ready" && <CheckCircle2 className="attachmentState" size={18} />}
      {attachment.status === "error" && <XCircle className="attachmentState" size={18} />}
      {onRemove && (
        <button
          className="attachmentRemoveButton"
          type="button"
          title={`Bỏ ${attachment.name}`}
          aria-label={`Bỏ ${attachment.name}`}
          onClick={onRemove}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default function IELTSChatbot({
  apiBase = import.meta.env.VITE_CHATBOT_API_URL || "/api",
  className = "",
  initialSessionId,
  onSessionChange,
}) {
  const client = useMemo(() => createChatbotClient(apiBase), [apiBase]);
  const [initialSession] = useState(() => startEphemeralSession(initialSessionId));
  const [sessionId, setSessionId] = useState(initialSession.currentId);
  const [messages, setMessages] = useState([{ ...WELCOME_MESSAGE }]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [lastSessionActivity, setLastSessionActivity] = useState(Date.now());
  const fileInputRef = useRef(null);
  const messagesRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const requestControllerRef = useRef(null);
  const hasStreamingAssistant = messages.some((message) => message.streaming);

  useEffect(() => {
    onSessionChange?.(sessionId);
  }, [onSessionChange, sessionId]);

  useEffect(() => {
    for (const staleSessionId of initialSession.staleIds) {
      client
        .expireSession(staleSessionId)
        .then(() => completeSessionCleanup(staleSessionId))
        .catch(() => {});
    }
  }, [client, initialSession.staleIds]);

  useEffect(() => {
    const cleanupCurrentSession = () => {
      queueSessionCleanup(sessionId);
      const expireUrl = client.expireUrl(sessionId);
      if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(expireUrl)) {
        return;
      }
      client
        .expireSession(sessionId, { keepalive: true })
        .then(() => completeSessionCleanup(sessionId))
        .catch(() => {});
    };
    window.addEventListener("pagehide", cleanupCurrentSession);
    return () => window.removeEventListener("pagehide", cleanupCurrentSession);
  }, [client, sessionId]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    const remaining = Math.max(
      1000,
      SESSION_HARD_TTL_MS - (Date.now() - lastSessionActivity)
    );
    const timeoutId = window.setTimeout(async () => {
      if (isSending || isUploading || isResettingSession) {
        setLastSessionActivity(Date.now());
        return;
      }
      setIsResettingSession(true);
      queueSessionCleanup(sessionId);
      try {
        await client.deleteSession(sessionId);
        completeSessionCleanup(sessionId);
      } catch {
        // The backend hard TTL remains authoritative when the request fails.
      } finally {
        const nextSessionId = window.crypto.randomUUID();
        storeCurrentSession(nextSessionId);
        setSessionId(nextSessionId);
        setMessages([
          {
            ...WELCOME_MESSAGE,
            content: "Phiên trước đã hết hạn sau 30 phút không hoạt động. Mình đã bắt đầu một phiên mới cho bạn.",
          },
        ]);
        setPendingFiles([]);
        setInput("");
        setLastSessionActivity(Date.now());
        setIsResettingSession(false);
        shouldAutoScrollRef.current = true;
      }
    }, remaining);
    return () => window.clearTimeout(timeoutId);
  }, [client, sessionId, lastSessionActivity, isSending, isUploading, isResettingSession]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  function handleMessagesScroll(event) {
    const container = event.currentTarget;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  }

  function selectFiles(event) {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    queueFiles(selectedFiles);
    event.target.value = "";
  }

  function queueFiles(selectedFiles) {
    setPendingFiles((current) => {
      const existing = new Set(current.map((item) => item.id));
      const additions = selectedFiles
        .map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          name: file.name,
          status: "queued",
        }))
        .filter((item) => !existing.has(item.id));
      return [...current, ...additions];
    });
  }

  function pasteImages(event) {
    const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    const pastedImages = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file" && supportedTypes.has(item.type))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (!pastedImages.length) return;

    event.preventDefault();
    const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const extensions = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    queueFiles(
      pastedImages.map(
        (file, index) =>
          new File(
            [file],
            `clipboard-image-${timestamp}-${index + 1}.${extensions[file.type]}`,
            { type: file.type, lastModified: Date.now() + index }
          )
      )
    );
  }

  function updateAttachment(messageId, attachmentId, changes) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              attachments: (message.attachments || []).map((attachment) =>
                attachment.id === attachmentId ? { ...attachment, ...changes } : attachment
              ),
            }
          : message
      )
    );
  }

  async function sendMessage(event, retryText = "") {
    event?.preventDefault();
    const text = retryText.trim() || input.trim();
    const queuedFiles = retryText ? [] : pendingFiles;
    if ((!text && !queuedFiles.length) || isSending || isUploading || isResettingSession) return;

    const submissionId = Date.now();
    setLastSessionActivity(submissionId);
    const userId = `user-${submissionId}`;
    const assistantId = `assistant-${submissionId}`;
    setInput("");
    setPendingFiles([]);
    setIsSending(true);
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    shouldAutoScrollRef.current = true;
    setMessages((current) => [
      ...current,
      {
        id: userId,
        role: "user",
        content: text,
        attachments: queuedFiles.map(({ id, name }) => ({ id, name, status: "queued" })),
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        streamingStatus: queuedFiles.length ? "Đang chuẩn bị tài liệu..." : "Đang gửi câu hỏi...",
      },
    ]);

    try {
      const uploadedFiles = [];
      const failedFiles = [];

      if (queuedFiles.length) {
        setIsUploading(true);
        for (const [index, item] of queuedFiles.entries()) {
          updateAttachment(userId, item.id, { status: "uploading" });
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    streamingStatus: `Đang xử lý tài liệu ${index + 1}/${queuedFiles.length}: ${item.name}`,
                  }
                : message
            )
          );
          try {
            const data = await client.uploadDocument(
              sessionId,
              item.file,
              requestController.signal
            );
            uploadedFiles.push(data);
            updateAttachment(userId, item.id, {
              name: data.file_name,
              status: "ready",
              chunks: data.chunks_processed,
              documentId: data.document_id,
            });
          } catch (error) {
            if (error.name === "AbortError") throw error;
            failedFiles.push({ name: item.name, error: error.message });
            updateAttachment(userId, item.id, {
              status: "error",
              error: error.message,
            });
          }
        }
        setIsUploading(false);
      }

      if (!text) {
        const readyNames = uploadedFiles.map((data) => `**${data.file_name}**`).join(", ");
        const failedNames = failedFiles.map((item) => `**${item.name}**`).join(", ");
        const parts = [];
        if (readyNames) parts.push(`Đã xử lý xong ${uploadedFiles.length} tài liệu: ${readyNames}.`);
        if (failedNames) parts.push(`Không thể xử lý ${failedFiles.length} tài liệu: ${failedNames}.`);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: parts.join("\n\n"),
                  route_used: uploadedFiles.length ? "upload" : "error",
                  streaming: false,
                  streamingStatus: "",
                }
              : message
          )
        );
        return;
      }

      if (failedFiles.length) {
        throw new Error("Chưa gửi câu hỏi vì chưa xử lý thành công toàn bộ tài liệu đính kèm.");
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, streamingStatus: "Đang gửi câu hỏi..." } : message
        )
      );
      let streamCompleted = false;
      await client.streamChat(
        {
          session_id: sessionId,
          message: text,
          document_ids: uploadedFiles.length
            ? uploadedFiles.map((data) => data.document_id)
            : null,
          document_scope: uploadedFiles.length ? "explicit" : "available",
        },
        {
          signal: requestController.signal,
          onEvent: async (eventData) => {
          if (eventData.type === "status") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, streamingStatus: eventData.message } : message
              )
            );
          } else if (eventData.type === "metadata") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      route_used: eventData.route_used,
                    }
                  : message
              )
            );
          } else if (eventData.type === "token") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: `${message.content || ""}${eventData.token || ""}`,
                      streamingStatus: "",
                    }
                  : message
              )
            );
          } else if (eventData.type === "done") {
            streamCompleted = true;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: message.content || "Mình chưa nhận được nội dung trả lời. Vui lòng thử lại.",
                      streaming: false,
                      streamingStatus: "",
                    }
                  : message
              )
            );
          } else if (eventData.type === "error") {
            throw new Error(eventData.message || "Yêu cầu không thành công");
          }
          },
        }
      );
      if (!streamCompleted) {
        throw new Error("Kết nối bị ngắt trước khi nhận xong câu trả lời.");
      }
    } catch (error) {
      const message = userFacingError(error);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: message,
                route_used: "error",
                retryText: text || null,
                streaming: false,
                streamingStatus: "",
              }
            : message
        )
      );
    } finally {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, streaming: false, streamingStatus: "" } : message
        )
      );
      setIsSending(false);
      setIsUploading(false);
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null;
      }
    }
  }

  return (
    <main className={`ieltsChatbotRoot appShell ${className}`.trim()}>
      <section className="chatPanel">
        <header className="toolbar">
          <div className="brand">
            <span className="brandIcon">
              <Bot size={22} />
            </span>
            <div>
              <h1>IELTS Chatbot</h1>
              <p>Trợ lý luyện IELTS chạy bằng Ollama, có hỗ trợ hỏi đáp theo tài liệu</p>
            </div>
          </div>
        </header>

        <div className="messages" ref={messagesRef} onScroll={handleMessagesScroll}>
          {messages.map((message, index) => (
            <article key={message.id || `${message.role}-${index}`} className={`message ${message.role}`}>
              <div className="avatar">{message.role === "user" ? <UserRound size={17} /> : <Sparkles size={17} />}</div>
              <div className="bubble">
                <MessageContent message={message} />
                {routeLabel(message.route_used) && <div className="route">{routeLabel(message.route_used)}</div>}
                {message.retryText && (
                  <button
                    className="retryButton"
                    type="button"
                    onClick={() => sendMessage(null, message.retryText)}
                    disabled={isSending || isUploading || isResettingSession}
                  >
                    Thử lại
                  </button>
                )}
              </div>
            </article>
          ))}
          {isSending && !hasStreamingAssistant && (
            <article className="message assistant">
              <div className="avatar">
                <Sparkles size={17} />
              </div>
              <div className="bubble loadingBubble" aria-live="polite">
                <span className="typingDots" aria-label="Đang trả lời">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="loadingText">Đang suy nghĩ và soạn câu trả lời...</span>
              </div>
            </article>
          )}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          {pendingFiles.length > 0 && (
            <div className="pendingAttachments" aria-label="Tệp đính kèm đang chờ gửi">
              {pendingFiles.map((item) => (
                <AttachmentCard
                  key={item.id}
                  attachment={item}
                  onRemove={() => setPendingFiles((current) => current.filter((file) => file.id !== item.id))}
                />
              ))}
            </div>
          )}
          <div className="composerControls">
            <button
              className="composerIconButton"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending || isResettingSession}
              title="Đính kèm tệp"
              aria-label="Đính kèm tệp"
            >
              <Paperclip size={19} />
            </button>
            <input
              ref={fileInputRef}
              className="hiddenInput"
              type="file"
              multiple
              accept=".txt,.md,.pdf,.docx,image/png,image/jpeg,image/webp"
              onChange={selectFiles}
            />
            <textarea
              value={input}
              disabled={isResettingSession}
              onChange={(event) => setInput(event.target.value)}
              onPaste={pasteImages}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(event);
                }
              }}
              placeholder="Nhập câu hỏi IELTS hoặc dán ảnh..."
              rows={1}
            />
            <button
              className="sendButton"
              type={isSending || isUploading ? "button" : "submit"}
              onClick={
                isSending || isUploading
                  ? () => requestControllerRef.current?.abort()
                  : undefined
              }
              disabled={
                isResettingSession ||
                (!isSending &&
                  !isUploading &&
                  !input.trim() &&
                  !pendingFiles.length)
              }
              title={isSending || isUploading ? "Dừng" : isResettingSession ? "Đang làm mới phiên" : "Gửi"}
              aria-label={isSending || isUploading ? "Dừng" : isResettingSession ? "Đang làm mới phiên" : "Gửi"}
            >
              {isSending || isUploading ? <X size={18} /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
