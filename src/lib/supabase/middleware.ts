import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configured, settings } from "./config";
import type { Database } from "@/types/database";
import { roleDestination } from "@/lib/auth-path";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({request});
  const { pathname, searchParams } = request.nextUrl;
  const area = /^\/(teacher|student)(?:\/|$)/.exec(pathname)?.[1];
  const isAuthPage = pathname === "/login" || pathname === "/register";
  function redirect(destination: string, next?: string) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    if (destination === "/login" && next) url.searchParams.set("next", next);
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie));
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }
  if (!configured()) return area ? redirect("/login") : response;
  const {url, key} = settings();
  const db = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({name, value}) => request.cookies.set(name, value));
        response = NextResponse.next({request});
        values.forEach(({name, value, options}) => response.cookies.set(name, value, options));
      }
    }
  });
  const { data: { user } } = await db.auth.getUser();
  const requestedPath = pathname + request.nextUrl.search;
  if (!user) return area ? redirect("/login", requestedPath) : response;
  if (!area && !isAuthPage) return response;

  const { data: profile, error } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (area && (error || !profile)) return redirect("/login", requestedPath);
  if (profile && (isAuthPage || profile.role !== area)) {
    return redirect(roleDestination(profile.role, isAuthPage ? searchParams.get("next") : null));
  }
  return response;
}
