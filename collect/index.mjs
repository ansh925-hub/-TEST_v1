// 대시보드 데이터 수집기
// 실행: npm run collect  →  data/latest.json (최신 값), data/history.json (날짜별 기록) 갱신
//
// 출처 하나가 실패해도 나머지는 계속 수집한다. 실패한 출처는 latest.json에 오류로 남기고,
// 직전에 성공한 값을 그대로 보여 줄 수 있도록 lastSuccess를 유지한다.
// 실패가 하나라도 있으면 종료 코드 1 → Actions에서 실패로 표시된다.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { todayKST } from "./lib.mjs";
import * as weather from "./sources/weather.mjs";
import * as air from "./sources/air.mjs";
import * as fx from "./sources/fx.mjs";
import * as news from "./sources/news.mjs";
import * as indices from "./sources/indices.mjs";

// 새 출처를 추가하려면 sources/에 파일을 만들고 여기에 한 줄 추가한다.
// history: 날짜별 기록에 남길 값만 골라내는 함수 (차트용)
// date: (선택) 기록할 날짜. 없으면 수집한 날(한국 시간). 환율처럼 "기준일"이 따로 있으면 그 날짜에 기록해서
//       주말·휴일에 같은 값이 새 날짜로 반복 저장되지 않게 한다.
// history가 없는 출처(뉴스)는 latest.json에만 남고 날짜별 기록에는 쌓지 않는다.
export const SOURCES = {
  weather: { mod: weather, history: d => ({ max: d.max, min: d.min }) },
  air: { mod: air, history: d => ({ pm10: d.pm10, pm25: d.pm25 }) },
  fx: {
    mod: fx,
    date: d => d.baseDate,
    history: d => Object.fromEntries(Object.entries(d.rates).map(([c, r]) => [c, r.krw])),
  },
  // 미국·한국은 거래일이 달라서 묶음을 나누고, 각자의 거래일에 기록한다.
  indicesUS: { mod: indices.us, date: indices.tradeDate, history: indices.toHistory },
  indicesKR: { mod: indices.kr, date: indices.tradeDate, history: indices.toHistory },
  newsDomestic: { mod: news.domestic },
  newsWorld: { mod: news.world },
};

const DATA_DIR = new URL("../data/", import.meta.url);
const LATEST = new URL("latest.json", DATA_DIR);
const HISTORY = new URL("history.json", DATA_DIR);
const HISTORY_DAYS = 400; // 약 1년 + 여유

/** JSON 파일 읽기. 없으면 fallback. 깨져 있으면 .broken 파일로 옮겨 두고 fallback으로 계속 진행한다. */
async function readJSON(url, fallback) {
  let text;
  try { text = await readFile(url, "utf8"); }
  catch (e) { if (e.code === "ENOENT") return fallback; throw e; }
  try { return JSON.parse(text); }
  catch (e) {
    const backup = new URL(url.href.replace(/\.json$/, `.broken-${Date.now()}.json`));
    await rename(url, backup);
    console.warn(`⚠️ ${fileURLToPath(url)} 형식이 깨져 있어 ${fileURLToPath(backup)}로 옮기고 새로 시작: ${e.message}`);
    return fallback;
  }
}

/** 출처들을 동시에 수집해서 {이름: {ok, data | error}} 형태로 돌려준다. */
export async function collectAll(sources = SOURCES) {
  const names = Object.keys(sources);
  const results = await Promise.allSettled(names.map(n => sources[n].mod.collect()));
  return Object.fromEntries(names.map((n, i) => {
    const r = results[i];
    return [n, r.status === "fulfilled" ? { ok: true, data: r.value } : { ok: false, error: String(r.reason?.message ?? r.reason) }];
  }));
}

/** 이전 latest와 이번 결과를 합친다. 실패한 출처는 직전 성공 값을 유지한다. */
export function mergeLatest(prev, results, now = new Date()) {
  const sources = {};
  for (const [name, r] of Object.entries(results)) {
    const before = prev?.sources?.[name];
    sources[name] = r.ok
      ? { ok: true, updatedAt: now.toISOString(), data: r.data }
      : { ok: false, error: r.error, failedAt: now.toISOString(),
          // 직전 성공 값 (한 번도 성공한 적 없으면 null)
          updatedAt: before?.updatedAt ?? null, data: before?.data ?? null };
  }
  return { generatedAt: now.toISOString(), date: todayKST(now), sources };
}

/** 날짜별 기록을 넣거나 바꾸고, 오래된 기록은 잘라 낸다. 성공한 출처만 기록한다. */
export function mergeHistory(history, results, now = new Date(), sources = SOURCES) {
  const byDate = new Map(history.map(h => [h.date, { ...h }]));
  for (const [name, r] of Object.entries(results)) {
    if (!r.ok || !sources[name].history) continue;
    const date = sources[name].date?.(r.data) ?? todayKST(now);
    const entry = byDate.get(date) ?? { date };
    entry[name] = sources[name].history(r.data);
    byDate.set(date, entry);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HISTORY_DAYS);
}

async function main() {
  const results = await collectAll();
  const prevLatest = await readJSON(LATEST, null);
  const prevHistory = await readJSON(HISTORY, []);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(LATEST, JSON.stringify(mergeLatest(prevLatest, results), null, 2) + "\n");
  await writeFile(HISTORY, JSON.stringify(mergeHistory(prevHistory, results), null, 2) + "\n");

  for (const [name, r] of Object.entries(results)) {
    console.log(r.ok ? `✅ ${name}` : `❌ ${name}: ${r.error}`);
  }
  if (Object.values(results).some(r => !r.ok)) process.exitCode = 1;
}

// 테스트에서 import할 때는 실행하지 않고, 직접 실행할 때만 수집한다.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
