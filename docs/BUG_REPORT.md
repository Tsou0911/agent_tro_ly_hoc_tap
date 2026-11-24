# Lỗi, khoảng trống và rủi ro

Ghi nhận ngày 24/11/2026. Bằng chứng dưới đây là đối chiếu mã hoặc đầu ra lệnh. Các ghi nhận chưa chạy browser/live được đánh dấu tương ứng.

| ID | Mức / phân loại | Expected | Actual và bằng chứng | Owner / task |
| --- | --- | --- | --- | --- |
| BUG-01 | P0 · Đã xác nhận qua mã | Task đã lưu hiện lại theo học phần sau reload hoặc đăng nhập lại, gồm tiến độ cho REFLECT | UI khởi tạo danh sách rỗng, chỉ thêm task vừa lưu. Backend có POST/PATCH và thiếu GET danh sách. Kịch bản xác minh sau triển khai: lưu task → đổi trạng thái → reload → mở Nhiệm vụ và Reflect. [UI state](../frontend/app/page.tsx) · [Router](../backend/app/api.py) | Codex ALC-01, Copilot ALC-04/05 |
| ENV-01 | P0 · Blocker | Có Git base, branch và worktree để chạy song song | `git status`/ `git worktree list` trả `fatal: not a git repository`. [Nhật ký](PROGRESS.md) | Codex OPS-01 |
| ENV-02 | P0 · Đã xác minh qua smoke ALC-02 | Docker engine, PostgreSQL, Qdrant và FastEmbed sẵn sàng | Context `desktop-linux` hoạt động, PostgreSQL healthy, Qdrant 2 points collection `course_chunks`, FastEmbed ingest thành công, `/health` 200. [Bàn giao ALC-02](handoffs/ALC-02.md) | Copilot ALC-02 (DONE) |
| GAP-01 | P1 · Quản lý học liệu | Phiên bản hiện hành có thể kích hoạt lại hoặc thay thế có kiểm soát | Index đánh dấu active khi upsert. Chunks phiên bản cũ dùng ID khác cần được tắt thủ công. [Ingest](../backend/app/retrieval.py) | Codex ALC-09 |
| GAP-02 | P1 · Quyết định privacy | Có quy tắc nhóm nhỏ, chính sách dữ liệu escalation và retention memory | KPI thiếu ngưỡng nhóm nhỏ, escalation trả question, memory chờ duyệt đã được lưu. Kiểm chứng phạm vi dữ liệu tổng hợp trước khi dùng dữ liệu thật. [KPI](../backend/app/kpi.py) · [API](../backend/app/api.py) · [Repository](../backend/app/repository.py) | Codex ALC-10 |
| GAP-03 | P1 · Điều kiện vận hành | Danh tính thực được xác minh trước khi cấp token | Login development cấp JWT theo subject và role khai báo. [Login](../backend/app/api.py) | Codex ALC-10 |

## Mẫu bổ sung theo task

`ID | Task | mức độ | môi trường và phiên bản | bước kiểm tra với fixture tổng hợp | expected | actual | lệnh/artifact đã làm sạch | owner | trạng thái`

QA báo vào phiếu riêng theo Task ID. Codex nối bằng chứng vào bảng khi tổng hợp.
