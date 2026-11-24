"use client";

import { FormEvent, useState } from "react";
import { json, mondayOf, shiftDay, today } from "./api";
import type { FormContext, PlanItem, Task, TaskInput, TaskResult, TaskStatus, Workflow } from "./api";

const skills = ["Từ vựng", "Ngữ pháp", "Nghe", "Nói", "Đọc", "Viết"];
const taskStatuses: Record<TaskStatus, string> = { todo: "Chưa làm", in_progress: "Đang làm", done: "Hoàn thành" };
const latestWeek = "9999-12-25";

function validWeek(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= latestWeek;
}

type TaskSaver = (task: TaskInput & TaskResult) => void;
type EditableTask = TaskInput & { proposal: PlanItem; saved: boolean };

function validateTask(input: TaskInput, max = 1440) {
  if (!input.title || input.title.length > 2000) throw new Error("Tên nhiệm vụ cần từ 1 đến 2.000 ký tự.");
  if (!input.day) throw new Error("Hãy chọn ngày học.");
  if (!Number.isInteger(input.estimated_minutes) || input.estimated_minutes < 1 || input.estimated_minutes > max) {
    throw new Error(`Thời lượng dự kiến phải là số phút nguyên từ 1 đến ${max}.`);
  }
}

function Citations({ citations }: Pick<Workflow, "citations">) {
  if (citations.length === 0) return null;
  return (
    <div className="citations">
      <h3>Nguồn học liệu</h3>
      {citations.map((source) => (
        <div className="citation" key={source.chunk_id}>
          <strong>[{source.chunk_id}] {source.title}</strong> · bản {source.document_version} · trang {source.page}
          <br /><small>{source.source_uri}</small>
        </div>
      ))}
    </div>
  );
}

