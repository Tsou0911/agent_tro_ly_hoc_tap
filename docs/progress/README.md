# Tiến trình AI Learning Companion

## Đã hoàn thành

- **PLAN** nhận mục tiêu tiếng Anh, CEFR tự đánh giá, kỹ năng ưu tiên và phút rảnh
  theo ngày. Người học có thể sửa và lưu từng nhiệm vụ. Giao diện kiểm tra quỹ phút
  trước khi lưu và đưa nhiệm vụ đã duyệt vào danh sách cập nhật trạng thái trong phiên.
- **DO** có hai luồng tự luyện và góp ý bài nháp, hiển thị nguồn do backend trả
  về và thông báo khi thiếu căn cứ. Guardrail nhận diện thêm yêu cầu viết hộ bài
  luận tính điểm được diễn đạt rõ bằng tiếng Anh.
- **REFLECT** cho xem nhiệm vụ đã đánh dấu hoàn thành trong phiên, ghi lại kỹ năng,
  khó khăn và thời gian tuần sau. Người học xác nhận hoặc thu hồi ghi chú ngay từ kết quả.
- Các form khóa thao tác khi yêu cầu đang chạy, phân biệt lỗi với xác nhận thành
  công và xử lý token lỗi, hết hạn hoặc bị API từ chối. PLAN dùng số phút nguyên
  JSON, cần ít nhất một ngày có thời gian rảnh. API giữ các endpoint và trường
  hiện có. CEFR và kỹ năng đi trong `message`.
- Demo dùng học phần `english101` và học liệu tự viết tại
  [data/samples/english_chunks.json](../../data/samples/english_chunks.json).
  Fixtures và kết quả JSON dùng dữ liệu tổng hợp.

## Provider Gemini

- [llm.py](../../backend/app/llm.py) gọi Gemini Developer API qua `httpx` và
  giữ interface `generate(prompt, payload, schema)`. Key đi qua header
  `x-goog-api-key`. Adapter dùng structured output, kiểm tra toàn bộ schema
  Pydantic và chuyển phản hồi lỗi, bị chặn hoặc bị cắt thành `ModelUnavailable`.
- [config.py](../../backend/app/config.py), [main.py](../../backend/app/main.py)
  và [.env.example](../../.env.example) cấu hình `GEMINI_API_KEY` và model
  mặc định `gemini-3.5-flash-lite`. Đây là model duy nhất adapter chấp nhận.
  Runtime dùng một provider, không retry HTTP hoặc fallback. Guardrails,
  quyền truy cập, trích dẫn và hợp đồng API giữ nguyên.
