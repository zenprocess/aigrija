import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkStaleCampaigns } from './campaigns';
import type { Campaign } from './campaigns';

function makeCampaign(last_updated: string): Campaign {
  return {
    id: 'test-campaign',
    slug: 'test',
    name_ro: 'Test',
    status: 'active',
    severity: 'high',
    impersonated_entity: 'Test',
    description_ro: '',
    how_it_works_ro: '',
    red_flags_ro: [],
    advice_ro: [],
    patterns: [],
    url_patterns: [],
    first_seen: '2024-01-01',
    last_updated,
    seo: { title: '', description: '', keywords: [], og_title: '', og_description: '' },
  };
}

describe('checkStaleCampaigns', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a warning for a campaign last updated more than 90 days ago', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const staleDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    checkStaleCampaigns([makeCampaign(staleDate)]);
    expect(warnSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('campaign_data_stale');
    expect(parsed.campaign_id).toBe('test-campaign');
    expect(parsed.age_days).toBeGreaterThanOrEqual(91);
  });

  it('does not log a warning for a campaign updated within 90 days', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const freshDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    checkStaleCampaigns([makeCampaign(freshDate)]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns only for stale campaigns in a mixed list', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const staleDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const freshDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    checkStaleCampaigns([
      { ...makeCampaign(staleDate), id: 'stale-one' },
      { ...makeCampaign(freshDate), id: 'fresh-one' },
    ]);
    expect(warnSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(parsed.campaign_id).toBe('stale-one');
  });
});
