import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
export function middleware(request: NextRequest) { return updateSession(request); }
export const config = { matcher: ["/login", "/register", "/teacher/:path*", "/student/:path*", "/join/:path*", "/api/((?!health).*)"] };
