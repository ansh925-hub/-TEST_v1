// 미세먼지: Open-Meteo Air Quality (키 없이 사용) https://open-meteo.com/en/docs/air-quality-api
import { getJSON, num } from "../lib.mjs";
import { CITY } from "./weather.mjs";

// 환경부 예보 등급 기준 (㎍/㎥): [좋음 상한, 보통 상한, 나쁨 상한], 그 위는 매우 나쁨
const GRADES = { pm10: [30, 80, 150], pm25: [15, 35, 75] };
const LABELS = ["좋음", "보통", "나쁨", "매우 나쁨"];

export function grade(kind, value) {
  const idx = GRADES[kind].findIndex(limit => value <= limit);
  return LABELS[idx === -1 ? 3 : idx];
}

export async function collect() {
  const url =
    "https://air-quality-api.open-meteo.com/v1/air-quality" +
    `?latitude=${CITY.latitude}&longitude=${CITY.longitude}` +
    "&current=pm10,pm2_5&timezone=Asia%2FSeoul";
  const d = await getJSON(url);
  const pm10 = num(d.current?.pm10, "PM10");
  const pm25 = num(d.current?.pm2_5, "PM2.5");
  return {
    city: CITY.name,
    pm10, pm10Grade: grade("pm10", pm10),
    pm25, pm25Grade: grade("pm25", pm25),
  };
}
