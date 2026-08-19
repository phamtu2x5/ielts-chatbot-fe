# IELTS Chatbot Frontend

React/Vite frontend for the IELTS chatbot. The backend, Ollama runtime, OCR,
layout analysis, and session-scoped RAG store live in the separate
`ielts-chatbot` repository.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

The development server listens on `http://127.0.0.1:8000`.

Set `VITE_CHATBOT_API_URL` to either:

- `/api` when the learning website proxies API requests through its own server;
- the backend URL for local testing when backend authentication is disabled.

Do not put the backend bearer token in a `VITE_*` variable or browser code.
For production, the learning website's trusted server should attach the token
while proxying requests to the backend.

## Build

```bash
npm run build
```

The production bundle is written to `dist/`.
