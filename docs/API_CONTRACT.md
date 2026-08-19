# Frontend API contract

All paths below are relative to the apiBase prop. In production, apiBase must be
a same-origin trusted proxy, not the public Colab API URL.

## Stream chat

POST /chat/stream with JSON:

    {
      "session_id": "UUID",
      "message": "user text",
      "document_ids": null,
      "document_scope": "available"
    }

For a question sent with newly uploaded files, document_ids contains those
upload response IDs and document_scope is explicit.

Response content type is application/x-ndjson. It contains one JSON object per
line:

    {"type":"status","message":"Đang phân tích câu hỏi..."}
    {"type":"metadata","route_used":"base_model"}
    {"type":"token","token":"Xin "}
    {"type":"token","token":"chào"}
    {"type":"done"}

An application failure may arrive as:

    {"type":"error","message":"Không thể tạo câu trả lời lúc này."}

The parser must handle a JSON line split across arbitrary network chunks. A
successful response is complete only after a done event.

## Upload document

POST /documents/upload with multipart fields:

- session_id: UUID
- file: TXT, Markdown, PDF, DOCX, PNG, JPEG, or WebP

Relevant response fields:

    {
      "session_id": "UUID",
      "file_name": "document.pdf",
      "document_id": "backend-document-id",
      "chunks_processed": 42
    }

Uploads are intentionally serial because the production backend allows one
upload pipeline at a time.

## Session endpoints

- POST /sessions/{session_id}/expire schedules cleanup after the backend grace
  period instead of deleting immediately.
- DELETE /sessions/{session_id} deletes backend conversation memory and that
  session's RAG data together.

## Error statuses

- 400: invalid request or unsupported document
- 401: proxy authentication/configuration error
- 413: upload/session content limit reached
- 429: request rate limit reached
- 502, 503, 504: backend/LLM unavailable or timeout

The proxy must preserve these statuses and JSON response bodies.
