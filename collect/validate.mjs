// 데이터 검사기: data/latest.json, data/history.json이 대시보드가 기대하는 모양과 "말이 되는" 범위인지 확인한다.
// 실행: npm run validate  → 문제가 있으면 목록을 출력하고 종료 코드 1
// 범위는 "고장 감지"용으로 넉넉하게 잡았다 (예: 환율이 0이거나 단위가 100배 틀린 경우를 잡는 정도).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GRADES = ["좋음", "보통", "나쁨", "매우 나쁨"];
// 원화 환산 값의 허용 범위 (단위: USD·EUR·CNY는 1, JPY는 100)
const FX_RANGE = { USD: [500, 3000], JPY: [300, 3000], EUR: [500, 3500], CNY: [50, 600] };
const INDEX_CODES = { indicesUS: ["SPX", "NDX"], indicesKR: ["KOSPI", "KOSDAQ"] };
const MAX_HISTORY = 400;

/** 검사 도우미: 문제를 errors 배열에 쌓는다 */
function checker(errors, prefix) {
  const fail = (path, msg) => errors.push(`${prefix}${path}: ${msg}`);
  return {
    fail,
    num(path, v, [lo, hi]) {
      if (typeof v !== "number" || !Number.isFinite(v)) return fail(path, `숫자가 아님 (${JSON.stringify(v)})`);
      if (v < lo || v > hi) fail(path, `범위 밖 ${v} (허용 ${lo}~${hi})`);
    },
    str(path, v, { max = 500 } = {}) {
      if (typeof v !== "string" || !v.trim()) return fail(path, "빈 글자이거나 글자가 아님");
      if (v.length > max) fail(path, `너무 김 (${v.length}자)`);
    },
    date(path, v) { if (typeof v !== "string" || !DATE.test(v)) fail(path, `날짜 형식(YYYY-MM-DD)이 아님 (${JSON.stringify(v)})`); },
    iso(path, v, { nullable = false } = {}) {
      if (nullable && v === null) return;
      if (typeof v !== "string" || Number.isNaN(Date.parse(v))) fail(path, `시각 형식이 아님 (${JSON.stringify(v)})`);
    },
    url(path, v) {
      try { const u = new URL(v); if (u.protocol !== "https:" && u.protocol !== "http:") fail(path, `http/https가 아님 (${u.protocol})`); }
      catch { fail(path, `주소 형식이 아님 (${JSON.stringify(v)})`); }
    },
  };
}

// 출처별 data 검사
const DATA_RULES = {
  weather(c, d) {
    c.str(".city", d.city);
    c.str(".condition", d.condition);
    c.num(".temperature", d.temperature, [-40, 50]);
    c.num(".max", d.max, [-40, 50]);
    c.num(".min", d.min, [-40, 50]);
    if (d.max < d.min) c.fail(".max", `최고(${d.max})가 최저(${d.min})보다 낮음`);
    if (d.precipitationChance !== null) c.num(".precipitationChance", d.precipitationChance, [0, 100]);
  },
  air(c, d) {
    c.num(".pm10", d.pm10, [0, 1000]);
    c.num(".pm25", d.pm25, [0, 1000]);
    if (!GRADES.includes(d.pm10Grade)) c.fail(".pm10Grade", `모르는 등급 ${JSON.stringify(d.pm10Grade)}`);
    if (!GRADES.includes(d.pm25Grade)) c.fail(".pm25Grade", `모르는 등급 ${JSON.stringify(d.pm25Grade)}`);
  },
  fx(c, d) {
    c.date(".baseDate", d.baseDate);
    for (const [code, range] of Object.entries(FX_RANGE)) {
      const r = d.rates?.[code];
      if (!r) { c.fail(`.rates.${code}`, "없음"); continue; }
      c.num(`.rates.${code}.krw`, r.krw, range);
    }
  },
  indicesUS: (c, d) => indices(c, d, INDEX_CODES.indicesUS),
  indicesKR: (c, d) => indices(c, d, INDEX_CODES.indicesKR),
  newsDomestic: news,
  newsWorld: news,
};

// 검사 규칙이 있는 출처 = 대시보드가 아는 출처. 수집기의 SOURCES와 같은지는 테스트가 확인한다
// (수집기가 이 파일을 불러 쓰므로, 여기서 수집기를 불러오면 서로 물고 물리게 된다)
export const SOURCE_NAMES = Object.keys(DATA_RULES);

