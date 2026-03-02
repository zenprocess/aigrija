import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReportSignalQueue } from './queue-handler';
import type { Env, ReportSignal } from './types';

function makeKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, _opts?: unknown) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
    _store: store,
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

function makeMessage(signal: ReportSignal) {
  return {
    body: signal,
    ack: vi.fn(),
    retry: vi.fn(),
    id: 'msg-' + Math.random(),
    timestamp: new Date(),
    attempts: 1,
  };
}

function makeBatch(messages: ReturnType<typeof makeMessage>[]): MessageBatch<ReportSignal> {
  return {
    queue: 'report-signals',
    messages,
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  } as unknown as MessageBatch<ReportSignal>;
}

describe('handleReportSignalQueue', () => {
  let kv: ReturnType<typeof makeKV>;
  let env: Partial<Env>;

  beforeEach(() => {
    kv = makeKV();
    env = { CACHE: kv as unknown as KVNamespace };
  });

  it('acks messages without domain or scam_type', async () => {
    const msg = makeMessage({ verdict: 'phishing', scam_type: '', confidence: 0.9, timestamp: Date.now() });
    const batch = makeBatch([msg]);
    await handleReportSignalQueue(batch, env as Env);
    expect(msg.ack).toHaveBeenCalled();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it('aggregates signal counts for domain+scam_type', async () => {
    const signal: ReportSignal = { verdict: 'phishing', scam_type: 'phishing', url_domain: 'evil.ro', confidence: 0.9, timestamp: Date.now() };
    const msg = makeMessage(signal);
    const batch = makeBatch([msg]);
    await handleReportSignalQueue(batch, env as Env);
    expect(msg.ack).toHaveBeenCalled();
    const raw = kv._store.get('signal:evil.ro:phishing');
    expect(raw).toBeDefined();
    const agg = JSON.parse(raw!);
    expect(agg.count).toBe(1);
  });

  it('increments count on subsequent signals', async () => {
    const signal: ReportSignal = { verdict: 'phishing', scam_type: 'phishing', url_domain: 'evil.ro', confidence: 0.9, timestamp: Date.now() };
    // Pre-populate existing aggregate
    kv._store.set('signal:evil.ro:phishing', JSON.stringify({ count: 2, first_seen: '2026-01-01T00:00:00.000Z', last_seen: '2026-01-01T00:00:00.000Z' }));
    const msg = makeMessage(signal);
    const batch = makeBatch([msg]);
    await handleReportSignalQueue(batch, env as Env);
    const raw = kv._store.get('signal:evil.ro:phishing');
    const agg = JSON.parse(raw!);
    expect(agg.count).toBe(3);
  });

  it('creates emerging campaign when threshold is reached', async () => {
    const signal: ReportSignal = { verdict: 'phishing', scam_type: 'phishing', url_domain: 'evil.ro', confidence: 0.9, timestamp: Date.now() };
    kv._store.set('signal:evil.ro:phishing', JSON.stringify({ count: 2, first_seen: '2026-01-01T00:00:00.000Z', last_seen: '2026-01-01T00:00:00.000Z' }));
    const msg = makeMessage(signal);
    const batch = makeBatch([msg]);
    await handleReportSignalQueue(batch, env as Env);
    const campaignRaw = kv._store.get('emerging:evil.ro:phishing');
    expect(campaignRaw).toBeDefined();
    const campaign = JSON.parse(campaignRaw!);
    expect(campaign.domain).toBe('evil.ro');
    expect(campaign.scam_type).toBe('phishing');
    expect(campaign.report_count).toBe(3);
    expect(campaign.source).toBe('community');
    expect(campaign.status).toBe('investigating');
  });

  it('updates existing emerging campaign on new signals', async () => {
    const signal: ReportSignal = { verdict: 'phishing', scam_type: 'phishing', url_domain: 'evil.ro', confidence: 0.9, timestamp: Date.now() };
    kv._store.set('signal:evil.ro:phishing', JSON.stringify({ count: 5, first_seen: '2026-01-01T00:00:00.000Z', last_seen: '2026-01-01T00:00:00.000Z' }));
    kv._store.set('emerging:evil.ro:phishing', JSON.stringify({ domain: 'evil.ro', scam_type: 'phishing', report_count: 5, first_seen: '2026-01-01T00:00:00.000Z', last_seen: '2026-01-01T00:00:00.000Z', source: 'community', status: 'investigating' }));
    const msg = makeMessage(signal);
    const batch = makeBatch([msg]);
    await handleReportSignalQueue(batch, env as Env);
    const campaignRaw = kv._store.get('emerging:evil.ro:phishing');
    const campaign = JSON.parse(campaignRaw!);
    expect(campaign.report_count).toBe(6);
  });

  it('retries on KV failure', async () => {
    kv.get = vi.fn(async () => { throw new Error('KV down'); });
    const signal: ReportSignal = { verdict: 'phishing', scam_type: 'phishing', url_domain: 'evil.ro', confidence: 0.9, timestamp: Date.now() };
    const msg = makeMessage(signal);
    const batch = makeBatch([msg]);
    await handleReportSignalQueue(batch, env as Env);
    expect(msg.retry).toHaveBeenCalled();
    expect(msg.ack).not.toHaveBeenCalled();
  });
});
