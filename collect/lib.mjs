// 수집 스크립트에서 같이 쓰는 도구 모음
// 외부 서비스에 계정·저장소 이름이 남지 않도록 일반적인 이름만 쓴다.
const UA = "dashboard-collector/1.0";

/** URL에서 JSON을 받아 온다. 20초 안에 응답이 없거나 200번대가 아니면 오류. */
export async function getJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

/** URL에서 글자(RSS 등)를 받아 온다. */
export async function getText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

/** 한국 시간 기준 오늘 날짜 (예: "2026-11-27") */
export function todayKST(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

/** 숫자인지 확인하고, 아니면 어떤 값이 이상한지 알려 주는 오류를 낸다. */
export function num(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} 값이 숫자가 아님: ${JSON.stringify(value)}`);
  }
  return value;
}

/** 소수점 자리 맞추기 (예: round(1344.6512, 2) → 1344.65) */
export function round(value, digits) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
