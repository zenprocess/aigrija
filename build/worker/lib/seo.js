export function generateMetaTags(meta) {
    const tags = [];
    tags.push(`<title>${escapeHtml(meta.title)} | ai-grija.ro</title>`);
    tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
    tags.push(`<meta property="og:title" content="${escapeHtml(meta.title)}">`);
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.description)}">`);
    tags.push(`<meta property="og:type" content="${meta.ogType}">`);
    tags.push(`<meta property="og:url" content="${meta.canonicalUrl}">`);
    tags.push(`<link rel="canonical" href="${meta.canonicalUrl}">`);
    tags.push(`<meta property="og:locale" content="${meta.language}">`);
    if (meta.ogImage)
        tags.push(`<meta property="og:image" content="${meta.ogImage}">`);
    if (meta.publishedAt)
        tags.push(`<meta property="article:published_time" content="${meta.publishedAt}">`);
    if (meta.alternateLanguages) {
        for (const alt of meta.alternateLanguages) {
            tags.push(`<link rel="alternate" hreflang="${alt.lang}" href="${alt.url}">`);
        }
    }
    if (meta.jsonLd) {
        tags.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`);
    }
    return tags.join('\n');
}
export function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
