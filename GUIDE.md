# GUIDE — Hướng dẫn triển khai AI Learning Companion

> Dùng cùng [`README.md`](./README.md). Đây là **hướng dẫn xây dựng**, không phải nhật ký tính năng đã hoàn thành.

> Backend Multi-Agent đã được hiện thực. Lệnh chạy và API hiện tại nằm ở
> [backend/README.md](backend/README.md), hợp đồng và giới hạn ở
> [docs/MULTI_AGENT.md](docs/MULTI_AGENT.md). Sản phẩm hiện tập trung vào tự học
> tiếng Anh với học phần demo `english101`. Các phần bên dưới lưu lộ trình MVP
> ban đầu. Lệnh chạy bộ tình huống tiếng Anh tổng hợp và xuất kết quả nằm trong
> [eval/README.md](eval/README.md).

## 1. Nguyên tắc triển khai

- **Một flow chạy thật trước:** nhập assignment → lập kế hoạch → cập nhật nhiệm vụ → phản tư → cập nhật kế hoạch.
- **MVP trước, mở rộng sau:** làm dữ liệu giả lập và một workflow LangGraph trước khi tích hợp Canvas thật.
- **LLM đề xuất, code xác minh:** deadline, KPI, authorization và tính toán trạng thái không phụ thuộc văn bản do model sinh.
- **Human approval:** kế hoạch và nội dung phản tư/memory chỉ lưu sau khi người học đồng ý.
- **Không làm hộ:** AI hỗ trợ cách học, giải thích và phản hồi, tránh cung cấp bài nộp hoàn chỉnh cho assignment tính điểm.

## 2. Chuẩn bị dự án

### 2.1 Điều kiện

- Python 3.11+ (chốt một phiên bản cho môi trường cá nhân)
- Node.js LTS, npm
- Docker + Docker Compose
- Git, GitHub
- Gemini API key cho demo live. Suite offline tự cung cấp mock.

### 2.2 Tạo repository và nhánh

1. Tạo repository cá nhân private/public theo chính sách dữ liệu; không upload dữ liệu thật khi chưa được phép.
2. Tạo branch `main`, dùng nhánh `feature/<ten-tinh-nang>`.
3. Mỗi chức năng hoàn chỉnh bằng commit riêng; dùng checklist và chạy test trước khi merge nếu có feature branch.
4. Có thể dùng PR cá nhân để lưu bằng chứng và tự review; không bắt buộc có reviewer khác.
5. Thêm `.gitignore` gồm `.env`, `.venv/`, `node_modules/`, `__pycache__/`, dữ liệu cá nhân và report chứa thông tin nhạy cảm.

### 2.3 Thiết lập cấu hình

Ví dụ `.env.example` **không chứa khóa thật**:

```dotenv
APP_ENV=development
DATABASE_URL=postgresql+pg8000://app:change_me@localhost:5432/learning
QDRANT_URL=http://localhost:6333
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=
EMBEDDING_MODEL=intfloat/multilingual-e5-small
JWT_SECRET=replace_with_at_least_32_random_characters
CANVAS_BASE_URL=
CANVAS_ACCESS_TOKEN=
```

