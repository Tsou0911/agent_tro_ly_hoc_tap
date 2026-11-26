import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { settings } from "./config";

export async function createClient() {
  const jar = await cookies();
  const {url, key} = settings();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({name, value, options}) => jar.set(name, value, options));
        } catch {
          // Server Components are read-only. Middleware persists refreshed sessions.
        }
      }
    }
  });
}
