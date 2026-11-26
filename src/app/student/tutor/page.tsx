import { classContext } from "@/lib/learning-data"
import { GroupTabs, PageIntro, Empty, dateLabel } from "@/components/learning/common"
import { TutorChat, EscalationForm } from "@/components/learning/tutor"

export default async function TutorPage({searchParams}:{searchParams:Promise<{group?:string}>}) {
  const {db,groups,group}=await classContext((await searchParams).group)
  const [files,threads]=group?await Promise.all([
    db.from("materials").select("id,title").eq("group_id",group.id).order("created_at",{ascending:false}),
    db.from("escalations").select("id,question,teacher_reply,created_at,status").eq("group_id",group.id).order("created_at",{ascending:false})
  ]):[null,null]
  if(files?.error||threads?.error)throw new Error("Không tải được tài liệu hoặc hộp thư.")
  return <main className="learn-page"><PageIntro title="Trợ giảng tài liệu">Hỏi về nội dung đang học và xem đoạn trích trong tài liệu của lớp.</PageIntro>
    <GroupTabs groups={groups} active={group?.id} href="/student/tutor"/>{group&&<>
    <div className="learn-two"><TutorChat key={group.id} groupId={group.id} language={group.language}/>
      <section className="learn-box"><h2>Thư viện của lớp</h2>
      {files?.data?.length?files.data.map(f=><p className="learn-item" key={f.id}>{f.title}</p>):<Empty title="Chưa có tài liệu">Giáo viên có thể tải tài liệu lên từ trang lớp.</Empty>}</section></div>
    <section className="learn-box"><h2>Trao đổi với giáo viên</h2>
      <details className="learn-details"><summary>Viết câu hỏi mới</summary><EscalationForm groupId={group.id}/></details>
      {threads?.data?.map(t=><article className="learn-item" key={t.id}><div className="learn-row"><strong>{t.question}</strong><span className="learn-badge">{t.status==="answered"?"Đã trả lời":"Đang chờ"}</span></div>
        <p className="learn-subtle">{dateLabel(t.created_at,true)}</p>{t.teacher_reply&&<p className="learn-feedback">{t.teacher_reply}</p>}</article>)}
    </section></>}</main>
}
