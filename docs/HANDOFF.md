# IELTS chatbot frontend handoff

## Current boundary

- FE repository: phamtu2x5/ielts-chatbot-fe
- BE/LLM/RAG repository: phamtu2x5/ielts-chatbot
- Backend hostname: supplied privately to the deployment/integration owner
- Production browser access: only through a trusted same-origin website proxy
- UI redesign: intentionally deferred

The frontend currently supports direct chat, NDJSON token streaming, retry and
cancel, serial multi-file upload, pasted PNG/JPEG/WebP images, Markdown/GFM
tables, session expiry, and responsive rendering.

Debug Panel, debug download, and RAG source rendering have been removed. The
production browser receives only user-facing status, route label, answer tokens,
completion, and safe error messages.

## Integration sequence

1. Implement the trusted proxy described in PROXY.md.
2. Add this source/component to the IELTS system.
3. Render IELTSChatbot in the Chatbot tab with the proxy path as apiBase.
4. Keep the component mounted while the tab is active, or preserve a per-user
   UUID and pass it back as initialSessionId on remount.
5. Verify the acceptance cases below before changing the visual design.

## Acceptance cases

1. Direct greeting streams and finishes with no console error.
2. A long Writing request streams to completion and Markdown remains valid.
3. A PDF upload completes, then a same-turn question uses explicit document
   scope.
4. A pasted image uploads and its question uses the image document.
5. A follow-up question in the same session uses backend memory.
6. Two browsers use different UUIDs and never see each other's RAG documents.
7. Closing/reloading triggers expire without breaking the next page load.
8. 401, 413, 429, network failure, and interrupted stream show safe
   user-facing errors; text-only failures can be retried.
9. The browser network panel never contains the backend bearer token.
10. The proxy shows incremental NDJSON delivery rather than one buffered body.

## Operational assumptions

- Colab, Ollama, the FastAPI backend, and the named Cloudflare tunnel must stay
  running for the public hostname to respond.
- Backend runs one worker because its JSON/NumPy session store is not
  multi-process.
- Backend limits and TTLs are authoritative; frontend controls are UX only.
- The host website owns authentication, authorization, analytics, and final
  visual design.

## Verification commands

    npm install
    npm test
    npm run build
    npm audit --omit=dev
