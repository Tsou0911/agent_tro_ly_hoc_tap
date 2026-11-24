# Đánh giá offline cho luồng tiếng Anh

Chạy từ thư mục gốc với các phụ thuộc backend đã cài.

```powershell
python -m pytest backend/tests/test_english_eval.py -q -p no:cacheprovider --english-eval-report eval/reports/english-workflow-offline.json
```

`fixtures/english_workflow.json` chứa các tình huống tổng hợp, ID ổn định, đầu vào,
nguồn truy xuất dựng sẵn, bản nháp mock và kỳ vọng. Học liệu mẫu nguyên bản ở
`data/samples/english_chunks.json`. Suite chạy LangGraph và repository SQLite,
dùng `FakeRetriever`, `ScriptedLLM` và một lượt xét duyệt cho mỗi bản nháp mock.

`reports/english-workflow-offline.json` ghi phiên bản schema, chế độ
`offline_mock`, số ca chạy/đạt và dữ liệu từng ca gồm `id`, `input`,
`source_ids`, `expected`, `actual` và `passed`. Kết quả thực tế có lịch theo
ngày, trạng thái, phản hồi, citation IDs và các giá trị kiểm tra guardrail.
Để lưu nhiều lần chạy, truyền đường dẫn JSON khác trong `eval/reports/` và đối
chiếu các ca theo `id`, phiên bản fixture và chế độ chạy. Với fixture ổn định, JSON
có thể so sánh trực tiếp vì báo cáo bỏ timestamp và ID memory sinh ngẫu nhiên.

Kết quả kiểm tra việc chuyển tiếp bản nháp dựng sẵn và các điều kiện chặn của
workflow. Chất lượng bài luyện, phản hồi gợi mở, retrieval và kiểm định ngữ nghĩa
của model thật cần được đánh giá riêng.
