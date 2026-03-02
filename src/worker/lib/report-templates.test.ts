import { describe, it, expect } from 'vitest';
import {
  templatePlangere,
  templatePetitiePolitie,
  templateRaportDNSC,
  templateSesizareBanca,
  generateReport,
  REPORT_INSTRUCTIONS,
} from './report-templates';
import type { ReportParams, ReportType } from './report-templates';

const baseParams: ReportParams = {
  scam_type: 'phishing',
  text_excerpt: 'Cont blocat. Click aici.',
  date: '2026-03-01',
  verdict: 'SCAM',
};

describe('templatePlangere', () => {
  it('includes scam_type, date, verdict', () => {
    const result = templatePlangere(baseParams);
    expect(result).toContain('phishing');
    expect(result).toContain('2026-03-01');
    expect(result).toContain('SCAM');
  });

  it('includes text_excerpt', () => {
    expect(templatePlangere(baseParams)).toContain('Cont blocat. Click aici.');
  });

  it('includes URL when provided', () => {
    const result = templatePlangere({ ...baseParams, url: 'https://evil.com' });
    expect(result).toContain('https://evil.com');
  });

  it('omits URL line when not provided', () => {
    const result = templatePlangere(baseParams);
    expect(result).not.toContain('URL identificat:');
  });
});

describe('templatePetitiePolitie', () => {
  it('includes scam_type, date, verdict', () => {
    const result = templatePetitiePolitie(baseParams);
    expect(result).toContain('phishing');
    expect(result).toContain('2026-03-01');
    expect(result).toContain('SCAM');
  });

  it('includes URL when provided', () => {
    const result = templatePetitiePolitie({ ...baseParams, url: 'https://evil.com' });
    expect(result).toContain('Link/URL folosit');
    expect(result).toContain('https://evil.com');
  });

  it('uses bank_name when provided', () => {
    expect(templatePetitiePolitie({ ...baseParams, bank_name: 'BCR' })).toContain('BCR');
  });
});

describe('templateRaportDNSC', () => {
  it('includes incident type and date', () => {
    const result = templateRaportDNSC(baseParams);
    expect(result).toContain('phishing');
    expect(result).toContain('2026-03-01');
  });

  it('mentions URL when provided', () => {
    const result = templateRaportDNSC({ ...baseParams, url: 'https://bad.ro' });
    expect(result).toContain('https://bad.ro');
  });

  it('shows fallback when no URL', () => {
    const result = templateRaportDNSC(baseParams);
    expect(result).toContain('neidentificat');
  });
});

describe('templateSesizareBanca', () => {
  it('uses bank_name in header', () => {
    const result = templateSesizareBanca({ ...baseParams, bank_name: 'ING' });
    expect(result).toContain('ING');
  });

  it('uses placeholder when bank_name missing', () => {
    const result = templateSesizareBanca(baseParams);
    expect(result).toContain('[COMPLETAȚI NUMELE BĂNCII]');
  });

  it('includes scam_type and verdict', () => {
    const result = templateSesizareBanca(baseParams);
    expect(result).toContain('phishing');
    expect(result).toContain('SCAM');
  });
});

describe('generateReport', () => {
  const types: ReportType[] = ['plangere-penala', 'petitie-politie', 'raport-dnsc', 'sesizare-banca'];

  for (const type of types) {
    it('returns template and instructions for ' + type, () => {
      const result = generateReport(type, baseParams);
      expect(typeof result.template).toBe('string');
      expect(result.template.length).toBeGreaterThan(0);
      expect(typeof result.instructions).toBe('string');
      expect(result.instructions.length).toBeGreaterThan(0);
    });
  }
});

describe('REPORT_INSTRUCTIONS', () => {
  it('has entries for all 4 report types', () => {
    expect(Object.keys(REPORT_INSTRUCTIONS)).toHaveLength(4);
    expect(REPORT_INSTRUCTIONS['plangere-penala']).toBeTruthy();
    expect(REPORT_INSTRUCTIONS['petitie-politie']).toBeTruthy();
    expect(REPORT_INSTRUCTIONS['raport-dnsc']).toBeTruthy();
    expect(REPORT_INSTRUCTIONS['sesizare-banca']).toBeTruthy();
  });
});
