// 날씨: Open-Meteo (키 없이 사용, 비상업 무료) https://open-meteo.com/
import { getJSON, num } from "../lib.mjs";

export const CITY = { name: "서울", latitude: 37.5665, longitude: 126.978 };

// WMO 날씨 코드 → 한국어 설명 (https://open-meteo.com/en/docs 의 표 기준)
const WMO = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
  45: "안개", 48: "서리 안개",
  51: "약한 이슬비", 53: "이슬비", 55: "강한 이슬비",
  61: "약한 비", 63: "비", 65: "강한 비",
  66: "약한 어는 비", 67: "어는 비",
  71: "약한 눈", 73: "눈", 75: "강한 눈", 77: "싸락눈",
  80: "약한 소나기", 81: "소나기", 82: "강한 소나기",
  85: "약한 눈 소나기", 86: "눈 소나기",
  95: "뇌우", 96: "우박 동반 뇌우", 99: "강한 우박 동반 뇌우",
};

export async function collect() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${CITY.latitude}&longitude=${CITY.longitude}` +
    "&current=temperature_2m,weather_code" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=Asia%2FSeoul&forecast_days=1";
  return parse(await getJSON(url));
}

/** API 응답 → 대시보드용 값 (네트워크 없이 테스트할 수 있게 분리) */
export function parse(d) {
  const code = num(d.current?.weather_code, "weather_code");
  const rain = d.daily?.precipitation_probability_max?.[0];
  return {
    city: CITY.name,
    temperature: num(d.current?.temperature_2m, "현재 기온"),
    condition: WMO[code] ?? `코드 ${code}`,
    max: num(d.daily?.temperature_2m_max?.[0], "최고 기온"),
    min: num(d.daily?.temperature_2m_min?.[0], "최저 기온"),
    // 강수 확률은 가끔 비어서 오므로 없으면 null (핵심 값이 아니라 전체를 실패시키지 않음)
    precipitationChance: typeof rain === "number" && Number.isFinite(rain) ? rain : null,
  };
}
