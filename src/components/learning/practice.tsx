"use client"
import { useEffect, useRef, useState } from "react"
import { AudioLines, Headphones, Mic, PencilLine, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Notice, RequestError, request, useAction } from "./client"

type Mode="listening"|"speaking"|"writing"
type Turn={role:"user"|"assistant";content:string}
interface SpeechResultEvent {results:ArrayLike<ArrayLike<{transcript:string}>>}
interface Recognition {
  lang:string; interimResults:boolean; continuous:boolean
  onresult:((event:SpeechResultEvent)=>void)|null
  onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null
  start:()=>void;stop:()=>void;abort:()=>void
}
type VoiceWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition}

const choices=[
  {id:"listening" as const,label:"Nghe",icon:Headphones},
  {id:"speaking" as const,label:"Nói nhập vai",icon:Mic},
  {id:"writing" as const,label:"Viết",icon:PencilLine}
]
const voices=[
  {pattern:/english|tiếng anh/i,code:"en-US",passage:"Excuse me, does this bus stop near the library? Yes, get off after the bridge. The library is on the left, opposite the bakery."},
  {pattern:/chinese|mandarin|trung|中文/i,code:"zh-CN",passage:"请问，这趟车到图书馆吗？过桥以后下车。图书馆在左边，就在面包店的对面。"},
  {pattern:/french|pháp|français/i,code:"fr-FR",passage:"Excusez-moi, où se trouve la bibliothèque ? Traversez le pont. Elle est à gauche, en face de la boulangerie."},
  {pattern:/japan|nhật/i,code:"ja-JP",passage:"すみません、図書館はどこですか。橋を渡ってください。図書館は左側、パン屋の向かいにあります。"},
  {pattern:/korean|hàn/i,code:"ko-KR",passage:"실례합니다. 도서관은 어디에 있나요? 다리를 건너세요. 도서관은 빵집 맞은편 왼쪽에 있어요."},
  {pattern:/spanish|tây ban nha/i,code:"es-ES",passage:"Disculpe, ¿dónde está la biblioteca? Cruce el puente. Está a la izquierda, enfrente de la panadería."}
]
const prompts:Record<Mode,string>={
  listening:"Nghe đoạn hội thoại và ghi lại ý chính bằng lời của bạn.",
  speaking:"Bạn đang ở một thành phố mới. Hỏi đường đến thư viện và xác nhận một chi tiết trong lời chỉ dẫn.",
  writing:"Viết một lời mời ngắn cho bạn cùng lớp. Nêu thời gian, địa điểm và lý do muốn gặp."
}

