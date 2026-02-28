import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateSignals, storeReportSignal } from './campaign-aggregator';
import type { Env, ReportSignal } from './types';

function makeKV(store: Map<string, string>) {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => {
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys };
    }),
  } as unknown as KVNamespace;
}

function makeEnv(kv: KVNamespace): Env {
  return { CACHE: kv } as unknown as Env;
}

const NOW = Date.now();

describe('storeReportSignal', () => {
  it('stores signal with report: prefix', async () => {
    const store = new Map<string, string>();
    const kv = makeKV(store);
    const env = makeEnv(kv);
    const signal: ReportSignal = {
      verdict: 'phishing',
      scam_type: 'banking',
      url_domain: 'evil.com',
      confidence: 0.95,
      timestamp: NOW,
    };
    await storeReportSignal(env, signal, 'abc123');
    const keys = [...store.keys()];
    expect(keys.some((k) => k.startsWith('report:'))).toBe(true);
    expect(keys.some((k) => k.endsWith(':abc123'))).toBe(true);
  });

  it('invalidates aggregation cache on store', async () => {
    const store = new Map<string, string>();
    store.set('cache:emerging-campaigns', '{"emerging":[]}');
    const kv = makeKV(store);
    const env = makeEnv(kv);
    const signal: ReportSignal = {
      verdict: 'suspicious',
      scam_type: 'delivery',
      confidence: 0.7,
      timestamp: NOW,
    };
    await storeReportSignal(env, signal, 'xyz');
    expect(store.has('cache:emerging-campaigns')).toBe(false);
  });
});

describe('aggregateSignals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached result if present', async () => {
    const store = new Map<string, string>();
    const cached = { emerging: [{ scam_type: 'test', report_count: 99, first_seen: '2026-01-01', last_seen: '2026-01-01', source: 'community', status: 'investigating' }] };
    store.set('cache:emerging-campaigns', JSON.stringify(cached));
    const env = makeEnv(makeKV(store));
    const result = await aggregateSignals(env);
    expect(result.emerging).toHaveLength(1);
    expect(result.emerging[0].scam_type).toBe('test');
  });

  it('returns empty when no reports', async () => {
    const store = new Map<string, string>();
    const env = makeEnv(makeKV(store));
    const result = await aggregateSignals(env);
    expect(result.emerging).toHaveLength(0);
  });

  it('detects domain cluster when >=5 reports share same domain', async () => {
    const store = new Map<string, string>();
    const domain = 'evil-bank.ro';
    for (let i = 0; i < 6; i++) {
      const signal: ReportSignal = { verdict: 'phishing', scam_type: 'banking', url_domain: domain, confidence: 0.9, timestamp: NOW - i * 1000 };
      store.set(`report:2026-01-01:hash${i}`, JSON.stringify(signal));
    }
    const env = makeEnv(makeKV(store));
    const result = await aggregateSignals(env);
    expect(result.emerging.some((e) => e.domain === domain)).toBe(true);
    expect(result.emerging.find((e) => e.domain === domain)?.report_count).toBe(6);
  });

  it('detects scam_type cluster when >=10 reports share same scam_type', async () => {
    const store = new Map<string, string>();
    for (let i = 0; i < 11; i++) {
      const signal: ReportSignal = { verdict: 'phishing', scam_type: 'delivery', confidence: 0.85, timestamp: NOW - i * 1000 };
      store.set(`report:2026-01-01:hash${i}`, JSON.stringify(signal));
    }
    const env = makeEnv(makeKV(store));
    const result = await aggregateSignals(env);
    expect(result.emerging.some((e) => e.scam_type === 'delivery')).toBe(true);
  });

  it('excludes reports older than 7 days', async () => {
    const store = new Map<string, string>();
    const oldTimestamp = NOW - 8 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 6; i++) {
      const signal: ReportSignal = { verdict: 'phishing', scam_type: 'banking', url_domain: 'old-evil.ro', confidence: 0.9, timestamp: oldTimestamp };
      store.set(`report:2026-01-01:old${i}`, JSON.stringify(signal));
    }
    const env = makeEnv(makeKV(store));
    const result = await aggregateSignals(env);
    expect(result.emerging.some((e) => e.domain === 'old-evil.ro')).toBe(false);
  });

  it('sets source and status correctly on emerging campaigns', async () => {
    const store = new Map<string, string>();
    for (let i = 0; i < 6; i++) {
      const signal: ReportSignal = { verdict: 'phishing', scam_type: 'banking', url_domain: 'fake.ro', confidence: 0.9, timestamp: NOW - i * 1000 };
      store.set(`report:2026-01-01:h${i}`, JSON.stringify(signal));
    }
    const env = makeEnv(makeKV(store));
    const result = await aggregateSignals(env);
    const campaign = result.emerging.find((e) => e.domain === 'fake.ro');
    expect(campaign?.source).toBe('community');
    expect(campaign?.status).toBe('investigating');
  });
});
