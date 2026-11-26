"use client"
import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { QRCodeCanvas } from "qrcode.react"
import type { Html5Qrcode } from "html5-qrcode"
import { Camera, Copy, Download, QrCode } from "lucide-react"
import { joinDestination, normalizeJoinCode } from "@/lib/auth-path"
import { vi } from "@/lib/i18n/vi"
import { Button } from "@/components/ui/button"
import { Notice, Submit, request, useAction, val } from "./client"

export function CreateClass() {
  const op = useAction()
  const router = useRouter()
  return <form className="learn-form" onSubmit={e => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    void op.run(async () => {
      const { id } = await request<{id:string}>("groups", { name:val(data,"name"), language:val(data,"language") })
      router.push("/teacher/groups/" + id)
    })
  }}>
    <label>{vi.groups.className}<input required name="name" maxLength={100} placeholder={vi.groups.classNamePlaceholder}/></label>
    <label>{vi.groups.language}<input required name="language" maxLength={60} placeholder={vi.groups.languagePlaceholder}/></label>
    <Submit pending={op.pending}>{vi.groups.create}</Submit><Notice notice={op.notice}/>
  </form>
}

export function InviteActions({ code, name }: { code: string; name?: string }) {
  const [url, setUrl] = useState("")
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const linkInput = useRef<HTMLInputElement>(null)
  const heading = useId()
  const op = useAction()

  useEffect(() => { setUrl(new URL("/join/" + code, window.location.origin).href) }, [code])

  function download() {
    if (!canvas.current) return
    const link = document.createElement("a")
    link.href = canvas.current.toDataURL("image/png")
    link.download = "linguacompanion-" + code + ".png"
    link.click()
  }

  return <div className="learn-list">
    <div className="learn-actions flex-wrap">
      <Button type="button" variant="outline" disabled={!url || op.pending} onClick={() => void op.run(async () => {
        try {
          await navigator.clipboard.writeText(url)
        } catch {
          dialog.current?.showModal()
          linkInput.current?.select()
          throw new Error(vi.groups.copyFallback)
        }
      }, vi.groups.copied, false)}><Copy size={16}/> {vi.groups.copyInvite}</Button>
      <Button type="button" variant="outline" disabled={!url} onClick={() => dialog.current?.showModal()}><QrCode size={16}/> {vi.groups.showQr}</Button>
    </div>
    <Notice notice={op.notice}/>
    <dialog ref={dialog} aria-labelledby={heading} className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-white p-5 text-foreground shadow-xl backdrop:bg-black/40">
      <div className="learn-list">
        <h2 id={heading} className="text-lg font-semibold">{name ? vi.groups.classQrTitle + name : vi.groups.qrTitle}</h2>
        {url && <QRCodeCanvas ref={canvas} value={url} size={1024} marginSize={4} level="M" role="img"
          aria-label={vi.groups.qrAccessibleLabel + code} style={{ width: 240, maxWidth: "100%", height: "auto", margin: "auto" }}/>}
        <p>{vi.groups.classCode} <strong className="tracking-widest">{code}</strong></p>
        <input ref={linkInput} className="learn-input" aria-label={vi.groups.inviteLink} readOnly value={url} onFocus={e => e.currentTarget.select()}/>
        <div className="learn-actions flex-wrap">
          <Button type="button" onClick={download}><Download size={16}/> {vi.groups.downloadQr}</Button>
          <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>{vi.groups.close}</Button>
        </div>
      </div>
    </dialog>
  </div>
}

export function Invite({ code }: { code: string }) {
  return <section className="learn-box">
    <h2>{vi.groups.invite}</h2>
    <p>{vi.groups.classCode} <strong className="tracking-widest">{code}</strong></p>
    <InviteActions code={code}/>
  </section>
}

function scanCode(raw: string) {
  const value = raw.trim()
  const directCode = normalizeJoinCode(value)
  if (directCode) return directCode
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return joinDestination(url.pathname)?.slice("/join/".length) ?? null
  } catch {
    return null
  }
}

