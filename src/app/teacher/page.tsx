import Link from "next/link"
import { BookOpen, UsersRound, CalendarClock } from "lucide-react"
import { classContext } from "@/lib/learning-data"
import { CreateClass, InviteActions } from "@/components/learning/groups"
import { PageIntro, Empty, dateLabel } from "@/components/learning/common"
import { vi } from "@/lib/i18n/vi"

export default async function TeacherPage() {
  const {db,groups}=await classContext()
  const ids=groups.map(g=>g.id)
  const [members,tests,attempts,profiles]=await Promise.all([
    db.from("memberships").select("group_id,student_id,joined_at").in("group_id",ids),
    db.from("tests").select("id,group_id,title,due_date").eq("is_published",true).lt("due_date",new Date().toISOString()).in("group_id",ids).order("due_date",{ascending:false}),
    db.from("test_attempts").select("test_id,student_id"),
    db.from("profiles").select("id,full_name").eq("role","student")
  ])
  if ([members,tests,attempts,profiles].some(q=>q.error)) throw new Error(vi.groups.errors.overviewUnavailable)
  const names=new Map((profiles.data??[]).map(p=>[p.id,p.full_name||vi.teacherGroups.unnamedStudent]))
  const done=new Set((attempts.data??[]).map(a=>a.test_id+"/"+a.student_id))
  const late=(tests.data??[]).flatMap(t=>(members.data??[]).filter(m=>m.group_id===t.group_id&&t.due_date&&Date.parse(m.joined_at)<=Date.parse(t.due_date)&&!done.has(t.id+"/"+m.student_id)).map(m=>({student:names.get(m.student_id)||vi.teacherGroups.unnamedStudent, test:t})))
  const metrics=[{Icon:BookOpen,value:groups.length,label:vi.teacherGroups.classes},{Icon:UsersRound,value:new Set(members.data?.map(m=>m.student_id)).size,label:vi.teacherGroups.students},{Icon:CalendarClock,value:late.length,label:vi.teacherGroups.overdue}]
  return <main className="learn-page"><PageIntro title={vi.teacherGroups.heading}>{vi.teacherGroups.intro}</PageIntro>
    <div className="learn-grid">{metrics.map(({Icon,value,label})=><div className="learn-box" key={label}><Icon size={22}/><div className="learn-kpi"><strong>{value}</strong>{label}</div></div>)}</div>
    <div className="learn-two"><section className="learn-box"><h2>{vi.teacherGroups.classList}</h2>
      {!groups.length && <Empty title={vi.teacherGroups.createFirstTitle}>{vi.teacherGroups.createFirstBody}</Empty>}
      {groups.map(g=><article className="learn-item" key={g.id}>
        <Link className="learn-question learn-card-link" href={"/teacher/groups/"+g.id}>
          <div className="learn-row"><h3>{g.name}</h3><span className="learn-badge">{g.language}</span></div>
          <p className="learn-subtle">{members.data?.filter(m=>m.group_id===g.id).length??0}{vi.teacherGroups.studentCount}{g.join_code}</p>
        </Link>
        <InviteActions code={g.join_code} name={g.name}/>
      </article>)}</section>
      <section className="learn-box"><h2>{vi.teacherGroups.createNew}</h2><CreateClass/></section></div>
    <section className="learn-box"><h2>{vi.teacherGroups.lateTitle}</h2>
      {late.length?late.map(({student,test},i)=><div className="learn-item" key={test.id+i}><strong>{student} · {test.title}</strong>
        <Link href={"/teacher/tests?group="+test.group_id} className="learn-link">{groups.find(g=>g.id===test.group_id)?.name}</Link>
        {test.due_date&&<span className="learn-subtle">{vi.teacherGroups.lateDue} {dateLabel(test.due_date,true)}</span>}</div>):<Empty title={vi.teacherGroups.noLate}/>}
    </section></main>
}
