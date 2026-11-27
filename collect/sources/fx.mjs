// 환율: Frankfurter (유럽중앙은행 기준환율, 키 없이 사용) https://frankfurter.dev/
// 유럽중앙은행 기준이라 은행 고시 환율과 조금 다를 수 있고, 주말·휴일에는 직전 영업일 값이다.
import { getJSON, num, round } from "../lib.mjs";

// 원화로 얼마인지 보여 줄 통화와 단위 (엔화는 100엔 기준)
const CURRENCIES = [
  { code: "USD", unit: 1 },
  { code: "JPY", unit: 100 },
  { code: "EUR", unit: 1 },
  { code: "CNY", unit: 1 },
];

export async function collect() {
  const symbols = ["KRW", ...CURRENCIES.map(c => c.code).filter(c => c !== "USD")].join(",");
  return parse(await getJSON(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`));
}

/** API 응답(USD 기준) → 통화별 원화 환산 값 (네트워크 없이 테스트할 수 있게 분리) */
export function parse(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "")) throw new Error(`기준일 형식이 이상함: ${d.date}`);
  const krwPerUsd = num(d.rates?.KRW, "USD→KRW");
  const rates = {};
  for (const { code, unit } of CURRENCIES) {
    const perUsd = code === "USD" ? 1 : num(d.rates?.[code], `USD→${code}`);
    rates[code] = { unit, krw: round((krwPerUsd / perUsd) * unit, 2) };
  }
  return { baseDate: d.date, rates };
}
