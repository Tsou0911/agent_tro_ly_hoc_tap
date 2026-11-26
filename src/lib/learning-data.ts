import "server-only"
import { createClient } from "@/lib/supabase/server"
import { vi } from "@/lib/i18n/vi"

export async function classContext(query?: string) {
  const db = await createClient()
  const { data, error } = await db.from("groups").select("id,name,language,join_code,created_at").order("created_at", { ascending: false })
  if (error) throw new Error(vi.groups.errors.groupsUnavailable)
  const groups = data ?? []
  return { db, groups, group: groups.find(g => g.id === query) ?? groups[0] }
}

export function mondayInVietnam() {
  const now = new Date(Date.now() + 7 * 3600_000)
  now.setUTCDate(now.getUTCDate() - (now.getUTCDay() + 6) % 7)
  return now.toISOString().slice(0, 10)
}
