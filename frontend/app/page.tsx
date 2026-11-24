"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, fetchApi, json, mondayOf, parseSession, shiftDay, today } from "./api";
import type { FormContext, RequestAPI, Session, Task } from "./api";
import { DoForm, PlanForm, ReflectForm, TaskForm } from "./student-forms";

const SESSION_KEY = "learning-session";
const EXPIRED = "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.";
const studentTabs = [
  ["plan", "PLAN · Kế hoạch tuần"],
  ["tasks", "Nhiệm vụ"],
  ["do", "DO · Luyện tiếng Anh"],
  ["reflect", "REFLECT · Nhìn lại tuần học"],
];
const instructorTabs = [["dashboard", "Tổng quan"], ["escalations", "Cần hỗ trợ"]];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState("plan");
  const [loginSubject, setLoginSubject] = useState("student-demo");
  const [loginRole, setLoginRole] = useState<Session["role"]>("student");
  const [course, setCourse] = useState("english101");
  const [courseInput, setCourseInput] = useState("english101");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  function clearSession(message = "") {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // The active session still ends when browser storage is unavailable.
    }
    setSession(null);
    setTasks([]);
    setError(message);
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved !== null) {
        const parsed = parseSession(JSON.parse(saved));
        if (!parsed) {
          clearSession(EXPIRED);
        } else {
          setSession(parsed.session);
          setActive(parsed.session.role === "student" ? "plan" : "dashboard");
        }
      }
    } catch {
      clearSession(EXPIRED);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const parsed = parseSession(session);
    if (!parsed) {
      clearSession(EXPIRED);
      return;
    }
    // Demo tokens expire after two hours, within the range of a browser timer.
    const timer = window.setTimeout(() => clearSession(EXPIRED), parsed.expiresAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [session]);

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yêu cầu thất bại.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const request: RequestAPI = async <T,>(path: string, options?: RequestInit) => {
    if (!session || !parseSession(session)) {
      clearSession(EXPIRED);
      throw new Error(EXPIRED);
    }
    try {
      const data = await fetchApi<T>(path, options, session.access_token);
      if (!parseSession(session)) {
        clearSession(EXPIRED);
        throw new Error(EXPIRED);
      }
      return data;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearSession(EXPIRED);
        throw new Error(EXPIRED);
      }
      throw e;
    }
  };

  function login(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const subject = loginSubject.trim();
      if (!subject) throw new Error("Hãy nhập tên định danh.");
      const parsed = parseSession(await fetchApi<unknown>("/api/auth/login", json("POST", { subject, role: loginRole })));
      if (!parsed) throw new Error("Máy chủ trả phiên đăng nhập không hợp lệ.");
      localStorage.setItem(SESSION_KEY, JSON.stringify(parsed.session));
      setTasks([]);
      setSession(parsed.session);
      setActive(parsed.session.role === "student" ? "plan" : "dashboard");
    });
  }

  if (!ready) return <main className="login-wrap"><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>;

  if (!session) {
    return (
      <main className="login-wrap">
        <form className="card login-card" onSubmit={login}>
          <h1>AI Learning Companion</h1>
          <p className="empty">Lập kế hoạch và tự học tiếng Anh theo chu trình Plan–Do–Reflect.</p>
          {error && <div className="alert error" role="alert">{error}</div>}
          <fieldset disabled={busy}>
            <label className="field">Tên định danh
              <input value={loginSubject} maxLength={100} onChange={(e) => setLoginSubject(e.target.value)} required />
            </label>
            <label className="field">Vai trò demo
              <select value={loginRole} onChange={(e) => {
                const role = e.target.value as Session["role"];
                setLoginRole(role);
                setLoginSubject(role === "student" ? "student-demo" : "instructor-demo");
              }}>
                <option value="student">Người học</option>
                <option value="instructor">Giảng viên</option>
              </select>
            </label>
            <button className="btn primary">{busy ? "Đang đăng nhập…" : "Đăng nhập demo"}</button>
          </fieldset>
        </form>
      </main>
    );
  }

  const id = encodeURIComponent(course);
  const path = session.role === "student" ? `/api/courses/${id}` : `/api/instructor/courses/${id}`;
  const context = { path, request, run };
  const courseTasks = tasks.filter((task) => task.course === course);

  function onSaved(task: Omit<Task, "course">) {
    setTasks((list) => [...list, { ...task, course }]);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Learn<span>AI</span></div>
        <nav className="nav">
          {(session.role === "student" ? studentTabs : instructorTabs).map(([tab, label]) => (
            <button key={tab} className={active === tab ? "active" : ""} aria-current={active === tab ? "page" : undefined}
              disabled={busy} onClick={() => { setActive(tab); setError(""); }}>{label}</button>
          ))}
        </nav>
        <div className="user">
          <div>{session.subject}</div>
          <div>{session.role === "student" ? "Người học" : "Giảng viên"}</div>
          <button className="btn secondary" style={{ marginTop: 10 }} disabled={busy} onClick={() => clearSession()}>Đăng xuất</button>
        </div>
      </aside>
      <main className="main">
        {error && <div className="alert error" role="alert">{error}</div>}
        <div role="status">{busy && <p className="empty">Đang xử lý yêu cầu…</p>}</div>
        <fieldset disabled={busy}>
          <form className="course-settings row" onSubmit={(event) => {
            event.preventDefault();
            if (!courseInput.trim() || pending.current) return;
            setCourse(courseInput.trim());
            setCourseInput(courseInput.trim());
            setError("");
          }}>
            <label htmlFor="course">Mã học phần</label>
            <input id="course" value={courseInput} maxLength={100} required onChange={(e) => setCourseInput(e.target.value)} />
            <button className="btn secondary" disabled={!courseInput.trim() || courseInput.trim() === course}>Đổi học phần</button>
            {courseInput.trim() !== course && <small>Đang dùng {course}</small>}
          </form>
          <div key={course}>
            {session.role === "student" ? (
              <>
                <section hidden={active !== "plan"}><PlanForm {...context} onSaved={onSaved} /></section>
                <section hidden={active !== "tasks"}><TaskForm {...context} tasks={courseTasks} onSaved={onSaved}
                  onUpdated={(task) => setTasks((list) => list.map((item) =>
                    item.id === task.id ? { ...item, status: task.status } : item))} /></section>
                <section hidden={active !== "do"}><DoForm {...context} /></section>
                <section hidden={active !== "reflect"}><ReflectForm {...context} tasks={courseTasks} /></section>
              </>
            ) : active === "dashboard" ? <Dashboard {...context} /> : <Escalations {...context} />}
          </div>
        </fieldset>
      </main>
    </div>
  );
}

