# Nhật ký điều phối

[Nhật ký triển khai trước đây](progress/README.md) lưu lịch sử giao diện, chuyển provider và build. Trang này ghi lần kiểm chứng và bàn giao mới của ba Agent.

## 24/11/2026 — Khảo sát và lập kế hoạch

- Đối chiếu README, GUIDE, tài liệu backend/eval, mã nguồn, test và tài liệu runtime. Hoàn tất khảo sát và tài liệu điều phối. Kế hoạch triển khai đang chờ duyệt.
- `git status --short -b`, `git rev-parse --show-toplevel` và `git worktree list` trả `fatal: not a git repository`. Không có `.git` ở thư mục gốc hiện tại, nên chưa xác định branch, commit gốc hoặc diff. [OPS-01](TASKS.md#hồ-sơ-task)
- Không đọc nội dung `.env`. Không chạy dịch vụ, model live hoặc ghi lại báo cáo eval vào repo. `docker container ls` không kết nối được pipe Docker engine và báo quyền đọc cấu hình Docker bị từ chối.
- GitHub Copilot và Cline đã có tệp hướng dẫn tại repo. Việc VS Code nạp chúng trong từng extension chưa được kiểm chứng trên phiên đang chạy. [Cách xác nhận](HANDOFF.md#khởi-tạo-trong-vs-code)

### Lệnh và kết quả hiện tại

PowerShell từ thư mục gốc, Python 3.13.17, dùng phụ thuộc kiểm thử sẵn có trên Windows.

```powershell
$env:DISABLE_SQLALCHEMY_CEXT = '1'
$env:PYTHONPATH = (Resolve-Path .test-deps).Path
$env:PYTHONDONTWRITEBYTECODE = '1'
python -m pytest backend/tests -q -p no:cacheprovider --junitxml=$env:TEMP/alc-orchestration-audit.xml
```

**92/92 đạt, exit 0** · API 20, workflow 18, provider 33, English eval 9, health 2, retrieval 2, guardrails 5, KPI 3. SQLite/TestClient và Qdrant in-memory với embedder dựng sẵn, Gemini mock. Chín test English eval gồm tám ca workflow và một ca seed. [Suite backend](../backend/tests) · [JSON offline đã có](../eval/reports/english-workflow-offline.json)

Trong `frontend`, Node v26.13.1.

```powershell
node --test tests/api.test.mjs
npm.cmd run lint -- --incremental false
```

**5/5 đạt**, fetch giả lập. Node có cảnh báo nhận dạng ESM. TypeScript đạt, exit 0. Build Next.js thành công được ghi trong nhật ký cũ và chưa chạy lại ở lượt này. Browser E2E và PostgreSQL/Qdrant/FastEmbed/Gemini thật chưa được nghiệm thu. [Test frontend](../frontend/tests/api.test.mjs) · [Lịch sử build](progress/README.md#kiểm-thử-giao-diện-và-eval-trước-khi-chuyển-provider)

## 24/11/2026 — Codex kiểm tra điều kiện bắt đầu

| Task | Trạng thái | Revision và kiểm chứng | Việc tiếp theo |
| --- | --- | --- | --- |
| ALC-01 | TODO · chờ duyệt kế hoạch | Snapshot thiếu Git. Đã chuẩn bị bản nháp từ OpenAPI, schema, model và client. Kiểm tra baseline API 20/20 và client 5/5, TypeScript exit 0. [Bàn giao ALC-01](handoffs/ALC-01.md) | Duyệt kế hoạch và contract trước khi triển khai GET. |
| OPS-01 | BLOCKED | Git không nhận diện checkout tại thư mục hiện tại. [Bàn giao OPS-01](handoffs/OPS-01.md) | Xác nhận đường dẫn checkout Git gốc để xác lập base. |

## 24/11/2026 — Tiếp tục sau khi mở Docker Desktop

Người dùng báo đã mở Docker Desktop và yêu cầu tiếp tục. Codex dùng yêu cầu này để tiếp tục ALC-01 theo kế hoạch. Phê duyệt contract GET vẫn chờ người dùng.

| Task | Trạng thái | Kết quả | Việc tiếp theo |
| --- | --- | --- | --- |
| ALC-01 | REVIEW | Đã rà soát đặc tả, trường query, mã lỗi và yêu cầu OpenAPI. Chạy lại API 20/20 với SQLite/mock và frontend 5/5 với fetch giả lập. [Bàn giao ALC-01](handoffs/ALC-01.md) | Người dùng duyệt contract. |
| ALC-02 | DONE | Smoke PostgreSQL, Qdrant, FastEmbed và build Next.js thành công. Collection `course_chunks` có 2 points, live retrieval trả đúng `english101`, /health 200, build Next pass. [Bàn giao ALC-02](handoffs/ALC-02.md) | Phục vụ demo local và ALC-06/ALC-07. |
| ALC-03 | DONE | Ma trận QA và baseline offline hoàn tất: 29/29 test offline pass (9 english_eval, 20 test_api), JSON report 8/8 pass. Xác định khoảng trống reload task và injection học liệu. [Bàn giao ALC-03](handoffs/ALC-03.md) | Sẵn sàng cho ALC-04 và Phase 2. |
| OPS-01 | BLOCKED | Kiểm tra lại `git status --short --branch` vẫn trả `fatal: not a git repository`. [Bàn giao OPS-01](handoffs/OPS-01.md) | Xác nhận đường dẫn checkout Git gốc hoặc khởi tạo git để xác lập base. |

## Mẫu nhật ký sau mỗi task

`Ngày | Task ID | Agent | trạng thái | base/commit hoặc revision | lệnh, kết quả và link bằng chứng | việc tiếp theo`

Owner điền trong phiếu bàn giao của task. Codex ghi vào đây và cập nhật trạng thái ở TASKS sau review.
