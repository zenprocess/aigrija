import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDomainIntel } from './domain-intel';

function makeKV(store: Map<string, string>) {
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async () => ({ keys: [] }),
  } as unknown as KVNamespace;
}

describe('getDomainIntel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns nulls on 404', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });
    const result = await getDomainIntel('nonexistent-domain-xyz.invalid');
    expect(result.domain_age_days).toBeNull();
    expect(result.registrar).toBeNull();
    expect(result.is_new_domain).toBe(false);
  });

  it('returns nulls on network error (graceful degrade)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network failure'));
    const result = await getDomainIntel('example.com');
    expect(result.domain_age_days).toBeNull();
    expect(result.is_new_domain).toBe(false);
  });

  it('parses registration date and computes age', async () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const rdapData = {
      events: [
        { eventAction: 'registration', eventDate: pastDate },
        { eventAction: 'expiration', eventDate: '2030-01-01T00:00:00Z' },
      ],
      entities: [],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => rdapData,
    });
    const result = await getDomainIntel('newdomain.com');
    expect(result.domain_age_days).toBeGreaterThanOrEqual(9);
    expect(result.domain_age_days).toBeLessThanOrEqual(11);
    expect(result.creation_date).toBe(pastDate);
    expect(result.is_new_domain).toBe(true);
  });

  it('marks domain > 30 days as not new', async () => {
    const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
    const rdapData = {
      events: [{ eventAction: 'registration', eventDate: pastDate }],
      entities: [],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => rdapData,
    });
    const result = await getDomainIntel('olddomain.com');
    expect(result.is_new_domain).toBe(false);
    expect(result.domain_age_days).toBeGreaterThanOrEqual(59);
  });

  it('extracts registrar from entities', async () => {
    const rdapData = {
      events: [{ eventAction: 'registration', eventDate: '2020-01-01T00:00:00Z' }],
      entities: [
        {
          roles: ['registrar'],
          vcardArray: ['vcard', [['fn', {}, 'text', 'GoDaddy LLC']]],
        },
      ],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => rdapData,
    });
    const result = await getDomainIntel('example.com');
    expect(result.registrar).toBe('GoDaddy LLC');
  });

  it('returns cached result from KV', async () => {
    const store = new Map<string, string>();
    const cached = {
      domain_age_days: 5,
      registrar: 'CachedRegistrar',
      creation_date: '2026-01-01T00:00:00Z',
      is_new_domain: true,
    };
    store.set('rdap:example.com', JSON.stringify(cached));
    const kv = makeKV(store);

    const result = await getDomainIntel('example.com', kv);
    expect(result.domain_age_days).toBe(5);
    expect(result.registrar).toBe('CachedRegistrar');
    // fetch should not be called since we used cache
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores result in KV after fetch', async () => {
    const store = new Map<string, string>();
    const kv = makeKV(store);
    const pastDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const rdapData = {
      events: [{ eventAction: 'registration', eventDate: pastDate }],
      entities: [],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => rdapData,
    });
    await getDomainIntel('example.com', kv);
    const stored = store.get('rdap:example.com');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveProperty('domain_age_days');
    expect(parsed).toHaveProperty('is_new_domain');
  });

  it('strips www. prefix before lookup', async () => {
    const store = new Map<string, string>();
    const cached = {
      domain_age_days: 100,
      registrar: 'Test',
      creation_date: '2025-01-01T00:00:00Z',
      is_new_domain: false,
    };
    store.set('rdap:example.com', JSON.stringify(cached));
    const kv = makeKV(store);

    const result = await getDomainIntel('www.example.com', kv);
    expect(result.domain_age_days).toBe(100);
  });
});
