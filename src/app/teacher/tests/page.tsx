import { classContext } from "@/lib/learning-data"
import { GroupTabs, PageIntro, Empty, dateLabel } from "@/components/learning/common"
import { TestBuilder, Grade, Publish } from "@/components/learning/tests"

export default async function TeacherTests({searchParams}:{searchParams:Promise<{group?:string}>}) {
  const {db,groups,group}=await classContext((await searchParams).group)
  const tests=group?await db.from("tests").select("*").eq("group_id",group.id).order("created_at",{ascending:false}):null
  const ids=tests?.data?.map(t=>t.id)??[]
  const [questions,attempts,students]=ids.length?await Promise.all([
    db.from("test_questions").select("*").in("test_id",ids).order("order_index"),
    db.from("test_attempts").select("*").in("test_id",ids).order("submitted_at",{ascending:false}),
    db.from("profiles").select("id,full_name").eq("role","student")
  ]):[null,null,null]
  if(tests?.error||questions?.error||attempts?.error||students?.error)throw new Error("Không tải được dữ liệu bài kiểm tra.")
  const names=new Map(students?.data?.map(s=>[s.id,s.full_name||"Sinh viên"]))
  return <main className="learn-page"><PageIntro title="Bài kiểm tra của lớp">Soạn đề, công bố và chấm từng bài nộp.</PageIntro>
    <GroupTabs groups={groups} active={group?.id} href="/teacher/tests"/>{group&&<>
    <details key={group.id} className="learn-box learn-details"><summary>Tạo bài kiểm tra mới</summary><TestBuilder groupId={group.id}/></details>
    {!ids.length&&<Empty title="Chưa có bài kiểm tra"/>}
    {tests?.data?.map(t=>{
      const qs=questions?.data?.filter(q=>q.test_id===t.id)??[]
      const submissions=attempts?.data?.filter(a=>a.test_id===t.id)??[]
      return <section key={t.id} className="learn-box"><div className="learn-row"><h2>{t.title}</h2><span className="learn-badge">{t.is_published?"Đã công bố":"Bản nháp"}</span></div>
        <p className="learn-subtle">{qs.length} câu · {submissions.length} bài nộp{t.due_date&&" · Hạn "+dateLabel(t.due_date,true)}</p>
        {!t.is_published&&<Publish id={t.id}/>}<details className="learn-details"><summary>Xem đề và hướng dẫn chấm</summary>{qs.map((q,i)=><article key={q.id} className="learn-item"><strong>{i+1}. {q.prompt}</strong><p>{q.correct_answer||q.rubric} · {q.points} điểm</p></article>)}</details>
        {submissions.map(a=>{
          const answers=a.answers&&typeof a.answers==="object"&&!Array.isArray(a.answers)?a.answers:{}
          return <details key={a.id} className="learn-item learn-details"><summary>{names.get(a.student_id)||"Sinh viên"} · {a.teacher_score??a.auto_score}/100 · {a.status==="graded"?"Đã chấm":"Chờ chấm"}</summary>
            <div className="learn-list"><p className="learn-subtle">Nộp lúc {dateLabel(a.submitted_at,true)}</p>{qs.map((q,i)=><div className="learn-quote" key={q.id}><strong>{i+1}. {q.prompt}</strong><p className="learn-wrap">{String(answers[q.id]??"Chưa trả lời")}</p>{q.rubric&&<p className="learn-subtle">Tiêu chí: {q.rubric}</p>}</div>)}
            <Grade id={a.id} score={a.teacher_score}/></div></details>
        })}</section>
    })}</>}</main>
}
