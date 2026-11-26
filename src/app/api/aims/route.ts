import { z } from "zod";
import { checkDb, jsonBody, requireGroup, respond, session } from "@/lib/api";

const date = z.string().date();
const goal = z.number().int().nonnegative().max(100000);
const aim = z.object({
  group_id: z.string().uuid(), title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(""), start_date: date, end_date: date,
  target_tests: goal.default(0), target_min_score: z.number().min(0).max(100).default(0),
  target_listening: goal.default(0), target_writing: goal.default(0), target_speaking_mins: goal.default(0),
}).refine(v => v.start_date <= v.end_date && v.target_tests + v.target_listening + v.target_writing + v.target_speaking_mins > 0);
const reflection = z.object({
  group_id: z.string().uuid(), week_start: date.refine(v => new Date(v).getUTCDay() === 1),
  plan_goals: z.array(z.string().trim().min(1).max(1000)).max(30),
  strengths: z.string().max(3000).default(""), weaknesses: z.string().max(3000).default(""),
  next_week_action: z.string().max(3000).default(""),
});

export function GET(req: Request) {
  return respond(async () => {
    const ctx = await session();
    const groupId = z.string().uuid().parse(new URL(req.url).searchParams.get("group_id"));
    await requireGroup(ctx, groupId);
    const result = await ctx.db.rpc("group_aim_progress", { p_group_id: groupId });
    checkDb(result.error);
    return { progress: result.data ?? [] };
  });
}

export function POST(req: Request) {
  return respond(async () => {
    const ctx = await session("teacher");
    const input = aim.parse(await jsonBody(req));
    await requireGroup(ctx, input.group_id);
    const result = await ctx.db.from("aims").insert(input).select("id").single();
    checkDb(result.error);
    return result.data;
  });
}

export function PUT(req: Request) {
  return respond(async () => {
    const ctx = await session("student");
    const input = reflection.parse(await jsonBody(req));
    await requireGroup(ctx, input.group_id);
    const result = await ctx.db.from("weekly_reflections").upsert({ ...input, student_id: ctx.user.id }, { onConflict: "group_id,student_id,week_start" }).select("id").single();
    checkDb(result.error);
    return result.data;
  });
}
