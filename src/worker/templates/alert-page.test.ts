import { describe, it, expect } from 'vitest';
import { renderAlertPage, renderAlertsIndex } from './alert-page';
import { CAMPAIGNS } from '../data/campaigns';

describe('renderAlertPage', () => {
  const campaign = CAMPAIGNS[0];
  const html = renderAlertPage(campaign, 'https://ai-grija.ro');

  it('contains SEO title', () => {
    expect(html).toContain(`<title>${campaign.seo.title}</title>`);
  });

  it('contains og:url meta tag', () => {
    expect(html).toContain('og:url');
    expect(html).toContain(campaign.slug);
  });

  it('contains canonical link', () => {
    expect(html).toContain('<link rel="canonical"');
  });

  it('contains all red flags (HTML-escaped)', () => {
    // Flags with quotes get escaped, so check for flags without quotes
    const simpleFlags = campaign.red_flags_ro.filter(f => !f.includes('"'));
    for (const flag of simpleFlags) {
      expect(html).toContain(flag);
    }
    // Flags with quotes should appear with &quot;
    const quotedFlags = campaign.red_flags_ro.filter(f => f.includes('"'));
    for (const flag of quotedFlags) {
      expect(html).toContain(flag.replace(/"/g, '&quot;'));
    }
  });

  it('contains DNSC link when present', () => {
    if (campaign.dnsc_alert_url) {
      expect(html).toContain(campaign.dnsc_alert_url);
    }
  });

  it('escapes HTML entities in content', () => {
    // The description contains quotes which should be escaped
    expect(html).toContain('&quot;');
  });
});

describe('renderAlertsIndex', () => {
  const html = renderAlertsIndex(CAMPAIGNS, 'https://ai-grija.ro');

  it('lists all campaigns', () => {
    for (const c of CAMPAIGNS) {
      expect(html).toContain(c.name_ro);
    }
  });

  it('has links to individual alert pages', () => {
    for (const c of CAMPAIGNS) {
      expect(html).toContain(`/alerte/${c.slug}`);
    }
  });
});
