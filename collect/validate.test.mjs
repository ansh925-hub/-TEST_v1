// 데이터 검사기 테스트. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateLatest, validateHistory, SOURCE_NAMES } from "./validate.mjs";

const load = async f => JSON.parse(await readFile(new URL(`../data/${f}`, import.meta.url), "utf8"));

test("저장소에 있는 실제 데이터는 검사를 통과한다", async () => {
  assert.deepEqual(validateLatest(await load("latest.json")), []);
  assert.deepEqual(validateHistory(await load("history.json")), []);
});

test("모든 출처에 검사 규칙이 있다 (출처를 추가하면 검사도 추가)", async () => {
  const latest = await load("latest.json");
  for (const name of SOURCE_NAMES) assert.ok(latest.sources[name], `${name}이 latest.json에 없음`);
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
  ]).join("\n");
  assert.match(errors, /날짜순이 아니거나 중복/);
  assert.match(errors, /weather\.max: 숫자가 아님/);
  assert.match(errors, /뉴스는 기록에 쌓으면 안 됨/);
});
