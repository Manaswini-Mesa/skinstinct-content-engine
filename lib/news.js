// Google News RSS: no API key needed.
function decode(s = '') {
  return s.replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}
const tag = (xml, t) => decode((xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]);

export async function fetchNews(query, limit = 5) {
  if (!query) return [];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:30d')}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split('<item>').slice(1, limit + 1);
    return items.map(it => ({
      title: tag(it, 'title'),
      link: tag(it, 'link'),
      source: tag(it, 'source'),
      date: (tag(it, 'pubDate') || '').slice(0, 16),
    }));
  } catch {
    return [];
  }
}
