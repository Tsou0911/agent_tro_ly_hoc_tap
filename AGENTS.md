# AI Learning Companion — hướng dẫn cho ba Agent

## Bắt đầu

1. Đọc dòng của Task ID được giao trong [docs/TASKS.md](docs/TASKS.md), rồi mở phần hồ sơ task tương ứng.
2. Đọc [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) để biết mức kiểm chứng và [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) nếu task liên quan đến contract. Chỉ mở các tệp liên quan đến tiêu chí nghiệm thu.
3. Kiểm tra Git trên checkout đang dùng, dependency, trạng thái phê duyệt và phạm vi tệp. [docs/HANDOFF.md](docs/HANDOFF.md) có quy trình và prompt riêng cho từng Agent.

Kế hoạch ngày 24/11/2026 đang chờ người dùng duyệt. Chỉ thực hiện khảo sát và chuẩn bị tài liệu ở lượt đầu. Sau khi được duyệt, thực hiện đúng task được giao. Các thay đổi quan trọng về API, schema, auth, privacy hoặc phạm vi MVP cần quyết định rõ trong handoff.

## Trách nhiệm

| Agent | Trách nhiệm |
| --- | --- |
| Codex | Tech lead. Chốt kiến trúc và contract, triển khai LangGraph, PLAN–DO–REFLECT, RAG, citation, memory, LLM, guardrails và HITL. Review cuối, tích hợp và nghiệm thu. |
| GitHub Copilot | Full-stack. Next.js, React, TypeScript, UI/UX, FastAPI, CRUD, DB, validation, tích hợp và unit test trong phạm vi được giao. |
| Cline + Gemini | QA độc lập. Functional, regression, edge cases, grounding/citation, liêm chính học thuật, quyền truy cập, kiểm tra ứng dụng xử lý tài liệu có chỉ dẫn không đáng tin, phân tích log và báo cáo. Mỗi phiên một task, ưu tiên test offline, thay đổi code chỉ trong allowlist. |

## Quy tắc làm việc

- PLAN → IMPLEMENT → TEST → REVIEW → HANDOFF. Một owner cho mỗi tệp đang sửa. Kiểm tra allowlist và dùng branch/worktree riêng khi chạy song song. Codex cập nhật trực tiếp các bảng điều phối chung sau khi nhận handoff.
- Giữ entry point và hành vi đang dùng, tái sử dụng module hiện có. Thay đổi DB cần kế hoạch migration và kiểm chứng dữ liệu cũ. Giữ validation, auth và quyền truy cập tại backend, KPI và phép tính thời gian trong code xác định.
- Dùng Pydantic cho contract backend, SQLAlchemy session hiện có cho DB, TypeScript strict và client API chung cho frontend. Theo quy ước hiện tại của module. Ưu tiên test nhỏ theo regression cụ thể.
- Không đọc, sửa, in hoặc đưa `.env`, API key, JWT hay dữ liệu học viên thật vào context, diff, log hoặc báo cáo. Runtime chỉ nhận cấu hình bí mật qua cơ chế môi trường sẵn có. Dùng fixture tổng hợp. Không tự push lên main.
- Ghi lệnh, môi trường, số đạt/thất bại và giới hạn. Phân biệt unit/mock, tích hợp cục bộ và dịch vụ live. Chỉ ghi DONE sau nghiệm thu có bằng chứng. Nếu bị chặn, ghi nguyên nhân cụ thể vào handoff.

## Nguồn điều phối

- [Trạng thái module](docs/PROJECT_STATUS.md)
- [Kiến trúc và API](docs/ARCHITECTURE.md)
- [Roadmap, owner và tiêu chí nghiệm thu](docs/TASKS.md)
- [Tiến độ](docs/PROGRESS.md)
- [Bàn giao và prompt](docs/HANDOFF.md)
- [Lỗi và rủi ro](docs/BUG_REPORT.md)
