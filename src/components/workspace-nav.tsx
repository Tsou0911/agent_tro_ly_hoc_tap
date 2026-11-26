"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LayoutDashboard, LogOut, MessagesSquare, Mic, BookOpenText } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/types/database";

export function WorkspaceNav({role,name}:{role:Role;name:string}) {
  const pathname=usePathname();
  const router=useRouter();
  const [error,setError]=useState("");
  const items=role==="teacher" ? [
    {href:"/teacher",label:"Lớp học",Icon:LayoutDashboard},{href:"/teacher/tests",label:"Bài kiểm tra",Icon:ClipboardList},{href:"/teacher/escalations",label:"Hộp thư",Icon:MessagesSquare}
  ] : [
    {href:"/student",label:"Tuần học",Icon:LayoutDashboard},{href:"/student/tutor",label:"Gia sư AI",Icon:BookOpenText},{href:"/student/practice",label:"Luyện tập",Icon:Mic},{href:"/student/tests",label:"Bài kiểm tra",Icon:ClipboardList}
  ];
  async function signOut() {
    const {error}=await createClient().auth.signOut({scope:"local"});
    if (error) {setError("Chưa thể đăng xuất. Hãy thử lại.");return;}
    router.replace("/login");router.refresh();
  }
  return <><div className="workspace-role">{role==="teacher"?"Giáo viên":"Sinh viên"}</div><nav aria-label="Không gian học tập">{items.map(({href,label,Icon})=>{
    const active=pathname===href || (href==="/teacher" && pathname.startsWith("/teacher/groups/"));
    return <Link href={href} key={href} aria-current={active?"page":undefined}><Icon size={18}/>{label}</Link>;
  })}</nav><div className="workspace-account"><span>{name}</span><button title="Đăng xuất" aria-label="Đăng xuất" onClick={signOut}><LogOut size={18}/></button>{error && <small role="status">{error}</small>}</div></>;
}