type KPIs = {
  completion_rate: number | null;
  on_time_submission_rate: number | null;
  task_count: number;
  completed_task_count: number;
};

function Dashboard({ path, request, run }: FormContext) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [start, setStart] = useState(mondayOf(today()));
  const [end, setEnd] = useState(today());

  function load(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setKpis(null);
      if (!start || !end || end < start) throw new Error("Hãy chọn khoảng ngày hợp lệ.");
      const params = new URLSearchParams({
        start: start + "T00:00:00+07:00",
        end: shiftDay(end, 1) + "T00:00:00+07:00",
      });
      setKpis(await request<KPIs>(`${path}/kpis?${params}`));
    });
  }

  const percent = (value: number | null) => value === null ? "Không đủ dữ liệu" : `${value}%`;

  return (
    <>
      <div className="top"><h1>Dashboard giảng viên</h1></div>
      <form className="card" onSubmit={load}>
        <div className="grid">
          <label className="field">Từ ngày<input type="date" value={start} required onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field">Đến ngày<input type="date" value={end} required min={start} max="9999-12-30" onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <button className="btn primary">Xem KPI</button>
      </form>
      {kpis && <div className="grid results">
        <div className="card"><h2>{percent(kpis.completion_rate)}</h2><p>Tỷ lệ hoàn thành nhiệm vụ</p></div>
        <div className="card"><h2>{percent(kpis.on_time_submission_rate)}</h2><p>Tỷ lệ nộp đúng hạn</p></div>
        <div className="card"><h2>{kpis.task_count}</h2><p>Số nhiệm vụ trong kỳ</p></div>
        <div className="card"><h2>{kpis.completed_task_count}</h2><p>Nhiệm vụ đã hoàn thành</p></div>
      </div>}
    </>
  );
}

type Escalation = { id: string; question: string; reason: string; status: string; created_at: string };

function Escalations({ path, request, run }: FormContext) {
  const [rows, setRows] = useState<Escalation[] | null>(null);
  return (
    <>
      <div className="top"><h1>Câu hỏi cần giảng viên hỗ trợ</h1></div>
      <div className="card">
        <button className="btn primary" onClick={() => void run(async () => {
          setRows(null);
          setRows(await request<Escalation[]>(`${path}/escalations`));
        })}>Tải danh sách</button>
        {rows?.length === 0 && <p className="empty results">Chưa có câu hỏi cần hỗ trợ.</p>}
        {rows?.map((row) => (
          <div className="task" key={row.id}>
            <div><strong>{row.question}</strong><div className="empty">{row.reason} · {row.status}</div></div>
            <span className="badge">{new Date(row.created_at).toLocaleString("vi-VN")}</span>
          </div>
        ))}
      </div>
    </>
  );
}
