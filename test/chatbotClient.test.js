import assert from "node:assert/strict";
import test from "node:test";
import { createChatbotClient, userFacingError } from "../src/api/chatbotClient.js";

const encoder = new TextEncoder();

test("streams chat through the configured same-origin API base", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"type":"token","token":"OK"}\n'));
          controller.enqueue(encoder.encode('{"type":"done"}\n'));
          controller.close();
        },
      }),
      { status: 200 }
    );
  };

  try {
    const events = [];
    const client = createChatbotClient("/api/ielts-chatbot/");
    await client.streamChat(
      { session_id: "session", message: "hello" },
      { onEvent: (event) => events.push(event) }
    );

    assert.equal(calls[0].url, "/api/ielts-chatbot/chat/stream");
    assert.equal(calls[0].options.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      session_id: "session",
      message: "hello",
    });
    assert.deepEqual(events, [
      { type: "token", token: "OK" },
      { type: "done" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps rate limiting to a stable user-facing message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: "internal rate detail" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const client = createChatbotClient("/api");
    await assert.rejects(
      client.streamChat(
        { session_id: "session", message: "hello" },
        { onEvent: () => {} }
      ),
      /gửi yêu cầu quá nhanh/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uploads a document with the backend session id", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(
      JSON.stringify({
        session_id: "session",
        file_name: "notes.txt",
        document_id: "doc-1",
        chunks_processed: 1,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const client = createChatbotClient("/api");
    const result = await client.uploadDocument(
      "session",
      new Blob(["hello"], { type: "text/plain" })
    );
    assert.equal(request.url, "/api/documents/upload");
    assert.equal(request.options.body.get("session_id"), "session");
    assert.equal(request.options.body.get("file").size, 5);
    assert.equal(result.document_id, "doc-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deletes conversation memory and RAG through the session endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ status: "deleted" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const client = createChatbotClient("/api/ielts-chatbot");
    await client.deleteSession("session-1");
    assert.equal(request.url, "/api/ielts-chatbot/sessions/session-1");
    assert.equal(request.options.method, "DELETE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("hides raw browser network errors", () => {
  assert.equal(
    userFacingError(new TypeError("Failed to fetch")),
    "Không thể kết nối tới chatbot. Vui lòng kiểm tra mạng và thử lại."
  );
});
