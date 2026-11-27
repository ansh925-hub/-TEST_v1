// RSS 해석기 테스트 (고정된 예시 피드, 네트워크 없음). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRss, decodeEntities, safeUrl } from "./rss.mjs";
import { mergeHistory, SOURCES } from "./index.mjs";

const GOOGLE = `<?xml version="1.0"?><rss><channel><title>주요 뉴스</title>
<item><title>첫 번째 소식 - 한겨레</title><link>https://news.google.com/rss/articles/A?oc=5</link>
<pubDate>Fri, 27 Nov 2026 02:24:00 GMT</pubDate><description>&lt;a href="x"&gt;본문&lt;/a&gt;</description><source url="https://www.hani.co.kr">한겨레</source></item>
<item><title>두 번째 &amp; 소식 - 조선일보</title><link>https://news.google.com/rss/articles/B</link><pubDate>Fri, 27 Nov 2026 01:00:00 GMT</pubDate><source url="https://www.chosun.com">조선일보</source></item>
<item><title>첫 번째 소식 - 한겨레</title><link>https://news.google.com/rss/articles/A2</link><source url="https://www.hani.co.kr">한겨레</source></item>
<item><title>위험한 링크</title><link>javascript:alert(1)</link></item>
<item><title>세 번째 소식 - KBS</title><link>https://news.google.com/rss/articles/C</link><pubDate>잘못된 날짜</pubDate><source url="https://news.kbs.co.kr">KBS</source></item>
<item><title>네 번째</title><link>https://news.google.com/rss/articles/D</link></item>
</channel></rss>`;

const BBC = `<rss><channel><item>
<title><![CDATA[US too focused on Middle East, Zelensky says]]></title>
<description><![CDATA[본문은 저장하지 않음]]></description>
<link>https://www.bbc.co.uk/news/articles/c8?at_medium=RSS&amp;at_campaign=rss</link>
<pubDate>Thu, 26 Nov 2026 22:49:27 GMT</pubDate></item></channel></rss>`;

test("Google 뉴스: 언론사 꼬리 제거, 중복·위험한 링크 건너뛰고 앞에서 3개", () => {
  const items = parseRss(GOOGLE, { limit: 3, defaultSource: "Google 뉴스" });
  assert.deepEqual(items.map(i => i.title), ["첫 번째 소식", "두 번째 & 소식", "세 번째 소식"]);
  assert.deepEqual(items.map(i => i.source), ["한겨레", "조선일보", "KBS"]);
  assert.equal(items[0].publishedAt, "2026-11-27T02:24:00.000Z");
  assert.equal(items[2].publishedAt, null); // 날짜가 이상하면 null
});

test("BBC: CDATA 제목, &amp; 들어간 링크, 기본 언론사 이름", () => {
  const [item] = parseRss(BBC, { defaultSource: "BBC News" });
  assert.equal(item.title, "US too focused on Middle East, Zelensky says");
  assert.equal(item.link, "https://www.bbc.co.uk/news/articles/c8?at_medium=RSS&at_campaign=rss");
  assert.equal(item.source, "BBC News");
  assert.equal("description" in item, false); // 본문은 저장하지 않음
});

test("피드 순서가 아니라 최신순으로 고른다", () => {
  const xml = `<rss><channel>
<item><title>오래된</title><link>https://e.com/1</link><pubDate>Thu, 26 Nov 2026 19:26:16 GMT</pubDate></item>
<item><title>시각 없음</title><link>https://e.com/2</link></item>
<item><title>가장 최신</title><link>https://e.com/3</link><pubDate>Fri, 27 Nov 2026 00:52:11 GMT</pubDate></item>
<item><title>중간</title><link>https://e.com/4</link><pubDate>Thu, 26 Nov 2026 22:49:27 GMT</pubDate></item>
</channel></rss>`;
  assert.deepEqual(parseRss(xml, { limit: 3 }).map(i => i.title), ["가장 최신", "중간", "오래된"]);
});

test("CDATA 안은 엔티티를 풀지 않고, 제목은 HTML이 아닌 글자로 남긴다", () => {
  const xml = `<rss><channel>
<item><title><![CDATA[AT&amp;T explained]]></title><link>https://e.com/1</link></item>
<item><title>&lt;img src=x onerror=alert(1)&gt;</title><link>https://e.com/2</link></item>
</channel></rss>`;
  const titles = parseRss(xml).map(i => i.title);
  assert.equal(titles[0], "AT&amp;T explained");
  // 글자 그대로 저장됨 → 화면에서는 textContent로 넣어야 안전 (CLAUDE.md 규칙)
  assert.equal(titles[1], "<img src=x onerror=alert(1)>");
});

test("엔티티와 링크 검사", () => {
  assert.equal(decodeEntities("A&#39;s &#x2014; &lt;b&gt; &unknown;"), "A's — <b> &unknown;");
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("not a url"), null);
  assert.equal(safeUrl("https://example.com/a b"), "https://example.com/a%20b");
});

test("뉴스는 날짜별 기록(history)에 쌓지 않는다", () => {
  const item = { title: "t", link: "https://e.com", source: "s", publishedAt: null };
  const h = mergeHistory([], { newsDomestic: { ok: true, data: { items: [item] } } }, new Date("2026-11-27T00:00:00Z"), SOURCES);
  assert.deepEqual(h, []);
});