/** 출처 하나의 data 검사 → 문제 목록. 수집기가 저장 전에 출처별로 부른다. */
export function validateSource(name, data, prefix = `${name}.data`) {
  const errors = [];
  const rule = DATA_RULES[name];
  if (!rule) return [`${prefix}: "${name}"에 대한 검사 규칙이 없음 (collect/validate.mjs의 DATA_RULES에 추가)`];
  if (!data || typeof data !== "object") return [`${prefix}: 객체가 아님`];
  try { rule(checker(errors, prefix), data); }
  catch (e) { errors.push(`${prefix}: 검사 중 오류 (${e.message})`); }
  return errors;
}

function indices(c, d, codes) {
  if (!Array.isArray(d.items)) return c.fail(".items", "목록이 아님");
  const seen = d.items.map(i => i.code);
  for (const code of codes) if (!seen.includes(code)) c.fail(".items", `${code} 없음`);
  d.items.forEach((i, n) => {
    const p = `.items[${n}](${i.code})`;
    if (i.error) return c.str(`${p}.error`, i.error, { max: 2000 }); // 이 지수만 실패한 경우
    c.num(`${p}.price`, i.price, [1, 1e6]);
    c.num(`${p}.previousClose`, i.previousClose, [1, 1e6]);
    c.num(`${p}.changePct`, i.changePct, [-30, 30]);
    c.date(`${p}.date`, i.date);
    if (![true, false, null].includes(i.closed)) c.fail(`${p}.closed`, `true/false/null이 아님 (${JSON.stringify(i.closed)})`);
  });
}

function news(c, d) {
  if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > 3) return c.fail(".items", "기사가 1~3개가 아님");
  d.items.forEach((n, i) => {
    c.str(`.items[${i}].title`, n.title, { max: 300 });
    c.url(`.items[${i}].link`, n.link);
    c.iso(`.items[${i}].publishedAt`, n.publishedAt, { nullable: true });
    if ("description" in n) c.fail(`.items[${i}]`, "기사 본문(description)은 저장하면 안 됨");
  });
}

/** latest.json 검사 → 문제 목록 (없으면 빈 배열) */
export function validateLatest(latest) {
  const errors = [];
  const c = checker(errors, "latest");
  if (!latest || typeof latest !== "object") return ["latest: 객체가 아님"];
  c.iso(".generatedAt", latest.generatedAt);
  c.date(".date", latest.date);
  for (const name of SOURCE_NAMES) {
    const s = latest.sources?.[name];
    if (!s) { c.fail(`.sources.${name}`, "없음"); continue; }
    if (typeof s.ok !== "boolean") c.fail(`.sources.${name}.ok`, "true/false가 아님");
    if (s.ok && !s.data) c.fail(`.sources.${name}`, "성공인데 data가 없음");
    if (!s.ok) c.str(`.sources.${name}.error`, s.error, { max: 2000 });
    if (s.data) errors.push(...validateSource(name, s.data, `latest.sources.${name}.data`));
  }
  return errors;
}

/** history.json 검사 → 문제 목록 */
export function validateHistory(history) {
  const errors = [];
  const c = checker(errors, "history");
  if (!Array.isArray(history)) return ["history: 배열이 아님"];
  if (history.length > MAX_HISTORY) c.fail("", `기록이 너무 많음 (${history.length}개)`);
  history.forEach((h, i) => {
    const p = `[${i}]`;
    if (!h || typeof h !== "object" || Array.isArray(h)) return c.fail(p, "객체가 아님");
    c.date(`${p}.date`, h.date);
    const prev = history[i - 1]?.date;
    if (i > 0 && !(prev < h.date)) c.fail(`${p}.date`, `날짜순이 아니거나 중복 (${prev} → ${h.date})`);
    for (const [name, v] of Object.entries(h)) {
      if (name === "date") continue;
      if (!SOURCE_NAMES.includes(name)) { c.fail(`${p}.${name}`, "모르는 출처"); continue; }
      if (name.startsWith("news")) { c.fail(`${p}.${name}`, "뉴스는 기록에 쌓으면 안 됨"); continue; }
      if (!v || typeof v !== "object") { c.fail(`${p}.${name}`, "객체가 아님"); continue; }
      for (const [k, x] of Object.entries(v)) {
        if (typeof x !== "number" || !Number.isFinite(x)) c.fail(`${p}.${name}.${k}`, `숫자가 아님 (${JSON.stringify(x)})`);
      }
    }
  });
  return errors;
}

async function main() {
  const dir = new URL("../data/", import.meta.url);
  const read = async f => JSON.parse(await readFile(new URL(f, dir), "utf8"));
  let errors;
  try {
    errors = [...validateLatest(await read("latest.json")), ...validateHistory(await read("history.json"))];
  } catch (e) {
    errors = [`파일을 읽지 못함: ${e.message}`];
  }
  if (errors.length) {
    console.log(`❌ 데이터 검사에서 문제 ${errors.length}개`);
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log("✅ 데이터 검사 통과");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
