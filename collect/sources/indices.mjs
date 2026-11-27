// 주가지수: S&P500, 나스닥100, 코스피, 코스닥
// - 기본: Yahoo Finance 차트 API (공식 공개 API가 아니어서 막히거나 형식이 바뀔 수 있음)
// - 미국 지수 대체: FRED (미국 세인트루이스 연방준비은행, 공식 공개 CSV, 하루 늦게 갱신될 수 있음)
// 시세를 보여 주기만 하고, 투자 판단이나 추천은 하지 않는다.
import { getJSON, getText, num, round } from "../lib.mjs";

export const US = [
  { code: "SPX", name: "S&P 500", yahoo: "^GSPC", fred: "SP500" },
  { code: "NDX", name: "나스닥 100", yahoo: "^NDX", fred: "NASDAQ100" },
];
export const KR = [
  { code: "KOSPI", name: "코스피", yahoo: "^KS11" },
  { code: "KOSDAQ", name: "코스닥", yahoo: "^KQ11" },
];

/** 현재값·직전 종가로 변동폭과 등락률을 계산한다. */
function withChange(price, previousClose) {
  const change = price - previousClose;
  return { price: round(price, 2), previousClose: round(previousClose, 2), change: round(change, 2), changePct: round((change / previousClose) * 100, 2) };
}

/** Yahoo 차트 응답 → 지수 값. 마지막 두 개의 종가로 변동을 계산한다. */
export function parseYahoo(j, now = new Date()) {
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`Yahoo 응답에 결과가 없음: ${JSON.stringify(j?.chart?.error ?? null)}`);
  const closes = (r.indicators?.quote?.[0]?.close ?? [])
    .map((c, i) => ({ c, t: r.timestamp?.[i] }))
    .filter(x => typeof x.c === "number" && Number.isFinite(x.c) && typeof x.t === "number");
  if (closes.length < 2) throw new Error(`종가가 2개보다 적음 (${closes.length}개)`);
  const last = closes.at(-1), prev = closes.at(-2);
  const tz = r.meta?.exchangeTimezoneName ?? "UTC";
  const asOf = new Date(num(r.meta?.regularMarketTime ?? last.t, "기준 시각") * 1000);
  const end = r.meta?.currentTradingPeriod?.regular?.end;
  return {
    ...withChange(last.c, prev.c),
    // 거래소 시간대 기준 거래일 (예: 미국 지수는 뉴욕 날짜)
    date: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(last.t * 1000)),
    asOf: asOf.toISOString(),
    // 장이 끝났으면 종가, 아니면 장중 값
    closed: typeof end === "number" ? now.getTime() / 1000 >= end : null,
    via: "Yahoo Finance",
  };
}

/** FRED CSV("날짜,값" 줄들, 휴장일은 "." 또는 빈칸) → 지수 값 */
export function parseFred(csv) {
  const rows = csv.trim().split(/\r?\n/).slice(1)
    .map(line => line.split(","))
    .filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)));
  if (rows.length < 2) throw new Error(`FRED 값이 2개보다 적음 (${rows.length}개)`);
  const [date, last] = rows.at(-1), [, prev] = rows.at(-2);
  return { ...withChange(Number(last), Number(prev)), date, asOf: null, closed: true, via: "FRED" };
}

async function fromYahoo(symbol) {
  return parseYahoo(await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`));
}

async function fromFred(series) {
  // 최근 3주만 받는다 (휴장일이 이어져도 값 2개 이상 확보)
  const start = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  return parseFred(await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${start}`));
}

/** 지수 하나: Yahoo 먼저, 실패하면 FRED(있을 때만). 둘 다 실패하면 오류 내용을 담아 돌려준다. */
async function one(idx) {
  const base = { code: idx.code, name: idx.name };
  try { return { ...base, ...(await fromYahoo(idx.yahoo)) }; }
  catch (e1) {
    if (!idx.fred) return { ...base, error: e1.message };
    try { return { ...base, ...(await fromFred(idx.fred)), fallbackReason: e1.message }; }
    catch (e2) { return { ...base, error: `Yahoo: ${e1.message} / FRED: ${e2.message}` }; }
  }
}

/** 지수 묶음: 하나라도 성공하면 성공, 전부 실패하면 오류. */
export async function collectGroup(list) {
  const items = await Promise.all(list.map(one));
  if (items.every(i => i.error)) throw new Error(items.map(i => `${i.code}: ${i.error}`).join("; "));
  return { items };
}

/** 날짜별 기록용: 성공한 지수만 {코드: 값} */
export const toHistory = d => Object.fromEntries(d.items.filter(i => !i.error).map(i => [i.code, i.price]));
/** 기록할 날짜: 성공한 지수 중 가장 늦은 거래일 */
export const tradeDate = d => d.items.filter(i => !i.error).map(i => i.date).sort().at(-1);

export const us = { collect: () => collectGroup(US) };
export const kr = { collect: () => collectGroup(KR) };
