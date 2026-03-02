const KNOWN_BRANDS = ['ANAF', 'BCR', 'BRD', 'ING', 'Posta Romana', 'eMAG', 'OLX', 'FanCourier'];
const BRAND_PATTERNS = {
    'ANAF': /\banaf\b/i,
    'BCR': /\bbcr\b/i,
    'BRD': /\bbrd\b/i,
    'ING': /\bing\b/i,
    'Posta Romana': /po[sș]ta rom[aâ]n[aă]/i,
    'eMAG': /\bemag\b/i,
    'OLX': /\bolx\b/i,
    'FanCourier': /fan\s*courier|fanbox/i,
};
const THREAT_KEYWORDS = {
    'ransomware': /ransomware|cripteaz[aă]|r[aă]scump[aă]rare/i,
    'phishing': /phishing|fals[aă]?|impostori?|cloneaz[aă]/i,
    'malware': /malware|virus|troian|spyware/i,
    'scam': /frauda|escrocher|inselat|scam|arnar[eă]/i,
};
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80);
}
function extractTag(xml, tag) {
    const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (!m)
        return '';
    return (m[1] ?? m[2] ?? '').trim();
}
export const dnscScraper = {
    name: 'dnsc',
    feedUrl: 'https://dnsc.ro/feed',
    type: 'rss',
    parseRSS(xml) {
        const items = [];
        const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
        for (const block of itemBlocks) {
            const title = extractTag(block, 'title');
            const link = extractTag(block, 'link') || extractTag(block, 'guid');
            const pubDate = extractTag(block, 'pubDate');
            const guid = extractTag(block, 'guid');
            if (!title || !link)
                continue;
            const slug = slugify(title);
            items.push({ title, link, pubDate, slug, guid });
        }
        return items;
    },
    async scrapeFullPage(url) {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ai-grija-bot/1.0 (+https://ai-grija.ro/bot)',
            },
            // @ts-ignore Workers-specific cf property
            cf: { cacheTtl: 3600 },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        const collected = {
            title: '',
            publishedAt: '',
            description: '',
            bodyParagraphs: [],
            iocLinks: [],
        };
        const rewriter = new HTMLRewriter()
            .on('h1.entry-title, h1', {
            text(chunk) {
                if (!collected.title) {
                    collected.title += chunk.text;
                }
            },
        })
            .on('meta[property="article:published_time"]', {
            element(el) {
                const content = el.getAttribute('content');
                if (content)
                    collected.publishedAt = content;
            },
        })
            .on('meta[property="og:description"]', {
            element(el) {
                const content = el.getAttribute('content');
                if (content)
                    collected.description = content;
            },
        })
            .on('.entry-content p', {
            text(chunk) {
                if (chunk.lastInTextNode) {
                    const text = chunk.text.trim();
                    if (text)
                        collected.bodyParagraphs.push(text);
                }
            },
        })
            .on('a[href]', {
            element(el) {
                const href = el.getAttribute('href') ?? '';
                if (/\.(exe|zip|rar|apk|dmg|msi)(\?|$)/i.test(href) ||
                    /http[s]?:\/\/(?!dnsc\.ro)[a-z0-9-]+\.[a-z]{2,}\/[^\s"]{10,}/i.test(href)) {
                    collected.iocLinks.push(href);
                }
            },
        });
        await rewriter.transform(response).text();
        const title = collected.title.trim() || 'Alerta DNSC';
        const bodyText = collected.bodyParagraphs.join(' ');
        const fullText = `${title} ${bodyText}`.toLowerCase();
        const threatType = detectThreatType(fullText);
        const affectedBrands = detectBrands(fullText);
        const severity = deriveSeverity(threatType, affectedBrands.length);
        return {
            title,
            slug: slugify(title),
            source: 'dnsc',
            sourceUrl: url,
            publishedAt: collected.publishedAt || undefined,
            bodyText: bodyText || undefined,
            threatType,
            affectedBrands: affectedBrands.length ? affectedBrands : undefined,
            iocs: collected.iocLinks.length ? collected.iocLinks : undefined,
            severity,
        };
    },
};
export function detectThreatType(text) {
    for (const [type, pattern] of Object.entries(THREAT_KEYWORDS)) {
        if (pattern.test(text))
            return type;
    }
    return 'unknown';
}
export function detectBrands(text) {
    return KNOWN_BRANDS.filter((brand) => BRAND_PATTERNS[brand]?.test(text));
}
export function deriveSeverity(threatType, brandCount) {
    if (threatType === 'ransomware' || threatType === 'malware')
        return 'critical';
    if (threatType === 'phishing' && brandCount > 0)
        return 'high';
    if (threatType === 'scam')
        return 'medium';
    return 'low';
}
