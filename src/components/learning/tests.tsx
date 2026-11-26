"use client"
import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Notice, Submit, request, useAction, val } from "./client"

type Kind="mcq"|"short_answer"|"essay"
interface Draft {id:number;kind:Kind}
interface Question {id:string;order_index:number;question_type:Kind;prompt:string;options:unknown;points:number}
export function TestBuilder({groupId}:{groupId:string}) {
  const op=useAction()
  const [drafts,setDrafts]=useState<Draft[]>([{id:0,kind:"mcq"}])
  return <form className="learn-form" onSubmit={e=>{
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form)
    void op.run(async()=>{
      const questions=drafts.map(({id,kind})=>{
        const options=kind==="mcq"?val(data,"opts"+id).split("\n").map(s=>s.trim()).filter(Boolean):undefined
        const answer=val(data,"key"+id)
        if(options&&(new Set(options).size!==options.length||options.length<2||!options.includes(answer))) throw new Error("Mỗi câu trắc nghiệm cần ít nhất hai lựa chọn khác nhau và đáp án khớp một lựa chọn.")
        return {question_type:kind,prompt:val(data,"q"+id),options,correct_answer:kind==="essay"?undefined:answer,rubric:val(data,"rubric"+id)||undefined,points:Number(val(data,"pts"+id))}
      })
      const due=val(data,"due_date")
      await request("tests",{group_id:groupId,title:val(data,"title"),description:val(data,"description"),due_date:due?new Date(due).toISOString():undefined,time_limit_mins:val(data,"time_limit_mins")?Number(val(data,"time_limit_mins")):undefined,is_published:data.has("publish"),questions})
      form.reset();setDrafts([{id:0,kind:"mcq"}])
    },"Đã lưu bài kiểm tra.")
  }}>
    <label>Tên bài kiểm tra<input name="title" required maxLength={180}/></label>
    <label>Hướng dẫn làm bài<textarea name="description" maxLength={1600}/></label>
    <div className="learn-columns"><label>Hạn nộp (tùy chọn)<input name="due_date" type="datetime-local"/></label>
      <label>Thời gian làm (phút)<input name="time_limit_mins" type="number" min={1} max={1440} placeholder="Không giới hạn"/></label></div>
    {drafts.map(({id,kind},index)=><fieldset className="learn-question" key={id}><legend className="px-1 font-semibold">Câu {index+1}</legend>
      <div className="learn-columns"><label>Loại câu hỏi<select value={kind} onChange={e=>{const type=e.target.value as Kind;setDrafts(list=>list.map(q=>q.id===id?{id,kind:type}:q))}}>
        <option value="mcq">Trắc nghiệm</option><option value="short_answer">Trả lời ngắn</option><option value="essay">Tự luận</option></select></label>
        <label>Điểm tối đa<input name={"pts"+id} type="number" step=".1" min=".1" max={100} defaultValue={1} required/></label></div>
      <label>Nội dung câu hỏi<textarea name={"q"+id} required maxLength={2000}/></label>
      {kind==="mcq"&&<label>Các lựa chọn, mỗi dòng một đáp án<textarea name={"opts"+id} required maxLength={2400}/></label>}
      {kind!=="essay"?<label>Đáp án đúng<input name={"key"+id} required maxLength={500}/></label>:<label>Tiêu chí chấm<textarea name={"rubric"+id} required maxLength={2000}/></label>}
      {drafts.length>1&&<div><Button type="button" variant="outline" onClick={()=>setDrafts(list=>list.filter(q=>q.id!==id))}><Trash2 size={16}/> Xóa câu</Button></div>}
    </fieldset>)}
    <div><Button type="button" variant="outline" disabled={drafts.length>=50} onClick={()=>setDrafts(prev=>[...prev,{id:Math.max(...prev.map(q=>q.id))+1,kind:"mcq"}])}><Plus size={16}/> Thêm câu hỏi</Button></div>
    <label className="learn-choice"><input type="checkbox" name="publish" defaultChecked/> Công bố cho sinh viên ngay</label>
    <Submit pending={op.pending}>Lưu bài kiểm tra</Submit><Notice notice={op.notice}/>
  </form>
}
export function Publish({id}:{id:string}) {
  const op=useAction()
  return <div className="learn-list"><div><Button type="button" variant="outline" disabled={op.pending} onClick={()=>void op.run(async()=>{await request("tests",{test_id:id,is_published:true},"PATCH")},"Đã công bố bài kiểm tra.")}>Công bố bài</Button></div><Notice notice={op.notice}/></div>
}
export function Grade({id,score}:{id:string;score:number|null}) {
  const op=useAction()
  return <form className="learn-form" onSubmit={e=>{
    e.preventDefault();const data=new FormData(e.currentTarget)
    void op.run(async()=>{await request("tests",{id,teacher_score:Number(val(data,"score"))},"PATCH")},"Đã lưu điểm giáo viên.")
  }}><label>Điểm toàn bài (thang 100)<input type="number" name="score" min={0} max={100} step=".01" required defaultValue={score??""}/></label>
    <Submit pending={op.pending}>Lưu điểm</Submit><Notice notice={op.notice}/></form>
}
export function TestAttempt({id,userId,due}:{id:string;userId:string;due:string|null}) {
  const op=useAction()
  const [questions,setQuestions]=useState<Question[]|null>(null)
  const [deadline,setDeadline]=useState<string|null>(due)
  const [now,setNow]=useState(0)
  const [answers,setAnswers]=useState<Record<string,string>>({})
  const [submitted,setSubmitted]=useState(false)
  const draftKey="lingua:exam:"+userId+":"+id
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer)},[])
  const remaining=deadline?Math.max(0,Math.ceil((Date.parse(deadline)-now)/1000)):null
  const expired=remaining===0
  function change(qid:string,value:string) {
    const next={...answers,[qid]:value};setAnswers(next)
    try {sessionStorage.setItem(draftKey,JSON.stringify(next))}catch{/* Browser storage is optional. */}
  }
  if (submitted) return <p role="status" className="learn-feedback">Đã nộp bài.</p>
  if (!questions) return <div className="learn-list"><div><Button type="button" disabled={op.pending||expired} onClick={()=>void op.run(async()=>{
    const result=await request<{questions:Question[];deadline:string|null}>("tests",{action:"begin",test_id:id})
    setDeadline(result.deadline??due)
    let draft:Record<string,string>={}
    try {const raw=JSON.parse(sessionStorage.getItem(draftKey)??"{}");draft=Object.fromEntries(result.questions.filter(q=>typeof raw?.[q.id]==="string").map(q=>[q.id,raw[q.id]]))}catch{/* Start with an empty answer sheet. */}
    setAnswers(draft);setQuestions(result.questions)
  },"",false)}>{expired?"Đã hết hạn nộp":op.pending?"Đang mở đề…":"Bắt đầu / tiếp tục"}</Button></div><Notice notice={op.notice}/></div>
  return <form className="learn-form" onSubmit={e=>{
    e.preventDefault()
    void op.run(async()=>{
      await request("tests",{test_id:id,answers},"PUT")
      setSubmitted(true)
      try{sessionStorage.removeItem(draftKey)}catch{/* Draft has no effect after submission. */}
    },"Đã nộp bài.")
  }}>
    {remaining!==null&&<p className="learn-msg">{expired?"Thời gian làm bài đã kết thúc.":"Thời gian còn lại: "+Math.floor(remaining/60)+" phút "+remaining%60+" giây"}</p>}
    {questions.map((q,i)=><fieldset disabled={op.pending||expired} className="learn-question" key={q.id}><legend className="font-semibold px-1">Câu {i+1} · {q.points} điểm</legend><p>{q.prompt}</p>
      {q.question_type==="mcq"&&Array.isArray(q.options)?q.options.filter((v):v is string=>typeof v==="string").map(opt=><label className="learn-choice" key={opt}><input type="radio" name={q.id} value={opt} checked={answers[q.id]===opt} onChange={()=>change(q.id,opt)}/> {opt}</label>):
        <label>Trả lời<textarea value={answers[q.id]??""} onChange={e=>change(q.id,e.target.value)} maxLength={5000} rows={q.question_type==="essay"?5:2}/></label>}
    </fieldset>)}
    <div><Button type="submit" disabled={op.pending||expired}>{op.pending?"Đang nộp…":"Nộp bài"}</Button></div><Notice notice={op.notice}/>
  </form>
}
