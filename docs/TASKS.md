# Roadmap và backlog

**Người dùng đã yêu cầu tiếp tục theo kế hoạch ngày 24/11/2026.** Các phê duyệt contract và quyết định riêng theo từng task vẫn áp dụng. Trạng thái task dùng TODO, BLOCKED, IN PROGRESS, REVIEW và DONE. P0 là đường chính của demo, P1 là MVP kế tiếp. [Trạng thái module](PROJECT_STATUS.md) · [Quy trình và prompt](HANDOFF.md)

## Các phase

| Phase | Mục tiêu | Điều kiện ra phase |
| --- | --- | --- |
| 0 · Khảo sát | Kiểm tra code, contract, test và môi trường. Thiết lập vai trò, shared memory. | Baseline có bằng chứng và người dùng duyệt kế hoạch. |
| 1 · Hồi phục demo | Xác định Git base, kiểm tra runtime, chốt contract đọc task, tích hợp UI qua phiên. | Task reload đúng, quyền chéo được kiểm soát, có smoke hạ tầng và kết quả browser. |
| 2 · Đo chất lượng AI | Đo FastEmbed/Qdrant server rồi đánh giá Gemini trên học liệu tổng hợp trong quota được duyệt. | Có baseline retrieval, citation, gợi mở, thiếu căn cứ, liêm chính và độ trễ. Dùng kết quả để quyết định chỉnh ngưỡng/top-k hoặc thử reranker. |
| 3 · Hoàn thiện MVP | Import assignment, version/chunking học liệu, auth và privacy trước pilot, runbook demo local. | Có lối nhập dữ liệu được phép và vòng đời version rõ. Các quyết định auth/privacy được duyệt và có task triển khai riêng trước pilot. |

## Phân công và phụ thuộc

| ID | Module và mô tả | Agent | Ưu tiên | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| OPS-01 | Git base và worktree | Codex | P0 | Checkout Git của người dùng | BLOCKED |
| ALC-01 | Đặc tả API đọc task theo tuần | Codex | P0 | Duyệt kế hoạch | REVIEW |
| ALC-02 | Smoke PostgreSQL/Qdrant/FastEmbed và build UI | Copilot | P0 | Docker engine truy cập được qua `desktop-linux` với quyền phù hợp, embedding cần xác minh | DONE |
| ALC-03 | Ma trận QA và baseline offline | Cline | P0 | Duyệt kế hoạch | DONE |
| ALC-04 | Triển khai API GET task | Copilot | P0 | OPS-01, ALC-01, duyệt contract | TODO |
| ALC-05 | Tích hợp danh sách task vào UI | Copilot | P0 | OPS-01, ALC-04 | TODO |
| ALC-06 | Tích hợp demo browser/API | Codex | P0 | OPS-01, ALC-02, ALC-03, ALC-05 | TODO |
| ALC-07 | Đánh giá retrieval và model live | Cline | P1 | ALC-02, ALC-03, quyền và quota live đã duyệt | TODO |
| ALC-08 | Import assignment tổng hợp tại CLI | Copilot | P1 | OPS-01, ALC-06, duyệt contract import | TODO |
| ALC-09 | Quản lý version trong ingest RAG | Codex | P1 | OPS-01, ALC-07, duyệt lifecycle/migration nếu cần | TODO |
| ALC-10 | Chốt auth và privacy trước pilot | Codex | P1 | Duyệt kế hoạch và quyết định của người dùng | TODO |
| ALC-11 | Chuẩn hóa PDF thành chunks | Codex | P1 | OPS-01, ALC-09, ALC-08 do cùng sửa CLI, PDF được phép | TODO |
| ALC-12 | Runbook demo local và chạy lại | Copilot | P1 | ALC-06, ALC-08, ALC-11 nếu PDF nằm trong bản demo | TODO |

**Task đầu tiên.** Codex lấy ALC-01. Copilot lấy ALC-02 và ghi blocker nếu engine chưa sẵn sàng. Cline lấy ALC-03. OPS-01 là việc điều phối riêng của Codex khi có checkout.

**Song song.** ALC-01, ALC-02 và ALC-03 có đầu ra riêng. Dùng worktree từ cùng base sau OPS-01 để chạy đồng thời. Nếu thiếu Git, có thể làm phần khảo sát/tài liệu lần lượt trên snapshot. Sau baseline, ALC-04 có thể chạy cùng ALC-07 hoặc ALC-10 khi đủ dependency. ALC-08 có thể chạy cùng ALC-09. Dùng runtime và volume demo tách biệt nếu các task cần ghi đồng thời.

