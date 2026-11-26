import { z } from "zod";
import { checkDb, jsonBody, requireGroup, respond, session } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { tutor } from "@/lib/agents/orchestrator";

const input = z.object({
  group_id: z.string().uuid(), question: z.string().trim().min(1).max(3000),
  image: z.string().max(4_000_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+=*$/u).optional(),
  ocr_text: z.string().trim().max(5000).optional(),
});

export function POST(req: Request) {
  return respond(async () => {
    const ctx = await session("student");
    const data = input.parse(await jsonBody(req));
    await requireGroup(ctx, data.group_id);
    const answer = await tutor(ctx, data);
    const admin = createAdminClient();
    const log = await admin.from("activity_events").insert({
      group_id: data.group_id, student_id: ctx.user.id, event_type: "doc_question", numeric_value: 1, metadata: {},
    });
    checkDb(log.error);
    return { answer };
  });
}
