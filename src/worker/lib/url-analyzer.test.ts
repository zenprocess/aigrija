import { describe, it, expect } from 'vitest';
import { analyzeUrl } from './url-analyzer';

describe('analyzeUrl', () => {
  it('returns safe for official domains', async () => {
    const result = await analyzeUrl('https://ing.ro/homebank');
    expect(result.is_suspicious).toBe(false);
    expect(result.risk_score).toBe(0);
    expect(result.safe_browsing_match).toBe(false);
    expect(result.safe_browsing_threats).toEqual([]);
  });

  it('flags HTTP protocol', async () => {
    const result = await analyzeUrl('http://example.com');
    expect(result.flags).toContain('Conexiune nesecurizata (HTTP)');
    expect(result.safe_browsing_match).toBe(false);
  });

  it('flags long domains', async () => {
    const result = await analyzeUrl('https://this-is-a-very-long-domain-name-that-exceeds-thirty-chars.com');
    expect(result.flags).toContain('Domeniu neobisnuit de lung');
  });

  it('detects look-alike domains', async () => {
    const result = await analyzeUrl('https://ing-romania.com/login');
    expect(result.is_suspicious).toBe(true);
    expect(result.flags.some(f => f.includes('look-alike'))).toBe(true);
  });

  it('flags URL shorteners', async () => {
    const result = await analyzeUrl('https://bit.ly/abc123');
    expect(result.flags).toContain('URL scurtat — destinatia reala este ascunsa');
  });

  it('flags suspicious TLDs', async () => {
    const result = await analyzeUrl('https://ing-bank.xyz');
    expect(result.is_suspicious).toBe(true);
  });

  it('handles invalid URLs', async () => {
    const result = await analyzeUrl('not a url at all !!!');
    expect(result.is_suspicious).toBe(true);
    expect(result.flags).toContain('URL invalid sau malformat');
    expect(result.safe_browsing_match).toBe(false);
    expect(result.safe_browsing_threats).toEqual([]);
  });

  it('flags domains with many digits', async () => {
    const result = await analyzeUrl('https://login12345.com');
    expect(result.flags).toContain('Domeniu cu multe cifre');
  });

  it('flags too many subdomains', async () => {
    const result = await analyzeUrl('https://a.b.c.d.example.com');
    expect(result.flags).toContain('Prea multe subdomenii');
  });

  it('skips Safe Browsing when no API key provided', async () => {
    const result = await analyzeUrl('https://example.com');
    expect(result.safe_browsing_match).toBe(false);
    expect(result.safe_browsing_threats).toEqual([]);
  });
});

describe('analyzeUrl KV caching', () => {
  function makeKV(store: Map<string, string>) {
    return {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => { store.set(key, value); },
      delete: async (key: string) => { store.delete(key); },
      list: async () => ({ keys: [] }),
    } as unknown as KVNamespace;
  }

  it('returns cached result when within TTL', async () => {
    const store = new Map<string, string>();
    const entry = {
      safeBrowsing: { match: true, threats: ['MALWARE'] },
      phishTank: { match: false },
      cachedAt: Date.now(),
    };
    store.set('url-threat:example.com', JSON.stringify(entry));
    const kv = makeKV(store);
    const result = await analyzeUrl('https://example.com', undefined, undefined, kv);
    expect(result.safe_browsing_match).toBe(true);
    expect(result.safe_browsing_threats).toContain('MALWARE');
  });

  it('stores result in KV after external calls', async () => {
    const store = new Map<string, string>();
    const kv = makeKV(store);
    await analyzeUrl('https://suspicious-test-xyz.xyz', undefined, undefined, kv);
    const cached = store.get('url-threat:suspicious-test-xyz.xyz');
    expect(cached).toBeDefined();
    const parsed = JSON.parse(cached!);
    expect(parsed).toHaveProperty('safeBrowsing');
    expect(parsed).toHaveProperty('phishTank');
    expect(parsed).toHaveProperty('cachedAt');
  });

  it('ignores expired cache entries', async () => {
    const store = new Map<string, string>();
    const entry = {
      safeBrowsing: { match: true, threats: ['MALWARE'] },
      phishTank: { match: false },
      cachedAt: Date.now() - 120_000, // 2 minutes ago — expired
    };
    store.set('url-threat:example.com', JSON.stringify(entry));
    const kv = makeKV(store);
    // Should proceed without using cached value (no API key, so match stays false)
    const result = await analyzeUrl('https://example.com', undefined, undefined, kv);
    expect(result.safe_browsing_match).toBe(false);
  });
});
