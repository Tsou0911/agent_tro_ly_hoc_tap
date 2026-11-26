import { createClient } from "@/lib/supabase/server"
import { dateLabel, Empty } from "./common"

interface Aim {
  id:string; title:string; description:string|null; start_date:string; end_date:string
  target_tests:number; target_min_score:number; target_listening:number; target_writing:number; target_speaking_mins:number
}
export async function Progress({aims,students}:{aims:Aim[];students:{id:string;name:string}[]}) {
  if (!aims.length) return <Empty title="Chưa có mục tiêu">Mục tiêu và chỉ tiêu sẽ hiển thị khi giáo viên thiết lập.</Empty>
  const db=await createClient()
  return <div className="learn-list">{await Promise.all(aims.map(async aim=>
    <article className="learn-question" key={aim.id}>
      <h3>{aim.title}</h3><p className="learn-subtle">{dateLabel(aim.start_date)} – {dateLabel(aim.end_date)}</p>
      {aim.description && <p>{aim.description}</p>}
      <p className="learn-subtle">Chỉ tiêu: {aim.target_tests} bài kiểm tra đạt từ {aim.target_min_score}/100 · {aim.target_listening} bài nghe · {aim.target_writing} bài viết · {aim.target_speaking_mins} phút nói.</p>
      {await Promise.all(students.map(async s=>{
        const {data,error}=await db.rpc("aim_progress",{p_aim_id:aim.id,p_student_id:s.id}).single()
        if (error || !data) return <p key={s.id} role="alert">Chưa tải được tiến độ của {s.name}.</p>
        const pct=Math.round(Number(data.percent))
        return <div className="learn-item" key={s.id}><div className="learn-row"><strong>{s.name}</strong><span>{pct}%</span></div>
          <progress className="learn-progress" aria-label={"Tiến độ " + s.name} value={pct} max={100}/>
          <dl className="learn-stats">{[["Bài kiểm tra đạt",data.tests],["Bài nghe",data.listening],["Bài viết",data.writing],["Phút nói",Number(data.speaking_mins).toFixed(1)]].map(([l,v])=><div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
        </div>
      }))}
    </article>))}</div>
}