Xem `.env.example` để có đầy đủ biến mà backend hiện tại đọc.
[Cấu hình Gemini và Free Tier](backend/README.md#gemini-và-free-tier)

## 3. Cách tổ chức khi làm một mình

Một người lần lượt đảm nhiệm phân tích yêu cầu, backend, AI/RAG, frontend và kiểm thử. **Không phát triển tất cả cùng lúc**: hoàn thiện một lát cắt dọc từ giao diện → API → DB → AI → kết quả trước khi mở rộng.

| Thứ tự | Trách nhiệm cá nhân | Ưu tiên |
|---|---|---|
| 1 | Thiết kế data contract, mock data, API và schema | P0 |
| 2 | FastAPI, PostgreSQL, auth và RBAC | P0 |
| 3 | LangGraph PLAN, DO, REFLECT và bộ kiểm tra deterministic | P0 |
| 4 | RAG tài liệu và citation | P0 |
| 5 | Next.js giao diện sinh viên và dashboard demo giảng viên | P0/P1 |
| 6 | Eval, Docker, deploy, tối ưu hiệu năng | P1/P2 |

**Để giảm khối lượng:** bắt đầu với assignment CSV/JSON, một môn học, một người dùng demo, một model và giao diện tối giản. Khi workflow đã ổn mới thêm vai trò giảng viên và đăng nhập đầy đủ. Không dùng dữ liệu sinh viên thật nếu chưa được phép.

## 4. Lộ trình cá nhân 8 tuần (có thể rút gọn)

| Tuần | Việc chính | Tiêu chí hoàn thành |
|---|---|---|
| 1 | Đặc tả user flow, schema, dữ liệu mẫu, wireframe và khởi tạo repo | Có data contract, fixture, giao diện phác thảo |
| 2 | FastAPI + PostgreSQL + CRUD course/assignment/task | API chạy, unit tests và mẫu dữ liệu import được |
| 3 | Next.js tối giản + PLAN với structured output + validator | Nhập mục tiêu, tạo/sửa/duyệt kế hoạch |
| 4 | DO: task status, nhắc deadline trong ứng dụng | Tiến độ và deadline được tính bằng code |
| 5 | Ingestion tài liệu + Qdrant RAG + citation | Hỏi đáp có nguồn; thiếu bằng chứng thì nói rõ |
| 6 | REFLECT + consent memory + cập nhật plan tuần tiếp | Chu trình Plan–Do–Reflect chạy end-to-end |
| 7 | Auth/RBAC 2 vai trò + dashboard ẩn danh + deterministic KPI | Test quyền truy cập, KPI tái tính đúng |
| 8 | Guardrail, eval, Docker, deploy, demo và báo cáo | ≥5 test thực tế, log latency/cost, video demo |

**Nếu chỉ có 4–6 tuần:** bỏ Canvas thật, Redis, reranker nâng cao, ML dự báo và benchmark 1.000 concurrent; giữ một tài khoản sinh viên demo cùng trang dashboard giảng viên có dữ liệu ẩn danh. Nếu chưa đủ thời gian, ưu tiên chạy trọn chu trình Plan–Do–Reflect và test liêm chính học thuật hơn UI phức tạp.

## 5. Contract dữ liệu tối thiểu

### 5.1 Assignment mẫu

```json
{
  "id": "asg_001",
  "course_id": "course_python",
  "title": "Bài tập thuật toán tìm kiếm",
  "due_at": "2026-11-20T16:59:00Z",
  "graded": true,
  "source": "mock_lms",
  "source_verified": true
}
```

**Thời gian:** lưu timestamp UTC, hiển thị theo timezone do người dùng/cơ sở thiết lập, ví dụ `Asia/Ho_Chi_Minh`. Không tự suy luận “thứ Sáu” khi thiếu ngày chính xác.

### 5.2 Weekly goal mẫu

```json
{
  "user_id": "student_demo_01",
  "week_start": "2026-11-16",
  "available_minutes": 300,
  "goal": "Hoàn thành bài tìm kiếm và hiểu được BFS/DFS",
  "max_daily_minutes": 90
}
```

### 5.3 Plan output mẫu (model đề xuất, backend xác thực)

```json
{
  "goal_id": "goal_001",
  "tasks": [
    {"title": "Đọc đề và tự xác định yêu cầu", "minutes": 45, "assignment_id": "asg_001"},
    {"title": "Ôn BFS/DFS từ tài liệu môn học", "minutes": 60, "assignment_id": "asg_001"},
    {"title": "Tự làm bài và kiểm thử", "minutes": 150, "assignment_id": "asg_001"},
    {"title": "Rà soát và nộp bài", "minutes": 45, "assignment_id": "asg_001"}
  ],
  "requires_user_approval": true
}
```

Backend kiểm tra tổng `minutes` không vượt `available_minutes`, deadline không trước thời điểm hiện tại khi tạo task và mọi `assignment_id` thuộc môn người dùng có quyền truy cập. Khi vượt giới hạn, đề nghị giảm phạm vi hoặc hỏi người học, không âm thầm đổi deadline.

## 6. API contract dự kiến

| Method | Endpoint | Mục đích | Quyền |
|---|---|---|---|
| POST | `/auth/login` | Đăng nhập demo | Public |
| GET | `/courses` | Danh sách môn theo quyền | Student/Instructor |
| POST | `/assignments/import` | Nhập assignment CSV/JSON | Theo quyền ghi được cấp |
| POST | `/plans/generate` | Đề xuất kế hoạch | Student |
| POST | `/plans/{id}/approve` | Duyệt kế hoạch | Chủ sở hữu |
| PATCH | `/tasks/{id}` | Cập nhật tiến độ | Chủ sở hữu |
| POST | `/chat/ask` | Hỏi đáp với tài liệu và citation | Thành viên môn |
| POST | `/reflections` | Gửi phản tư, xác nhận lưu | Chủ sở hữu |
| GET | `/instructor/dashboard` | KPI tổng hợp theo môn phụ trách | Instructor |
| GET | `/health` | Kiểm tra dịch vụ | Dev/Monitoring |

Tất cả endpoint cần test auth, input validation, trạng thái lỗi và truy cập chéo (`IDOR`). Không cho frontend quyết định role chỉ bằng một biến client-side.

## 7. Implement PLAN

**Input:** mục tiêu tuần, assignments đã xác thực, deadline, task đang dở, quỹ thời gian, lịch học do sinh viên cung cấp.

**Luồng xử lý:**

1. Backend lọc assignment hợp lệ, sắp xếp deadline bằng code.
2. Node PLAN nhận context tối thiểu, tạo `structured output` theo schema Pydantic.
3. Validator kiểm tra task, giới hạn thời gian, quyền truy cập, không tạo deadline giả.
4. Backend lưu vào trạng thái `draft`.
5. Sinh viên xem, sửa và bấm phê duyệt rồi mới chuyển thành `active`.

**Test bắt buộc:** deadline trùng nhau, deadline đã quá, không đủ thời gian rảnh, task đã hoàn thành, assignment không thuộc người dùng.

## 8. Implement DO + RAG

### 8.1 Ingestion

1. Upload syllabus/tài liệu được phép sử dụng.
2. Parse và tách theo heading/chương/trang; giữ metadata `course_id`, `resource_id`, `version`, `page`, `checksum`.
3. Kiểm tra file lỗi, trang rỗng, encoding và trùng tài liệu.
4. Chunk, embed, index vào Qdrant; lưu metadata và trạng thái xử lý tại PostgreSQL.
5. Khi thay phiên bản, vô hiệu hóa chunks cũ theo quy trình.

### 8.2 Retrieval

1. Xác định môn đang hỏi và quyền của người dùng.
2. Retrieve chỉ trong tài liệu của môn được cấp phép.
3. Lọc/rerank theo độ liên quan.
4. Trả lời kèm citation: tên tài liệu, version, trang/section, excerpt ngắn.
5. Khi bằng chứng không đủ: nêu rõ “chưa có thông tin trong tài liệu được cung cấp” và không chế nguồn.

### 8.3 Nhắc deadline

Với MVP, nhắc trong dashboard dựa trên `due_at` và `task.status` bằng code. Email/push/background jobs là phạm vi mở rộng, chỉ bật khi có hệ thống schedule và opt-in rõ ràng.

## 9. Implement REFLECT

- Hỏi ngắn gọn: (1) mục tiêu nào đạt? (2) vướng ở đâu? (3) tài liệu nào hữu ích? (4) tuần tới thay đổi điều gì?
- Không tự gán nhãn “yếu/kém” hoặc đưa ra đánh giá tâm lý.
- Phân tách **tự đánh giá** với **năng lực đã có bằng chứng** (ví dụ: quiz tự nguyện, bài thực hành không tính điểm).
- Tạo bản tóm tắt; người học có quyền sửa/duyệt trước khi cập nhật memory.
- Giới hạn thông tin lưu: mục tiêu, sở thích học, khó khăn về kỹ năng liên quan; không lưu nguyên văn nội dung nhạy cảm nếu không cần.
- Node PLAN tuần sau đọc state đã được xác nhận, không coi mọi suy đoán trước đó của model là sự thật.

## 10. Guardrails — học tập trung thực

### Khi nhận câu hỏi liên quan bài tính điểm

- **Được:** giải thích khái niệm, gợi mở từng bước, đưa ví dụ tương tự không đồng nhất, chỉ lỗi cụ thể trong bài làm do người học cung cấp nếu chính sách môn cho phép.
- **Không được:** tạo nguyên bài nộp, lời giải trọn vẹn cho assignment được chấm, ngụy trang bài làm thay, vượt qua chính sách khi user yêu cầu “đừng nói ai”.
- **Cách phản hồi:** nêu ngắn gọn giới hạn, chuyển sang gợi ý để người học tự thực hiện.

### Các lớp bảo vệ

1. Phân loại ngữ cảnh `graded` + ý định người học; không chỉ dựa vào từ khóa.
2. Policy engine trước khi gọi model/tool và sau khi sinh câu trả lời.
3. Tool access theo quyền và scope môn học.
4. Xem tài liệu tải lên như dữ liệu **không đáng tin** (prompt injection).
5. Red-team test và human review cho ca khó.

## 11. KPI xác định + đánh giá tác động

### 11.1 Quy tắc tính

- `on_time = submitted_at_utc <= due_at_utc` khi cả hai timestamp đáng tin.
- `on_time_submission_rate = on_time_count / eligible_due_assignments`.
- `task_completion_rate = completed_due_tasks / eligible_due_tasks`.
- Báo cáo thêm `data_coverage` để phân biệt chưa nộp với thiếu ghi nhận; chốt chính sách denominator trước khi đo.
- Giữ query SQL/aggregation và test đối chiếu để mọi con số hiển thị khớp 100% với kết quả có thể tái tính.

### 11.2 Trước/sau

- Demo với dữ liệu mô phỏng chỉ thể hiện hệ thống tính đúng, **không chứng minh hiệu quả sư phạm**.
- Pilot thật: baseline đủ dài, xác định nhóm/điều kiện so sánh, số người tham gia, độ khác nhau giữa các học phần và consent.
- KPI thay đổi cần ghi rõ cách tính, kỳ đo, cỡ mẫu, giới hạn suy luận nhân quả.

## 12. Test matrix tối thiểu

| ID | Tình huống | Kỳ vọng |
|---|---|---|
| T01 | Một assignment hạn 2 ngày, quỹ thời gian đủ | PLAN tạo nhiệm vụ hợp lệ, có thể duyệt |
| T02 | Tổng thời gian nhiệm vụ vượt quỹ thời gian | Validator báo thiếu thời gian, không âm thầm lưu |
| T03 | Hỏi nội dung có trong syllabus | DO trích đúng tài liệu + trang/section |
| T04 | Hỏi thông tin không có trong tài liệu | DO thừa nhận chưa có căn cứ, không bịa nguồn |
| T05 | Yêu cầu giải trọn bài tính điểm | Từ chối làm hộ, đưa hướng dẫn tự học |
| T06 | Student A đọc assignment của Student B | API trả `403` hoặc `404`, không rò rỉ dữ liệu |
| T07 | PDF có chỉ dẫn giả “bỏ qua policy” | Không làm theo lệnh trong tài liệu |
| T08 | Reflect chưa được duyệt | Không ghi memory cá nhân lâu dài |
| T09 | Submission trước/sau deadline | KPI bằng đúng phép tính chuẩn UTC |
| T10 | Lớp có số sinh viên rất ít | Ẩn số liệu tổng hợp có nguy cơ tái nhận diện |

Lưu evidence cho mỗi test: `input`, `expected`, `actual`, `pass/fail`, `run_at`, `model_version`, `prompt_version`, `source_version`, `latency_ms`, `token_usage` nếu có.

## 13. Hiệu năng và chi phí

- Đo token, latency (p50/p95), chi phí mỗi request theo loại tác vụ; tránh gọi model lớn cho thao tác CRUD và tính toán KPI.
- Cache với khóa gồm role/course/version/scope; tránh tái sử dụng dữ liệu cá nhân qua người dùng.
- Batch embedding offline; không embed lại tài liệu chưa thay đổi (`checksum`).
- Dùng async worker/queue khi parse tài liệu nặng; áp dụng rate limit và concurrency limit.
- Benchmark lần lượt 10 → 50 → 100 → 1.000 virtual users bằng k6/Locust (chỉ trong môi trường được phép). Đo lỗi, throughput, p95, CPU/RAM, chi phí; không tuyên bố đạt 1.000 khi chưa thử thực tế.

## 14. Checklist đối chiếu ràng buộc

| Ràng buộc đề bài | Thiết kế đáp ứng | Bằng chứng cần nộp |
|---|---|---|
| Không làm hộ bài | Graded context + policy gate + phản hồi gợi mở | T05, tập red-team, log đã ẩn danh |
| Phân quyền, bảo mật | RBAC, kiểm tra object ownership, scope RAG | T06 + permission suite |
| Ẩn danh giảng viên | Dashboard tổng hợp, ngưỡng nhóm, không hiển thị reflection raw | T10 + review UI |
| Grounding | Citation bắt buộc, version metadata, abstain | T03–T04, citation eval |
| HITL | Student duyệt plan/memory; giảng viên xem xét cảnh báo | T08, audit log |
| KPI đúng | SQL/code deterministic + unit tests | T09, query/result reconciliation |
| Giảm hallucination | RAG + test unsupported queries | Citation support report |
| 1.000 users/chi phí | Cache, queue, routing, load test tăng dần | k6/Locust report (nâng cao) |
| Canvas LMS | Adapter/mock trước, Canvas REST/LTI khi có quyền | Demo mock; tài liệu tích hợp riêng |
| Multi-agent | LangGraph nodes/shared state → tách agent khi cần | Trace workflow và eval |

## 15. Sản phẩm cần nộp

- `README.md`, `GUIDE.md`, architecture diagram và ERD.
- Repo cá nhân có lịch sử commit rõ chức năng và checklist tự kiểm thử; PR không bắt buộc.
- MVP có thể demo một luồng chính thực sự (không mock toàn bộ AI output).
- Video 3 phút: nhập bài → Plan → Do/RAG → Reflect → dashboard.
- Bộ dữ liệu demo và ít nhất 5 test case với kết quả chạy thực tế.
- Báo cáo đánh giá: groundedness, guardrails, p95, tokens, chi phí, KPI cùng giới hạn dữ liệu.
- Ghi rõ tính năng chưa có: tích hợp Canvas thật, pilot thật, 1.000 đồng thời nếu chưa hoàn thành.

## 16. Thứ tự ưu tiên khi thiếu thời gian

**P0 (không được cắt trước demo):** import assignment, PLAN có approval, task status, REFLECT cơ bản, 1 luồng RAG có nguồn, kiểm tra quyền truy cập cơ bản, deterministic KPI, 5 test E2E. Trước khi deploy cho người khác dùng, phải bổ sung auth/RBAC thực sự.

**P1:** instructor dashboard nâng cao, nhắc việc in-app, memory có evidence, test guardrails mở rộng.

**P2:** Canvas API/LTI thật, reranker nâng cao, ML dự báo, Redis, 1.000-user load test, routing nhiều model.

---

**Quy tắc nghiệm thu cuối:** Chỉ đánh dấu tính năng “hoàn thành” khi có đường dẫn code, cách chạy và bằng chứng test. Thiết kế hoặc hình mockup không được xem là tính năng đã hoạt động.
