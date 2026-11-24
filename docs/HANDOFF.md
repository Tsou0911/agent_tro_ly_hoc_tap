# Bàn giao và khởi động ba Agent

Khảo sát và thiết lập tài liệu đã xong. Người dùng duyệt [kế hoạch](TASKS.md) trước khi triển khai. Thư mục hiện thiếu metadata Git và phiên audit không kết nối được Docker engine. [Bằng chứng](PROGRESS.md)

## Một vòng làm việc

1. **PLAN.** Codex chốt Task ID, owner, base SHA, dependency, trạng thái, allowlist và tiêu chí nghiệm thu. Người dùng phê duyệt thay đổi quan trọng. Codex đối chiếu allowlist và chốt một owner cho mỗi tệp trước khi mở task song song.
2. **IMPLEMENT.** Dùng branch `agent/<agent>/<task-id>` và worktree riêng. Chọn base đã tích hợp đúng dependency. Nếu chưa có Git, làm khảo sát và tài liệu lần lượt trên snapshot. Xác định checkout thật trước backlog thay đổi code.
3. **TEST.** Owner ghi chế độ chạy, lệnh, pass/fail, expected/actual và giới hạn. Cline review độc lập theo Task ID, diff và test liên quan. Báo lỗi ngoài allowlist để Codex phân công.
4. **REVIEW.** Codex xem diff, test, quyền và contract. Khi có tệp trùng, chờ task trước tích hợp hoặc điều chỉnh allowlist đã ghi nhận. Cập nhật base và chạy lại test sau giải quyết xung đột. Tích hợp lần lượt qua nhánh tích hợp hoặc PR khi được phép. Người dùng quyết định merge/push main.
5. **HANDOFF.** Owner tạo `docs/handoffs/<TASK-ID>.md`. Codex cập nhật [TASKS](TASKS.md), [PROGRESS](PROGRESS.md) và [BUG_REPORT](BUG_REPORT.md) sau review. Hồ sơ chung do Codex cập nhật tuần tự. Contract đã duyệt được cập nhật vào đặc tả khi tích hợp.

Ví dụ cho ALC-01 sau khi xác định checkout và base, với thư mục worktree có quyền ghi và chưa tồn tại.

```powershell
git status --short -b
git worktree list
$alcBase = git rev-parse HEAD
git worktree add -b agent/codex/alc-01 ../alc-codex-01 $alcBase
git -C ../alc-codex-01 status --short -b
```

Khi bàn giao, ghi `git diff --name-only <base>...HEAD` và `git status --short` để đối chiếu với allowlist. Ghép API trước UI và ghi các thay đổi có từ trước.

## Mẫu bàn giao

```markdown
# <Task ID> — <Tên task>

- Agent / ngày / trạng thái
- Base SHA, branch, worktree / commit hoặc đường dẫn diff
- Phạm vi đã làm và tệp thay đổi
- Tiêu chí nghiệm thu đã đối chiếu
- Test: lệnh, môi trường, mode, số đạt/thất bại, artifact
- Lỗi hoặc ca chưa kiểm chứng: expected / actual / blocker
- Quyết định cần duyệt, dependency tiếp theo và người nhận
```

## Khởi tạo trong VS Code

Mở đúng root của worktree, rồi dùng prompt của Agent. Codex có `AGENTS.md`. Kiểm tra `.github/copilot-instructions.md` trong danh sách custom instructions hoặc diagnostics của VS Code và `.clinerules/01-learning-companion.md` trong bảng Rules của Cline. Cả ba dùng cùng [AGENTS.md](../AGENTS.md) và hồ sơ task. [VS Code custom instructions](https://code.visualstudio.com/docs/agent-customization/custom-instructions) · [Cline workspace rules](https://github.com/cline/cline/blob/main/docs/customization/cline-rules.mdx)

### Prompt cho Codex

```text
Bạn là Codex, tech lead và Senior AI Engineer của AI Learning Companion.
Đọc AGENTS.md, hồ sơ ALC-01 trong docs/TASKS.md và docs/ARCHITECTURE.md.
Khi kế hoạch được duyệt, đối chiếu router, schemas, StudyTask và frontend
client. Đề xuất API đọc task theo học phần và tuần, quyền, thứ tự, response
và cách tải lại sau ghi. Ghi đối chiếu OpenAPI và ví dụ vào
docs/handoffs/ALC-01.md. Trình người dùng duyệt contract trước ALC-04.
Giữ phạm vi ở tài liệu.
```

### Prompt cho GitHub Copilot

```text
Bạn là GitHub Copilot, Full-stack Developer. Đọc AGENTS.md, hồ sơ ALC-02
trong docs/TASKS.md và hướng dẫn local ở backend/README.md. Sau khi kế hoạch
được duyệt, kiểm tra Docker engine. Khi sẵn sàng, chạy smoke demo tổng hợp
PostgreSQL, Qdrant, FastEmbed và Next build. Theo allowlist của ALC-02, ghi
lệnh, kết quả và blocker vào docs/handoffs/ALC-02.md. Giữ phạm vi smoke và
tài liệu. Không mở .env hoặc gọi Gemini live.
```

### Prompt cho Cline + Gemini

```text
Bạn là Cline + Gemini, QA độc lập. Đọc AGENTS.md, hồ sơ ALC-03 trong
docs/TASKS.md và eval/README.md. Mở riêng fixture tiếng Anh cùng các test
API/eval liên quan. Khi được duyệt, chạy hai suite offline ghi trong task.
Lập ma trận ngắn theo ca nghiệm thu, ghi expected/actual, mode và ca còn
thiếu vào docs/handoffs/ALC-03.md. Dùng dữ liệu tổng hợp, context theo task
và không gọi model của ứng dụng để chạy live.
```
