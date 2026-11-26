import Link from "next/link"
import { AudioLines, MessagesSquare, NotebookPen } from "lucide-react"
import { classContext, mondayInVietnam } from "@/lib/learning-data"
import { GroupTabs, PageIntro, dateLabel } from "@/components/learning/common"
import { JoinClass } from "@/components/learning/groups"
import { Progress } from "@/components/learning/progress"
import { ReflectionForm } from "@/components/learning/reflection"

export default async function StudentPage({searchParams}:{searchParams:Promise<{group?:string}>}) {
  const {db,groups,group}=await classContext((await searchParams).group)
  const {data:{user}}=await db.auth.getUser()
  const week=mondayInVietnam()
  const [aims,reflection,history]=group&&user?await Promise.all([
    db.from("aims").select("*").eq("group_id",group.id).order("end_date",{ascending:false}),
    db.from("weekly_reflections").select("*").eq("group_id",group.id).eq("student_id",user.id).eq("week_start",week).maybeSingle(),
    db.from("weekly_reflections").select("week_start,strengths,weaknesses,next_week_action,plan_goals").eq("group_id",group.id).eq("student_id",user.id).lt("week_start",week).order("week_start",{ascending:false}).limit(8)
  ]):[null,null,null]
  if (aims?.error||reflection?.error||history?.error) throw new Error("Không tải được nhật ký hoặc mục tiêu.")
  return <main className="learn-page"><PageIntro title="Tuần học của tôi">Chọn mục tiêu, luyện tập và nhìn lại những điều đã học.</PageIntro>
    <section className="learn-box" aria-label="Tham gia lớp mới"><JoinClass/></section>
    <GroupTabs groups={groups} active={group?.id} href="/student"/>
    {group&&user&&<>
      <div className="learn-two"><section className="learn-box"><h2>Mục tiêu của lớp</h2><Progress aims={aims?.data??[]} students={[{id:user.id,name:"Tiến độ của tôi"}]}/></section>
        <ReflectionForm key={group.id+week} groupId={group.id} row={reflection?.data??null} week={week}/></div>
      <section className="learn-box"><h2>Do · Vào học</h2><div className="learn-grid">{[
        {url:"tutor",icon:MessagesSquare,title:"Hỏi tài liệu",desc:"Đặt câu hỏi và đọc lại đoạn trích."},
        {url:"practice",icon:AudioLines,title:"Luyện kỹ năng",desc:"Luyện nghe, nói và viết theo chủ đề."},
        {url:"tests",icon:NotebookPen,title:"Bài kiểm tra",desc:"Làm bài và theo dõi kết quả."}
      ].map(({url,icon:Icon,title,desc})=><Link key={url} className="learn-question learn-card-link" href={"/student/"+url+"?group="+group.id}><Icon size={23}/><h3>{title}</h3><p className="learn-subtle">{desc}</p></Link>)}</div></section>
      {!!history?.data?.length&&<details className="learn-box learn-details"><summary>Nhật ký các tuần trước</summary>{history.data.map(r=><article className="learn-item" key={r.week_start}><strong>Tuần từ {dateLabel(r.week_start)}</strong>
        {Array.isArray(r.plan_goals)&&<p>{r.plan_goals.filter(x=>typeof x==="string").join(" · ")}</p>}
        {r.strengths&&<p>Đã làm tốt: {r.strengths}</p>}{r.weaknesses&&<p>Còn khó: {r.weaknesses}</p>}{r.next_week_action&&<p>Tuần tới: {r.next_week_action}</p>}
      </article>)}</details>}
    </>}
  </main>
}
