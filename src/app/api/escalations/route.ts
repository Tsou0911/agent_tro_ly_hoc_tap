import { z } from "zod";
import { checkDb, jsonBody, requireGroup, respond, session } from "@/lib/api";

const question = z.object({
  group_id: z.string().uuid(), question: z.string().trim().min(1).max(4000), ai_context: z.string().max(8000).default(""),
});
const reply = z.object({ id: z.string().uuid(), teacher_reply: z.string().trim().min(1).max(5000) });

export function GET() {
  return respond(async () => {
    const { db } = await session();
    const result = await db.from("escalations").select("*").order("created_at", { ascending: false });
    checkDb(result.error);
    return { escalations: result.data };
  });
}

export function POST(req: Request) {
  return respond(async () => {
    const ctx = await session("student");
    const input = question.parse(await jsonBody(req));
    await requireGroup(ctx, input.group_id);
    const result = await ctx.db.from("escalations").insert({ ...input, student_id: ctx.user.id }).select("id").single();
    checkDb(result.error);
    return result.data;
  });
}

export function PATCH(req: Request) {
  return respond(async () => {
    const { db } = await session("teacher");
    const input = reply.parse(await jsonBody(req));
    const result = await db.from("escalations").update({
      teacher_reply: input.teacher_reply, status: "answered", answered_at: new Date().toISOString(),
    }).eq("id", input.id).select("id").single();
    checkDb(result.error);
    return result.data;
  });
}
