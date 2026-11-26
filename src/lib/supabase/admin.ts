import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { settings } from "./config";

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Thiếu cấu hình dịch vụ Supabase trên máy chủ.");
  return createClient<Database>(settings().url, key, {auth: {autoRefreshToken: false, persistSession: false}});
}
