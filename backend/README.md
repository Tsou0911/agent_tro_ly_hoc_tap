# Chạy backend local

Chạy các lệnh sau từ thư mục gốc `agent_tro_li_hoc_tap` bằng PowerShell.
Backend dùng Python 3.13, PostgreSQL chạy bằng Docker Compose.
Kết nối dùng driver `pg8000` viết bằng Python vì Windows trên máy phát triển
chặn DLL của `psycopg`. `DATABASE_URL` dùng tiền tố `postgresql+pg8000://`.

1. Cài thư viện nếu môi trường Python hiện tại chưa có.

   ```powershell
   python -m pip install -r backend/requirements.txt
   ```

2. Lần đầu thiết lập, tạo `.env` nếu chưa có.

   ```powershell
   Copy-Item .env.example .env
   ```

   Đặt mật khẩu local trong `POSTGRES_PASSWORD` và cập nhật mật khẩu tương ứng
   trong `DATABASE_URL`. Nếu đổi `POSTGRES_PORT`, cập nhật cổng trong URL.
   Mật khẩu có ký tự đặc biệt cần được URL-encode trong `DATABASE_URL`.
   `.env` được loại khỏi Git. PostgreSQL dùng các biến này khi khởi tạo volume
   lần đầu, đổi `.env` sau đó cần đồng bộ với tài khoản trong database.

3. Mở Docker Desktop, rồi khởi động PostgreSQL và Qdrant.

   ```powershell
   docker compose up -d postgres qdrant
   ```

