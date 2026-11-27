// 수집기 단위 테스트 (네트워크 없이 실행). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeLatest, mergeHistory } from "./index.mjs";
import { grade } from "./sources/air.mjs";
import { todayKST } from "./lib.mjs";

const SRC = { a: { history: d => ({ v: d.v }) }, b: { history: d => ({ w: d.w }) } };
const T1 = new Date("2026-11-27T00:00:00Z"); // 한국 시간 2026-11-27 09:00
const T2 = new Date("2026-11-27T10:00:00Z"); // 한국 시간 2026-11-27 19:00

test("todayKST는 한국 시간 기준 날짜", () => {
  assert.equal(todayKST(new Date("2026-11-27T15:30:00Z")), "2026-11-28"); // 한국 00:30
});

test("실패한 출처는 직전 성공 값을 유지", () => {
  const first = mergeLatest(null, { a: { ok: true, data: { v: 1 } } }, T1);
  const second = mergeLatest(first, { a: { ok: false, error: "HTTP 500" } }, T2);
  assert.equal(second.sources.a.ok, false);
  assert.equal(second.sources.a.error, "HTTP 500");
  assert.deepEqual(second.sources.a.data, { v: 1 });
  assert.equal(second.sources.a.updatedAt, T1.toISOString());
});

test("한 번도 성공한 적 없으면 data는 null", () => {
  const r = mergeLatest(null, { a: { ok: false, error: "x" } }, T1);
  assert.equal(r.sources.a.data, null);
});

test("같은 날 다시 수집하면 기록을 덮어쓰고, 실패한 출처의 기존 값은 남김", () => {
  let h = mergeHistory([], { a: { ok: true, data: { v: 1 } }, b: { ok: true, data: { w: 2 } } }, T1, SRC);
  h = mergeHistory(h, { a: { ok: true, data: { v: 5 } }, b: { ok: false, error: "x" } }, T2, SRC);
  assert.equal(h.length, 1);
  assert.deepEqual(h[0], { date: "2026-11-27", a: { v: 5 }, b: { w: 2 } });
});

test("기록은 날짜순으로 정렬", () => {
  const h = mergeHistory([{ date: "2026-11-28" }], { a: { ok: true, data: { v: 1 } } }, T1, SRC);
  assert.deepEqual(h.map(x => x.date), ["2026-11-27", "2026-11-28"]);
});

test("미세먼지 등급 경계값", () => {
  assert.equal(grade("pm10", 30), "좋음");
  assert.equal(grade("pm10", 31), "보통");
  assert.equal(grade("pm25", 35), "보통");
  assert.equal(grade("pm25", 76), "매우 나쁨");
});
