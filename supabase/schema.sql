-- lang-companion: Supabase schema (run once in Supabase SQL Editor)
-- Writes to attempts/answers/activity_events/practice_sessions are done server-side with the service role.

create extension if not exists pgcrypto;

-- ───────── Enums ─────────
create type user_role as enum ('teacher', 'student');
create type aim_metric as enum ('practice_sessions', 'test_score', 'speaking_minutes', 'writing_submissions');
create type question_kind as enum ('mcq', 'short', 'essay');
create type practice_kind as enum ('listening', 'writing', 'speaking');
create type activity_type as enum ('chat_question', 'test_submitted', 'listening_done', 'writing_submitted', 'speaking_minutes');
create type escalation_status as enum ('open', 'answered');

-- ───────── Tables ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  full_name text,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  language text not null default 'en',
  join_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);

create table memberships (
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create table aims (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  description text,
  metric aim_metric not null,
  target numeric not null check (target > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now()
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  idx int not null,
  content text not null,
  fts tsvector generated always as (to_tsvector('simple', content)) stored
);
create index chunks_fts_idx on chunks using gin (fts);
create index chunks_group_idx on chunks (group_id);

create table tests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  position int not null default 0,
  kind question_kind not null,
  prompt text not null,
  options jsonb,                       -- mcq: ["A","B","C","D"]
  points numeric not null default 1
);

-- teacher-only: correct answers and rubrics (never readable by students)
create table question_keys (
  question_id uuid primary key references questions(id) on delete cascade,
  answer jsonb,                        -- mcq: index; short: ["accepted","answers"]
  rubric text                          -- essay
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  unique (test_id, student_id)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  response text,
  auto_score numeric,
  final_score numeric,
  needs_review boolean not null default false,
  feedback text,
  unique (attempt_id, question_id)
);

create table escalations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  question text not null,
  ai_context text,
  status escalation_status not null default 'open',
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table activity_events (
  id bigserial primary key,
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  type activity_type not null,
  value numeric not null default 1,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index activity_group_student_idx on activity_events (group_id, student_id, created_at);

create table practice_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  kind practice_kind not null,
  topic text,
  transcript jsonb,
  feedback jsonb,
  score numeric,
  duration_sec int,
  created_at timestamptz not null default now()
);

-- ───────── Helper functions (security definer avoids RLS recursion) ─────────
create or replace function is_teacher_of(gid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from groups where id = gid and teacher_id = auth.uid());
$$;

create or replace function is_member_of(gid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where group_id = gid and student_id = auth.uid());
$$;

create or replace function shares_group_with(uid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from memberships m join groups g on g.id = m.group_id
    where (g.teacher_id = auth.uid() and m.student_id = uid)
       or (m.student_id = auth.uid() and g.teacher_id = uid)
  );
$$;

create or replace function is_teacher() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'teacher');
$$;

create or replace function my_role() returns user_role
language sql security definer set search_path = public stable as $$
  select role from profiles where id = auth.uid();
$$;

