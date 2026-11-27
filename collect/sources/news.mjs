// 뉴스: 제목·링크·언론사·시각만 저장한다 (기사 본문 저장 안 함).
// - 국내: Google 뉴스 한국 주요 뉴스 RSS (여러 언론사 기사 모음, 개인용 피드 리더 용도)
// - 해외: BBC News World RSS (이용 조건: https://www.bbc.co.uk/usingthebbc/terms-of-use/#15metadataandrssfeeds)
// 연합뉴스 RSS는 피드에 "무단 전재-재배포 금지"가 명시되어 있어 쓰지 않는다.
import { getText } from "../lib.mjs";
import { parseRss } from "../rss.mjs";

export const COUNT = 3;

async function headlines(url, defaultSource) {
  const items = parseRss(await getText(url), { limit: COUNT, defaultSource });
  if (items.length < COUNT) throw new Error(`기사가 ${COUNT}개보다 적음 (${items.length}개): ${url}`);
  return { items };
}

export const domestic = {
  collect: () => headlines("https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko", "Google 뉴스"),
};

export const world = {
  collect: () => headlines("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC News"),
};
