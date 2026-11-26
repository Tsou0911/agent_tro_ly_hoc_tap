import { classContext } from "@/lib/learning-data"
import { Empty, GroupTabs, PageIntro, dateLabel } from "@/components/learning/common"
import { Practice } from "@/components/learning/practice"

export default async function PracticePage({searchParams}:{searchParams:Promise<{group?:string}>}) {
  const {db,groups,group}=await classContext((await searchParams).group)
  const [chunks,materials,sessions]=group?await Promise.all([
    db.from("material_chunks").select("id,material_id,chunk_index,content").eq("group_id",group.id).order("chunk_index").limit(12),
    db.from("materials").select("id,title").eq("group_id",group.id),
    db.from("practice_sessions").select("id,mode,topic,created_at,duration_seconds").eq("group_id",group.id).order("created_at",{ascending:false}).limit(10)
  ]):[null,null,null]
  if(chunks?.error||materials?.error||sessions?.error)throw new Error("Không tải được dữ liệu luyện tập.")
  const names=new Map(materials?.data?.map(m=>[m.id,m.title]))
  const examples=(chunks?.data??[]).map(c=>({id:c.id,title:names.get(c.material_id)||"Tài liệu",index:c.chunk_index,content:c.content.slice(0,1200)}))
  return <main className="learn-page"><PageIntro title="Phòng luyện tập">Nghe đoạn văn, thử một vai hội thoại hoặc viết theo chủ đề của lớp.</PageIntro>
    <GroupTabs groups={groups} active={group?.id} href="/student/practice"/>{group&&<>
      <Practice key={group.id} groupId={group.id} language={group.language} excerpts={examples}/>
      <section className="learn-box"><h2>Lượt luyện gần đây</h2>{sessions?.data?.length?sessions.data.map(s=><article key={s.id} className="learn-item">
        <strong>{s.topic}</strong><p className="learn-subtle">{{listening:"Nghe",speaking:"Nói",writing:"Viết",image:"Ảnh"}[s.mode]} · {dateLabel(s.created_at,true)} · {s.duration_seconds} giây</p>
      </article>):<Empty title="Chưa có lượt luyện nào"/>}</section></>}</main>
}
