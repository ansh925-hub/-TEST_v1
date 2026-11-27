// 데이터 검사기 테스트. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateLatest, validateHistory, validateSource, SOURCE_NAMES } from "./validate.mjs";
import { SOURCES, rejectInvalid } from "./index.mjs";

const load = async f => JSON.parse(await readFile(new URL(`../data/${f}`, import.meta.url), "utf8"));

test("저장소에 있는 실제 데이터는 검사를 통과한다", async () => {
  assert.deepEqual(validateLatest(await load("latest.json")), []);
  assert.deepEqual(validateHistory(await load("history.json")), []);
});

test("수집기의 모든 출처에 검사 규칙이 있다 (출처를 추가하면 검사도 추가)", () => {
  assert.deepEqual([...SOURCE_NAMES].sort(), Object.keys(SOURCES).sort());
  assert.match(validateSource("unknown", {}).join(), /검사 규칙이 없음/);
});

test("이상한 값을 받은 출처만 실패로 바뀌고, 나머지는 그대로", async () => {
  const l = await load("latest.json");
  const results = {
    fx: { ok: true, data: { ...l.sources.fx.data, rates: { ...l.sources.fx.data.rates, USD: { unit: 1, krw: 0 } } } },
    weather: { ok: true, data: l.sources.weather.data },
    air: { ok: false, error: "HTTP 500" },
  };
  const r = rejectInvalid(results);
  assert.equal(r.fx.ok, false);
  assert.match(r.fx.error, /데이터 검사 실패: .*USD\.krw: 범위 밖 0/);
  assert.deepEqual(r.weather, results.weather);
  assert.deepEqual(r.air, results.air);
});

test("고장 난 값을 잡아낸다", async () => {
  const l = structuredClone(await load("latest.json"));
  l.sources.fx.data.rates.JPY.krw = 8.44; // 100엔 단위를 빼먹은 실수
  l.sources.weather.data.max = -50;
  l.sources.newsWorld.data.items[0].link = "javascript:alert(1)";
  l.sources.newsDomestic.data.items[0].description = "본문";
  l.sources.indicesKR.data.items[0].changePct = 80;
  delete l.sources.air;
  const errors = validateLatest(l).join("\n");
  for (const want of ["rates.JPY.krw: 범위 밖", "weather.data.max: 범위 밖", "link: http/https가 아님", "description", "changePct: 범위 밖", "sources.air: 없음"]) {
    assert.match(errors, new RegExp(want.replace(/[.()[\]]/g, "\\$&")), `"${want}"를 잡지 못함`);
  }
});

test("실패한 출처는 직전 값이 있으면 그 값도 검사하고, 없으면(null) 통과", async () => {
  const l = structuredClone(await load("latest.json"));
  l.sources.air = { ok: false, error: "HTTP 500", updatedAt: null, data: null };
  assert.deepEqual(validateLatest(l), []);
  l.sources.air = { ok: true, data: null };
  assert.match(validateLatest(l).join(), /성공인데 data가 없음/);
});

test("기록: 날짜순·중복·뉴스·숫자 아닌 값을 잡는다", () => {
  const errors = validateHistory([
    { date: "2026-11-27", fx: { USD: 1344 } },
    { date: "2026-11-27", weather: { max: "15" } },
    { date: "2026-11-28", newsWorld: { x: 1 } },
    null,
  ]).join("\n");
  assert.match(errors, /\[3\]: 객체가 아님/); // null이 있어도 멈추지 않고 알려 줌
  assert.match(errors, /날짜순이 아니거나 중복/);
  assert.match(errors, /weather\.max: 숫자가 아님/);
  assert.match(errors, /뉴스는 기록에 쌓으면 안 됨/);
});
