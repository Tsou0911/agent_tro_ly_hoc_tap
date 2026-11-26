"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Notice, RequestError, Submit, request, useAction, val } from "./client"

async function readImage(file:File) {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Vui lòng chọn ảnh JPEG, PNG hoặc WebP.")
  if (file.size>8*1024*1024) throw new Error("Vui lòng chọn ảnh dưới 8 MB.")
  const bitmap=await createImageBitmap(file)
  try {
    const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height))
    const canvas=document.createElement("canvas")
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
    const ctx=canvas.getContext("2d")
    if (!ctx) throw new Error("Trình duyệt không đọc được ảnh.")
    ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
    return canvas.toDataURL("image/jpeg",.82)
  } finally {bitmap.close()}
}

interface Exchange {question:string;answer:string;imageName?:string}
export function TutorChat({groupId,language}:{groupId:string;language:string}) {
  const chat=useAction()
  const escalation=useAction()
  const [messages,setMessages]=useState<Exchange[]>([])
  const [escalated,setEscalated]=useState<number[]>([])
  const [phase,setPhase]=useState("")
  return <section className="learn-box"><h2>Hỏi trợ giảng</h2>
    {messages.map((turn,i)=><article key={i} className="learn-item"><div><span className="learn-badge">Bạn</span><p className="learn-wrap mt-2">{turn.question}</p>{turn.imageName&&<p className="learn-subtle">Ảnh: {turn.imageName}</p>}</div>
      <p className="learn-feedback">{turn.answer}</p>
      <div><Button variant="outline" type="button" disabled={escalation.pending||escalated.includes(i)} onClick={()=>void escalation.run(async()=>{
        await request("escalations",{group_id:groupId,question:turn.question,ai_context:turn.answer.slice(0,4000)})
        setEscalated(v=>[...v,i])
      },"Đã chuyển câu hỏi tới giáo viên.")}>{escalated.includes(i)?"Đã gửi giáo viên":"Hỏi thêm giáo viên"}</Button></div></article>)}
    <Notice notice={escalation.notice}/>
    <form className="learn-form" onSubmit={e=>{
      e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const question=val(data,"question");const file=data.get("image")
      void chat.run(async()=>{
        try {
          setPhase("Đang tra cứu tài liệu lớp…")
          const upload=file instanceof File&&file.size?file:undefined
          const image=upload?await readImage(upload):undefined
          let answer:string
          try {({answer}=await request<{answer:string}>("chat",{group_id:groupId,question,image}))}
          catch (err) {
            if (!(err instanceof RequestError)||err.code!=="OCR_REQUIRED"||!image) throw err
            setPhase("Đang đọc chữ trong ảnh trên thiết bị…")
            const {createWorker}=await import("tesseract.js")
            const lang=/chinese|trung|中文/i.test(language)?"chi_sim+eng":/french|pháp/i.test(language)?"fra+eng":/japan|nhật/i.test(language)?"jpn+eng":"eng+vie"
            const worker=await createWorker(lang)
            let extracted=""
            try {extracted=(await worker.recognize(image)).data.text.trim().slice(0,3500)} finally {await worker.terminate()}
            if (!extracted) throw new Error("Chưa nhận được chữ trong ảnh. Hãy nhập đoạn chữ hoặc chọn ảnh rõ hơn.")
            setPhase("Đang đối chiếu phần chữ với tài liệu…")
            ;({answer}=await request<{answer:string}>("chat",{group_id:groupId,question,ocr_text:extracted}))
          }
          setMessages(prev=>[...prev,{question,answer,imageName:upload?.name}]);form.reset()
        } finally {setPhase("")}
      },"",false)
    }}>
      <label>Câu hỏi về tài liệu<textarea name="question" rows={3} required maxLength={1600} placeholder="Đoạn hội thoại dùng cách nào để đưa ra lời đề nghị?"/></label>
      <label>Đính kèm ảnh (tùy chọn)<input type="file" name="image" accept="image/jpeg,image/png,image/webp"/></label>
      <Submit pending={chat.pending}>Gửi câu hỏi</Submit>{phase&&<p role="status" className="learn-subtle">{phase}</p>}
      <Notice notice={chat.notice}/>
    </form></section>
}

export function EscalationForm({groupId}:{groupId:string}) {
  const op=useAction()
  return <form className="learn-form" onSubmit={e=>{
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form)
    void op.run(async()=>{await request("escalations",{group_id:groupId,question:val(data,"question")});form.reset()},"Đã gửi câu hỏi.")
  }}><label>Câu hỏi gửi giáo viên<textarea name="question" required maxLength={1600}/></label><Submit pending={op.pending}>Gửi giáo viên</Submit><Notice notice={op.notice}/></form>
}
export function ReplyForm({id}:{id:string}) {
  const op=useAction()
  return <form className="learn-form" onSubmit={e=>{
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form)
    void op.run(async()=>{await request("escalations",{id,teacher_reply:val(data,"reply")},"PATCH");form.reset()},"Đã gửi phản hồi.")
  }}><label>Phản hồi của giáo viên<textarea name="reply" required maxLength={4000}/></label><Submit pending={op.pending}>Gửi phản hồi</Submit><Notice notice={op.notice}/></form>
}