4. Chạy API, giữ terminal này mở.

   ```powershell
   python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. Mở `http://127.0.0.1:8000/docs` để xem API, hoặc kiểm tra bằng terminal khác.

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8000/health
   ```

   Kết nối thành công trả HTTP 200 với
   `{"status":"ok","database":"connected"}`.
   Database chưa sẵn sàng trả HTTP 503 với
   `{"status":"degraded","database":"unavailable"}`.

## Kiểm thử

```powershell
python -m pytest backend/tests/test_provider.py -q -p no:cacheprovider
python -m pytest backend/tests -q -p no:cacheprovider
```

Các test dùng SQLite, Qdrant in-memory khi kiểm tra retrieval và `httpx.MockTransport`
hoặc đầu ra dựng sẵn khi kiểm tra Gemini.
Suite không đọc `.env` và chạy được khi chưa khởi động dịch vụ.
Suite kiểm tra định dạng request, 429 giả lập, các nhánh graph, quyền truy cập,
citation giả, JSON sai, memory, escalation và KPI. Endpoint `/health` kiểm tra
kết nối DB. Quyền truy cập model và quota dự án cần kiểm chứng riêng.
Để chạy riêng bộ đánh giá tiếng Anh và xuất JSON, xem [eval/README.md](../eval/README.md).

Từ thư mục `frontend`, chạy `npm.cmd run build` và
`node --test tests/api.test.mjs` với Node.js hỗ trợ đọc TypeScript trực tiếp.
Test frontend giả lập fetch và kiểm tra phiên lưu trong trình duyệt, dữ liệu gửi API,
phản hồi lỗi và phép tính ngày.

## Chạy Multi-Agent

1. Dùng `GEMINI_API_KEY` từ dự án Free Tier trong `.env` hiện có. Khi không
   khai báo `GEMINI_MODEL`, backend chọn mặc định `gemini-3.5-flash-lite`.
   Nếu khai báo biến này, dùng đúng ID model trên. Backend từ chối giá trị rỗng
   hoặc model khác và bỏ qua các biến cấu hình provider cũ. Tạo `JWT_SECRET`
   ngẫu nhiên ít nhất 32 ký tự để ký token local.
2. Sau khi PostgreSQL sẵn sàng, khởi tạo schema và dữ liệu demo:

   ```powershell
   python -m backend.app.cli init-db
   python -m backend.app.cli seed-demo
   python -m backend.app.cli ingest data/samples/english_chunks.json
   ```

   FastEmbed tải model miễn phí và chạy trên CPU ở lần ingest đầu. Chờ Qdrant
   sẵn sàng trước ingest. Các tài liệu demo là dữ liệu minh họa, không phải syllabus thật.
   `init-db` chỉ tạo bảng thiếu; cần migration riêng nếu thay đổi schema đã tồn tại.
3. Khi chủ động chạy demo với Gemini thật, khởi động uvicorn như trên. Lấy token
   local (hết hạn sau 2 giờ) và gọi DO.

   ```powershell
   $studentToken = python -m backend.app.cli token student-demo student
   $headers = @{ Authorization = "Bearer $studentToken" }
   $body = @{
       mode = 'do'
       message = 'Tôi ở mức A2 và muốn tự luyện một cuộc hội thoại hỏi đường theo học liệu.'
       week_start = '2026-11-16'
   } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/courses/english101/workflow' -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
   ```

4. Đổi `message` thành câu hỏi ngoài môn, ví dụ thời tiết, để thử escalation.
   Đổi thành yêu cầu làm hộ bài nộp để thử academic refusal. Dashboard API:

   ```powershell
   $teacherToken = python -m backend.app.cli token instructor-demo instructor
   $teacherHeaders = @{ Authorization = "Bearer $teacherToken" }
   Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/instructor/courses/english101/escalations' -Headers $teacherHeaders
   Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/instructor/courses/english101/kpis?start=2026-11-16T00:00:00%2B07:00&end=2026-11-23T00:00:00%2B07:00' -Headers $teacherHeaders
   ```

KPI ban đầu có thể là `null` do chưa có task/submission. Đó là không đủ dữ liệu,
không phải lỗi hoặc thành tích 0%. PLAN trả đề xuất; sinh viên lưu các task đã duyệt
bằng `POST /api/courses/{id}/tasks`. REFLECT trả memory chờ duyệt; xác nhận bằng
`PUT /api/courses/{id}/memories/{memory_id}/approval` với `{"approved":true}`.
Xem toàn bộ schema qua `/docs` và [thiết kế Multi-Agent](../docs/MULTI_AGENT.md).

### Gemini và Free Tier

Backend gửi `POST /v1beta/models/{model}:generateContent` tới Gemini Developer
API. Key được đọc bằng `SecretStr` và gửi qua `x-goog-api-key`. Prompt của agent
đi qua `systemInstruction`, dữ liệu workflow đi qua `contents`, còn schema
Pydantic được chuyển sang tập từ khóa Gemini hỗ trợ cho `responseJsonSchema` với
`responseMimeType: application/json`. Kết quả vẫn phải qua toàn bộ validation
Pydantic và guardrails. [REST API](https://aistudio.google.com/api-reference/generate-content/generate-content) ·
[API key](https://aistudio.google.com/docs/api-key) ·
[Structured output](https://aistudio.google.com/docs/structured-output) ·
[Tên trường wire trong SDK chính thức](https://github.com/googleapis/python-genai/blob/main/google/genai/models.py)

Model duy nhất được bật là `gemini-3.5-flash-lite`. Google công bố đây là phiên
bản ổn định, có structured output, tối đa 1.048.576 token đầu vào và 65.536 token
đầu ra. Backend đặt `maxOutputTokens=3000` cho mỗi lượt và dùng
`LLM_TIMEOUT_SECONDS` (mặc định 45 giây). [Tài liệu model](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite)

Free Tier công bố miễn phí token đầu vào và đầu ra cho model trên với dự án đủ
điều kiện. Các giới hạn RPM, TPM và RPD áp dụng theo dự án. Xem hạn mức thực tế
trong AI Studio. Chi phí do tier của dự án quyết định, vì vậy để chỉ dùng miễn
phí hãy giữ dự án ở Free Tier. Backend gửi một request cho mỗi lần gọi model,
không bật công cụ tính phí, retry HTTP hoặc fallback. Phản hồi lỗi bị rút gọn
thành `unavailable`/HTTP 503 của workflow. Khi thiếu key hoặc model rỗng/sai
giá trị, backend ghi cảnh báo cố định về biến cần cấu hình.
[Bảng giá](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite) ·
[Giới hạn](https://aistudio.google.com/docs/rate-limits) ·
[Billing](https://aistudio.google.com/docs/billing)

### Windows chặn DLL SQLAlchemy

Nếu môi trường có SQLAlchemy bản binary bị Application Control chặn, có thể dùng
bản thuần Python trong thư mục kiểm thử riêng, không cần tắt bảo vệ Windows:

```powershell
$env:DISABLE_SQLALCHEMY_CEXT = '1'
python -m pip install --target .test-deps --no-binary=SQLAlchemy --no-deps 'SQLAlchemy==2.0.48'
python -m pip install --target .test-deps --no-deps 'ormsgpack==1.12.2'
$env:PYTHONPATH = (Resolve-Path .test-deps).Path
python -m pytest backend/tests -q -p no:cacheprovider
```

Đây cũng là cách chọn bản SQLAlchemy thuần Python khi chạy CLI/uvicorn trong cùng
terminal. FastEmbed/ONNX có native dependency riêng; nếu máy chặn, cần môi trường
Python/Docker được chính sách máy cho phép. Không thay đổi Application Control.
Trên máy phát triển, wheel `ormsgpack 1.13.1` bị chặn còn `1.12.2` chạy được;
requirements đã chọn bản đã kiểm thử cho Windows.

## Dừng dịch vụ

Dừng API bằng `Ctrl+C`. Dừng PostgreSQL bằng lệnh sau, dữ liệu giữ trong volume.

```powershell
docker compose stop postgres qdrant
```
