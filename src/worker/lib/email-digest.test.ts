import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildEmailHtml,
  getSubscribers,
  addSubscriber,
  removeSubscriber,
  sendDigestEmail,
} from './email-digest';
import type { WeeklyDigest } from './weekly-digest';
import type { Env } from './types';

const mockDigest: WeeklyDigest = {
  weekOf: '2026-W09',
  topScams: [
    { title: 'Frauda BRD', url: 'https://ai-grija.ro/alerte/brd', reportCount: 42, severity: 'critical' },
  ],
  stats: { totalChecks: 500, totalAlerts: 20, quizCompletions: 10, communityReports: 5 },
  blogPosts: [{ title: 'Articol test', slug: 'articol-test', date: '2026-03-01' }],
  tips: ['Sfat important pentru utilizatori.'],
};

function makeKV(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;
}

describe('buildEmailHtml', () => {
  it('includes week identifier', () => {
    const html = buildEmailHtml(mockDigest, 'user@example.com', 'https://ai-grija.ro');
    expect(html).toContain('2026-W09');
  });

  it('includes scam title', () => {
    const html = buildEmailHtml(mockDigest, 'user@example.com', 'https://ai-grija.ro');
    expect(html).toContain('Frauda BRD');
  });

  it('includes stats', () => {
    const html = buildEmailHtml(mockDigest, 'user@example.com', 'https://ai-grija.ro');
    expect(html).toContain('500');
  });

  it('includes blog post', () => {
    const html = buildEmailHtml(mockDigest, 'user@example.com', 'https://ai-grija.ro');
    expect(html).toContain('articol-test');
    expect(html).toContain('Articol test');
  });

  it('includes tip', () => {
    const html = buildEmailHtml(mockDigest, 'user@example.com', 'https://ai-grija.ro');
    expect(html).toContain('Sfat important');
  });

  it('includes unsubscribe link with encoded email', () => {
    const html = buildEmailHtml(mockDigest, 'test@example.com', 'https://ai-grija.ro');
    expect(html).toContain('dezabonare');
    expect(html).toContain('test%40example.com');
  });

  it('is valid HTML with doctype', () => {
    const html = buildEmailHtml(mockDigest, 'user@example.com', 'https://ai-grija.ro');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });
});

describe('getSubscribers', () => {
  it('returns empty array when key missing', async () => {
    const kv = makeKV();
    const result = await getSubscribers(kv);
    expect(result).toEqual([]);
  });

  it('returns parsed subscribers', async () => {
    const kv = makeKV({ 'email:subscribers': JSON.stringify(['a@b.com', 'c@d.com']) });
    const result = await getSubscribers(kv);
    expect(result).toEqual(['a@b.com', 'c@d.com']);
  });

  it('returns empty array on invalid JSON', async () => {
    const kv = makeKV({ 'email:subscribers': 'not-json' });
    const result = await getSubscribers(kv);
    expect(result).toEqual([]);
  });
});

describe('addSubscriber', () => {
  it('adds new subscriber', async () => {
    const kv = makeKV();
    await addSubscriber(kv, 'new@example.com');
    const list = await getSubscribers(kv);
    expect(list).toContain('new@example.com');
  });

  it('does not duplicate existing subscriber', async () => {
    const kv = makeKV({ 'email:subscribers': JSON.stringify(['a@b.com']) });
    await addSubscriber(kv, 'A@B.COM');
    const list = await getSubscribers(kv);
    expect(list.filter(e => e === 'a@b.com')).toHaveLength(1);
  });

  it('normalizes email to lowercase', async () => {
    const kv = makeKV();
    await addSubscriber(kv, 'UPPER@EXAMPLE.COM');
    const list = await getSubscribers(kv);
    expect(list).toContain('upper@example.com');
  });
});

describe('removeSubscriber', () => {
  it('removes existing subscriber', async () => {
    const kv = makeKV({ 'email:subscribers': JSON.stringify(['a@b.com', 'c@d.com']) });
    await removeSubscriber(kv, 'a@b.com');
    const list = await getSubscribers(kv);
    expect(list).not.toContain('a@b.com');
    expect(list).toContain('c@d.com');
  });

  it('handles removal of non-existing subscriber gracefully', async () => {
    const kv = makeKV({ 'email:subscribers': JSON.stringify(['a@b.com']) });
    await removeSubscriber(kv, 'nothere@example.com');
    const list = await getSubscribers(kv);
    expect(list).toEqual(['a@b.com']);
  });
});

describe('sendDigestEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns early when no CACHE', async () => {
    const env = {} as unknown as Env;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await sendDigestEmail(env, mockDigest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns early when no subscribers', async () => {
    const env = { CACHE: makeKV(), BASE_URL: 'https://ai-grija.ro' } as unknown as Env;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await sendDigestEmail(env, mockDigest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls MailChannels for each subscriber', async () => {
    const kv = makeKV({
      'email:subscribers': JSON.stringify(['a@b.com', 'c@d.com']),
    });
    const env = { CACHE: kv, BASE_URL: 'https://ai-grija.ro' } as unknown as Env;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 202 })
    );
    await sendDigestEmail(env, mockDigest);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url] = fetchSpy.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('mailchannels.net');
  });

  it('does not throw when fetch fails for a subscriber', async () => {
    const kv = makeKV({ 'email:subscribers': JSON.stringify(['a@b.com']) });
    const env = { CACHE: kv, BASE_URL: 'https://ai-grija.ro' } as unknown as Env;
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    await expect(sendDigestEmail(env, mockDigest)).resolves.toBeUndefined();
  });
});
