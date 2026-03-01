import { describe, it, expect, vi } from 'vitest';
import { generateWeeklyDigest, getISOWeek } from './weekly-digest';
import type { Env } from './types';

describe('getISOWeek', () => {
  it('returns year-week format', () => {
    const result = getISOWeek(new Date('2026-01-05'));
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns correct week for known date', () => {
    // 2026-01-05 is week 2
    const result = getISOWeek(new Date('2026-01-05'));
    expect(result).toBe('2026-W02');
  });
});

describe('generateWeeklyDigest', () => {
  it('returns null when no ADMIN_DB', async () => {
    const env = {} as Env;
    const result = await generateWeeklyDigest(env);
    expect(result).toBeNull();
  });

  it('returns null when no campaigns found', async () => {
    const env = {
      ADMIN_DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      },
    } as unknown as Env;
    const result = await generateWeeklyDigest(env);
    expect(result).toBeNull();
  });

  it('returns campaign and SVG when campaign found', async () => {
    const mockCampaign = {
      id: '1',
      name_ro: 'Test Frauda',
      severity: 'critical',
      created_at: new Date().toISOString(),
    };
    const env = {
      ADMIN_DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockCampaign),
        }),
      },
    } as unknown as Env;

    const result = await generateWeeklyDigest(env);
    expect(result).not.toBeNull();
    expect(result?.campaign).toEqual(mockCampaign);
    expect(result?.cardSvg).toContain('<svg');
    expect(result?.cardSvg).toContain('Test Frauda');
  });
});
