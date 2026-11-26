import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { configured } from "@/lib/supabase/config";
import type { Role } from "@/types/database";
import { Brand } from "./brand";
import { WorkspaceNav } from "./workspace-nav";

export async function WorkspaceLayout({role,children}:{role:Role;children:React.ReactNode}) {
  if (!configured()) redirect("/login");
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) redirect("/login");
  const {data:profile,error}=await db.from("profiles").select("full_name,role").eq("id",user.id).single();
  if (error || !profile) throw new Error("Không thể đọc hồ sơ tài khoản.");
  if (profile.role!==role) redirect("/"+profile.role);
  return <div className="workspace-shell"><aside className="workspace-sidebar"><Brand/><WorkspaceNav role={role} name={profile.full_name || "Tài khoản"}/></aside><div className="workspace-main">{children}</div></div>;
}
