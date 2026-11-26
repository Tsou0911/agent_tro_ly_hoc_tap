"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { vi } from "@/lib/i18n/vi"
import type { ReactNode } from "react"

export class RequestError extends Error {
  constructor(message: string, readonly code?: string) { super(message) }
}
export async function request<T = unknown>(endpoint: string, body: unknown, method = "POST"): Promise<T> {
  const multipart = body instanceof FormData
  const response = await fetch("/api/" + endpoint, {
    method, headers: multipart ? undefined : { "Content-Type": "application/json" },
    body: multipart ? body : JSON.stringify(body)
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new RequestError(result.error || vi.common.requestFailed, result.code)
  return result
}
export function useAction() {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState({ text: "", error: false })
  const router = useRouter()
  async function run(action: () => Promise<void>, success = "", refresh = true) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setNotice({text:"", error:false})
    try {
      await action()
      setNotice({text:success, error:false})
      if (refresh) router.refresh()
    } catch(err) {
      setNotice({text:err instanceof Error ? err.message : vi.common.unexpectedError, error:true})
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return { pending, run, notice }
}
export function Notice({ notice }: { notice: {text:string;error:boolean} }) {
  return notice.text ? <p className="learn-msg" data-error={notice.error} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null
}
export function Submit({ pending, children }: { pending:boolean; children:ReactNode }) {
  return <div><Button type="submit" disabled={pending}>{pending ? vi.common.processing : children}</Button></div>
}
export function val(data: FormData, name: string) { return String(data.get(name) ?? "").trim() }
