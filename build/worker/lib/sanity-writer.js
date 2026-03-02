import { structuredLog } from './logger';
const SANITY_API_VERSION = 'v2024-01-01';
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80);
}
function buildThreatReportDoc(campaign, draftContent) {
    const brands = (campaign.affected_brands || '')
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
    return {
        _type: 'threatReport',
        _id: `threatReport-${campaign.id}`,
        title: campaign.title,
        slug: { _type: 'slug', current: slugify(campaign.title) },
        severity: campaign.severity || 'medium',
        affectedEntities: brands,
        threatType: campaign.threat_type || 'phishing',
        sourceUrl: campaign.source_url || '',
        content: draftContent,
        publishedAt: new Date().toISOString(),
        status: 'published',
    };
}
function buildBlogPostDoc(campaign, draftContent, contentType) {
    const categoryMap = {
        guide: 'ghid',
        education: 'educatie',
        alert: 'amenintari',
        blogPost: 'general',
    };
    return {
        _type: 'blogPost',
        _id: `blogPost-${campaign.id}-${contentType}`,
        title: campaign.title,
        slug: { _type: 'slug', current: slugify(campaign.title) + '-' + contentType },
        category: categoryMap[contentType] || 'general',
        content: draftContent,
        publishedAt: new Date().toISOString(),
        sourceUrl: campaign.source_url || '',
    };
}
export async function publishToSanity(campaign, draftContent, contentType, env) {
    const projectId = env.SANITY_PROJECT_ID;
    const dataset = env.SANITY_DATASET || 'production';
    const token = env.SANITY_WRITE_TOKEN;
    if (!projectId || !token) {
        throw new Error('Sanity not configured: missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN');
    }
    const doc = contentType === 'threatReport'
        ? buildThreatReportDoc(campaign, draftContent)
        : buildBlogPostDoc(campaign, draftContent, contentType);
    const url = `https://${projectId}.api.sanity.io/${SANITY_API_VERSION}/data/mutate/${dataset}`;
    const body = {
        mutations: [{ createOrReplace: doc }],
    };
    const swController = new AbortController();
    const swTimeoutId = setTimeout(() => swController.abort(), 5000);
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: swController.signal,
        });
    }
    finally {
        clearTimeout(swTimeoutId);
    }
    if (!res.ok) {
        const text = await res.text();
        structuredLog('error', '[sanity-writer] Publish failed', { status: res.status, body: text.slice(0, 200) });
        throw new Error(`Sanity publish failed: ${res.status}`);
    }
    const data = await res.json();
    const id = data?.results?.[0]?.id || doc._id;
    structuredLog('info', '[sanity-writer] Published', { id, contentType, campaignId: campaign.id });
    return { id };
}
export { buildThreatReportDoc, buildBlogPostDoc };
