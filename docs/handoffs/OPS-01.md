# OPS-01 — Git base và worktree

Codex · 24/11/2026 · BLOCKED

Tại `D:\must_try\agent_tro_li_hoc_tap` trên Windows PowerShell, `git status --short --branch` trả exit 1. `git rev-parse --show-toplevel`, `git rev-parse HEAD` và `git worktree list` cũng trả `fatal: not a git repository (or any of the parent directories): .git`. Thư mục gốc không có mục `.git`. Chưa xác định được lịch sử, branch, base SHA hoặc thay đổi hiện tại theo Git.

Để tiếp tục OPS-01, cần đường dẫn checkout Git gốc của dự án từ người dùng. Khi có checkout, Codex kiểm tra root, branch, HEAD, trạng thái và danh sách worktree trước khi chọn base và tạo worktree cho tác vụ đã được duyệt. Snapshot hiện tại dùng được cho khảo sát tài liệu ALC-01.
