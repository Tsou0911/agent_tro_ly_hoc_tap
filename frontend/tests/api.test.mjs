import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, fetchApi, json, mondayOf, parseSession, shiftDay } from "../app/api.ts";

function session(claims = {}) {
  const subject = "học-viên-demo";
  const role = "student";
  const payload = Buffer.from(JSON.stringify({
    sub: subject, role, exp: Math.floor(Date.now() / 1000) + 120, ...claims,
  })).toString("base64url");
  return { access_token: `mock.${payload}.signature`, subject, role };
}

test("restores a session with valid shape, matching identity and future expiry", () => {
  const value = session();
  assert.deepEqual(parseSession(value)?.session, value);
});

test("rejects stale sessions, malformed JWT payloads and unexpected role or identity", () => {
  for (const value of [
    null,
    { ...session(), access_token: "broken" },
    { ...session(), access_token: "mock.invalid.signature" },
    session({ exp: 1 }),
    session({ exp: "4000000000" }),
    session({ role: "instructor" }),
    session({ sub: "other" }),
    { ...session(), subject: 42 },
  ]) {
    assert.equal(parseSession(value), null);
  }
});

test("serializes integer task minutes and forwards the Bearer header", async (t) => {
  const payload = { title: "Luyện nghe", day: "2026-11-16", estimated_minutes: 25 };
  const saved = { id: "mock-task", status: "todo" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.match(url, /\/api\/courses\/english101\/tasks$/);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    assert.equal(options.headers.get("Authorization"), "Bearer mock-token");
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json(saved, { status: 201 });
  });
  assert.deepEqual(await fetchApi("/api/courses/english101/tasks", json("POST", payload), "mock-token"), saved);
});

test("normalizes validation, authentication, unavailable and invalid response bodies", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch");
  for (const [body, status, message] of [
    [{ detail: [{ loc: ["body", "estimated_minutes"] }] }, 422, /Dữ liệu chưa hợp lệ/],
    [{ detail: "Invalid token" }, 401, /Invalid token/],
    [{ status: "unavailable", response: "Vui lòng thử lại." }, 503, /Vui lòng thử lại/],
  ]) {
    fetch.mock.mockImplementation(async () => Response.json(body, { status }));
    await assert.rejects(fetchApi("/api/example"), (error) =>
      error instanceof ApiError && error.status === status && message.test(error.message));
  }
  fetch.mock.mockImplementation(async () => new Response("<html>offline</html>", { status: 200 }));
  await assert.rejects(fetchApi("/api/example"), /dữ liệu không hợp lệ/);
  fetch.mock.mockImplementation(async () => { throw new TypeError("network"); });
  await assert.rejects(fetchApi("/api/example"), /Không kết nối được/);
});

test("calculates date-only week boundaries across month, year and DST changes", () => {
  assert.equal(mondayOf("2027-01-01"), "2026-12-28");
  assert.equal(mondayOf("2026-11-01"), "2026-10-26");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});
