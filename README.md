# IELTS Chatbot Frontend

Frontend React cho chatbot IELTS. Repository này chứa giao diện và lớp kết nối
trình duyệt; toàn bộ LLM, OCR, document processing, conversation memory và RAG
được xử lý bởi backend riêng.

## Phạm vi

Frontend hiện hỗ trợ:

- Chat trực tiếp và follow-up theo phiên.
- Streaming câu trả lời dạng NDJSON.
- Upload PDF, DOCX, TXT, Markdown và ảnh.
- Dán ảnh trực tiếp từ clipboard.
- Hiển thị Markdown/GFM, bao gồm bảng.
- Dừng hoặc thử lại yêu cầu.
- Bắt đầu trò chuyện mới và xóa memory/RAG của phiên cũ.
- Tự quản lý UUID phiên và yêu cầu backend dọn memory/RAG khi phiên kết thúc.
- Thông báo thân thiện cho lỗi xác thực, giới hạn, mạng và backend.

Frontend không chứa model, dữ liệu RAG, lịch sử hội thoại backend, token truy
cập backend hoặc công cụ debug nội bộ.

## Kiến trúc kết nối

```text
Trình duyệt
  -> proxy cùng domain của hệ thống IELTS
  -> Backend API qua Cloudflare Tunnel
  -> LLM / OCR / RAG trong Colab
```

Trình duyệt không gọi backend bằng token. Proxy tin cậy của hệ thống IELTS giữ
token, gắn `Authorization: Bearer ...` và chuyển tiếp request/stream tới backend.

## Cấu trúc chính

```text
src/App.jsx                 Component IELTSChatbot
src/api/                    API client và NDJSON stream parser
src/session/                Vòng đời session phía trình duyệt
src/styles.css              CSS đã scope cho component
src/main.jsx, src/demo.css  Trang demo local
tests/                      Contract tests của FE
docs/HANDOFF.md             Hướng dẫn chạy lại và tích hợp
```

Giao diện hiện tại đã được căn theo card AI Chatbot của hệ thống IELTS tham
chiếu. Component chỉ chứa phần chatbot; sidebar, breadcrumb và tài khoản vẫn do
ứng dụng chủ quản lý.

## Bàn giao

Người tiếp nhận chỉ cần đọc [docs/HANDOFF.md](docs/HANDOFF.md). Tài liệu này mô
tả đầy đủ thông tin cần nhận, cách chạy local, cách đưa component vào tab
Chatbot, proxy production, API contract, session lifecycle và checklist nghiệm
thu.