- Mẫu cấu hình để trống key. Không sửa `.env`. Thông số và nguồn chính thức
  được ghi ở [hướng dẫn Gemini và Free Tier](../../backend/README.md#gemini-và-free-tier).

## File chính

- Giao diện, session và kiểu API tại [page.tsx](../../frontend/app/page.tsx),
  [student-forms.tsx](../../frontend/app/student-forms.tsx) và [api.ts](../../frontend/app/api.ts).
- Validation, nhận diện yêu cầu làm hộ và seed demo tại [contracts.py](../../backend/app/contracts.py),
  [api.py](../../backend/app/api.py), [auth.py](../../backend/app/auth.py),
  [guardrails.py](../../backend/app/guardrails.py) và [cli.py](../../backend/app/cli.py).
- [Fixture tiếng Anh](../../eval/fixtures/english_workflow.json),
  [test workflow và seed](../../backend/tests/test_english_eval.py),
  [test API backend](../../backend/tests/test_api.py) và
  [test frontend](../../frontend/tests/api.test.mjs).
- [Cách chạy demo và test](../../backend/README.md),
  [cách xuất báo cáo](../../eval/README.md) và
  [JSON kết quả](../../eval/reports/english-workflow-offline.json).

## Kiểm thử chuyển provider

Chạy từ thư mục gốc với các phụ thuộc sẵn có trong `.test-deps`.

```powershell
$env:DISABLE_SQLALCHEMY_CEXT = '1'
$env:PYTHONPATH = (Resolve-Path .test-deps).Path
python -m pytest backend/tests/test_provider.py -q -p no:cacheprovider --tb=short
python -m pytest backend/tests -q -p no:cacheprovider --tb=short
```

- **33/33 test provider** và **92/92 test backend** pass, mã thoát 0.
  [Test provider](../../backend/tests/test_provider.py) dùng `httpx.MockTransport`
  để kiểm tra payload cả bốn schema, lỗi đã sanitize, cấu hình thiếu, timeout,
  429 và chặn redirect. [Test API](../../backend/tests/test_api.py) kiểm tra
  Gemini Validator lỗi thì workflow trả HTTP 503 và không phát hành bản nháp.
- Toàn bộ lần chạy dùng mock, không gửi request Gemini thật. Không chạy lại
  frontend build vì không có thay đổi frontend hay hợp đồng API.

## Kiểm thử giao diện và eval trước khi chuyển provider

Backend chạy từ thư mục gốc trên Windows với các phụ thuộc sẵn có trong `.test-deps`.

```powershell
$env:DISABLE_SQLALCHEMY_CEXT = '1'
$env:PYTHONPATH = (Resolve-Path .test-deps).Path
python -m pytest backend/tests -q -p no:cacheprovider --tb=short --english-eval-report eval/reports/english-workflow-offline.json
python -m pytest backend/tests/test_english_eval.py -q -p no:cacheprovider --english-eval-report eval/reports/english-workflow-offline.json
```

- Suite backend đạt **71/71**. Lần chạy riêng đạt **9/9**, gồm 8 ca workflow và 1
  test chạy seed lặp. JSON ghi **8/8** ca workflow và có cùng SHA-256 giữa hai lần chạy.
- Lần kiểm tra trung gian khi test khởi tạo Qdrant bằng URL `:memory:` đạt 41,
  thất bại 2 và lỗi setup 6. Suite cuối giả lập retriever ở lifespan; test
  retrieval riêng vẫn dùng Qdrant in-memory.
- Trong `frontend`, `node --test tests/api.test.mjs` đạt **5/5** với fetch giả lập.
  Node báo cảnh báo nhận diện module ESM. `npm.cmd run lint -- --incremental false`
  chạy thành công.
- Trong `frontend`, `npm.cmd run build` thành công và kết thúc với mã 0.
  Lần chạy đầu báo `EPERM` khi ghi vào `.next`. Build chạy lại với quyền ghi
  được cấp, gồm biên dịch và kiểm tra TypeScript. Không chạy luồng trình duyệt
  tương tác.

## Còn phụ thuộc dịch vụ hoặc dữ liệu

- Demo tích hợp cần PostgreSQL, Qdrant, học liệu tiếng Anh đã ingest, FastEmbed
  và cấu hình đăng nhập demo. Workflow AI live cần Gemini key có quyền dùng
  model và quota dự án. Các test dùng SQLite, dữ liệu tổng hợp và mock. Key,
  tier, quota và kết quả model thật chưa được xác minh.
- API hiện có lưu nhiệm vụ và cập nhật trạng thái. Danh sách và tổng kết tiến độ
  trên giao diện chỉ gồm nhiệm vụ ghi nhận trong phiên đang mở. Thời lượng hiển
  thị là số phút dự kiến.

## Việc tiếp theo

- Khi chủ động chạy live, xác nhận dự án Gemini ở Free Tier trong AI Studio và
  dùng biến `GEMINI_API_KEY` hiện có. Có thể để `GEMINI_MODEL` chưa khai báo để
  dùng mặc định. Chạy demo `english101` với học liệu tổng hợp để kiểm tra duyệt
  kế hoạch, nguồn phản hồi, nhiệm vụ và phản tư từ giao diện.
- Nếu cần hiển thị nhiệm vụ qua các phiên, bổ sung contract đọc danh sách theo
  người dùng và học phần, cùng test phân quyền.
- Khi đánh giá model thật, chốt tiêu chí cho mức độ phù hợp với mục tiêu và trình
  độ, chất lượng gợi mở, độ bám nguồn và xử lý yêu cầu bài tính điểm. Lưu kết quả
  kèm phiên bản model, prompt và học liệu để đối chiếu.
