import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { vi } from "@/lib/i18n/vi";

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

export function checkDb(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new HttpError(403, vi.api.forbidden);
  if (error.code === "23505") throw new HttpError(409, vi.api.duplicate);
  if (error.code === "P0001") throw new HttpError(400, error.message);
  if (error.code?.startsWith("22") || error.code?.startsWith("23")) {
    throw new HttpError(400, vi.api.invalidData);
  }
  if (error.code === "PGRST116") throw new HttpError(404, vi.api.notFound);
  throw new HttpError(500, vi.api.queryFailed);
}

export async function session(role?: "teacher" | "student") {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new HttpError(401, vi.api.signIn);
  const profile = await db.from("profiles").select("role").eq("id", user.id).single();
  checkDb(profile.error);
  if (!profile.data || (role && role !== profile.data.role)) {
    throw new HttpError(403, vi.api.roleForbidden);
  }
  return { db, user, role: profile.data.role };
}

export type Session = Awaited<ReturnType<typeof session>>;

export async function requireGroup(ctx: Session, id: string) {
  const result = await ctx.db.from("groups").select("id,teacher_id,language").eq("id", id).maybeSingle();
  checkDb(result.error);
  if (!result.data) throw new HttpError(404, vi.api.groupNotFound);
  if (ctx.role === "teacher" && result.data.teacher_id !== ctx.user.id) {
    throw new HttpError(403, vi.api.otherTeacherGroup);
  }
  return result.data;
}

export async function jsonBody(req: Request) {
  try {
    return await req.json() as unknown;
  } catch {
    throw new HttpError(400, vi.api.invalidJson);
  }
}

export async function respond(action: () => Promise<unknown>) {
  try {
    return Response.json(await action(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof ZodError) {
      const field = err.issues[0]?.path.join(".");
      return Response.json({ error: field ? vi.api.invalidField.replace("{field}", field) : vi.api.invalidData }, { status: 400 });
    }
    const failure = err instanceof HttpError ? err : new HttpError(500, vi.api.serviceUnavailable);
    return Response.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
