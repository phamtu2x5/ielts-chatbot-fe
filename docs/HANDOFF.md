# Bàn giao IELTS Chatbot Frontend

## 1. Thông tin cần bàn giao

1. Repository `phamtu2x5/ielts-chatbot-fe`.
2. `CHATBOT_BACKEND_URL` do chủ hệ thống cung cấp riêng.
3. `IELTS_API_TOKEN` trùng với secret trong Colab, gửi qua kênh bảo mật.

Không bàn giao `CLOUDFLARE_TUNNEL_TOKEN`; token này chỉ dùng trong Colab.

## 2. Luồng kết nối bắt buộc

```text
React trong trình duyệt
  -> /api/ielts-chatbot/* trên domain hệ thống IELTS
  -> server/proxy tin cậy của hệ thống IELTS
  -> gắn Authorization: Bearer <IELTS_API_TOKEN>
  -> <CHATBOT_BACKEND_URL>/*
  -> FastAPI + LLM + OCR + session RAG trong Colab
```

Không đặt `IELTS_API_TOKEN` trong React, Git hoặc biến `VITE_*`. Token chỉ tồn
tại trong Colab và server/proxy của hệ thống IELTS.

## 3. Chạy lại frontend độc lập ở local

Yêu cầu Node.js 20+ và backend Colab/tunnel đang hoạt động. Tạo `.env.local`:

```env
VITE_CHATBOT_API_URL=/api
CHATBOT_BACKEND_URL=<URL backend được bàn giao>
IELTS_API_TOKEN=<token trùng với Colab>
```

Sau đó chạy:

```bash
npm install
npm test
npm run dev
```

Mở `http://127.0.0.1:8000`. Vite nhận `/api/*`, gắn token trong tiến trình Node
rồi chuyển sang backend. `.env.local` đã được Git bỏ qua. Trước khi bàn giao lại:

```bash
npm run build
npm audit --omit=dev
```

## 4. Đưa component vào hệ thống IELTS

Repo hiện là ứng dụng Vite, chưa phải package npm. Đưa các module sau vào
codebase của hệ thống IELTS:

```text
src/App.jsx
src/styles.css
src/api/
src/session/
```

Không đưa `src/main.jsx` và `src/demo.css` vì chỉ dùng cho demo. Cài dependency
còn thiếu:

```bash
npm install react-markdown remark-gfm lucide-react
```

Render component trong tab Chatbot:

```jsx
import IELTSChatbot from "./features/ielts-chatbot/App.jsx";

export function ChatbotTab() {
  return (
    <IELTSChatbot
      apiBase="/api/ielts-chatbot"
      onSessionChange={(sessionId) => {
        // Chỉ dùng cho lifecycle/quan sát; sessionId không phải thông tin đăng nhập.
        console.info("IELTS chatbot session", sessionId);
      }}
    />
  );
}
```

CSS đã scope dưới `.ieltsChatbotRoot`. Nên giữ component được mount khi chuyển
tab. Nếu buộc phải unmount, lưu UUID theo người dùng hiện tại và truyền lại qua
`initialSessionId`. Không dùng chung UUID giữa người dùng hoặc trình duyệt.

## 5. Proxy production

Đặt hai giá trị sau trong secret/environment của **server IELTS**:

```env
CHATBOT_BACKEND_URL=<URL backend được bàn giao>
IELTS_API_TOKEN=<token trùng với Colab>
```

Tên biến có thể đổi. Proxy phải:

1. Nhận `/api/ielts-chatbot/*`, bỏ prefix này rồi chuyển tới backend.
2. Gắn `Authorization: Bearer <IELTS_API_TOKEN>` phía server.
3. Giữ method, query, body, status và response headers.
4. Chuyển multipart upload nguyên vẹn.
5. Không buffer `/chat/stream`; chuyển từng NDJSON chunk ngay khi nhận.
6. Cho phép timeout đủ dài và chấp nhận body rỗng từ `sendBeacon`.

Browser chỉ được thấy `/api/ielts-chatbot/...`, không được thấy Bearer token.

