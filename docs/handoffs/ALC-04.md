# ALC-04 - API GET nhiệm vụ theo tuần

- Agent / ngày / trạng thái: GitHub Copilot / 24/11/2026 / DONE
- Base SHA, branch, worktree / commit hoặc đường dẫn diff: Checkout hiện không có Git metadata nên không xác định được base SHA hoặc diff Git; không tạo branch/worktree.
- Phạm vi đã làm:
  - Thêm `GET /api/courses/{course_id}/tasks?week_start=YYYY-MM-DD` trong `backend/app/api.py`.
  - Thêm Pydantic `TaskResult` với `id`, `title`, `day`, `estimated_minutes`, `status`.
  - Kiểm tra ngày theo định dạng và tính hợp lệ lịch trước khi cộng sáu ngày.
  - Dùng `authorize(db, user, course_id, "student")`, lọc chủ task/học phần/cửa sổ bảy ngày và sắp xếp `day ASC, id ASC`.
  - Khai báo `response_model`, response `200`, `401`, `403`, `422`, `503` trong decorator.
  - Giữ nguyên POST `201` và PATCH `200` hiện có.
  - Bổ sung test API cho danh sách rỗng, ngày đầu/cuối, nhiệm vụ cùng ngày, PATCH rồi GET, cách ly sinh viên/học phần và các mã lỗi.
- Tiêu chí nghiệm thu đã đối chiếu:
  - Cửa sổ truy vấn bao gồm `week_start` và sáu ngày sau.
  - Response rỗng là `[]`; response có dữ liệu theo thứ tự ổn định.
  - `401` cho thiếu/token sai/hết hạn; `403` cho sai role, thiếu enrollment hoặc course không tồn tại; `422` cho thiếu/sai ngày.
  - OpenAPI thấy query `week_start` bắt buộc, format pattern, và các response HTTP đã khai báo.
- Test:
  - Lệnh: `python -m pytest backend/tests/test_api.py -q -p no:cacheprovider`
  - Môi trường: Windows, Python 3.13.17, `DISABLE_SQLALCHEMY_CEXT=1`, `PYTHONPATH=.test-deps`, `PYTHONDONTWRITEBYTECODE=1`.
  - Kết quả: **34/34 đạt**, 0 thất bại, exit 0.
- OpenAPI đã kiểm tra:
  - `course_id`: path, bắt buộc.
  - `week_start`: query, bắt buộc, pattern `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`.
  - Responses: `200`, `401`, `403`, `422`, `503`.
- Diff/tệp thay đổi:
  - `backend/app/api.py`: route GET, `TaskResult`, validation cửa sổ tuần và truy vấn.
  - `backend/tests/test_api.py`: các ca regression ALC-04.
  - `docs/handoffs/ALC-04.md`: phiếu bàn giao này.
- Ví dụ response `200`:

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "title": "Luyện nghe",
    "day": "2026-11-24",
    "estimated_minutes": 20,
    "status": "done"
  },
  {
    "id": "00000000-0000-4000-8000-000000000002",
    "title": "Ôn từ vựng",
    "day": "2026-11-24",
    "estimated_minutes": 15,
    "status": "todo"
  }
]
```

- Ví dụ response rỗng:

```json
[]
```

- Ví dụ lỗi `422`:

```json
{"detail":"week_start must be a valid date in YYYY-MM-DD format"}
```

- Lỗi hoặc ca chưa kiểm chứng:
  - Không xác định được diff Git do checkout không có repository metadata.
  - Không chạy PostgreSQL live riêng cho task này; test chạy FastAPI/TestClient/SQLite offline theo yêu cầu.
  - Không chạy sửa đổi frontend hoặc workflow AI.
