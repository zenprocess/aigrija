import { describe, it, expect } from 'vitest';
import { matchCampaigns } from './campaign-matcher';

describe('matchCampaigns', () => {
  it('matches ING campaign by text patterns', () => {
    const matches = matchCampaigns('Am primit un apel de la ING despre tranzactii suspecte pe homebank');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].campaign.id).toBe('ing-spoofing-2025');
  });

  it('matches FAN Courier campaign', () => {
    const matches = matchCampaigns('Coletul dvs FANBOX este in asteptare');
    expect(matches.some(m => m.campaign.id === 'fanbox-2025')).toBe(true);
  });

  it('returns empty for unrelated text', () => {
    const matches = matchCampaigns('Vremea e frumoasa azi');
    expect(matches).toHaveLength(0);
  });

  it('scores URL patterns higher', () => {
    const matches = matchCampaigns('Verifica contul', 'https://ing-homebank.com/login');
    expect(matches[0].campaign.id).toBe('ing-spoofing-2025');
    expect(matches[0].score).toBeGreaterThanOrEqual(2);
  });

  it('returns multiple matches sorted by score', () => {
    const matches = matchCampaigns('Am primit amenda de la ANAF si politia despre un dosar penal');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
  });
});
