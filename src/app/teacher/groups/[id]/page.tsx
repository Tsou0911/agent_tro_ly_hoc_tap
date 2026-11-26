import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AimForm, Invite, MaterialUpload } from "@/components/learning/groups"
import { Empty, PageIntro, dateLabel } from "@/components/learning/common"
import { Progress } from "@/components/learning/progress"
import { vi } from "@/lib/i18n/vi"

export default async function GroupPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  const db=await createClient()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const {data:group,error}=await db.from("groups").select("id,name,language,join_code,created_at,teacher_id").eq("id",id).maybeSingle()
  if (error) throw new Error(vi.groups.errors.groupUnavailable)
  if (!group) notFound()
  const [aims,files,members]=await Promise.all([
    db.from("aims").select("*").eq("group_id",id).order("end_date",{ascending:false}),
    db.from("materials").select("id,title,file_url,created_at").eq("group_id",id).order("created_at",{ascending:false}),
    db.from("memberships").select("student_id").eq("group_id",id)
  ])
  if ([aims,files,members].some(q=>q.error)) throw new Error(vi.groups.errors.groupDataUnavailable)
  const {data:students,error:profileError}=await db.from("profiles").select("id,full_name").in("id",members.data?.map(m=>m.student_id)??[])
  if (profileError) throw new Error(vi.groups.errors.studentsUnavailable)
  const paths=(files.data??[]).map(m=>m.file_url)
  const links=paths.length?(await db.storage.from("materials").createSignedUrls(paths,300)).data:undefined
  return <main className="learn-page"><Link className="learn-link" href="/teacher">{vi.teacherGroups.classesLink}</Link><PageIntro title={group.name}>{group.language}</PageIntro>
    <div className="learn-two"><section className="learn-box"><h2>{vi.teacherGroups.goals}</h2>
      <Progress aims={aims.data??[]} students={(students??[]).map(s=>({id:s.id,name:s.full_name||vi.teacherGroups.unnamedStudent}))}/>
      <details className="learn-details"><summary>{vi.teacherGroups.addGoal}</summary><AimForm groupId={id}/></details></section>
      <Invite code={group.join_code}/></div>
    <div className="learn-two"><section className="learn-box"><h2>{vi.teacherGroups.materials}</h2>
      {(files.data??[]).length?files.data?.map((f,i)=><article key={f.id} className="learn-item">
        {links?.[i]?.signedUrl?<a className="learn-link" href={links[i].signedUrl} target="_blank" rel="noreferrer">{f.title}</a>:<strong>{f.title}</strong>}
        <span className="learn-subtle">{dateLabel(f.created_at)}</span></article>):<Empty title={vi.teacherGroups.noMaterials}/>}
      <MaterialUpload groupId={id}/></section>
      <section className="learn-box"><h2>{vi.teacherGroups.studentsHeading} ({students?.length??0})</h2>
        {students?.length?students.map(s=><div className="learn-item" key={s.id}><strong>{s.full_name||vi.teacherGroups.unnamedStudent}</strong></div>):<Empty title={vi.teacherGroups.noStudents}/>}
        <Link className="learn-link" href={"/teacher/tests?group="+id}>{vi.teacherGroups.tests}</Link></section>
    </div></main>
}
