"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, GraduationCap, LoaderCircle, School } from "lucide-react";
import { z } from "zod";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/client";
import { configured } from "@/lib/supabase/config";
import { joinDestination, roleDestination } from "@/lib/auth-path";
import { vi } from "@/lib/i18n/vi";
import type { Role } from "@/types/database";

export function AuthForm({register=false,next,initialRole,confirm=false}: {register?:boolean; next?:string; initialRole?:string;confirm?:boolean}) {
  const router = useRouter();
  const [role,setRole]=useState<Role>(initialRole==="teacher"?"teacher":"student");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(confirm
    ? vi.auth.confirmRetry
    : "");
  const destination=joinDestination(next);
  const alternate=(register?"/login":"/register")+(destination?"?next="+encodeURIComponent(destination):"");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const email=String(form.get("email")).trim();
    const password=String(form.get("password"));
    const name=String(form.get("name")||"").trim();
    setMessage("");
    if (!configured()) { setMessage(vi.auth.setupSupabase); return; }
    if (!z.string().email().safeParse(email).success || (register && (!name || password.length<8))) {
      setMessage(vi.auth.invalidDetails); return;
    }
    setBusy(true);
    try {
      const db=createClient();
      const callback=new URL("/auth/callback",window.location.origin);
      if (destination) callback.searchParams.set("next",destination);
      const {data,error}=register
        ? await db.auth.signUp({email,password,options:{data:{full_name:name,role},emailRedirectTo:callback.toString()}})
        : await db.auth.signInWithPassword({email,password});
      if (error) {
        setMessage(error.code==="email_not_confirmed" ? vi.auth.emailNotConfirmed :
          register ? vi.auth.registerFailed : vi.auth.loginFailed);
        return;
      }
      if (!data.session || !data.user) {setMessage(vi.auth.confirmEmail);return;}
      const {data:profile,error:profileError}=await db.from("profiles").select("role").eq("id",data.user.id).single();
      if (profileError || !profile) {setMessage(vi.auth.profileUnavailable);return;}
      router.replace(roleDestination(profile.role, destination));
      router.refresh();
    } catch { setMessage(vi.auth.connectionFailed); }
    finally { setBusy(false); }
  }

  return <main className="auth-screen"><div className="auth-brand"><Brand/></div><section className="auth-card">
    <div className="auth-emblem">{register ? <GraduationCap/> : <School/>}</div>
    <h1>{register?vi.auth.registerHeading:vi.auth.loginHeading}</h1><p>{register?vi.auth.registerIntro:vi.auth.loginIntro}</p>
    <form onSubmit={submit} className="stack">
      {register && <><fieldset><legend>{vi.auth.roleLabel}</legend><div className="choose-role">
        {(["student","teacher"] as const).map(value=><label key={value} className={role===value?"selected":""}><input type="radio" name="role" value={value} checked={role===value} onChange={()=>setRole(value)}/>{value==="teacher"?<School size={16}/>:<GraduationCap size={16}/>} {value==="teacher"?vi.auth.teacher:vi.auth.student}</label>)}
      </div></fieldset><label>{vi.auth.displayName}<input className="field" name="name" autoComplete="name" maxLength={100} required/></label></>}
      <label>{vi.auth.email}<input className="field" name="email" type="email" autoComplete="email" required/></label>
      <div><label htmlFor="password">{vi.auth.password}{register && <small>{vi.auth.minimumPassword}</small>}</label><div className="password-field"><input className="field" id="password" name="password" type={show?"text":"password"} autoComplete={register?"new-password":"current-password"} minLength={register?8:1} required/>
      <button type="button" onClick={()=>setShow(!show)} aria-label={show?vi.auth.hidePassword:vi.auth.showPassword}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
      <Button disabled={busy} type="submit">{busy && <LoaderCircle className="animate-spin" size={16}/>} {register?vi.auth.registerAction:vi.auth.loginAction}</Button>
      {message && <p className="notice" role="status">{message}</p>}
    </form>
    <div className="auth-alt">{register?vi.auth.existingAccount:vi.auth.newAccount} <Link href={alternate}>{register?vi.auth.loginAction:vi.auth.registerAction}</Link></div>
  </section></main>;
}
