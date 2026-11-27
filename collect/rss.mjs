// 아주 작은 RSS 2.0 해석기 (외부 패키지 없이). 뉴스 제목·링크·언론사·시각만 꺼낸다.
// 기사 본문(description)은 저작권 때문에 읽지도 저장하지도 않는다.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** &amp; &#39; &#x27; 같은 HTML 엔티티를 글자로 바꾼다. */
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** <name ...>값</name>의 값 (CDATA 벗기고, 엔티티 풀고, 공백 정리). 없으면 null. */
export function tagText(xml, name) {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  // CDATA 안의 글자는 이미 있는 그대로라서 엔티티를 풀면 안 된다 (예: "AT&amp;T"는 그대로 둠)
  const cdata = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const text = cdata ? cdata[1] : decodeEntities(m[1]);
  return text.replace(/\s+/g, " ").trim();
}

/** http/https 주소만 통과시킨다 (javascript: 같은 위험한 주소 차단). */
export function safeUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch { return null; }
}

/**
 * RSS 문자열 → [{title, link, source, publishedAt}]
 * 최신순(발행 시각이 없는 기사는 맨 뒤)으로 정렬해서 limit개, 제목 중복 제거.
 * 주의: title은 HTML이 아닌 "그냥 글자"다. 화면에 넣을 때는 반드시 textContent로 넣는다 (innerHTML 금지).
 * @param {string} xml
 * @param {{limit?: number, defaultSource?: string}} opts
 */
export function parseRss(xml, { limit = 3, defaultSource = null } = {}) {
  const out = [];
  const seen = new Set();
  for (const [, item] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const source = tagText(item, "source") || defaultSource;
    let title = tagText(item, "title");
    const link = safeUrl(tagText(item, "link") ?? "");
    if (!title || !link) continue;
    // Google 뉴스는 제목 끝에 " - 언론사"가 붙어 있으므로 떼어 낸다.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    if (seen.has(title)) continue;
    seen.add(title);
    const date = new Date(tagText(item, "pubDate") ?? "");
    out.push({ title, link, source, publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString() });
  }
  // ISO 문자열은 글자 순서 = 시간 순서. 시각이 없으면("") 맨 뒤로. 같은 시각이면 피드 순서 유지(안정 정렬).
  return out
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, limit);
}
