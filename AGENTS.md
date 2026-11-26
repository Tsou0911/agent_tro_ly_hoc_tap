
# AGENTS.md — lang-companion

## Product

Language-learning platform with AI tutor.

- Teacher: creates groups (join by code / link / QR), sets time-boxed aims, uploads course materials, builds tests (Google-Forms style), tracks aim progress, answers questions the AI escalates.
- Student: joins groups, asks the AI tutor (grounded in teacher materials, with citations), takes tests, practices listening / writing / speaking, can attach images.
- UI language: Vietnamese (all strings via `src/lib/i18n/vi.ts`). Target language is set per group (default English).

## Stack (free tiers only)

Next.js App Router + TypeScript (strict) + Tailwind + shadcn/ui, Supabase (Auth, Postgres, Storage, RLS), zod, vitest, pnpm. Deploy: Vercel.

## Commands

`pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`
Run typecheck + lint + test before finishing any task.

## Structure

```
src/app/(auth)/login|register
src/app/teacher/**          teacher pages
src/app/student/**          student pages
src/app/join/[code]         join-by-link/QR
src/app/api/**              route handlers
src/lib/supabase/{client,server,admin}.ts
src/lib/llm/{client,schemas}.ts
src/lib/agent/{classify,answer,guardrails,escalate}.ts
src/lib/rag/{extract,chunk,search}.ts
src/lib/progress/aims.ts
src/lib/speech/{recognize,speak}.ts
src/lib/i18n/vi.ts
supabase/schema.sql         SOURCE OF TRUTH for data model + RLS
scripts/seed.ts
```

## Hard rules

1. Roles live in `profiles.role` (teacher | student). Enforce with RLS AND server-side checks. Never trust the client.
2. Writes to attempts, answers, activity_events, practice_sessions go through server routes using the admin client AFTER verifying auth + group membership. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
3. Students must never receive `question_keys` (answers/rubrics).
4. LLM calls only via `src/lib/llm/client.ts` (OpenAI-compatible; env `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` for quality, `LLM_MODEL_FAST` for cheap tasks). No provider hardcoding, no provider SDKs. Default base URL is a 9router proxy (`http://localhost:20128/v1`).
5. Every structured LLM output is JSON validated with zod; retry once on parse failure, then return a friendly error.
6. Progress, aim status and objective grading (mcq/short) are deterministic code. The LLM never computes them.
7. Tutor behaviour: answer ONLY from retrieved chunks and cite `[file, chunk]`; no relevant source → escalate to teacher; out of scope → polite refusal; "do my work" requests → refuse and give hints/steps, never finished graded work.
8. Every API route: auth check → zod-validate input → logic → typed JSON response. Rate-limit LLM routes.
9. Speech uses the browser Web Speech API. Feature-detect and always provide a typed fallback.
10. Log learning actions to `activity_events` (type + value).

## Working style

- One feature per task. Small diffs. Do not touch unrelated files. No new dependency unless necessary.
- Read only the files you need; do not dump logs or whole files in replies.
- Add vitest tests for pure logic (chunking, grading, progress, schemas).
- Finish with a summary of at most 10 lines: what changed, what to run, what is left.
