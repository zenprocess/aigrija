import type { Env, Campaign } from './types';
import { structuredLog } from './logger';
import { withCircuitBreaker, CircuitOpenError } from './circuit-breaker';

const SANITY_API_VERSION = 'v2024-01-01';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function buildThreatReportDoc(campaign: Campaign, draftContent: string): Record<string, unknown> {
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

function buildBlogPostDoc(campaign: Campaign, draftContent: string, contentType: string): Record<string, unknown> {
  const categoryMap: Record<string, string> = {
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

export async function publishToSanity(
  campaign: Campaign,
  draftContent: string,
  contentType: string,
  env: Env
): Promise<{ id: string }> {
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
  const body = { mutations: [{ createOrReplace: doc }] };

  const doFetch = async (): Promise<{ id: string }> => {
    const swController = new AbortController();
    const swTimeoutId = setTimeout(() => swController.abort(), 5000);
    let res: Response;
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
    } finally {
      clearTimeout(swTimeoutId);
    }

    if (!res.ok) {
      const text = await res.text();
      structuredLog('error', '[sanity-writer] Publish failed', { status: res.status, body: text.slice(0, 200) });
      throw new Error(`Sanity publish failed: ${res.status}`);
    }

    const data = await res.json() as { results?: { id: string }[] };
    const id = data?.results?.[0]?.id || (doc._id as string);

    structuredLog('info', '[sanity-writer] Published', { id, contentType, campaignId: campaign.id });
    return { id };
  };

  if (!env.CACHE) {
    return doFetch();
  }

  try {
    return await withCircuitBreaker(env.CACHE, 'sanity', doFetch, {
      failureThreshold: 5,
      resetTimeout: 30_000,
    });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      structuredLog('warn', '[sanity-writer] Circuit OPEN -- skipping publish', {
        campaignId: campaign.id,
        contentType,
      });
      throw err;
    }
    throw err;
  }
}

export { buildThreatReportDoc, buildBlogPostDoc };
