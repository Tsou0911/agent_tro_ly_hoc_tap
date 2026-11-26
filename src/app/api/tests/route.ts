import { z } from "zod";
import { checkDb, jsonBody, requireGroup, respond, session, type Session } from "@/lib/api";

const uuid = z.string().uuid();
const question = z.object({
  question_type: z.enum(["mcq", "short_answer", "essay"]),
  prompt: z.string().trim().min(1).max(4000), options: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
  correct_answer: z.string().trim().max(2000).default(""), rubric: z.string().trim().max(4000).default(""),
  points: z.number().positive().max(1000),
}).refine(q => {
  if (q.question_type === "essay") return true;
  if (!q.correct_answer) return false;
  return q.question_type !== "mcq" || (q.options.length >= 2 && new Set(q.options).size === q.options.length && q.options.includes(q.correct_answer));
});
const exam = z.object({
  group_id: uuid, title: z.string().trim().min(1).max(200), description: z.string().max(2000).default(""),
  due_date: z.string().datetime({ offset: true }).nullish(), time_limit_mins: z.number().int().min(1).max(1440).nullish(),
  is_published: z.boolean().default(true), questions: z.array(question).min(1).max(80),
});
const begin = z.object({ action: z.literal("begin"), test_id: uuid });
const submission = z.object({ test_id: uuid, answers: z.record(uuid, z.string().max(10000)).refine(obj => Object.keys(obj).length <= 80) });
const grade = z.object({ id: uuid, teacher_score: z.number().min(0).max(100) });
const publish = z.object({ test_id: uuid, is_published: z.literal(true) });

async function questions(ctx: Session, id: string) {
  const result = await ctx.db.rpc("list_test_questions", { p_test_id: id });
  checkDb(result.error);
  return result.data;
}

export function GET(req: Request) {
  return respond(async () => {
    const ctx = await session();
    const id = new URL(req.url).searchParams.get("test_id");
    if (id) return { questions: await questions(ctx, uuid.parse(id)) };
    const result = await ctx.db.from("tests").select("*").order("created_at", { ascending: false });
    checkDb(result.error);
    return { tests: result.data };
  });
}

export function POST(req: Request) {
  return respond(async () => {
    const payload = await jsonBody(req);
    const start = begin.safeParse(payload);
    if (start.success) {
      const ctx = await session("student");
      const id = start.data.test_id;
      const result = await ctx.db.rpc("begin_test", { p_test_id: id });
      checkDb(result.error);
      return { deadline: result.data, questions: await questions(ctx, id) };
    }
    const ctx = await session("teacher");
    const input = exam.parse(payload);
    await requireGroup(ctx, input.group_id);
    const result = await ctx.db.rpc("create_test_with_questions", {
      p_group_id: input.group_id, p_title: input.title, p_description: input.description,
      p_due_date: input.due_date ?? null, p_time_limit_mins: input.time_limit_mins ?? null,
      p_is_published: input.is_published, p_questions: input.questions,
    });
    checkDb(result.error);
    return { id: result.data };
  });
}

export function PUT(req: Request) {
  return respond(async () => {
    const { db } = await session("student");
    const input = submission.parse(await jsonBody(req));
    const result = await db.rpc("submit_test", { p_test_id: input.test_id, p_answers: input.answers });
    checkDb(result.error);
    return { id: result.data };
  });
}

export function PATCH(req: Request) {
  return respond(async () => {
    const { db } = await session("teacher");
    const input = z.union([grade, publish]).parse(await jsonBody(req));
    if ("test_id" in input) {
      const published = await db.from("tests").update({ is_published: true }).eq("id", input.test_id).select("id").single();
      checkDb(published.error);
      return published.data;
    }
    const result = await db.rpc("grade_attempt", { p_attempt_id: input.id, p_score: input.teacher_score });
    checkDb(result.error);
    return { id: input.id };
  });
}