export function JoinClass({ invitationCode }: { invitationCode?: string }) {
  const op = useAction()
  const router = useRouter()
  const [code, setCode] = useState("")
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off")
  const [cameraMessage, setCameraMessage] = useState("")
  const reader = useRef<Html5Qrcode | null>(null)
  const stopping = useRef<Promise<void> | null>(null)
  const panel = useRef<HTMLDetailsElement>(null)
  const mounted = useRef(false)
  const id = "qr-" + useId().replace(/[^a-z0-9-]/gi, "")

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (!stopping.current && reader.current?.isScanning) void reader.current.stop().catch(() => undefined)
    }
  }, [])

  async function scanner() {
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
    if (!mounted.current || !panel.current?.open) return null
    reader.current ??= new Html5Qrcode(id, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false
    })
    return reader.current
  }

  async function stopCamera() {
    if (!stopping.current && reader.current?.isScanning) {
      stopping.current = reader.current.stop().finally(() => { stopping.current = null })
    }
    await stopping.current
    if (mounted.current) setCamera("off")
  }

  async function joinClass(joinCode: string) {
    await stopCamera()
    const { id } = await request<{ id: string }>("groups", { join_code: joinCode })
    router.replace("/student?group=" + id)
    router.refresh()
  }

  async function toggleCamera() {
    setCameraMessage("")
    try {
      if (camera === "on") {
        await stopCamera()
        return
      }
      setCamera("starting")
      const qr = await scanner()
      if (!qr) {
        if (mounted.current) setCamera("off")
        return
      }
      let decoded = false
      const started = qr.start({ facingMode: "environment" }, { fps: 8 }, result => {
        if (decoded || !mounted.current || !panel.current?.open) return
        const match = scanCode(result)
        if (!match) {
          setCameraMessage(vi.groups.notInviteQr)
          return
        }
        decoded = true
        void started.then(() => {
          if (!mounted.current || !panel.current?.open) return
          setCameraMessage("")
          setCode(match)
          void op.run(() => joinClass(match), vi.groups.joined, false)
        }).catch(() => undefined)
      }, () => undefined)
      await started
      if (!mounted.current || !panel.current?.open) await stopCamera()
      else if (!decoded) setCamera("on")
    } catch {
      if (mounted.current) {
        setCamera("off")
        setCameraMessage(vi.groups.cameraUnavailable)
      }
    }
  }

  return <div className="learn-list">
    {invitationCode ? <div><Button disabled={op.pending} onClick={() => void op.run(() => joinClass(invitationCode), vi.groups.joined, false)}>
      {op.pending ? vi.groups.joining : vi.groups.join}
    </Button></div> : <details ref={panel} className="learn-details" onToggle={e => {
      if (!e.currentTarget.open && camera === "on") void stopCamera().catch(() => setCameraMessage(vi.groups.cameraStopFailed))
    }}>
      <summary className="cursor-pointer font-semibold">{vi.groups.joinQrOrCode}</summary>
      <div className="learn-list">
        <form className="learn-form" onSubmit={e => {
          e.preventDefault()
          void op.run(async () => {
            const match = normalizeJoinCode(code)
            if (!match) throw new Error(vi.groups.invalidCode)
            await joinClass(match)
          }, vi.groups.joined, false)
        }}>
          <label>{vi.groups.classCode}<input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            required maxLength={6} pattern="[A-Za-z0-9]{6}" autoCapitalize="characters" autoComplete="off" placeholder={vi.groups.codePlaceholder}/></label>
          <Submit pending={op.pending || camera === "starting"}>{vi.groups.join}</Submit>
        </form>
        <div id={id}/>
        <div><Button type="button" variant="outline" disabled={op.pending || camera === "starting"} onClick={() => void toggleCamera()}>
          <Camera size={16}/> {camera === "on" ? vi.groups.cameraOff : camera === "starting" ? vi.groups.cameraStarting : vi.groups.cameraOn}
        </Button></div>
        {cameraMessage && <p role="status">{cameraMessage}</p>}
        <label className="learn-file">{vi.groups.uploadQr}<input type="file" accept="image/*"
          disabled={op.pending || camera === "starting"} onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            void op.run(async () => {
              setCameraMessage("")
              await stopCamera()
              const qr = await scanner()
              if (!qr) return
              const decoded = await qr.scanFile(file, false).catch(() => {
                throw new Error(vi.groups.unreadableQr)
              })
              const match = scanCode(decoded)
              if (!match) throw new Error(vi.groups.noInviteInImage)
              setCode(match)
              await joinClass(match)
            }, vi.groups.joined, false)
          }}/></label>
      </div>
    </details>}
    <Notice notice={op.notice}/>
  </div>
}

export function AimForm({groupId}:{groupId:string}) {
  const op = useAction()
  return <form className="learn-form" onSubmit={e => {
    e.preventDefault(); const form=e.currentTarget; const data=new FormData(form)
    void op.run(async () => {
      if (val(data,"end_date") < val(data,"start_date")) throw new Error(vi.groups.dateOrder)
      const targets = Object.fromEntries(["target_tests","target_min_score","target_listening","target_writing","target_speaking_mins"].map(k => [k,Number(val(data,k))]))
      if (!["target_tests","target_listening","target_writing","target_speaking_mins"].some(k=>targets[k]>0)) throw new Error(vi.groups.targetRequired)
      await request("aims",{group_id:groupId,title:val(data,"title"),description:val(data,"description"),start_date:val(data,"start_date"),end_date:val(data,"end_date"),...targets})
      form.reset()
    }, vi.groups.aimSaved)
  }}>
    <label>{vi.groups.aimTitle}<input name="title" required maxLength={180}/></label>
    <label>{vi.groups.aimDescription}<textarea name="description" maxLength={2000}/></label>
    <div className="learn-columns"><label>{vi.groups.startsAt}<input type="date" name="start_date" required/></label><label>{vi.groups.endsAt}<input type="date" name="end_date" required/></label></div>
    <div className="learn-columns">{[["target_tests",vi.groups.targetTests],["target_min_score",vi.groups.targetScore],["target_listening",vi.groups.targetListening],["target_writing",vi.groups.targetWriting],["target_speaking_mins",vi.groups.targetSpeaking]].map(([key,label]) =>
      <label key={key}>{label}<input type="number" name={key} min={0} max={key==="target_min_score"?100:10000} step={key==="target_min_score"?"0.1":1} defaultValue={0} required/></label>)}</div>
    <Submit pending={op.pending}>{vi.groups.saveAim}</Submit><Notice notice={op.notice}/>
  </form>
}

export function MaterialUpload({groupId}:{groupId:string}) {
  const op=useAction()
  return <form className="learn-form" onSubmit={e=>{
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form);data.set("group_id",groupId)
    void op.run(async()=>{await request("materials/upload",data);form.reset()}, "Đã lưu tài liệu và lập chỉ mục.")
  }}><label>{vi.groups.uploadMaterials}<input name="file" type="file" required accept=".pdf,.docx"/></label>
    <Submit pending={op.pending}>{vi.groups.upload}</Submit><Notice notice={op.notice}/>
  </form>
}