export function PlanForm({ path, request, run, onSaved }: FormContext & { onSaved: TaskSaver }) {
  const [week, setWeek] = useState(mondayOf(today()));
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [focus, setFocus] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>(Array(7).fill(""));
  const [budget, setBudget] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Workflow | null>(null);
  const [draft, setDraft] = useState<EditableTask[]>([]);

  function generate(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setResult(null);
      setDraft([]);
      if (!goal.trim()) throw new Error("Hãy nhập mục tiêu tiếng Anh trong tuần.");
      if (!validWeek(week)) throw new Error("Hãy chọn ngày bắt đầu tuần hợp lệ.");
      const minutes = availability.map(Number);
      if (minutes.some((value) => !Number.isInteger(value) || value < 0 || value > 1440) || !minutes.some(Boolean)) {
        throw new Error("Hãy nhập số phút nguyên từ 0 đến 1.440 và có ít nhất một ngày rảnh.");
      }
      const available = Object.fromEntries(minutes.map((value, i) => [shiftDay(week, i), value]));
      const message = [
        `Mục tiêu tiếng Anh trong tuần: ${goal.trim()}`,
        level && `Trình độ CEFR tự đánh giá: ${level}`,
        focus.length > 0 && `Kỹ năng tập trung: ${focus.join(", ")}`,
      ].filter(Boolean).join("\n");
      const data = await request<Workflow>(`${path}/workflow`, json("POST", {
        mode: "plan", message, week_start: week, available_minutes: available,
      }));
      setBudget(available);
      setResult(data);
      setDraft(data.plan?.tasks.map((proposal) => ({
        title: proposal.text, day: proposal.day, estimated_minutes: proposal.minutes, proposal, saved: false,
      })) ?? []);
    });
  }

  function edit(index: number, fields: Partial<EditableTask>) {
    setDraft((tasks) => tasks.map((task, i) => i === index ? { ...task, ...fields } : task));
  }

  function approve(event: FormEvent, index: number) {
    event.preventDefault();
    void run(async () => {
      const task = draft[index];
      if (task.saved) return;
      const input = { title: task.title.trim(), day: task.day, estimated_minutes: task.estimated_minutes };
      validateTask(input, 480);
      const savedMinutes = draft.reduce((sum, item) => item.saved && item.day === input.day ? sum + item.estimated_minutes : sum, 0);
      if (savedMinutes + input.estimated_minutes > (budget[input.day] ?? 0)) {
        throw new Error("Nhiệm vụ này cùng các nhiệm vụ đã duyệt trong bản đề xuất vượt quỹ phút của ngày.");
      }
      const saved = await request<TaskResult>(`${path}/tasks`, json("POST", input));
      edit(index, { ...input, saved: true });
      onSaved({ ...input, ...saved });
    });
  }

  return (
    <>
      <div className="top"><h1>Lập kế hoạch học tiếng Anh</h1></div>
      <form className="card" onSubmit={generate}>
        <label className="field">Mục tiêu trong tuần
          <textarea value={goal} maxLength={5700} placeholder="Ví dụ: dùng được 8 cụm từ để hỏi và chỉ đường."
            onChange={(e) => setGoal(e.target.value)} required />
        </label>
        <div className="grid">
          <label className="field">Trình độ CEFR (tùy chọn)
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Chưa chọn</option>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="field">Ngày bắt đầu tuần
            <input type="date" value={week} max={latestWeek} required onChange={(e) => setWeek(e.target.value)} />
          </label>
        </div>
        <fieldset className="skill-list">
          <legend>Kỹ năng muốn tập trung (tùy chọn)</legend>
          <div className="row">
            {skills.map((skill) => (
              <label key={skill}><input type="checkbox" checked={focus.includes(skill)} onChange={(e) => setFocus(
                e.target.checked ? [...focus, skill] : focus.filter((item) => item !== skill),
              )} /> {skill}</label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Số phút rảnh mỗi ngày</legend>
          <div className="grid-7">
            {availability.map((value, i) => {
              const day = validWeek(week) ? shiftDay(week, i) : "";
              return (
                <label className="field" key={i}>
                  {day ? new Date(day + "T00:00:00Z").toLocaleDateString("vi-VN", {
                    weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC",
                  }) : `Ngày ${i + 1}`}
                  <input type="number" min="0" max="1440" step="1" value={value} placeholder="0"
                    onChange={(e) => setAvailability(availability.map((item, index) => index === i ? e.target.value : item))} />
                </label>
              );
            })}
          </div>
        </fieldset>
        <button className="btn primary">Đề xuất kế hoạch</button>
      </form>
      {result && (
        <section className="card results">
          <h2>Kế hoạch đề xuất</h2>
          {draft.length === 0 ? <p className="alert" role="status">{result.response}</p> : (
            <p className="empty">Sửa và duyệt từng nhiệm vụ bạn muốn lưu. Nhiệm vụ đã lưu xuất hiện ở mục Nhiệm vụ.</p>
          )}
          {draft.map((task, i) => (
            <form className="plan-task" onSubmit={(event) => approve(event, i)} key={i}>
              <fieldset disabled={task.saved}>
                <label className="field">Nhiệm vụ {i + 1}
                  <input value={task.title} maxLength={2000} required onChange={(e) => edit(i, { title: e.target.value })} />
                </label>
                <div className="grid">
                  <label className="field">Ngày học
                    <input type="date" value={task.day} required min={Object.keys(budget)[0]} max={Object.keys(budget).at(-1)}
                      readOnly={task.proposal.assignment_id !== null} onChange={(e) => edit(i, { day: e.target.value })} />
                  </label>
                  <label className="field">Phút dự kiến
                    <input type="number" value={task.estimated_minutes || ""} min="1" max="480" step="1" required
                      onChange={(e) => edit(i, { estimated_minutes: Number(e.target.value) })} />
                  </label>
                </div>
                <p className="empty">Quỹ phút của ngày trong đề xuất: {budget[task.day] ?? 0}
                  {task.proposal.assignment_id && " · Ngày học theo hạn bài tập"}</p>
                <p className="empty">Nguồn của đề xuất: {Array.from(new Set(task.proposal.evidence.map((e) => e.chunk_id))).map((id) => `[${id}]`).join(" ")}</p>
                {!task.saved && <button className="btn secondary">Duyệt và lưu</button>}
              </fieldset>
              {task.saved && <span className="badge" role="status">Đã lưu</span>}
            </form>
          ))}
          <Citations citations={result.citations} />
        </section>
      )}
    </>
  );
}

export function TaskForm({ path, request, run, tasks, onSaved, onUpdated }: FormContext & {
  tasks: Task[];
  onSaved: TaskSaver;
  onUpdated: (task: TaskResult) => void;
}) {
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(today());
  const [minutes, setMinutes] = useState("30");
  const [success, setSuccess] = useState("");

  function create(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setSuccess("");
      const input = { title: title.trim(), day, estimated_minutes: Number(minutes) };
      validateTask(input);
      const saved = await request<TaskResult>(`${path}/tasks`, json("POST", input));
      onSaved({ ...input, ...saved });
      setTitle("");
      setSuccess("Đã thêm nhiệm vụ.");
    });
  }

  function update(task: Task, status: TaskStatus) {
    void run(async () => {
      setSuccess("");
      onUpdated(await request<TaskResult>(`${path}/tasks/${encodeURIComponent(task.id)}`, json("PATCH", { status })));
      setSuccess("Đã cập nhật trạng thái.");
    });
  }

  return (
    <>
      <div className="top"><h1>Nhiệm vụ học tiếng Anh</h1></div>
      <form className="card" onSubmit={create}>
        <label className="field">Tên nhiệm vụ
          <input value={title} maxLength={2000} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <div className="grid">
          <label className="field">Ngày học<input type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></label>
          <label className="field">Phút dự kiến
            <input type="number" min="1" max="1440" step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
          </label>
        </div>
        <button className="btn primary">Thêm nhiệm vụ</button>
      </form>
      <section className="card results">
        <h2>Nhiệm vụ đã lưu trong phiên này</h2>
        {success && <p className="alert" role="status">{success}</p>}
        {tasks.length === 0 && <p className="empty">Chưa có nhiệm vụ trong phiên này.</p>}
        {[...tasks].sort((a, b) => a.day.localeCompare(b.day)).map((task, index) => (
          <div className="task" key={task.id}>
            <div><strong>{task.title}</strong><div className="empty">{task.day} · {task.estimated_minutes} phút dự kiến</div></div>
            <label className="field">Trạng thái
              <select aria-label={`Trạng thái nhiệm vụ ${index + 1}`} value={task.status} onChange={(e) => update(task, e.target.value as TaskStatus)}>
                {Object.entries(taskStatuses).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </select>
            </label>
          </div>
        ))}
      </section>
    </>
  );
}

export function DoForm({ path, request, run }: FormContext) {
  const [kind, setKind] = useState("practice");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Workflow | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setResult(null);
      if (!message.trim()) throw new Error("Hãy nhập mục tiêu luyện tập hoặc phần bạn đã thử.");
      const instruction = kind === "practice"
        ? "Dựa vào học liệu, đề xuất một bài luyện tiếng Anh theo mục tiêu bên dưới. Để tôi tự trả lời."
        : "Dựa vào học liệu, chỉ ra một điểm cần cải thiện và đặt câu hỏi để tôi tự sửa.";
      setResult(await request<Workflow>(`${path}/workflow`, json("POST", {
        mode: "do", message: `${instruction}\n\n${message.trim()}`, week_start: mondayOf(today()),
      })));
    });
  }

  return (
    <>
      <div className="top"><h1>Luyện tiếng Anh</h1></div>
      <form className="card" onSubmit={submit}>
        <label className="field">Bạn cần gì?
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="practice">Một bài luyện để tự làm</option>
            <option value="feedback">Gợi ý để tự sửa bài nháp</option>
          </select>
        </label>
        <label className="field">{kind === "practice" ? "Kỹ năng, mục tiêu và trình độ của bạn" : "Bài nháp và phần bạn muốn được góp ý"}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5700} required
            placeholder={kind === "practice" ? "Ví dụ: A2, luyện hỏi đường bằng một đoạn hội thoại ngắn."
              : "Ví dụ: “At the blue bench, left.” Làm sao để câu chỉ đường này rõ hơn?"} />
        </label>
        <p className="empty">Gợi ý dựa trên học liệu để bạn tự luyện và tự sửa bài. Nếu thiếu căn cứ, hệ thống sẽ báo rõ.</p>
        <button className="btn primary">Gửi yêu cầu</button>
      </form>
      {result && (
        <section className="card results">
          <h2>Phản hồi</h2>
          <p className="alert" role="status">{result.response}</p>
          <Citations citations={result.citations} />
        </section>
      )}
    </>
  );
}

