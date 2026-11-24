# ALC-01 — Đề xuất API đọc nhiệm vụ theo tuần

Codex · 24/11/2026 · REVIEW. Người dùng yêu cầu tiếp tục theo kế hoạch. Đặc tả đã được rà soát trên snapshot hiện tại và chờ người dùng duyệt contract. Git chưa nhận diện checkout nên chưa có base SHA, branch, worktree hay diff Git.

## Contract đề xuất

`GET /api/courses/{course_id}/tasks?week_start=2026-11-23` yêu cầu Bearer token và một `week_start` dạng ngày lịch `YYYY-MM-DD`. Ngày phải tồn tại và cộng được sáu ngày trong miền `date`. Khoảng truy vấn từ `week_start` đến `week_start + 6 ngày`, bao gồm hai đầu. `StudyTask.day` là kiểu `Date` nên dùng ngày đã lưu trực tiếp. UI mặc định thứ Hai của tuần hiện tại bằng `mondayOf(today())` và truyền ngày người dùng chọn. API chấp nhận mọi ngày bắt đầu hợp lệ, phù hợp cửa sổ bảy ngày của PLAN/REFLECT hiện tại.

API dùng `principal` và `authorize(..., "student")`, rồi truy vấn theo `StudyTask.course_id == course_id`, `StudyTask.student_id == principal.id` và khoảng ngày. Sắp xếp theo `day ASC, id ASC`. Mỗi bản ghi được trả với ID và trạng thái hiện có, kể cả bản ghi tạo trước khi bổ sung GET. Truy vấn dùng schema DB hiện tại.

Khai báo response model Pydantic rõ ràng cho `200` với mảng item. Mỗi item gồm `id` (string), `title` (string), `day` (string, format `date`), `estimated_minutes` (integer), `status` (`todo` | `in_progress` | `done`). Model đọc cần phản ánh dữ liệu đã lưu. `TaskInput` kiểm tra đầu vào ghi với tiêu đề được trim và số phút nguyên từ 1 đến 1440. Ràng buộc DB về số phút chỉ yêu cầu số dương, nên model đọc tránh áp lại giới hạn nhập liệu có thể loại bản ghi cũ. Client có thể dùng `TaskInput & TaskResult` làm kiểu hàng và gắn `course` từ đường dẫn để tạo `Task`.

| HTTP | Điều kiện | Body |
| --- | --- | --- |
| `200` | Có quyền, không có nhiệm vụ trong phạm vi | `[]` |
| `200` | Có quyền, có nhiệm vụ trong phạm vi | Mảng item theo thứ tự đã định |
| `401` | Thiếu Bearer token hoặc token lỗi/hết hạn | `{"detail":"Bearer token required"}` hoặc `{"detail":"Invalid token"}` theo `principal`. Trường hợp thiếu token có `WWW-Authenticate: Bearer` theo hành vi hiện tại. |
| `403` | `week_start` hợp lệ, token hợp lệ nhưng sai role, thiếu enrollment hoặc học phần không tồn tại | `{"detail":"Course access denied"}` |
| `422` | Thiếu hoặc sai `week_start`, với yêu cầu từ người học có quyền | `detail` dạng mảng lỗi validation, trường `query.week_start` |
| `503` | Lỗi DB hoặc cấu hình xác thực chưa sẵn sàng | `{"detail":"Database operation unavailable"}` hoặc `{"detail":"Authentication is not configured"}` |

OpenAPI của GET cần thể hiện `week_start` là query bắt buộc, kiểu string với format `date`, `HTTPBearer` và response `200` là mảng item. Khai báo response lỗi `401`, `403`, `422` và `503` tương ứng với bảng trên. Kiểm tra định dạng `YYYY-MM-DD` và giới hạn ngày trước khi cộng sáu ngày. Với token hợp lệ, lỗi xác thực query có thể trả `422` trước khi handler kiểm tra quyền học phần.