## 6. API contract

### Chat streaming

```http
POST /chat/stream
Content-Type: application/json
```

```json
{
  "session_id": "UUID",
  "message": "Câu hỏi của người dùng",
  "document_ids": null,
  "document_scope": "available"
}
```

Khi người dùng vừa upload tài liệu cùng câu hỏi, FE gửi các `document_id` vừa
nhận và đặt `document_scope` thành `explicit`.

Response là `application/x-ndjson`, một JSON object mỗi dòng:

```json
{"type":"status","message":"Đang phân tích câu hỏi..."}
{"type":"metadata","route_used":"base_model"}
{"type":"token","token":"Xin "}
{"type":"token","token":"chào"}
{"type":"done"}
```

Proxy không được chờ `done` rồi mới trả response.

### Upload tài liệu

```http
POST /documents/upload
Content-Type: multipart/form-data
```

Form fields: `session_id` và `file`. Hỗ trợ TXT, Markdown, PDF, DOCX, PNG, JPEG,
WebP. FE upload tuần tự. Proxy giữ response gồm `session_id`, `file_name`,
`document_id`, `chunks_processed`.

### Vòng đời session

```http
POST   /sessions/{session_id}/expire
DELETE /sessions/{session_id}
```

`expire` lên lịch dọn sau grace period. `DELETE` xóa memory và RAG của UUID.

## 7. Session

Một UUID sở hữu cả conversation memory và RAG ở backend. FE không gửi toàn bộ
lịch sử và không lưu nội dung tài liệu trong local storage.

1. Component tạo UUID khi mount, trừ khi nhận `initialSessionId` hợp lệ.
2. Mọi chat/upload đều gửi UUID này.
3. Đóng/reload gọi `expire`; backend chờ 5 phút trước khi dọn.
4. Sau 30 phút không hoạt động, FE yêu cầu xóa phiên và tạo UUID mới.
5. Backend TTL dọn phiên nếu cleanup từ browser thất bại.

UUID không phải thông tin đăng nhập. Website vẫn dùng authentication riêng.

## 8. Lỗi cần giữ nguyên

| Status | Ý nghĩa phía FE |
| --- | --- |
| 400 | Request hoặc loại tài liệu không hợp lệ |
| 401 | Proxy thiếu token hoặc token không khớp backend |
| 413 | File/nội dung hoặc quota session vượt giới hạn |
| 429 | Gửi yêu cầu quá nhanh |
| 502/503/504 | Tunnel, backend, LLM hoặc timeout không sẵn sàng |

Proxy giữ status và JSON error body.

## 9. Nghiệm thu

1. Direct và câu trả lời dài stream đến hết; Markdown/bảng render đúng.
2. Upload PDF và paste ảnh rồi hỏi sử dụng đúng tài liệu.
3. Follow-up cùng phiên nhớ đúng nội dung.
4. Hai trình duyệt không lẫn memory hoặc RAG.
5. Reload/đóng tab không làm hỏng phiên mới; phiên cũ được dọn.
6. Stop, Retry và lỗi 401/413/429/mất kết nối hiển thị đúng.
7. Browser không thấy token; stream về nhiều chunk thay vì một response cuối.

## 10. Vận hành

- Colab, Ollama, FastAPI và named Cloudflare Tunnel phải tiếp tục chạy.
- Backend chạy một worker vì session store JSON/NumPy hiện không dành cho nhiều
  process.
- Token trên server IELTS phải khớp token Colab sau mỗi lần đổi token.
- Quota, rate limit và TTL do backend quyết định.

Chẩn đoán nhanh:

- `401`: thiếu hoặc sai `IELTS_API_TOKEN` tại proxy.
- `502/503/504`: kiểm tra Colab, backend, Ollama và tunnel.
- Có câu trả lời nhưng không stream: proxy đang buffer NDJSON.
- Direct hoạt động nhưng upload lỗi: kiểm tra multipart forwarding và timeout.
- Follow-up/RAG bị lẫn: kiểm tra hệ thống chủ không dùng chung `session_id` giữa
  người dùng.
