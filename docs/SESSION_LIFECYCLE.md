# Session lifecycle

One UUID identifies both backend memory and the session-scoped RAG collection.
Documents and memory from one UUID must never be reused by another UUID.

## Browser lifecycle

1. Mount creates a UUID, unless a valid initialSessionId is supplied.
2. Every chat and upload request includes that UUID.
3. pagehide sends POST /sessions/{id}/expire.
4. The backend waits 5 minutes before cleanup, allowing reload/network races to
   finish safely.
5. The frontend hard-idle timer rolls over after 30 minutes and requests DELETE
   /sessions/{id}.
6. The backend hard TTL remains authoritative if the browser closes before any
   cleanup request succeeds.

Old IDs that could not be expired are retained in local storage as a cleanup
queue and retried on the next mount. Chat messages and document contents are not
stored in browser local storage.

## Host integration rule

The learning website may record the active UUID for tab remounting, but it must
not treat that UUID as authentication. Access control belongs to the website
session and trusted server proxy.

Do not share one chatbot UUID between different logged-in users, browser
profiles, or concurrent anonymous visitors.
