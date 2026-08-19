import assert from "node:assert/strict";
import test from "node:test";
import { readNdjsonStream } from "../src/api/ndjsonStream.js";

const encoder = new TextEncoder();

function chunkedStream(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test("parses NDJSON events split across arbitrary network chunks", async () => {
  const events = [];
  const stream = chunkedStream([
    '{"type":"status","message":"Đang ',
    'xử lý"}\n{"type":"token","token":"Hel',
    'lo"}\n{"type":"done"}',
  ]);

  await readNdjsonStream(stream, (event) => events.push(event));

  assert.deepEqual(events, [
    { type: "status", message: "Đang xử lý" },
    { type: "token", token: "Hello" },
    { type: "done" },
  ]);
});

test("rejects malformed NDJSON instead of silently dropping it", async () => {
  const stream = chunkedStream(['{"type":"token"\n']);
  await assert.rejects(
    readNdjsonStream(stream, () => {}),
    /Dữ liệu stream từ backend không hợp lệ/
  );
});
