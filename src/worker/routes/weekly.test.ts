import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { weekly } from './weekly';

// Mock weekly-digest
const mockGenerateWeeklyDigest = vi.fn();
vi.mock('../lib/weekly-digest', () => ({
  generateWeeklyDigest: (...args: unknown[]) => mockGenerateWeeklyDigest(...args),
}));

// Mock gdpr-consent (fire-and-forget in subscribe/unsubscribe)
vi.mock('../lib/gdpr-consent', () => ({
  recordConsent: vi.fn().mockResolvedValue(undefined),
  revokeConsent: vi.fn().mockResolvedValue(undefined),
}));

// Mock rate-limiter (default: allowed)
const mockWeeklyRateLimiterFn = vi.fn().mockResolvedValue({ allowed: true });
vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: () => mockWeeklyRateLimiterFn,
  isTestEnvironment: () => true,
}));

function makeKV(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { ...overrides };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

// ─── Buttondown fetch mock helpers ────────────────────────────────────────────

function mockFetch(status: number, body: unknown = { ok: true }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('GET /api/weekly', () => {
  it('returns 200', async () => {
    const res = await weekly.fetch(new Request('http://localhost/api/weekly'), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
  });

  it('returns ok:true with items array', async () => {
    const res = await weekly.fetch(new Request('http://localhost/api/weekly'), makeEnv(), makeCtx());
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe('POST /api/digest/subscribe', () => {
  it('returns 422 for invalid email', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(422);
  });

  it('returns 503 when BUTTONDOWN_API_KEY missing', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
      makeEnv({ CACHE: makeKV() }),
      makeCtx()
    );
    expect(res.status).toBe(503);
  });

  it('subscribes valid email via Buttondown and returns 200', async () => {
    mockFetch(201, { email: 'user@example.com' });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 400 on invalid JSON', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when Buttondown returns 400 (already subscribed)', async () => {
    mockFetch(400, { error: 'already subscribed' });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('sends digest tag to Buttondown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.tags).toContain('digest');
  });
});

describe('POST /api/digest/unsubscribe', () => {
  it('returns 422 for invalid email', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(422);
  });

  it('returns 503 when BUTTONDOWN_API_KEY missing', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV() }),
      makeCtx()
    );
    expect(res.status).toBe(503);
  });

  it('unsubscribes email via Buttondown and returns 200', async () => {
    mockFetch(204);
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 404 when Buttondown returns 404', async () => {
    mockFetch(404);
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'notsubscribed@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(404);
  });
});

// ─── Sample digest fixture ─────────────────────────────────────────────────────

const sampleDigest = {
  weekOf: '10-17 Martie 2026',
  topScams: [
    { title: 'Phishing ING', url: 'https://example.com/phishing', reportCount: 42, severity: 'critical' },
    { title: 'Frauda PayPal', url: 'https://example.com/fraud', reportCount: 1, severity: 'high' },
  ],
  stats: { totalChecks: 1500, totalAlerts: 8, communityReports: 32, quizCompletions: 120 },
  blogPosts: [{ title: 'Articol nou', slug: 'articol-nou', date: '2026-03-14' }],
  tips: ['Nu da parola la nimeni.'],
};

describe('GET /saptamanal', () => {
  beforeEach(() => { vi.unstubAllGlobals(); mockGenerateWeeklyDigest.mockResolvedValue(sampleDigest); mockWeeklyRateLimiterFn.mockResolvedValue({ allowed: true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns 200 with HTML content-type', async () => {
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('sets Cache-Control header', async () => {
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
  });

  it('renders scam titles when topScams is non-empty', async () => {
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    expect(html).toContain('Phishing ING');
  });

  it('renders singular report count label', async () => {
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    // reportCount=1 should render "1 raport" not "1 raporte"
    expect(html).toContain('1 raport');
  });

  it('renders empty state when topScams is empty', async () => {
    mockGenerateWeeklyDigest.mockResolvedValueOnce({ ...sampleDigest, topScams: [] });
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    expect(html).toContain('Nu au fost detectate campanii noi');
  });

  it('omits blog section when blogPosts is empty', async () => {
    mockGenerateWeeklyDigest.mockResolvedValueOnce({ ...sampleDigest, blogPosts: [] });
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    expect(html).not.toContain('Articole recente');
  });

  it('returns 503 when generateWeeklyDigest throws', async () => {
    mockGenerateWeeklyDigest.mockRejectedValueOnce(new Error('DB error'));
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    expect(res.status).toBe(503);
  });
});

describe('GET /api/digest/latest', () => {
  beforeEach(() => { vi.unstubAllGlobals(); mockGenerateWeeklyDigest.mockResolvedValue(sampleDigest); mockWeeklyRateLimiterFn.mockResolvedValue({ allowed: true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns 200 with digest json', async () => {
    const res = await weekly.fetch(new Request('http://localhost/api/digest/latest'), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.digest).toBeDefined();
  });

  it('sets Cache-Control header', async () => {
    const res = await weekly.fetch(new Request('http://localhost/api/digest/latest'), makeEnv(), makeCtx());
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
  });

  it('returns 503 on error', async () => {
    mockGenerateWeeklyDigest.mockRejectedValueOnce(new Error('DB error'));
    const res = await weekly.fetch(new Request('http://localhost/api/digest/latest'), makeEnv(), makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.ok).toBe(false);
  });
});

describe('POST /api/digest/subscribe — additional branches', () => {
  beforeEach(() => { vi.unstubAllGlobals(); mockWeeklyRateLimiterFn.mockResolvedValue({ allowed: true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns 429 when rate limit exceeded', async () => {
    mockWeeklyRateLimiterFn.mockResolvedValueOnce({ allowed: false });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(429);
  });

  it('returns 502 on network error during Buttondown call', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(502);
  });

  it('returns 502 when Buttondown returns 500', async () => {
    mockFetch(500, { error: 'internal server error' });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(502);
  });
});

describe('GET /saptamanal — severity rendering branches', () => {
  beforeEach(() => { vi.unstubAllGlobals(); mockGenerateWeeklyDigest.mockResolvedValue(sampleDigest); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders medium severity label and color', async () => {
    const mediumDigest = {
      ...sampleDigest,
      topScams: [{ title: 'Frauda medie', url: 'https://example.com', reportCount: 5, severity: 'medium' }],
    };
    mockGenerateWeeklyDigest.mockResolvedValueOnce(mediumDigest);
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    expect(html).toContain('Medie');
    expect(html).toContain('#eab308');
  });

  it('renders default (low/unknown) severity label and color', async () => {
    const lowDigest = {
      ...sampleDigest,
      topScams: [{ title: 'Frauda scazuta', url: 'https://example.com', reportCount: 2, severity: 'low' }],
    };
    mockGenerateWeeklyDigest.mockResolvedValueOnce(lowDigest);
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    expect(html).toContain('Scazuta');
    expect(html).toContain('#22c55e');
  });

  it('escapes HTML special characters in scam title (XSS prevention)', async () => {
    const xssDigest = {
      ...sampleDigest,
      topScams: [{ title: '<b>Test & "Alert"</b>', url: 'https://example.com', reportCount: 3, severity: 'critical' }],
    };
    mockGenerateWeeklyDigest.mockResolvedValueOnce(xssDigest);
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    expect(html).not.toContain('<b>Test');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });

  it('escapes HTML apostrophes in scam title', async () => {
    const apostropheDigest = {
      ...sampleDigest,
      topScams: [{ title: "It's a scam", url: 'https://example.com', reportCount: 1, severity: 'high' }],
    };
    mockGenerateWeeklyDigest.mockResolvedValueOnce(apostropheDigest);
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv(), makeCtx());
    const html = await res.text();
    expect(html).toContain('&#39;');
  });

  it('uses BASE_URL fallback (https://ai-grija.ro) when not set in env', async () => {
    mockGenerateWeeklyDigest.mockResolvedValueOnce(sampleDigest);
    // makeEnv({}) returns env without BASE_URL — triggers the ?? fallback
    const res = await weekly.fetch(new Request('http://localhost/saptamanal'), makeEnv({}), makeCtx());
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('ai-grija.ro');
  });
});

describe('GET /api/digest/latest — BASE_URL fallback', () => {
  beforeEach(() => { vi.unstubAllGlobals(); mockGenerateWeeklyDigest.mockResolvedValue(sampleDigest); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns ok when BASE_URL is not set', async () => {
    const res = await weekly.fetch(new Request('http://localhost/api/digest/latest'), makeEnv({}), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/digest/subscribe — no CACHE branch', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('skips rate limiting when CACHE is not provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }));
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      // No CACHE key — c.env.CACHE is undefined → skips rate limit check
      makeEnv({ BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/digest/unsubscribe — no CACHE branch', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('skips rate limiting when CACHE is not provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) }));
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/digest/unsubscribe — additional branches', () => {
  beforeEach(() => { vi.unstubAllGlobals(); mockWeeklyRateLimiterFn.mockResolvedValue({ allowed: true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns 400 on invalid JSON body', async () => {
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockWeeklyRateLimiterFn.mockResolvedValueOnce({ allowed: false });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(429);
  });

  it('returns 502 on network error during Buttondown call', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(502);
  });

  it('returns 502 when Buttondown returns 500', async () => {
    mockFetch(500, { error: 'server error' });
    const res = await weekly.fetch(
      new Request('http://localhost/api/digest/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
      makeEnv({ CACHE: makeKV(), BUTTONDOWN_API_KEY: 'test-key' }),
      makeCtx()
    );
    expect(res.status).toBe(502);
  });
});
