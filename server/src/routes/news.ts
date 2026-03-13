interface FeedItem {
    title: string;
    url: string;
    source: string;
    published: string;
    score?: number;
    summary?: string;
}

interface RSSSource {
    name: string;
    url: string;
    parser: (xml: string) => FeedItem[];
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const cut = text.lastIndexOf(' ', maxLen);
    return text.slice(0, cut > 0 ? cut : maxLen) + '...';
}

function extractSummary(block: string): string | undefined {
    const desc = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim();
    const content = block.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content[^>]*>/)?.[1]?.trim();
    const summary = block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary[^>]*>/)?.[1]?.trim();
    const raw = summary || content || desc;
    if (!raw) return undefined;
    const text = stripHtml(decodeEntities(raw));
    if (text.length < 20) return undefined;
    return truncate(text, 200);
}

function parseRSSItems(xml: string, source: string): FeedItem[] {
    const items: FeedItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
        const link = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim();
        const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim();
        if (title && link) {
            items.push({
                title: decodeEntities(title),
                url: link,
                source,
                published: pubDate || new Date().toISOString(),
                summary: extractSummary(block),
            });
        }
    }
    return items;
}

function parseAtomItems(xml: string, source: string): FeedItem[] {
    const items: FeedItem[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
        const link = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?\s*>/)?.[1]?.trim();
        const updated = block.match(/<(?:published|updated)>(.*?)<\/(?:published|updated)>/)?.[1]?.trim();
        if (title && link) {
            items.push({
                title: decodeEntities(title),
                url: link,
                source,
                published: updated || new Date().toISOString(),
                summary: extractSummary(block),
            });
        }
    }
    return items;
}

function decodeEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&nbsp;/g, ' ');
}

const DEFAULT_FEEDS: { name: string; url: string; type?: 'atom' }[] = [
    { name: 'HN', url: 'https://hnrss.org/frontpage?count=15' },
    { name: 'WSJ', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
    { name: 'TC', url: 'https://techcrunch.com/feed/' },
    { name: 'Reuters', url: 'https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best' },
    { name: 'Verge', url: 'https://www.theverge.com/rss/index.xml', type: 'atom' },
];

function loadFeeds(): { name: string; url: string; type?: 'atom' }[] {
    if (process.env.NEWS_FEEDS) {
        try { return JSON.parse(process.env.NEWS_FEEDS); } catch {}
    }
    return DEFAULT_FEEDS;
}

const feeds = loadFeeds();

const sources: RSSSource[] = feeds.map((f) => ({
    name: f.name,
    url: f.url,
    parser: f.type === 'atom'
        ? (xml) => parseAtomItems(xml, f.name).slice(0, 10)
        : f.name === 'HN'
            ? (xml) => {
                const items = parseRSSItems(xml, 'HN');
                const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
                for (let i = 0; i < blocks.length && i < items.length; i++) {
                    const scoreMatch = blocks[i].match(/(\d+)\s*points/);
                    if (scoreMatch) items[i].score = parseInt(scoreMatch[1]);
                    items[i].summary = items[i].summary?.replace(/Comments URL:.*$/, '').trim();
                }
                return items;
            }
            : (xml) => parseRSSItems(xml, f.name).slice(0, 12),
}));

let cache: FeedItem[] = [];
let lastFetch = 0;
const CACHE_TTL = 15 * 60 * 1000;

async function fetchAll(): Promise<FeedItem[]> {
    const now = Date.now();
    if (cache.length > 0 && now - lastFetch < CACHE_TTL) return cache;

    const results = await Promise.allSettled(
        sources.map(async (src) => {
            const res = await fetch(src.url, {
                headers: { 'User-Agent': 'nebula/1.0' },
                signal: AbortSignal.timeout(8000),
            });
            const xml = await res.text();
            return src.parser(xml);
        })
    );

    const items: FeedItem[] = [];
    for (const r of results) {
        if (r.status === 'fulfilled') items.push(...r.value);
    }

    items.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

    cache = items.slice(0, 40);
    lastFetch = now;
    return cache;
}

fetchAll().catch(() => {});

export async function handleNews(req: Request, path: string): Promise<Response | null> {
    if (req.method !== 'GET' || path !== '/news') return null;
    const items = await fetchAll();
    return Response.json({ items, sources: sources.map((s) => s.name) });
}