**Tuần tự.** ALC-01 → duyệt contract → ALC-04 → ALC-05 → ALC-06 → ALC-08. ALC-02 và ALC-03 → ALC-07 → ALC-09. ALC-08 và ALC-09 → ALC-11. Codex tích hợp từng thay đổi và chạy lại regression. ALC-12 dùng các dependency ghi ở bảng.

## Hồ sơ task

Mỗi hồ sơ dùng module, mô tả, owner, ưu tiên, dependency và status từ dòng cùng ID ở trên. Tệp được phép dưới đây bao gồm phiếu bàn giao theo từng task.

### OPS-01

- **Tệp được phép** · `docs/handoffs/OPS-01.md`. Lệnh Git chỉ thực hiện trên checkout đã xác nhận.
- **Nghiệm thu** · Xác định root, branch, base SHA, thay đổi hiện tại và worktree riêng. Giữ mọi thay đổi đang làm dở.
- **Kiểm thử** · `git rev-parse --show-toplevel`, `git status --short -b`, `git rev-parse HEAD`, `git worktree list`.
- **Bằng chứng** · Lỗi hiện tại ở [PROGRESS.md](PROGRESS.md). Chờ base SHA và worktree.

### ALC-01

- **Tệp được phép** · `docs/handoffs/ALC-01.md`.
- **Nghiệm thu** · Đề xuất GET `/api/courses/{course_id}/tasks` theo tuần, schema item, thứ tự ổn định, quy tắc quyền và empty/error. Ghi cách chọn tuần, tải lại sau POST/PATCH. Chốt contract trước ALC-04.
- **Kiểm thử** · Đối chiếu OpenAPI, TaskInput, StudyTask và client; ví dụ danh sách rỗng, hai mục cùng ngày và 401/403/422.
- **Bằng chứng** · [Đặc tả, đối chiếu và kết quả test](handoffs/ALC-01.md). Chờ người dùng duyệt contract.

### ALC-02

- **Tệp được phép** · `docs/handoffs/ALC-02.md`. Artefact build/test tạm ở ngoài diff bàn giao.
- **Nghiệm thu** · Smoke Docker, PostgreSQL, Qdrant, FastEmbed và Next build. Dùng volume demo riêng. Ghi blocker hạ tầng nếu có. Chạy với học liệu tổng hợp và không gọi Gemini live.
- **Kiểm thử** · Engine, `/health` 200, init/seed lặp, ingest mẫu, kiểm tra chunk truy xuất đúng học phần và build frontend.
- **Bằng chứng** · [Bàn giao Copilot](handoffs/ALC-02.md) ghi build Next.js đạt và blocker Docker ở lần thử trước. [Codex đã xác nhận kết nối Docker qua `desktop-linux`](PROGRESS.md). Chờ Copilot kiểm tra embedding và chạy smoke.

### ALC-03

- **Tệp được phép** · `docs/handoffs/ALC-03.md`.
- **Nghiệm thu** · Ma trận gồm PLAN, reload task, REFLECT/consent, DO có nguồn/thiếu căn cứ, liêm chính, xử lý chỉ dẫn không đáng tin trong học liệu, lỗi provider và quyền chéo. Mỗi ca có fixture, expected, mode và test liên quan hoặc khoảng trống.
- **Kiểm thử** · Chạy `test_english_eval.py` và `test_api.py` offline. Ghi actual cho ca có chạy.
- **Bằng chứng** · Chờ ma trận và đầu ra độc lập. Baseline ở [PROGRESS.md](PROGRESS.md).

### ALC-04

- **Tệp được phép** · `backend/app/api.py`, `backend/tests/test_api.py`, `docs/handoffs/ALC-04.md`.
- **Nghiệm thu** · GET trả task người học theo học phần/tuần đúng contract, thứ tự ổn định, dùng được với task cũ. POST/PATCH giữ hành vi hiện tại.
- **Kiểm thử** · FastAPI/SQLite với trường hợp rỗng, ngày biên, nhiều task cùng ngày, GET sau PATCH, token lỗi và cách ly người học/học phần.
- **Bằng chứng** · Chờ diff, test và OpenAPI.

### ALC-05

- **Tệp được phép** · `frontend/app/api.ts`, `frontend/app/page.tsx`, `frontend/app/student-forms.tsx`, `frontend/tests/api.test.mjs`, `docs/handoffs/ALC-05.md`.
- **Nghiệm thu** · Nhiệm vụ và REFLECT đọc task đã lưu cho đúng tuần/học phần, cập nhật sau POST/PATCH, có loading/error/empty. Đổi học phần, người dùng hoặc token hết hạn cập nhật đúng scope.
- **Kiểm thử** · Node test, TypeScript, Next build và smoke UI tạo → cập nhật → reload và đổi phạm vi.
- **Bằng chứng** · Chờ diff, test và kết quả smoke.

