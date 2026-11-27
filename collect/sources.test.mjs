// 출처별 응답 해석 테스트 (고정된 예시 응답 사용, 네트워크 없음). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fx from "./sources/fx.mjs";
import * as weather from "./sources/weather.mjs";
import { mergeHistory, SOURCES } from "./index.mjs";

const FX_SAMPLE = { amount: 1, base: "USD", date: "2026-11-26", rates: { KRW: 1344.65, JPY: 159.26, EUR: 0.91116, CNY: 6.6602 } };

test("환율: USD 기준 응답을 원화 환산 값으로 바꾼다 (엔화는 100엔)", () => {
  const r = fx.parse(FX_SAMPLE);
  assert.equal(r.baseDate, "2026-11-26");
  assert.deepEqual(r.rates.USD, { unit: 1, krw: 1344.65 });
  assert.deepEqual(r.rates.JPY, { unit: 100, krw: 844.31 }); // 1344.65 / 159.26 * 100
  assert.deepEqual(r.rates.EUR, { unit: 1, krw: 1475.76 });
  assert.deepEqual(r.rates.CNY, { unit: 1, krw: 201.89 });
});

test("환율: 값이 빠지면 오류", () => {
  assert.throws(() => fx.parse({ ...FX_SAMPLE, rates: { JPY: 1, EUR: 1, CNY: 1 } }), /KRW/);
  assert.throws(() => fx.parse({ ...FX_SAMPLE, date: undefined }), /기준일/);
});

test("환율 기록은 수집한 날이 아니라 기준일에 남는다 (주말 반복 방지)", () => {
  const data = fx.parse(FX_SAMPLE);
  const saturday = new Date("2026-11-28T01:00:00Z");
  const h = mergeHistory([], { fx: { ok: true, data } }, saturday, SOURCES);
  assert.deepEqual(h.map(x => x.date), ["2026-11-26"]);
});

const WEATHER_SAMPLE = {
  current: { temperature_2m: 14.4, weather_code: 2 },
  daily: { temperature_2m_max: [15], temperature_2m_min: [6.1], precipitation_probability_max: [77] },
};

test("날씨: 응답을 해석하고 날씨 코드를 한국어로 바꾼다", () => {
  assert.deepEqual(weather.parse(WEATHER_SAMPLE), {
    city: "서울", temperature: 14.4, condition: "구름 조금", max: 15, min: 6.1, precipitationChance: 77,
  });
});

test("날씨: 강수 확률이 비어 있어도 실패하지 않는다", () => {
  const d = structuredClone(WEATHER_SAMPLE);
  d.daily.precipitation_probability_max = [null];
  assert.equal(weather.parse(d).precipitationChance, null);
});

test("날씨: 모르는 코드는 숫자로, 기온이 없으면 오류", () => {
  const d = structuredClone(WEATHER_SAMPLE);
  d.current.weather_code = 42;
  assert.equal(weather.parse(d).condition, "코드 42");
  d.current.temperature_2m = null;
  assert.throws(() => weather.parse(d), /현재 기온/);
});
