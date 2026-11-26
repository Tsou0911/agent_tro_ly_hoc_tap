import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { settings } from "./config";
export function createClient() {
  const {url, key} = settings();
  return createBrowserClient<Database>(url, key);
}
