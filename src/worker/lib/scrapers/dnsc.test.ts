import { describe, it, expect } from 'vitest';
import { dnscScraper, detectBrands, detectThreatType, deriveSeverity } from './dnsc';

// ---- RSS parsing tests ----------------------------------------------------

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>DNSC</title>
<item>
  <title><![CDATA[Alerta phishing ING Romania 2025]]></title>
  <link>https://dnsc.ro/citeste/alerta-phishing-ing-romania-2025</link>
  <pubDate>Wed, 01 Jan 2025 10:00:00 +0000</pubDate>
  <guid>https://dnsc.ro/citeste/alerta-phishing-ing-romania-2025</guid>
</item>
<item>
  <title><![CDATA[Campanie malware FanCourier]]></title>
  <link>https://dnsc.ro/citeste/campanie-malware-fancourier</link>
  <pubDate>Mon, 30 Dec 2024 09:00:00 +0000</pubDate>
  <guid>guid-2</guid>
</item>
<item>
  <title></title>
  <link></link>
</item>
</channel>
</rss>`;

describe('dnscScraper.parseRSS', () => {
  it('parses items from RSS', () => {
    const items = dnscScraper.parseRSS(SAMPLE_RSS);
    expect(items).toHaveLength(2);
  });

  it('extracts title correctly from CDATA', () => {
    const items = dnscScraper.parseRSS(SAMPLE_RSS);
    expect(items[0].title).toBe('Alerta phishing ING Romania 2025');
  });

  it('extracts link', () => {
    const items = dnscScraper.parseRSS(SAMPLE_RSS);
    expect(items[0].link).toBe('https://dnsc.ro/citeste/alerta-phishing-ing-romania-2025');
  });

  it('generates slug from title', () => {
    const items = dnscScraper.parseRSS(SAMPLE_RSS);
    expect(items[0].slug).toMatch(/alerta-phishing-ing-romania-2025/);
  });

  it('extracts pubDate', () => {
    const items = dnscScraper.parseRSS(SAMPLE_RSS);
    expect(items[0].pubDate).toContain('Jan 2025');
  });

  it('skips items with empty title or link', () => {
    const items = dnscScraper.parseRSS(SAMPLE_RSS);
    expect(items.every(i => i.title && i.link)).toBe(true);
  });
});

// ---- Brand detection tests -------------------------------------------------

describe('detectBrands', () => {
  it('detects ING', () => {
    expect(detectBrands('atac ING Romania HomeBank spoofing')).toContain('ING');
  });

  it('detects ANAF', () => {
    expect(detectBrands('email fals ANAF impozit')).toContain('ANAF');
  });

  it('detects FanCourier via fan courier pattern', () => {
    expect(detectBrands('sms fals fan courier colet')).toContain('FanCourier');
  });

  it('detects multiple brands', () => {
    const brands = detectBrands('BCR si BRD ambele afectate');
    expect(brands).toContain('BCR');
    expect(brands).toContain('BRD');
  });

  it('returns empty array when no brands match', () => {
    expect(detectBrands('nimic relevant')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    expect(detectBrands('ing bank')).toContain('ING');
  });
});

// ---- Threat type detection tests ------------------------------------------

describe('detectThreatType', () => {
  it('detects phishing', () => {
    expect(detectThreatType('campanie phishing cu site fals')).toBe('phishing');
  });

  it('detects malware', () => {
    expect(detectThreatType('malware distribuit prin email')).toBe('malware');
  });

  it('detects ransomware', () => {
    expect(detectThreatType('atacuri ransomware asupra institutiilor')).toBe('ransomware');
  });

  it('detects scam', () => {
    expect(detectThreatType('frauda de investitii online')).toBe('scam');
  });

  it('returns unknown for unrecognized content', () => {
    expect(detectThreatType('stire normala fara amenintari')).toBe('unknown');
  });
});

// ---- Severity derivation tests --------------------------------------------

describe('deriveSeverity', () => {
  it('critical for ransomware', () => {
    expect(deriveSeverity('ransomware', 0)).toBe('critical');
  });

  it('critical for malware', () => {
    expect(deriveSeverity('malware', 0)).toBe('critical');
  });

  it('high for phishing with brands', () => {
    expect(deriveSeverity('phishing', 2)).toBe('high');
  });

  it('medium for scam', () => {
    expect(deriveSeverity('scam', 0)).toBe('medium');
  });

  it('low for unknown with no brands', () => {
    expect(deriveSeverity('unknown', 0)).toBe('low');
  });
});

// ---- Deduplication logic tests (pure logic, no KV) -----------------------

describe('slug generation', () => {
  it('produces url-safe slugs', () => {
    const items = dnscScraper.parseRSS(`<rss><channel>
      <item><title><![CDATA[Alerta! Phishing & Malware (2025)]]></title><link>https://dnsc.ro/x</link><pubDate>now</pubDate></item>
    </channel></rss>`);
    expect(items[0].slug).toMatch(/^[a-z0-9-]+$/);
  });
});