### ALC-06

- **Tệp được phép** · `docs/handoffs/ALC-06.md`, `eval/reports/demo-integration.md`.
- **Nghiệm thu** · Review và tích hợp API/UI, báo tối thiểu năm ca browser/API với chế độ cụ thể. Tách issue sửa theo owner.
- **Kiểm thử** · Suite backend, Node, TypeScript, build. Ma trận browser/API gồm PLAN → lưu → reload, DO có nguồn, DO thiếu căn cứ/liêm chính, REFLECT → duyệt/thu hồi, instructor/quyền. Dùng TestClient hiện có cho test AI offline. Các ca browser cần kết quả AI live thực hiện sau khi người dùng duyệt cấu hình và quota.
- **Bằng chứng** · Chờ revision, test, actual từng ca và báo cáo tích hợp.

### ALC-07

- **Tệp được phép** · `eval/reports/english-live-baseline.md`, `docs/handoffs/ALC-07.md`.
- **Nghiệm thu** · Đo retrieval server trước model. Báo recall@k, citation support/grounding, gợi mở, liêm chính, thiếu căn cứ, độ trễ và số lượt gọi. Ghi model, phiên bản prompt và học liệu, rubric và cỡ mẫu.
- **Kiểm thử** · Corpus tổng hợp, kiểm tra cách ly học phần/version. Lưu expected/actual đã làm sạch, số lần 429 và ca bị quota chặn.
- **Bằng chứng** · Chờ báo cáo retrieval/live và blocker nếu có.

### ALC-08

- **Tệp được phép** · `backend/app/cli.py`, `backend/app/assignment_import.py`, `backend/tests/test_assignment_import.py`, `data/samples/english_assignments.json`, `docs/handoffs/ALC-08.md`.
- **Nghiệm thu** · CLI JSON dùng schema hiện tại. Validate môn, deadline có timezone, provenance. Chạy lặp ổn định. Submission import cần contract riêng.
- **Kiểm thử** · Batch hợp lệ, timezone thiếu, sai môn, ID lặp, lỗi giữa batch, PLAN đọc assignment đã nhập.
- **Bằng chứng** · Chờ diff, fixture, test và ví dụ lệnh.

### ALC-09

- **Tệp được phép** · `backend/app/retrieval.py`, `backend/tests/test_retrieval.py`, `docs/handoffs/ALC-09.md`.
- **Nghiệm thu** · Kích hoạt version theo course/resource, retry an toàn và có rollback theo contract đã duyệt. Tách migration nếu cần storage/schema ngoài allowlist.
- **Kiểm thử** · Qdrant với cập nhật version, chạy lặp, quyền scope, lỗi giữa chừng và rollback. Đối chiếu ALC-07.
- **Bằng chứng** · Chờ diff, test và so sánh retrieval theo version.

### ALC-10

- **Tệp được phép** · `docs/handoffs/ALC-10.md`.
- **Nghiệm thu** · Chốt nguồn danh tính, cách tắt demo login, ngưỡng nhóm nhỏ, quyền xem escalation, retention và xóa memory. Sau khi duyệt, mở task triển khai theo từng quyết định và ghi dependency migration.
- **Kiểm thử** · Review ca quyền người học/giảng viên, nhóm một người và vòng đời pending memory với fixture tổng hợp.
- **Bằng chứng** · Chờ quyết định và ma trận kiểm thử đã review.

### ALC-11

- **Tệp được phép** · `backend/app/chunking.py`, `backend/app/cli.py`, `backend/requirements.txt`, `backend/tests/test_chunking.py`, `data/samples/english_syllabus.pdf`, `docs/handoffs/ALC-11.md`.
- **Nghiệm thu** · Parse PDF có text được phép thành JSON Chunk tương thích CLI. Giữ page, metadata, ID ổn định, báo lỗi với định dạng ngoài phạm vi.
- **Kiểm thử** · PDF lỗi, trang rỗng, Unicode, nhiều trang, giới hạn chunk và ingest JSON đầu ra.
- **Bằng chứng** · Chờ fixture, lệnh chuyển đổi và test.

### ALC-12

- **Tệp được phép** · `backend/README.md`, `docs/handoffs/ALC-12.md`.
- **Nghiệm thu** · Runbook demo local tái lập từ checkout sạch, dùng Compose hiện có, ghi cách seed/import, ingest, mở/dừng ứng dụng và chọn tuần demo.
- **Kiểm thử** · Chạy lại từ checkout sạch, kiểm tra dữ liệu sau restart và lưu phiên bản runtime.
- **Bằng chứng** · Chờ lệnh, build và smoke log đã làm sạch.
