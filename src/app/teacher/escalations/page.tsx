import { classContext } from "@/lib/learning-data"
import { GroupTabs, PageIntro, Empty, dateLabel } from "@/components/learning/common"
import { ReplyForm } from "@/components/learning/tutor"

export default async function InboxPage({searchParams}:{searchParams:Promise<{group?:string}>}) {
  const {db,groups,group}=await classContext((await searchParams).group)
  const [threads,profiles]=group?await Promise.all([
    db.from("escalations").select("*").eq("group_id",group.id).order("status",{ascending:false}).order("created_at",{ascending:false}),
    db.from("profiles").select("id,full_name").eq("role","student")
  ]):[null,null]
  if(threads?.error||profiles?.error)throw new Error("Không tải được hộp thư.")
  const names=new Map(profiles?.data?.map(p=>[p.id,p.full_name||"Sinh viên"]))
  return <main className="learn-page"><PageIntro title="Hộp thư giải đáp">Xem câu hỏi sinh viên chuyển đến và phản hồi theo từng lớp.</PageIntro>
    <GroupTabs groups={groups} active={group?.id} href="/teacher/escalations"/>
    {group&&(threads?.data?.length?threads.data.map(t=><article key={t.id} className="learn-box">
      <div className="learn-row"><strong>{names.get(t.student_id)||"Sinh viên"}</strong><span className="learn-badge">{t.status==="open"?"Chờ trả lời":"Đã trả lời"}</span></div>
      <p className="learn-subtle">{dateLabel(t.created_at,true)}</p><h2>{t.question}</h2>
      {t.ai_context&&<details className="learn-details"><summary>Trao đổi với trợ giảng</summary><p className="learn-quote learn-wrap">{t.ai_context}</p></details>}
      {t.status==="open"?<ReplyForm id={t.id}/>:<p className="learn-feedback">{t.teacher_reply}</p>}
    </article>):<Empty title="Hộp thư trống">Câu hỏi từ sinh viên lớp này sẽ xuất hiện ở đây.</Empty>)}</main>
}
