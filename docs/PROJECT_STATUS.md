# Trạng thái thực tế — 24/11/2026

Phạm vi đang chạy trong mã nguồn là demo tự học tiếng Anh với học phần tổng hợp `english101`. M1–M7 trong README là mục tiêu MVP gốc. Baseline lần này gồm 92/92 test backend, 5/5 test frontend và TypeScript pass. Xem [lệnh, môi trường và giới hạn kiểm chứng](PROGRESS.md).

**Nhãn** · DONE đã triển khai và kiểm chứng trong phạm vi ghi rõ · PARTIAL đã triển khai một phần · SCAFFOLD mới có cấu trúc hoặc kết nối cơ bản · MOCK dùng dữ liệu hoặc hành vi mô phỏng · UNVERIFIED có mã nhưng thiếu kiểm chứng tương ứng · TODO chưa triển khai · BLOCKED thiếu điều kiện thực thi.

| Module | Trạng thái | Căn cứ và khoảng trống |
| --- | --- | --- |
| Next.js student | PARTIAL | Có PLAN chỉnh/lưu từng đề xuất, DO luyện tập/góp ý bài nháp, REFLECT và consent. 5 test helper với fetch giả lập và TypeScript pass. Chưa kiểm tra tương tác trình duyệt trong lượt này. [Giao diện](../frontend/app/student-forms.tsx) |
| Điều phối PLAN–DO–REFLECT | DONE | Trong phạm vi offline, 18 test workflow và 8 ca workflow tiếng Anh xác minh graph theo request, routing, retry giới hạn và xử lý lỗi. Chất lượng model thật cần đánh giá riêng. [Graph](../backend/app/workflow.py) · [Suite](../backend/tests/test_workflow.py) |
| API task và danh sách xuyên phiên | PARTIAL | POST lưu task và PATCH đổi trạng thái, đã có test API SQLite. Thiếu GET danh sách, nên DO/REFLECT chỉ thấy task từ phiên hiện tại. [API](../backend/app/api.py) · [UI state](../frontend/app/page.tsx) |
| Reflection memory / HITL | PARTIAL | Lưu chờ duyệt, task cần người học lưu, memory có duyệt/thu hồi. Test offline xác minh quyền và đưa memory đã duyệt vào future PLAN. Pending vẫn được ghi DB, cần quyết định retention, chỉnh sửa và quản lý qua phiên. [Repository](../backend/app/repository.py) |
| RBAC và quyền đối tượng | DONE | Phạm vi demo/test offline: kiểm tra JWT, membership/owner, instructor đúng môn. [Auth](../backend/app/auth.py) · [API tests](../backend/tests/test_api.py) |
| Đăng nhập demo | MOCK | Development cấp JWT theo subject/role cung cấp, không xác thực credential. Danh tính và học liệu demo là dữ liệu tổng hợp. [Login](../backend/app/api.py) · [Seed](../backend/app/cli.py) |
| Xác thực danh tính cho pilot | TODO | Chưa có luồng xác minh danh tính người học và giảng viên trước khi cấp token. [ALC-10](TASKS.md#alc-10) |
| PostgreSQL và schema | PARTIAL | SQLAlchemy hỗ trợ course/enrollment, assignment/submission, task, reflection memory, escalation. Kiểm thử dùng SQLite. Có init bảng và seed, chưa có migration hoặc live smoke trong lượt này. [Models](../backend/app/models.py) |
| Assignment/submission import | SCAFFOLD | Có schema, PLAN đọc assignment và KPI đọc submission. API và CLI hiện thiếu import/CRUD dành cho assignment hoặc submission. [CLI](../backend/app/cli.py) · [Models](../backend/app/models.py) |
| Ingestion và version học liệu | PARTIAL | CLI ingest JSON chunks tin cậy và upsert theo course/chunk. Thiếu pipeline PDF/parse/chunk và phiên bản active tự quản lý. [Retrieval](../backend/app/retrieval.py) |
| Embedding/retrieval | UNVERIFIED | Lọc course/kind/active đã có test với Qdrant in-memory và embedder dựng sẵn. Chưa xác nhận FastEmbed ONNX/model thật, Qdrant server và chất lượng top-k. Rerank hoãn đến khi có số đo. [Retrieval tests](../backend/tests/test_retrieval.py) |
| Grounding, citation, academic integrity | PARTIAL | Kiểm tra ID/quote, citation server, chặn yêu cầu làm hộ rõ ràng và publish sau Validator đã qua test offline. Chưa có baseline ngữ nghĩa với model thật, tài liệu có chỉ dẫn không đáng tin và học liệu được cấp phép. [Guardrails](../backend/app/guardrails.py) |
| Adapter Gemini | UNVERIFIED | 33 ca adapter offline qua mock transport/cấu hình, gồm 429/timeout. Khả năng dùng model, quota và chất lượng live chưa đo. Adapter cấu hình một model, graph giới hạn lượt tạo lại. [Adapter](../backend/app/llm.py) |
| Instructor KPI và escalation | PARTIAL | KPI xác định có 3 test riêng; API/dashboard có output tập hợp và escalation đã lưu. Thiếu chính sách nhóm nhỏ, history và quy trình đóng escalation. Escalation trả nội dung câu hỏi. [KPI](../backend/app/kpi.py) · [Dashboard](../frontend/app/page.tsx) |
| Eval offline | DONE | Phạm vi mock tổng hợp, 8 ca workflow và 1 test seed. JSON có sẵn ghi mode `offline_mock` và 8/8. Chưa tạo báo cáo live. [Eval](../eval/README.md) |
| Demo tích hợp local | BLOCKED | Docker CLI có mặt, phiên audit không kết nối được Docker engine. Chưa thực hiện startup PostgreSQL/Qdrant, ingest FastEmbed, browser E2E hoặc Gemini live. [Setup](../backend/README.md) |
| Deployment | SCAFFOLD | Compose chạy PostgreSQL và Qdrant, API/UI chạy riêng. Chưa thấy Dockerfile ứng dụng, CI/CD hoặc cấu hình cloud trong thư mục audit. [Compose](../docker-compose.yml) |

## Giữ và hoàn thiện

- Giữ LangGraph per-request, interface `generate(prompt, payload, schema)`, output Pydantic, kiểm tra citation bằng Python, khóa theo học phần, KPI xác định, nút duyệt PLAN/memory, client API dùng chung và fixtures tiếng Anh.
- Hoàn thiện lát cắt task xuyên phiên và smoke demo trước. Đo RAG rồi mới điều chỉnh ngưỡng/top-k hay xét reranker. Bóc tách thêm ở điểm có regression hoặc nhu cầu đo được.
- Giai đoạn sau của MVP xử lý import assignment, version học liệu, danh tính và privacy giảng viên. Canvas thật, email/push, ML dự đoán, load 1.000 và triển khai cloud nằm ngoài kế hoạch hiện tại. [Roadmap](TASKS.md)