-- profile row auto-created on signup (role from signup metadata; defaults to student)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name)
  values (
    new.id,
    (case when new.raw_user_meta_data->>'role' = 'teacher' then 'teacher' else 'student' end)::user_role,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- students join a group by code (they cannot read groups they are not in)
create or replace function join_group(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'only students can join groups';
  end if;
  select id into gid from groups where join_code = p_code;
  if gid is null then raise exception 'invalid join code'; end if;
  insert into memberships (group_id, student_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;

-- full-text retrieval; p_query must be an OR tsquery built by the app, e.g. 'word1 | word2'
-- runs as invoker, so RLS applies
create or replace function search_chunks(p_group uuid, p_query text, p_limit int default 6)
returns table (id uuid, material_id uuid, idx int, content text, rank real)
language sql stable as $$
  select c.id, c.material_id, c.idx, c.content,
         ts_rank(c.fts, to_tsquery('simple', p_query)) as rank
  from chunks c
  where c.group_id = p_group and c.fts @@ to_tsquery('simple', p_query)
  order by rank desc
  limit p_limit;
$$;

-- ───────── Row Level Security ─────────
alter table profiles          enable row level security;
alter table groups            enable row level security;
alter table memberships       enable row level security;
alter table aims              enable row level security;
alter table materials         enable row level security;
alter table chunks            enable row level security;
alter table tests             enable row level security;
alter table questions         enable row level security;
alter table question_keys     enable row level security;
alter table attempts          enable row level security;
alter table answers           enable row level security;
alter table escalations       enable row level security;
alter table activity_events   enable row level security;
alter table practice_sessions enable row level security;

-- profiles
create policy profiles_select on profiles for select
  using (id = auth.uid() or shares_group_with(id));
create policy profiles_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = my_role());

-- groups
create policy groups_select on groups for select
  using (teacher_id = auth.uid() or is_member_of(id));
create policy groups_insert on groups for insert
  with check (teacher_id = auth.uid() and is_teacher());
create policy groups_update on groups for update using (teacher_id = auth.uid());
create policy groups_delete on groups for delete using (teacher_id = auth.uid());

-- memberships (insert only through join_group RPC)
create policy memberships_select on memberships for select
  using (student_id = auth.uid() or is_teacher_of(group_id));
create policy memberships_delete on memberships for delete
  using (student_id = auth.uid() or is_teacher_of(group_id));

-- aims
create policy aims_select on aims for select using (is_teacher_of(group_id) or is_member_of(group_id));
create policy aims_write  on aims for all using (is_teacher_of(group_id)) with check (is_teacher_of(group_id));

-- materials + chunks
create policy materials_select on materials for select using (is_teacher_of(group_id) or is_member_of(group_id));
create policy materials_write  on materials for all using (is_teacher_of(group_id)) with check (is_teacher_of(group_id));
create policy chunks_select on chunks for select using (is_teacher_of(group_id) or is_member_of(group_id));
create policy chunks_write  on chunks for all using (is_teacher_of(group_id)) with check (is_teacher_of(group_id));

-- tests
create policy tests_select on tests for select
  using (is_teacher_of(group_id) or (published and is_member_of(group_id)));
create policy tests_write on tests for all using (is_teacher_of(group_id)) with check (is_teacher_of(group_id));

-- questions (students see them only when the test is published)
create policy questions_select on questions for select using (
  exists (select 1 from tests t where t.id = questions.test_id
          and (is_teacher_of(t.group_id) or (t.published and is_member_of(t.group_id)))));
create policy questions_write on questions for all
  using (exists (select 1 from tests t where t.id = questions.test_id and is_teacher_of(t.group_id)))
  with check (exists (select 1 from tests t where t.id = questions.test_id and is_teacher_of(t.group_id)));

-- question_keys: teacher only
create policy question_keys_all on question_keys for all
  using (exists (select 1 from questions q join tests t on t.id = q.test_id
                 where q.id = question_keys.question_id and is_teacher_of(t.group_id)))
  with check (exists (select 1 from questions q join tests t on t.id = q.test_id
                 where q.id = question_keys.question_id and is_teacher_of(t.group_id)));

-- attempts / answers: read-only for clients, writes via server
create policy attempts_select on attempts for select using (
  student_id = auth.uid()
  or exists (select 1 from tests t where t.id = attempts.test_id and is_teacher_of(t.group_id)));
create policy answers_select on answers for select using (
  exists (select 1 from attempts a join tests t on t.id = a.test_id
          where a.id = answers.attempt_id and (a.student_id = auth.uid() or is_teacher_of(t.group_id))));

-- escalations
create policy escalations_select on escalations for select
  using (student_id = auth.uid() or is_teacher_of(group_id));
create policy escalations_insert on escalations for insert
  with check (student_id = auth.uid() and is_member_of(group_id));
create policy escalations_update on escalations for update using (is_teacher_of(group_id));

-- activity + practice: read-only for clients, writes via server
create policy activity_select on activity_events for select
  using (student_id = auth.uid() or is_teacher_of(group_id));
create policy practice_select on practice_sessions for select
  using (student_id = auth.uid() or is_teacher_of(group_id));

-- ───────── Storage: private bucket, path = {group_id}/{file} ─────────
insert into storage.buckets (id, name, public) values ('materials', 'materials', false)
on conflict (id) do nothing;

create policy materials_obj_select on storage.objects for select using (
  bucket_id = 'materials'
  and (is_teacher_of((storage.foldername(name))[1]::uuid) or is_member_of((storage.foldername(name))[1]::uuid)));
create policy materials_obj_insert on storage.objects for insert with check (
  bucket_id = 'materials' and is_teacher_of((storage.foldername(name))[1]::uuid));
create policy materials_obj_delete on storage.objects for delete using (
  bucket_id = 'materials' and is_teacher_of((storage.foldername(name))[1]::uuid));