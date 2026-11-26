/** Phản ánh schema.sql. UUID, ngày và timestamptz đi qua PostgREST dưới dạng chuỗi. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined }
export type Role = 'teacher' | 'student'
export type QuestionType = 'mcq' | 'short_answer' | 'essay'
export type PracticeMode = 'listening' | 'speaking' | 'writing' | 'image'
type EventType = 'test_completed' | 'listening_done' | 'speaking_done' | 'writing_done' | 'doc_question'
type Entity = { id: string }
type Created = Entity & { created_at: string }
type InGroup = { group_id: string }
type Learner = InGroup & { student_id: string }
type ForeignKey<Name extends string, Column extends string, Ref extends string> = {
  foreignKeyName: Name
  columns: [Column]
  isOneToOne: false
  referencedRelation: Ref
  referencedColumns: ['id']
}
type GroupFK<T extends string> = ForeignKey<`${T}_group_id_fkey`, 'group_id', 'groups'>
type PersonFK<T extends string, C extends string> = ForeignKey<`${T}_${C}_fkey`, C, 'profiles'>
type Table<R, Required extends keyof R, Relationships extends unknown[] = []> = {
  Row: R
  Insert: Pick<R, Required> & Partial<Omit<R, Required>>
  Update: Partial<R>
  Relationships: Relationships
}

type Profile = Created & { full_name: string | null; role: Role }
type Group = Created & { teacher_id: string; name: string; language: string; join_code: string }
type Aim = Created & InGroup & {
  title: string; description: string; start_date: string; end_date: string
  target_tests: number; target_min_score: number; target_listening: number; target_writing: number; target_speaking_mins: number
}
type Material = Created & InGroup & { uploader_id: string; title: string; file_url: string; file_type: string }
type Chunk = Entity & InGroup & { material_id: string; chunk_index: number; content: string; fts: string }
type Test = Created & InGroup & {
  creator_id: string; title: string; description: string; due_date: string | null; time_limit_mins: number | null; is_published: boolean
}
type Question = Entity & {
  test_id: string; order_index: number; question_type: QuestionType; prompt: string; options: Json; correct_answer: string | null
  rubric: string | null; points: number
}
type Attempt = Entity & {
  test_id: string; student_id: string; answers: Json; auto_score: number; ai_feedback: Json
  teacher_score: number | null; status: 'submitted' | 'graded'; submitted_at: string
}
type Escalation = Created & Learner & {
  question: string; ai_context: string; teacher_reply: string | null; status: 'open' | 'answered'; answered_at: string | null
}
type Practice = Created & Learner & {
  mode: PracticeMode; topic: string; input_summary: string; ai_feedback: Json; score: number | null; duration_seconds: number
}
type Event = Created & Learner & { event_type: EventType; numeric_value: number; metadata: Json }
type Mastery = Entity & Learner & {
  skill: 'listening' | 'speaking' | 'reading' | 'writing' | 'grammar_vocab'; mastery_prob: number; updated_at: string
}
type Reflection = Created & Learner & {
  week_start: string; plan_goals: Json; reflection_chat: Json; strengths: string; weaknesses: string; next_week_action: string
}
export type AimProgress = { tests: number; listening: number; writing: number; speaking_mins: number; percent: number }
type Tables = {
  profiles: Table<Profile,'id'|'role'>
  groups: Table<Group,'teacher_id'|'name'|'language',[PersonFK<'groups','teacher_id'>]>
  memberships: Table<Learner & { joined_at: string }, keyof Learner,[GroupFK<'memberships'>,PersonFK<'memberships','student_id'>]>
  aims: Table<Aim,'group_id'|'title'|'start_date'|'end_date',[GroupFK<'aims'>]>
  materials: Table<Material,'group_id'|'uploader_id'|'title'|'file_url'|'file_type',[GroupFK<'materials'>,PersonFK<'materials','uploader_id'>]>
  material_chunks: Table<Chunk,'group_id'|'material_id'|'chunk_index'|'content',[GroupFK<'material_chunks'>, {
    foreignKeyName: 'material_chunks_material_id_group_id_fkey'
    columns: ['material_id','group_id']; isOneToOne: false; referencedRelation: 'materials'; referencedColumns: ['id','group_id']
  }]> & { Insert: { fts?: never }; Update: { fts?: never } }
  tests: Table<Test,'group_id'|'creator_id'|'title',[GroupFK<'tests'>,PersonFK<'tests','creator_id'>]>
  test_questions: Table<Question,'test_id'|'order_index'|'question_type'|'prompt',[ForeignKey<'test_questions_test_id_fkey','test_id','tests'>]>
  test_attempts: Table<Attempt,'test_id'|'student_id'|'answers'|'auto_score'|'status',[ForeignKey<'test_attempts_test_id_fkey','test_id','tests'>,PersonFK<'test_attempts','student_id'>]>
  escalations: Table<Escalation,keyof Learner|'question',[GroupFK<'escalations'>,PersonFK<'escalations','student_id'>]>
  practice_sessions: Table<Practice,keyof Learner|'mode'|'topic'|'input_summary',[GroupFK<'practice_sessions'>,PersonFK<'practice_sessions','student_id'>]>
  activity_events: Table<Event,keyof Learner|'event_type',[GroupFK<'activity_events'>,PersonFK<'activity_events','student_id'>]>
  skill_mastery: Table<Mastery,keyof Learner|'skill',[GroupFK<'skill_mastery'>,PersonFK<'skill_mastery','student_id'>]>
  weekly_reflections: Table<Reflection,keyof Learner|'week_start',[GroupFK<'weekly_reflections'>,PersonFK<'weekly_reflections','student_id'>]>
}
export type Row<T extends keyof Tables> = Tables[T]['Row']
type Rpc<Args, Returns> = { Args: Args; Returns: Returns }
export type Database = {
  public: {
    Tables: Tables
    Views: Record<never, never>
    Functions: {
      join_group: Rpc<{ p_code: string },string>
      preview_group_invite: Rpc<{ p_code: string },Pick<Group, 'name' | 'language'>[]>
      save_material: Rpc<{ p_group_id: string; p_title: string; p_file_url: string; p_file_type: string; p_chunks: string[] },string>
      create_test_with_questions: Rpc<{
        p_group_id: string; p_title: string; p_description: string; p_due_date: string | null; p_time_limit_mins: number | null
        p_is_published: boolean; p_questions: Json
      },string>
      begin_test: Rpc<{ p_test_id: string },string | null>
      begin_practice: Rpc<{ p_id: string; p_group_id: string },string>
      list_test_questions: Rpc<{ p_test_id: string },Omit<Question,'correct_answer'|'rubric'>[]>
      submit_test: Rpc<{ p_test_id: string; p_answers: Json },string>
      grade_attempt: Rpc<{ p_attempt_id: string; p_score: number },undefined>
      aim_progress: Rpc<{ p_aim_id: string; p_student_id: string },AimProgress[]>
      group_aim_progress: Rpc<{ p_group_id: string },(AimProgress & LearnerProgressKey)[]>
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
type LearnerProgressKey = { aim_id: string; student_id: string }