export function ReflectForm({ path, request, run, tasks }: FormContext & { tasks: Task[] }) {
  const [week, setWeek] = useState(mondayOf(today()));
  const [progress, setProgress] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [result, setResult] = useState<Workflow | null>(null);
  const [approved, setApproved] = useState(false);
  const [success, setSuccess] = useState("");
  const lastDay = validWeek(week) ? shiftDay(week, 6) : "";
  const weekTasks = tasks.filter((task) => task.day >= week && task.day <= lastDay);
  const done = weekTasks.filter((task) => task.status === "done");

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setResult(null);
      setApproved(false);
      setSuccess("");
      if (!progress.trim()) throw new Error("Hãy ghi lại kỹ năng đã luyện hoặc tiến độ của bạn.");
      if (!validWeek(week)) throw new Error("Hãy chọn ngày bắt đầu tuần hợp lệ.");
      const message = [
        `Tiến độ và kỹ năng đã luyện: ${progress.trim()}`,
        difficulty.trim() && `Khó khăn: ${difficulty.trim()}`,
        adjustment.trim() && `Quỹ thời gian hoặc dự kiến điều chỉnh tuần sau: ${adjustment.trim()}`,
        "Hãy giúp tôi nhìn lại tiến độ và gợi ý cách phân bổ thời gian tuần sau dựa trên những gì tôi đã chia sẻ.",
      ].filter(Boolean).join("\n");
      setResult(await request<Workflow>(`${path}/workflow`, json("POST", {
        mode: "reflect", message, week_start: week,
      })));
    });
  }

  function approve(next: boolean) {
    if (!result?.memory_id) return;
    const id = encodeURIComponent(result.memory_id);
    void run(async () => {
      setSuccess("");
      const saved = await request<{ id: string; approved: boolean }>(`${path}/memories/${id}/approval`, json("PUT", { approved: next }));
      setApproved(saved.approved);
      setSuccess(saved.approved ? "Đã xác nhận ghi chú để dùng cho kế hoạch sau." : "Đã thu hồi xác nhận ghi chú.");
    });
  }

  return (
    <>
      <div className="top"><h1>Nhìn lại tuần học</h1></div>
      <form className="card" onSubmit={submit}>
        <label className="field">Ngày bắt đầu tuần
          <input type="date" value={week} max={latestWeek} onChange={(e) => setWeek(e.target.value)} required />
        </label>
        {weekTasks.length > 0 && (
          <p className="alert">Trong phiên này, bạn đã đánh dấu xong {done.length}/{weekTasks.length} nhiệm vụ của tuần, tương ứng
            {" "}{done.reduce((sum, task) => sum + task.estimated_minutes, 0)} phút dự kiến.</p>
        )}
        <label className="field">Bạn đã luyện kỹ năng nào và tiến bộ ra sao?
          <textarea value={progress} maxLength={1800} onChange={(e) => setProgress(e.target.value)} required />
        </label>
        <label className="field">Bạn gặp khó khăn ở đâu? (tùy chọn)
          <textarea value={difficulty} maxLength={1800} onChange={(e) => setDifficulty(e.target.value)} />
        </label>
        <label className="field">Tuần sau bạn rảnh bao nhiêu và muốn điều chỉnh gì? (tùy chọn)
          <textarea value={adjustment} maxLength={1800} onChange={(e) => setAdjustment(e.target.value)} />
        </label>
        <button className="btn primary">Nhận gợi ý phản tư</button>
      </form>
      {result && (
        <section className="card results">
          <h2>Gợi ý nhìn lại và điều chỉnh</h2>
          <p className="alert" role="status">{result.response}</p>
          <Citations citations={result.citations} />
          {!!result.reflection?.memory.length && (
            <div className="results">
              <h3>Ghi chú cho kế hoạch sau</h3>
              <ul>{result.reflection.memory.map((item, i) => <li key={i}>{item.observation}</li>)}</ul>
            </div>
          )}
          {result.memory_id && (
            <button className="btn secondary" onClick={() => approve(!approved)}>
              {approved ? "Thu hồi xác nhận" : "Xác nhận dùng ghi chú"}
            </button>
          )}
          {success && <p className="alert" role="status">{success}</p>}
        </section>
      )}
    </>
  );
}
