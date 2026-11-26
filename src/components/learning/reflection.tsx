"use client"
import { useState } from "react"
import { Notice, Submit, request, useAction, val } from "./client"

interface Reflection { plan_goals:unknown; strengths:string|null; weaknesses:string|null; next_week_action:string|null }
export function ReflectionForm({groupId,week,row}:{groupId:string;week:string;row:Reflection|null}) {
  const op=useAction()
  const [stage,setStage]=useState<"plan"|"reflect">("plan")
  return <section className="learn-box"><div className="learn-row"><h2>Nhật ký tuần</h2><span className="learn-badge">Tuần từ {week.split("-").reverse().join("/")}</span></div>
    <div className="class-tabs" aria-label="Giai đoạn">{(["plan","reflect"] as const).map(s=><button key={s} className={"rounded-full border px-4 py-2 "+(stage===s?"bg-emerald-900 text-white":"bg-white")} type="button" aria-pressed={stage===s} onClick={()=>setStage(s)}>{s==="plan"?"Plan · Lập kế hoạch":"Reflect · Nhìn lại"}</button>)}</div>
    <form className="learn-form" onSubmit={e=>{
      e.preventDefault();const data=new FormData(e.currentTarget)
      void op.run(async()=>{await request("aims",{group_id:groupId,week_start:week,plan_goals:val(data,"goals").split("\n").map(s=>s.trim()).filter(Boolean),strengths:val(data,"strengths"),weaknesses:val(data,"weaknesses"),next_week_action:val(data,"next_week_action")},"PUT")},"Đã lưu nhật ký tuần.")
    }}>
      <div hidden={stage!=="plan"}><label>Mục tiêu cá nhân, mỗi dòng một mục<textarea name="goals" rows={4} maxLength={2000} defaultValue={Array.isArray(row?.plan_goals)?row.plan_goals.filter(x=>typeof x==="string").join("\n"):""} placeholder="Ví dụ: Kể lại một đoạn hội thoại bằng lời của mình."/></label></div>
      <div hidden={stage!=="reflect"}><div className="learn-list">{[["strengths","Điều đã làm tốt",row?.strengths],["weaknesses","Điều còn khó",row?.weaknesses],["next_week_action","Hành động cho tuần tới",row?.next_week_action]].map(([name,label,value])=><label key={name}>{label}<textarea name={name??""} defaultValue={value??""} maxLength={2000}/></label>)}</div></div>
      <Submit pending={op.pending}>Lưu nhật ký</Submit><Notice notice={op.notice}/>
    </form></section>
}
