const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type Session = { access_token: string; subject: string; role: "student" | "instructor" };
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskInput = { title: string; day: string; estimated_minutes: number };
export type TaskResult = { id: string; status: TaskStatus };
export type Task = TaskInput & TaskResult & { course: string };

type Statement = { text: string; evidence: { chunk_id: string; quote: string }[] };
export type PlanItem = Statement & { day: string; minutes: number; assignment_id: string | null };
export type Workflow = {
  status: "ok" | "out_of_scope" | "academic_refusal" | "insufficient_evidence" | "unavailable";
  response: string;
  citations: { chunk_id: string; title: string; resource_id: string; document_version: string; page: number; source_uri: string }[];
  plan: { tasks: PlanItem[] } | null;
  reflection: { questions: Statement[]; memory: { observation: string; student_quote: string }[] } | null;
  memory_id: string | null;
  escalation_id: string | null;
};

export type RequestAPI = <T>(path: string, options?: RequestInit) => Promise<T>;
export type FormContext = {
  path: string;
  request: RequestAPI;
  run: (action: () => Promise<void>) => Promise<void>;
};

export function json(method: "POST" | "PATCH" | "PUT", body: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchApi<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error("Không kết nối được với máy chủ. Vui lòng thử lại.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.response === "string" ? data.response
      : typeof data?.detail === "string" ? data.detail
      : response.status === 422 ? "Dữ liệu chưa hợp lệ. Hãy kiểm tra các trường và thử lại."
      : `Yêu cầu thất bại (HTTP ${response.status}).`;
    throw new ApiError(response.status, message);
  }
  if (data === null || typeof data !== "object") throw new Error("Máy chủ trả dữ liệu không hợp lệ.");
  return data as T;
}

export function parseSession(value: unknown): { session: Session; expiresAt: number } | null {
  if (!value || typeof value !== "object") return null;
  const { access_token, subject, role } = value as Partial<Session>;
  if (typeof access_token !== "string" || typeof subject !== "string" || !subject.trim()
      || (role !== "student" && role !== "instructor")) return null;
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(access_token)) return null;
  try {
    // This checks browser state only. The API verifies the JWT signature and permissions.
    const [, payload] = access_token.split(".");
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    const expiresAt = typeof claims.exp === "number" ? claims.exp * 1000 : NaN;
    if (claims.sub !== subject || claims.role !== role || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return { session: { access_token, subject, role }, expiresAt };
  } catch {
    return null;
  }
}

export function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}
