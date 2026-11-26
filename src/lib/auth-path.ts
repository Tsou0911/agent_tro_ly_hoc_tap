import type { Role } from "@/types/database";

export function normalizeJoinCode(value: string) {
  const code = value.trim();
  return /^[a-z0-9]{6}$/i.test(code) ? code.toUpperCase() : null;
}

export function joinDestination(next: unknown): string | null {
  const code = typeof next === "string" ? /^\/join\/([a-z0-9]{6})$/i.exec(next)?.[1] : undefined;
  return code ? "/join/" + code.toUpperCase() : null;
}

export function roleDestination(role: Role, next?: unknown) {
  const invitation = role === "student" ? joinDestination(next) : null;
  if (invitation) return invitation;
  if (typeof next !== "string") return "/" + role;

  try {
    const url = new URL(next, "http://linguacompanion.local");
    if (url.origin !== "http://linguacompanion.local") return "/" + role;
    if (url.pathname !== "/" + role && !url.pathname.startsWith("/" + role + "/")) {
      return "/" + role;
    }
    return url.pathname + url.search;
  } catch {
    return "/" + role;
  }
}
