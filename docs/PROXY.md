# Trusted server proxy

## Required request flow

    Browser
      -> same-origin /api/ielts-chatbot/*
      -> trusted IELTS website server
      -> Authorization: Bearer <IELTS_API_TOKEN>
      -> https://api.mywsite.online/*

The bearer token is a backend service credential. It must exist only in the
website server's secret manager/environment and the Colab backend secret. Never
return it to the browser, place it in React code, or name it with a VITE_
prefix.

## Proxy requirements

- Require the website's normal authenticated user session where applicable.
- Strip /api/ielts-chatbot before forwarding.
- Attach the backend bearer token server-side.
- Preserve HTTP methods, query strings, status codes, and response headers.
- Pass multipart upload bodies without parsing or re-encoding them.
- Stream /chat/stream immediately. Disable response buffering, compression
  buffering, and full-body JSON parsing for this route.
- Keep the connection open long enough for LLM generation and document upload.
- Forward client disconnects so the upstream request can be cancelled.
- Accept bodyless POST /sessions/{id}/expire from sendBeacon.
- Apply the website's own CSRF/origin policy to mutating same-origin routes.

## Local Vite proxy

Use these values in .env.local:

    VITE_CHATBOT_API_URL=/api
    CHATBOT_BACKEND_URL=https://api.mywsite.online
    IELTS_API_TOKEN=replace-with-colab-backend-token

IELTS_API_TOKEN is loaded by vite.config.js without the VITE_ prefix, so it
remains in the local Node process and is not bundled.

This Vite proxy is for local development only. Production must use the IELTS
website's trusted server/proxy layer.
