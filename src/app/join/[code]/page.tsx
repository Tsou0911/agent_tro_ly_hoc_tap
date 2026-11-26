import Link from "next/link"
import { Brand } from "@/components/brand"
import { JoinClass } from "@/components/learning/groups"
import { PageIntro } from "@/components/learning/common"
import { joinDestination } from "@/lib/auth-path"
import { vi } from "@/lib/i18n/vi"
import { configured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

async function Invitation({ path }: { path: string }) {
  if (!configured()) return <p role="alert">{vi.groups.errors.connectSupabase}</p>
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  const code = path.slice("/join/".length)
  if (!user) {
    const next = encodeURIComponent(path)
    return <>
      <p>{vi.groups.classCode} <strong>{code}</strong></p>
      <p>{vi.groups.errors.joinSignIn}</p>
      <div className="learn-actions">
        <Link className="learn-link" href={"/login?next=" + next}>{vi.auth.loginAction}</Link>
        <Link className="learn-link" href={"/register?next=" + next}>{vi.auth.registerHeading}</Link>
      </div>
    </>
  }

  const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", user.id).single()
  if (profileError || !profile) return <p role="alert">{vi.auth.profileUnavailable}</p>
  if (profile.role === "teacher") {
    return <><p>{vi.groups.errors.studentInviteOnly}</p><Link className="learn-link" href="/teacher">{vi.teacherGroups.heading}</Link></>
  }

  const { data: group, error } = await db.rpc("preview_group_invite", { p_code: code }).maybeSingle()
  if (error) return <p role="alert">{vi.groups.errors.inviteUnavailable}</p>
  if (!group) return <p role="alert">{vi.groups.errors.groupNotFound}</p>
  return <>
    <div className="learn-item">
      <div className="learn-row"><h2>{group.name}</h2><span className="learn-badge">{group.language}</span></div>
      <p className="learn-subtle">{vi.groups.classCode} {code}</p>
    </div>
    <JoinClass invitationCode={code}/>
  </>
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const path = joinDestination("/join/" + code)
  return <main className="mx-auto grid min-h-screen max-w-xl content-center gap-6 p-5">
    <Brand/>
    <section className="learn-box">
      <PageIntro title={vi.groups.join}/>
      {path ? <Invitation path={path}/> : <p role="alert">{vi.groups.invalidCode}</p>}
    </section>
  </main>
}
