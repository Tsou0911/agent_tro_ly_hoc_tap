import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { joinDestination, roleDestination } from "@/lib/auth-path";
import { configured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const next = joinDestination(query.get("next"));
  const code = query.get("code");
  if (code && configured()) {
    const db = await createClient();
    const {data, error} = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const {data: profile} = await db.from("profiles").select("role").eq("id", data.user.id).single();
      if (profile) return NextResponse.redirect(new URL(roleDestination(profile.role, next), request.url));
    }
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("confirm", "retry");
  if (next) login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
