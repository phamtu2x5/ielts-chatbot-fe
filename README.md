# IELTS Chatbot Frontend

React/Vite frontend for the IELTS chatbot. The backend, LLM, OCR, layout
analysis, memory, and session-scoped RAG store live in
[phamtu2x5/ielts-chatbot](https://github.com/phamtu2x5/ielts-chatbot).

This repository is ready to be handed to the team that owns the IELTS learning
website. The current UI is intentionally unchanged; visual redesign is deferred
until after technical integration.

## Run locally

    cp .env.example .env.local
    # Set IELTS_API_TOKEN in .env.local. It is read by Vite's server process only.
    npm install
    npm run dev

The development server opens on http://127.0.0.1:8000. Its /api proxy forwards
to CHATBOT_BACKEND_URL and attaches the bearer token without exposing it to
browser JavaScript.

Never put IELTS_API_TOKEN in a VITE_* variable. Every VITE_* value is included
in the browser bundle.

## Integrate into the IELTS system

The component is exported from src/index.js:

    import { IELTSChatbot } from "./path/to/ielts-chatbot-fe/src";

    export function ChatbotTab() {
      return (
        <IELTSChatbot
          apiBase="/api/ielts-chatbot"
          onSessionChange={(sessionId) => console.info("chat session", sessionId)}
        />
      );
    }

The website server must proxy /api/ielts-chatbot/* to
https://api.mywsite.online/*, attach Authorization: Bearer <server secret>, and
stream responses without buffering.

Start with [docs/HANDOFF.md](docs/HANDOFF.md). Detailed contracts:

- [Integration guide](docs/INTEGRATION.md)
- [API and NDJSON contract](docs/API_CONTRACT.md)
- [Session lifecycle](docs/SESSION_LIFECYCLE.md)
- [Trusted proxy requirements](docs/PROXY.md)

## Verify

    npm test
    npm run build
    npm audit --omit=dev

The production bundle is written to dist/.
