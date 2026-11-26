import assert from "node:assert/strict";
import test from "node:test";
import { joinDestination, normalizeJoinCode, roleDestination } from "./auth-path";

test("normalizes valid invitation codes and rejects malformed codes", () => {
  assert.equal(normalizeJoinCode(" ab12cd "), "AB12CD");
  assert.equal(normalizeJoinCode("abc1234"), null);
});

test("accepts only local invitation paths", () => {
  assert.equal(joinDestination("/join/ab12cd"), "/join/AB12CD");
  assert.equal(joinDestination("//example.com/join/ab12cd"), null);
  assert.equal(joinDestination("/join/invalid"), null);
});

test("returns only same-role internal destinations after authentication", () => {
  assert.equal(roleDestination("teacher", "/teacher/groups/123?tab=materials"), "/teacher/groups/123?tab=materials");
  assert.equal(roleDestination("student", "/teacher/groups/123"), "/student");
  assert.equal(roleDestination("teacher", "https://example.com/teacher"), "/teacher");
  assert.equal(roleDestination("student", "/join/ab12cd"), "/join/AB12CD");
});
