import { classContext } from "@/lib/learning-data"
import { GroupTabs, PageIntro, Empty, dateLabel } from "@/components/learning/common"
import { TestAttempt } from "@/components/learning/tests"

export default async function StudentTests({searchParams}:{searchParams:Promise<{group?:string}>}) {
  const {db,groups,group}=await classContext((await searchParams).group)
  const {data:{user}}=await db.auth.getUser()
  const tests=group?await db.from("tests").select("*").eq("group_id",group.id).eq("is_published",true).order("created_at",{ascending:false}):null
  const attempts=tests?.data?.length&&user?await db.from("test_attempts").select("id,test_id,auto_score,teacher_score,status,submitted_at").in("test_id",tests.data.map(t=>t.id)).eq("student_id",user.id):null
  if(tests?.error||attempts?.error)throw new Error("Không tải được bài kiểm tra.")
  return <main className="learn-page"><PageIntro title="Bài kiểm tra">Xem thời hạn, làm bài và theo dõi điểm của bạn.</PageIntro>
    <GroupTabs groups={groups} active={group?.id} href="/student/tests"/>
    {group&&(!tests?.data?.length?<Empty title="Chưa có bài kiểm tra được công bố"/>:tests.data.map(t=>{
      const attempt=attempts?.data?.find(a=>a.test_id===t.id)
      return <section key={t.id} className="learn-box"><div className="learn-row"><h2>{t.title}</h2><span className="learn-badge">{attempt?"Đã nộp":"Chưa nộp"}</span></div>
        {t.description&&<p>{t.description}</p>}<p className="learn-subtle">{t.due_date?"Hạn nộp "+dateLabel(t.due_date,true):"Không có hạn nộp"} · {t.time_limit_mins?t.time_limit_mins+" phút kể từ lúc bắt đầu":"Không giới hạn thời gian"}</p>
        {attempt?<div className="learn-feedback"><strong>{attempt.status==="graded"?"Điểm toàn bài":"Điểm tự động tạm tính"}: {attempt.teacher_score??attempt.auto_score}/100</strong><p>Đã nộp {dateLabel(attempt.submitted_at,true)}{attempt.status==="submitted"&&" · Đang chờ giáo viên chấm."}</p></div>:
          user&&<TestAttempt id={t.id} userId={user.id} due={t.due_date}/>}</section>
    }))}</main>
}