export function Practice({groupId,language,excerpts}:{groupId:string;language:string;excerpts:{id:string;content:string;title:string;index:number}[]}) {
  const [mode,setMode]=useState<Mode>("listening")
  return <section className="learn-box"><h2>Chọn kỹ năng</h2><div className="learn-actions">
    {choices.map(({id,label,icon:Icon})=><Button key={id} type="button" variant={mode===id?"default":"outline"} aria-pressed={mode===id} onClick={()=>setMode(id)}><Icon size={17}/>{label}</Button>)}
  </div><Exercise key={groupId+mode} groupId={groupId} language={language} excerpts={excerpts} mode={mode}/></section>
}
function Exercise({groupId,language,excerpts,mode}:{groupId:string;language:string;excerpts:{id:string;content:string;title:string;index:number}[];mode:Mode}) {
  const op=useAction()
  const sample=voices.find(v=>v.pattern.test(language))
  const [lang,setLang]=useState(sample?.code??"en-US")
  const [source,setSource]=useState(excerpts[0]?.id??"sample")
  const [custom,setCustom]=useState(sample?.passage??"")
  const [topic,setTopic]=useState(prompts[mode])
  const [input,setInput]=useState("")
  const [turns,setTurns]=useState<Turn[]>([])
  const [speaking,setSpeaking]=useState(false)
  const [heard,setHeard]=useState(false)
  const [recognizing,setRecognizing]=useState(false)
  const [supported,setSupported]=useState({speaker:false,mic:false})
  const [voiceError,setVoiceError]=useState("")
  const [feedback,setFeedback]=useState("")
  const [started,setStarted]=useState(false)
  const capture=useRef<Recognition|null>(null)
  const segment=useRef<number|null>(null)
  const seconds=useRef(0)
  const since=useRef(0)
  const session=useRef("")
  const speakingNow=useRef(false)
  const excerpt=excerpts.find(e=>e.id===source)
  const passage=excerpt?.content??custom
  function sessionId(){if(!session.current)session.current=crypto.randomUUID();return session.current}
  useEffect(()=>{
    const browser=window as VoiceWindow
    setSupported({speaker:"speechSynthesis" in window,mic:!!(browser.SpeechRecognition||browser.webkitSpeechRecognition)})
    since.current=Date.now()
    return ()=>{if(capture.current){capture.current.onend=null;capture.current.onresult=null;capture.current.onerror=null;capture.current.abort()}if("speechSynthesis" in window)window.speechSynthesis.cancel()}
  },[])
  async function begin() {
    if(started)return
    await request("practice",{action:"begin",group_id:groupId,session_id:sessionId()})
    setStarted(true)
  }
  function play(text:string) {
    if(!supported.speaker||!text)return
    window.speechSynthesis.cancel()
    setVoiceError("")
    const utterance=new SpeechSynthesisUtterance(text)
    utterance.lang=lang;utterance.rate=.92
    utterance.onstart=()=>{speakingNow.current=true;setSpeaking(true)}
    utterance.onend=()=>{speakingNow.current=false;setSpeaking(false);if(mode==="listening")setHeard(true)}
    utterance.onerror=e=>{speakingNow.current=false;setSpeaking(false);if(e.error!=="interrupted"&&e.error!=="canceled")setVoiceError("Không phát được âm thanh. Kiểm tra giọng đọc đã cài trên thiết bị.")}
    window.speechSynthesis.speak(utterance)
  }
  function stopSound(){window.speechSynthesis.cancel();speakingNow.current=false;setSpeaking(false)}
  function mic(){
    if(recognizing){capture.current?.stop();return}
    const browser=window as VoiceWindow
    const Constructor=browser.SpeechRecognition||browser.webkitSpeechRecognition
    if(!Constructor)return
    if(speakingNow.current)stopSound()
    const rec=new Constructor();capture.current=rec;rec.lang=lang;rec.interimResults=false;rec.continuous=false
    let recognized=false
    rec.onresult=event=>{
      const transcript=Array.from(event.results).map(r=>r[0]?.transcript??"").join(" ").trim()
      if(transcript){recognized=true;setInput(prev=>(prev+" "+transcript).trim().slice(0,3500))}
    }
    rec.onend=()=>{if(segment.current!==null&&recognized)seconds.current+=(Date.now()-segment.current)/1000;segment.current=null;setRecognizing(false)}
    rec.onerror=e=>setVoiceError(e.error==="not-allowed"?"Quyền dùng micro đã bị từ chối. Bạn có thể nhập lời thoại.":"Chưa nhận được giọng nói. Hãy thử lại hoặc nhập lời thoại.")
    setVoiceError("");rec.start();segment.current=Date.now();setRecognizing(true)
  }
  function reset() {
    setFeedback("");setInput("");setTurns([]);setHeard(false);setStarted(false);setVoiceError("")
    session.current="";since.current=Date.now();seconds.current=0
  }
  if(feedback)return <div className="learn-list"><h3>Phản hồi luyện tập</h3><p className="learn-feedback">{feedback}</p><div><Button type="button" variant="outline" onClick={reset}>Luyện thêm một lượt</Button></div></div>
  const fullText=turns.map(t=>(t.role==="user"?"Tôi: ":"Bạn hội thoại: ")+t.content).concat(input.trim()?["Tôi: "+input.trim()]:[]).join("\n")
  return <div className="learn-form">
    <label>Chủ đề luyện {language}<textarea value={topic} onChange={e=>setTopic(e.target.value)} maxLength={500} rows={2}/></label>
    {mode!=="writing"&&<label>Ngôn ngữ giọng đọc và micro<select value={lang} onChange={e=>setLang(e.target.value)}>{[["en-US","English"],["zh-CN","中文"],["fr-FR","Français"],["ja-JP","日本語"],["ko-KR","한국어"],["es-ES","Español"],["de-DE","Deutsch"],["vi-VN","Tiếng Việt"]].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>}
    {mode==="listening"&&<>
      <label>Nội dung nghe<select value={source} onChange={e=>{if(supported.speaker)stopSound();setSource(e.target.value);setHeard(false)}}>{excerpts.map(ex=><option key={ex.id} value={ex.id}>{ex.title} · Đoạn {ex.index}</option>)}<option value="sample">Đoạn luyện tập tự chọn</option></select></label>
      {source==="sample"&&<details className="learn-details" open={!sample||undefined}><summary>Xem hoặc nhập đoạn luyện nghe</summary><label>Nội dung để phát<textarea value={custom} onChange={e=>{setCustom(e.target.value);setHeard(false)}} maxLength={1600}/></label></details>}
      <div><Button type="button" variant="outline" disabled={!supported.speaker||!passage.trim()} onClick={()=>speaking?stopSound():play(passage)}><Headphones size={17}/>{speaking?"Dừng phát":heard?"Nghe lại":"Phát đoạn nghe"}</Button></div>
      {!supported.speaker&&<p className="learn-subtle">Trình duyệt thiếu tính năng đọc thành tiếng. Hãy mở bài nghe trên trình duyệt có Web Speech API.</p>}
      {excerpt&&<details className="learn-details"><summary>Xem văn bản đối chiếu</summary><p className="learn-quote">{excerpt.content}</p></details>}
    </>}
    {mode==="speaking"&&!started&&<div><Button type="button" disabled={op.pending} onClick={()=>void op.run(begin,"",false)}><AudioLines size={17}/> Bắt đầu hội thoại</Button></div>}
    {turns.map((t,i)=><div key={i} className={t.role==="assistant"?"learn-feedback":"learn-quote"}><strong>{t.role==="user"?"Bạn":"Bạn hội thoại"}</strong><p>{t.content}</p>
      {t.role==="assistant"&&supported.speaker&&<button type="button" className="learn-link inline-flex items-center gap-1" onClick={()=>play(t.content)}><Volume2 size={16}/> Nghe câu trả lời</button>}</div>)}
    {(mode!=="speaking"||started)&&<>
      <label>{mode==="writing"?"Bài viết của bạn":mode==="listening"?"Ý chính bạn nghe được":"Lời thoại của bạn"}<textarea value={input} onChange={e=>setInput(e.target.value)} maxLength={3500} rows={4}/></label>
      {mode==="speaking"&&<><div className="learn-actions"><Button type="button" variant="outline" disabled={op.pending||!supported.mic} onClick={()=>void op.run(async()=>mic(),"",false)}><Mic size={16}/>{recognizing?"Dừng ghi":"Dùng micro"}</Button>
        <Button type="button" variant="outline" disabled={op.pending||recognizing||!input.trim()||!topic.trim()||turns.length>=16} onClick={()=>void op.run(async()=>{
          const content=input.trim()
          const {reply}=await request<{reply:string}>("practice",{action:"roleplay",group_id:groupId,topic,input_summary:content,history:turns.slice(-8)})
          setTurns(list=>[...list,{role:"user",content},{role:"assistant",content:reply}]);setInput("")
        },"",false)}>Gửi lời thoại</Button></div>
        <p className="learn-subtle">{supported.mic?"Thời lượng nói được ghi nhận khi micro nhận được lời thoại.":"Trình duyệt thiếu nhận diện giọng nói. Bạn vẫn có thể hội thoại bằng văn bản."}</p></>}
      <div><Button type="button" disabled={op.pending||recognizing||!topic.trim()||(!input.trim()&&!turns.length)||(mode==="listening"&&!heard)} onClick={()=>void op.run(async()=>{
        const result=await request<{feedback:string}>("practice",{group_id:groupId,session_id:sessionId(),mode,topic,input_summary:mode==="speaking"?fullText.slice(-3500):input.trim(),duration_seconds:Math.floor(mode==="speaking"?seconds.current:(Date.now()-since.current)/1000)})
        if(!result.feedback)throw new RequestError("Chưa nhận được phản hồi.")
        setFeedback(result.feedback)
      })}>{op.pending?"Đang xử lý…":"Hoàn thành và xem phản hồi"}</Button></div>
    </>}
    {voiceError&&<p role="alert" className="learn-msg" data-error="true">{voiceError}</p>}<Notice notice={op.notice}/>
  </div>
}
