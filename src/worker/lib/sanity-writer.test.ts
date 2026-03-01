import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { publishToSanity, buildThreatReportDoc, buildBlogPostDoc } from './sanity-writer';
import type { Campaign, Env } from './types';

const baseCampaign: Campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  slug: 'test-campaign',
  source: 'dnsc',
  source_url: 'https://dnsc.ro/1',
  severity: 'high',
  threat_type: 'phishing',
  affected_brands: 'BRD, BCR',
  draft_status: 'pending',
  archived: 0,
  created_at: '2026-03-01T00:00:00Z',
};

const baseEnv = {
  SANITY_PROJECT_ID: 'proj123',
  SANITY_DATASET: 'production',
  SANITY_WRITE_TOKEN: 'tok-secret',
} as unknown as Env;

describe('buildThreatReportDoc', () => {
  it('builds a threatReport document', () => {
    const doc = buildThreatReportDoc(baseCampaign, 'draft content');
    expect(doc._type).toBe('threatReport');
    expect(doc._id).toBe('threatReport-camp-1');
    expect(doc.title).toBe('Test Campaign');
    expect(doc.severity).toBe('high');
    expect(doc.threatType).toBe('phishing');
    expect(Array.isArray(doc.affectedEntities)).toBe(true);
    expect((doc.affectedEntities as string[])).toContain('BRD');
    expect((doc.affectedEntities as string[])).toContain('BCR');
    expect(doc.content).toBe('draft content');
    expect(doc.status).toBe('published');
  });

  it('defaults severity to medium when missing', () => {
    const doc = buildThreatReportDoc({ ...baseCampaign, severity: undefined }, 'x');
    expect(doc.severity).toBe('medium');
  });

  it('defaults threatType to phishing when missing', () => {
    const doc = buildThreatReportDoc({ ...baseCampaign, threat_type: undefined }, 'x');
    expect(doc.threatType).toBe('phishing');
  });

  it('handles empty affected_brands', () => {
    const doc = buildThreatReportDoc({ ...baseCampaign, affected_brands: '' }, 'x');
    expect((doc.affectedEntities as string[])).toHaveLength(0);
  });
});

describe('buildBlogPostDoc', () => {
  it('maps guide to ghid category', () => {
    const doc = buildBlogPostDoc(baseCampaign, 'content', 'guide');
    expect(doc._type).toBe('blogPost');
    expect(doc.category).toBe('ghid');
  });

  it('maps education to educatie', () => {
    expect(buildBlogPostDoc(baseCampaign, 'content', 'education').category).toBe('educatie');
  });

  it('maps alert to amenintari', () => {
    expect(buildBlogPostDoc(baseCampaign, 'content', 'alert').category).toBe('amenintari');
  });

  it('defaults unknown contentType to general', () => {
    expect(buildBlogPostDoc(baseCampaign, 'content', 'unknown').category).toBe('general');
  });

  it('includes slug with contentType suffix', () => {
    const doc = buildBlogPostDoc(baseCampaign, 'content', 'guide');
    expect((doc.slug as { current: string }).current).toContain('-guide');
  });
});

describe('publishToSanity', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when SANITY_PROJECT_ID is missing', async () => {
    const env = { ...baseEnv, SANITY_PROJECT_ID: '' } as unknown as Env;
    await expect(publishToSanity(baseCampaign, 'draft', 'threatReport', env)).rejects.toThrow('Sanity not configured');
  });

  it('throws when SANITY_WRITE_TOKEN is missing', async () => {
    const env = { ...baseEnv, SANITY_WRITE_TOKEN: '' } as unknown as Env;
    await expect(publishToSanity(baseCampaign, 'draft', 'threatReport', env)).rejects.toThrow('Sanity not configured');
  });

  it('throws when Sanity API returns non-ok status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(publishToSanity(baseCampaign, 'draft', 'threatReport', baseEnv)).rejects.toThrow('Sanity publish failed: 401');
  });

  it('returns id on successful publish', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 'threatReport-camp-1' }] }),
    });
    const result = await publishToSanity(baseCampaign, 'draft', 'threatReport', baseEnv);
    expect(result.id).toBe('threatReport-camp-1');
  });

  it('falls back to doc._id when results array is empty', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) });
    const result = await publishToSanity(baseCampaign, 'draft', 'threatReport', baseEnv);
    expect(result.id).toBe('threatReport-camp-1');
  });

  it('calls Sanity API URL with correct project and dataset', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [{ id: 'x' }] }) });
    await publishToSanity(baseCampaign, 'draft', 'threatReport', baseEnv);
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('proj123.api.sanity.io');
    expect(url).toContain('production');
  });
});
