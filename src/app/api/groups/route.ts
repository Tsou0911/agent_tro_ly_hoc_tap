import { randomInt } from "node:crypto";
import { z } from "zod";
import { checkDb, HttpError, jsonBody, respond, session } from "@/lib/api";
import { normalizeJoinCode } from "@/lib/auth-path";
import { vi } from "@/lib/i18n/vi";

const create = z.object({
  name: z.string().trim().min(1).max(120),
  language: z.string().trim().min(1).max(80),
}).strict();
const join = z.object({
  join_code: z.string().transform(normalizeJoinCode).pipe(z.string().length(6)),
}).strict();
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateJoinCode() {
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export function GET() {
  return respond(async () => {
    const { db } = await session();
    const result = await db.from("groups")
      .select("id,teacher_id,name,language,join_code,created_at")
      .order("created_at", { ascending: false });
    checkDb(result.error);
    return { groups: result.data };
  });
}

export function POST(req: Request) {
  return respond(async () => {
    const ctx = await session();
    const input = z.union([join, create]).parse(await jsonBody(req));
    if ("join_code" in input) {
      if (ctx.role !== "student") throw new HttpError(403, vi.groups.errors.unauthorizedJoin);
      const result = await ctx.db.rpc("join_group", { p_code: input.join_code });
      if (result.error?.code === "P0001" && result.error.message === "invalid join code") {
        throw new HttpError(404, vi.groups.errors.invalidJoinCode);
      }
      checkDb(result.error);
      return { id: result.data };
    }
    if (ctx.role !== "teacher") throw new HttpError(403, vi.groups.errors.teacherOnlyCreate);
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await ctx.db.from("groups").insert({
        ...input, teacher_id: ctx.user.id, join_code: generateJoinCode(),
      }).select("id,join_code").single();
      if (result.error?.code === "23505") continue;
      checkDb(result.error);
      return result.data;
    }
    throw new HttpError(503, vi.groups.errors.createFailed);
  });
}
