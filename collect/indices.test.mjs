// 주가지수 해석 테스트 (고정된 예시 응답, 네트워크 없음). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYahoo, parseFred, toHistory, tradeDate } from "./sources/indices.mjs";

// 실제 코스피 응답을 줄인 것 (2026-11-27 장중)
const YAHOO_KOSPI = {
  chart: {
    result: [{
      meta: {
        symbol: "^KS11", exchangeTimezoneName: "Asia/Seoul", regularMarketTime: 1795752790,
        currentTradingPeriod: { regular: { start: 1795737600, end: 1795761000 } },
      },
      timestamp: [1795392000, 1795478400, 1795564800, 1795651200, 1795737600],
      indicators: { quote: [{ close: [4708.54, 5006.03, 4697.51, 4711.2099609375, 4887.72998046875] }] },
    }],
    error: null,
  },
};

test("Yahoo: 마지막 두 종가로 변동 계산, 거래소 시간대 날짜", () => {
  const r = parseYahoo(YAHOO_KOSPI, new Date(1795752790 * 1000));
  assert.equal(r.price, 4887.73);
  assert.equal(r.previousClose, 4711.21);
  assert.equal(r.change, 176.52);
  assert.equal(r.changePct, 3.75);
  assert.equal(r.date, "2026-11-27");
  assert.equal(r.closed, false); // 장중
  assert.equal(r.via, "Yahoo Finance");
});

test("Yahoo: 장 마감 뒤에는 closed=true", () => {
  assert.equal(parseYahoo(YAHOO_KOSPI, new Date(1795761000 * 1000)).closed, true);
});

test("Yahoo: 빈 값(null)은 건너뛰고, 결과가 없으면 오류", () => {
  const j = structuredClone(YAHOO_KOSPI);
  j.chart.result[0].indicators.quote[0].close[4] = null; // 오늘 값이 아직 없음
  const r = parseYahoo(j);
  assert.equal(r.price, 4711.21);
  assert.equal(r.previousClose, 4697.51);
  assert.equal(r.date, "2026-11-26");
  assert.throws(() => parseYahoo({ chart: { result: null, error: { code: "Not Found" } } }), /결과가 없음/);
});

test("FRED: 휴장일('.')은 건너뛰고 마지막 두 값으로 계산", () => {
  const csv = "observation_date,NASDAQ100\n2026-11-24,26214.170\n2026-11-25,26046.900\n2026-11-26,.\n";
  const r = parseFred(csv);
  assert.equal(r.date, "2026-11-25");
  assert.equal(r.price, 26046.9);
  assert.equal(r.change, -167.27);
  assert.equal(r.changePct, -0.64);
  assert.equal(r.via, "FRED");
  assert.throws(() => parseFred("observation_date,SP500\n2026-11-25,6000\n"), /2개보다 적음/);
});

test("기록용 값과 날짜는 성공한 지수만 사용", () => {
  const d = { items: [
    { code: "SPX", price: 6000, date: "2026-11-26" },
    { code: "NDX", error: "HTTP 429" },
  ] };
  assert.deepEqual(toHistory(d), { SPX: 6000 });
  assert.equal(tradeDate(d), "2026-11-26");
});