Ví dụ `200` cho tuần bắt đầu `2026-11-23` với hai nhiệm vụ cùng ngày. Ví dụ `422` dùng `week_start=2026-11-31` với phiên người học có quyền. Ví dụ `401` bỏ header Bearer. Ví dụ `403` dùng phiên giảng viên hợp lệ cho cùng đường dẫn và ngày hợp lệ.

```json
[
  {"id":"00000000-0000-4000-8000-000000000001","title":"Luyện nghe","day":"2026-11-24","estimated_minutes":20,"status":"done"},
  {"id":"00000000-0000-4000-8000-000000000002","title":"Ôn từ vựng","day":"2026-11-24","estimated_minutes":15,"status":"todo"}
]
```

## Tải lại trong giao diện

Mục Nhiệm vụ và REFLECT lấy dữ liệu khi mở lần đầu, đăng nhập lại, đổi học phần hoặc đổi tuần đang xem. REFLECT truyền chính `week_start` của lượt đánh giá. Sau POST từ PLAN hay Nhiệm vụ, tải lại danh sách đang xem nếu ngày vừa lưu thuộc tuần đó. Sau PATCH thành công, tải lại học phần và tuần của nhiệm vụ đã sửa nếu phạm vi đó đang hiển thị. POST `201` và PATCH `200` tiếp tục trả `{id, status}`. Khi người dùng đổi phiên, học phần hoặc tuần trong lúc tải, chỉ áp dụng kết quả còn khớp với phạm vi hiện tại. UI phân biệt đang tải, danh sách rỗng và lỗi. Nếu ghi thành công nhưng tải lại lỗi, lần thử lại thực hiện GET để tránh tạo trùng.

## Đối chiếu và kiểm thử

- OpenAPI sinh từ `app.openapi()` trên snapshot có POST `201` dùng `TaskInput` và PATCH `200` dùng `TaskStatus`, cả hai có `HTTPBearer` và khai báo `422`. Đường dẫn collection hiện chỉ có POST. Chạy với `DISABLE_SQLALCHEMY_CEXT=1`, `PYTHONPATH` trỏ tới `.test-deps` và `PYTHONDONTWRITEBYTECODE=1`, không khởi động lifespan.
- Đã đối chiếu `backend/app/api.py`, `backend/app/auth.py`, `backend/app/main.py`, `backend/app/models.py`, `backend/app/contracts.py` và kiểu `TaskInput`, `TaskResult`, `Task` trong `frontend/app/api.ts`. `fetchApi` gửi Bearer và chấp nhận mảng JSON, kể cả `[]`.
- Windows PowerShell, Python 3.13.17, cùng cấu hình Python ở trên. `python -m pytest backend/tests/test_api.py -q -p no:cacheprovider` đạt 20/20, 0 thất bại, FastAPI TestClient/SQLite với fixture tổng hợp và provider giả lập.
- Windows PowerShell, Node v26.13.1, từ `frontend`. `node --test tests/api.test.mjs` đạt 5/5, 0 thất bại, fetch giả lập. Node báo cảnh báo nhận dạng ESM. `npm.cmd run lint -- --incremental false` đạt, exit 0.
- Sau yêu cầu tiếp tục ngày 24/11/2026, chạy lại suite API và test frontend, vẫn đạt 20/20 và 5/5, 0 thất bại.
- Các ví dụ GET là tiêu chí nghiệm thu cho ALC-04. Khi có route, chạy thêm các ca ngày đầu/cuối và ngày ngoài khoảng, thứ tự cùng ngày, GET sau PATCH, chủ sở hữu khác trong cùng học phần, học phần khác, `401`/`403`/`422` và xác nhận OpenAPI có response model mảng. ALC-05 kiểm tra tải lại và đổi phạm vi trên UI.

## Bàn giao

Người dùng xác nhận contract này, gồm cửa sổ bảy ngày từ ngày chọn, trường response và mã lỗi. Sau khi contract được duyệt và OPS-01 xác lập Git base, GitHub Copilot nhận ALC-04. ALC-05 theo sau ALC-04. BUG-01 còn mở cho đến khi có bằng chứng API/UI sau reload.
