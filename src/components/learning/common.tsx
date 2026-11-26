import Link from "next/link"
import { BookOpen, Layers3 } from "lucide-react"
import type { ReactNode } from "react"
import "./learning.css"

export interface GroupOption { id: string; name: string; language: string }

export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return <header className="learn-intro"><h1>{title}</h1>{children && <p>{children}</p>}</header>
}

export function GroupTabs({ groups, active, href }: { groups: GroupOption[]; active?: string; href: string }) {
  if (!groups.length) return <Empty title="Chưa có lớp học">Lớp đã tạo hoặc đã tham gia sẽ xuất hiện ở đây.</Empty>
  return <nav aria-label="Chọn lớp học" className="class-tabs">{groups.map(g =>
    <Link key={g.id} aria-current={g.id === active ? "page" : undefined} href={href + "?group=" + g.id}><BookOpen size={16}/>{g.name}</Link>)}</nav>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="learn-empty"><Layers3 size={24} aria-hidden="true"/><div><strong>{title}</strong>{children && <p>{children}</p>}</div></div>
}

export function dateLabel(date: string, time = false) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", ...(time ? { timeStyle: "short" as const } : {}), timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(date))
}
