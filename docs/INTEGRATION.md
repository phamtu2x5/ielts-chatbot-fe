# Component integration

## Component

IELTSChatbot is exported by src/index.js. It owns chat rendering, paste-image
support, serial document upload, NDJSON streaming, and browser session cleanup.

    <IELTSChatbot
      apiBase="/api/ielts-chatbot"
      className="learningSystemChatbot"
      initialSessionId={optionalUuid}
      onSessionChange={handleSessionChange}
    />

Props:

| Prop | Required | Meaning |
| --- | --- | --- |
| apiBase | No | Same-origin proxy prefix. Default: VITE_CHATBOT_API_URL or /api. |
| className | No | Host class added to the namespaced root element. |
| initialSessionId | No | Valid UUID used only for the component's initial session. |
| onSessionChange | No | Called with the active UUID at mount and after client TTL rollover. |

The component must be rendered inside the Chatbot tab. Prefer keeping the tab
mounted while the user navigates within the IELTS system. If the host unmounts
the tab, pass a host-owned initialSessionId to resume the same browser-level
session on remount.

## Data ownership

- Backend owns conversation memory. The browser does not send history or a
  conversation-state object.
- Backend owns RAG documents under the session UUID.
- Same-turn uploaded document IDs are sent as explicit scope. Later questions
  use the documents available in that backend session.
- FE never receives or renders backend debug payloads or source chunks.

## Styling

All component rules are scoped below .ieltsChatbotRoot. src/demo.css belongs
only to the standalone Vite demo and must not be imported by the host website.
The current visual design is a baseline, not the final IELTS-system design.

## Required browser behavior

- fetch, ReadableStream, TextDecoder, FormData, and crypto.randomUUID
- navigator.sendBeacon is preferred for page-exit expiration; keepalive fetch
  is the fallback.
- The host/proxy must not buffer application/x-ndjson.
