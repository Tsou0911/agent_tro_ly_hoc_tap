
# Codex prompt pack — lang-companion

Các prompt viết bằng tiếng Anh (ngắn hơn, ít token hơn); giao diện app vẫn là tiếng Việt theo AGENTS.md.

## 0. Chuẩn bị (làm tay, ~20 phút)

1. Tạo repo trống. Copy `AGENTS.md` vào thư mục gốc, `schema.sql` vào `supabase/schema.sql`.
2. Supabase (free): tạo project → SQL Editor → dán và chạy `schema.sql`. Auth → Providers → Email: tắt "Confirm email" cho nhanh khi demo.
3. Chạy 9router, tạo 1 combo gồm 3-4 model free (ví dụ tên `free-stack`), lấy API key.
4. Tạo `.env.local` (Codex sẽ tạo `.env.example` ở P0):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   LLM_BASE_URL=http://localhost:20128/v1
   LLM_API_KEY=...
   LLM_MODEL=free-stack
   LLM_MODEL_FAST=free-stack
   ```
5. `~/.codex/config.toml` (kiểm tra tên model bằng `/model`, vì danh sách phụ thuộc gói và client của bạn):
   ```toml
   model = "gpt-6.2-sol"
   model_reasoning_effort = "medium"
   plan_mode_reasoning_effort = "high"

   [agents]
   default_subagent_model = "gpt-6-luna"
   default_subagent_reasoning_effort = "medium"
   ```

## 1. Chọn model và mức suy luận

| Việc                                                 | Model        | Effort       |
| ----------------------------------------------------- | ------------ | ------------ |
| Mặc định cho mọi prompt                           | Sol          | medium       |
| P0 scaffold, P5 inbox, P10 seed, P11 deploy           | Sol          | low          |
| P4 (lõi agent): lập kế hoạch bằng `/plan`      | Sol          | high         |
| P4: viết code sau khi duyệt plan                    | Sol          | medium       |
| Audit RLS/bảo mật (prompt R1)                       | Sol          | high         |
| Sol sai 2 lần liên tiếp một lỗi khó (prompt R2) | Astra        | high         |
| Max, Ultra                                            | không dùng | không dùng |

## 2. Quy trình mỗi prompt (tiết kiệm token)

1. `/new` để mỗi tính năng có một phiên sạch, không kéo theo ngữ cảnh cũ.
2. Dán prompt. Không dán thêm log hay file dài; chỉ nêu đường dẫn.
3. Xem diff, chạy `pnpm typecheck && pnpm lint && pnpm test`.
4. `git commit`. Nếu Codex làm hỏng, `git reset --hard` rồi chạy lại, đừng nhờ nó sửa chồng sửa.

---

## P0 — Scaffold (Sol, low)

```
Scaffold the project in this empty repo per AGENTS.md.
- Next.js App Router + TypeScript strict + Tailwind + shadcn/ui (button, input, card, dialog, tabs, table, badge, textarea, select, progress, sonner), pnpm, vitest, eslint.
- Create the folder structure from AGENTS.md; placeholder files only where needed.
- Scripts: dev, lint, typecheck, test, build.
- .env.example with: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_MODEL_FAST.
- src/lib/i18n/vi.ts: typed string map + t() helper; all UI text in Vietnamese through it.
- Landing page with two CTAs: register as teacher / as student.
No features yet. typecheck+lint must pass. Reply in <=8 lines.
```

## P1 — Auth và vai trò (Sol, medium)

```
Implement auth + roles with Supabase (@supabase/ssr).
- src/lib/supabase/{client,server,admin}.ts. admin uses SUPABASE_SERVICE_ROLE_KEY, server-only.
- Middleware refreshes session and guards routes: /teacher/** needs role teacher, /student/** needs role student, otherwise redirect to /login.
- Pages: /login, /register (email, password, full name, role radio teacher|student sent as user metadata `role` and `full_name`; the profile row is created by the DB trigger in supabase/schema.sql), logout.
- After login redirect by role to /teacher or /student. Simple nav layout per role.
- Helper getSessionProfile() -> {user, profile}, used by server components and API routes.
- Vitest for the role-guard function.
```

## P2 — Nhóm, mã, link, QR (Sol, medium)

```
Implement groups.
Teacher: /teacher lists own groups + create dialog (name, target language). /teacher/groups/[id] with tabs: Members, Aims, Materials, Tests, Questions, Progress (only Members implemented now; others show "coming soon").
- Show join code, join link `${origin}/join/[code]`, QR (qrcode.react), copy buttons.
- Members tab lists students; teacher can remove a member.
Student: /student lists joined groups. /join/[code]: if logged out -> login/register then return here; if student -> call RPC join_group(code), redirect to /student/groups/[id] (group home page with placeholders).
Use the RLS-safe join via RPC from supabase/schema.sql. Vitest for join-code extraction.
```

## P3 — Tài liệu và truy xuất (Sol, medium)

```
Implement materials + retrieval.
- Teacher Materials tab: upload PDF/DOCX/TXT/MD (max 10MB) to Storage bucket `materials` at `{group_id}/{uuid}-{filename}`; insert a materials row.
- POST /api/materials/ingest: verify caller is the group's teacher -> download file -> extract text (pdf-parse, mammoth) -> chunk (~800 chars, 100 overlap, sentence-aware, unicode-safe) -> insert chunks rows. Show status and chunk count; allow delete.
- src/lib/rag/search.ts: searchChunks(groupId, question): build an OR tsquery from unicode words (drop very short words, max 12 terms, escape special chars), call RPC search_chunks, return [{materialId, fileName, idx, content}].
- Vitest for chunk.ts and the tsquery builder.
```

## P4 — Lõi agent: gia sư AI (Sol, `/plan` high rồi build medium)

```
/plan then implement the AI tutor agent.
1. src/lib/llm/client.ts: OpenAI-compatible fetch client (no SDK) using LLM_BASE_URL/LLM_API_KEY. chat({model, messages, json?}) with 30s timeout, 1 retry, clear errors. src/lib/llm/schemas.ts with zod.
2. src/lib/agent/classify.ts (LLM_MODEL_FAST): classify the student message into JSON {intent: 'in_materials'|'in_scope_no_source'|'out_of_scope'|'do_my_work'|'practice_request', reason}.
3. src/lib/agent/answer.ts: for in_materials, retrieve chunks and answer (LLM_MODEL) grounded ONLY in them. Return {answer, citations:[{fileName, idx}]}. Explanations in Vietnamese, examples in the group's target language. If retrieval is empty or irrelevant -> escalate.
4. src/lib/agent/guardrails.ts: for do_my_work (e.g. "write my essay", "give me all the test answers") refuse kindly and give hints/outline steps, never finished graded work. Add a regex pre-filter for obvious cases.
5. src/lib/agent/escalate.ts: insert escalations row {group_id, student_id, question, ai_context}; tell the student it was sent to the teacher.
6. POST /api/tutor: auth student who is a member; zod body {groupId, message, history (max 10)}; returns {type:'answer'|'escalated'|'refused'|'offtopic', ...}. Log activity_events 'chat_question'. Rate limit 20 req/min/user.
7. UI /student/groups/[id]/chat: messages, citation chips, distinct states for escalated/refused, loading. Image attach button stubbed.
Vitest with mocked LLM: classification routing, guardrail refuses 10 adversarial "do my work" prompts.
```

## P5 — Hộp thư câu hỏi cho giáo viên (Sol, low)

```
Teacher "Questions" tab: list escalations (open first) with the student's question + AI context and a reply form that sets status 'answered', answer, answered_at. Student chat shows answered escalations as teacher messages (poll every 20s). Show an open-count badge in teacher nav.
```

## P6 — Aim và tiến độ (Sol, medium)

```
Implement aims + deterministic progress.
- Teacher Aims tab: CRUD aims for the group (title, description, metric, target, starts_at, ends_at), applied to all students of the group.
- src/lib/progress/aims.ts: pure computeAimProgress(aim, events, attempts) -> {value, target, pct, status:'done'|'on_track'|'at_risk'|'late'}; at_risk when time-elapsed% minus progress% > 25 points; late when past ends_at and not done. Thorough unit tests incl. edge cases.
- Teacher Progress tab: students x aims table with progress bars + status badges, at_risk first; click a student for detail.
- Student group home: own aims with progress and days left.
All reads server-side; activity is written by server routes via the admin client.
```

## P7 — Bài test kiểu Google Form (Sol, medium)

```
Implement tests.
- Teacher Tests tab: create test (title, due_at); question builder for mcq (options + correct), short (list of accepted answers), essay (rubric); reorder; publish toggle. Answers/rubrics go in question_keys, never sent to students.
- Student: list published tests, take test on one page, submit once.
- POST /api/tests/[id]/submit (admin client after auth+membership checks): grade mcq and short deterministically (trim, case- and diacritic-insensitive); grade essay with LLM_MODEL against the rubric -> zod-validated {score, feedback}; store auto_score, set needs_review on essays; compute attempts.score.
- Teacher reviews per-student results and can override essay score/feedback (final_score); attempt score recomputed.
- Student sees score + feedback after submit. Log 'test_submitted' (value = score pct).
Vitest for the grading functions.
```

## P8 — Luyện nghe và viết (Sol, medium)

```
Implement Listening and Writing practice (student, inside a group).
Listening: pick topic + level -> POST /api/practice/listening: LLM generates a short dialogue/passage in the group's target language plus 4 mcq questions as JSON (zod). Player uses browser speechSynthesis (voice by language, speed control, max 3 replays). After answering show score + explanations. Save practice_sessions; log 'listening_done'.
Writing: pick a prompt (LLM-suggested or own) -> student writes -> POST /api/practice/writing -> LLM feedback JSON {scores:{grammar,vocab,coherence,task}, corrections:[{original,suggestion,why}], next_steps[]}. Never output a full rewritten text. Save + log 'writing_submitted'.
Feature-detect speechSynthesis; fallback button shows the transcript. Vitest for schema parsing.
```

## P9 — Luyện nói và nhập ảnh (Sol, medium)

```
Implement Speaking and Image input.
Speaking: /student/groups/[id]/speak. Pick topic + level. Browser SpeechRecognition (lang from group) push-to-talk -> text; speechSynthesis speaks the AI reply. LLM acts as a conversation partner: short turns, one follow-up question, gentle inline corrections. On finish POST /api/practice/speaking-feedback with the transcript -> JSON feedback (fluency, vocab, grammar, 3 tips). Save duration; log 'speaking_minutes' (value = minutes). If SpeechRecognition is unsupported show typed input and a note to use Chrome.
Image: allow attaching an image (<=4MB, resized client-side to <=1280px) in tutor chat and practice. If the model supports vision send it as an image content part; otherwise OCR in the browser with tesseract.js and send the text. Use cases: explain vocabulary/meaning in the image, or have the student describe it and get feedback.
Keep it minimal and robust; no other new deps.
```

## P10 — Seed dữ liệu và đo guardrails (Sol, low)

```
- scripts/seed.ts (tsx, admin client, idempotent): 1 teacher, 5 students, 1 English group, 3 short sample materials (write them yourself, ingest + chunk), 2 aims, 1 published test with mixed question types, random activity_events over the past 10 days so the Progress tab shows on_track/at_risk/late. Print the credentials.
- tests/guardrails.test.ts: 30 prompts (10 legit in-scope, 10 out-of-scope, 10 do-my-work) run against the real LLM only when RUN_LLM_TESTS=1; print refusal/accuracy rates.
- Add scripts: seed, eval:guardrails.
```

## P11 — Deploy và README (Sol, low)

```
Prepare deployment. README.md in Vietnamese: Supabase setup + running schema.sql, env vars, running 9router and setting LLM_BASE_URL in production (tunnel or VPS), seeding, deploying on Vercel, and a 5-minute demo script. Add GET /api/health checking DB and LLM reachability. Ensure `pnpm build` passes.
```

---

## R1 — Audit bảo mật (Sol, high), chạy một lần sau P7

```
Review supabase/schema.sql and all route handlers for authorization holes: role escalation, students reading question_keys, cross-group data access, service-role use without auth+membership checks, missing zod validation. List findings by severity, fix with minimal diffs, add tests where feasible.
```

## R2 — Cứu hộ (Astra, high). Chỉ dùng khi Sol sai 2 lần

```
Bug: <hành vi sai, 1-2 câu>. Expected: <hành vi đúng>. Error: <thông báo lỗi chính xác>. Relevant files: <1-3 đường dẫn>.
Find the root cause, apply the minimal fix, add a regression test. Do not refactor.
```
