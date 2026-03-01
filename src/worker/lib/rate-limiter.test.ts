import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from "../lib/rate-limiter";

function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: any) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

afterEach(() => {
  vi.useRealTimers();
});

// ── checkRateLimit ──────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  it("first request is allowed with remaining = limit - 1", async () => {
    const kv = makeKV();
    const result = await checkRateLimit(kv, "127.0.0.1", 5, 3600);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("returns allowed: false when at limit", async () => {
    const kv = makeKV();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv, "10.0.0.1", 5, 3600);
    }
    const result = await checkRateLimit(kv, "10.0.0.1", 5, 3600);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("different IPs are tracked separately", async () => {
    const kv = makeKV();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv, "1.1.1.1", 5, 3600);
    }
    const ip1 = await checkRateLimit(kv, "1.1.1.1", 5, 3600);
    const ip2 = await checkRateLimit(kv, "2.2.2.2", 5, 3600);
    expect(ip1.allowed).toBe(false);
    expect(ip2.allowed).toBe(true);
  });

  it("increments counter on each allowed request", async () => {
    const kv = makeKV();
    const r1 = await checkRateLimit(kv, "3.3.3.3", 10, 3600);
    const r2 = await checkRateLimit(kv, "3.3.3.3", 10, 3600);
    const r3 = await checkRateLimit(kv, "3.3.3.3", 10, 3600);
    expect(r1.remaining).toBe(9);
    expect(r2.remaining).toBe(8);
    expect(r3.remaining).toBe(7);
  });

  it("returns correct limit in response", async () => {
    const kv = makeKV();
    const result = await checkRateLimit(kv, "4.4.4.4", 20, 3600);
    expect(result.limit).toBe(20);
  });

  it("includes reset timestamp approximately equal to now + windowSeconds", async () => {
    const kv = makeKV();
    const before = Math.floor(Date.now() / 1000);
    const result = await checkRateLimit(kv, "5.5.5.5", 10, 3600);
    const after = Math.floor(Date.now() / 1000);
    expect(result.reset).toBeGreaterThanOrEqual(before + 3600);
    expect(result.reset).toBeLessThanOrEqual(after + 3600);
  });

  it("reset is set even when rate limited (allowed: false)", async () => {
    const kv = makeKV();
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(kv, "6.6.6.6", 3, 3600);
    }
    const result = await checkRateLimit(kv, "6.6.6.6", 3, 3600);
    expect(result.allowed).toBe(false);
    expect(result.reset).toBeGreaterThan(0);
  });
});

// ── ROUTE_RATE_LIMITS ───────────────────────────────────────────────────────

describe("ROUTE_RATE_LIMITS", () => {
  it("check route has stricter limit than report route", () => {
    expect(ROUTE_RATE_LIMITS['check'].limit).toBeLessThan(ROUTE_RATE_LIMITS['report'].limit);
  });

  it("vote route has stricter limit than telegram route", () => {
    expect(ROUTE_RATE_LIMITS['vote'].limit).toBeLessThan(ROUTE_RATE_LIMITS['telegram'].limit);
  });

  it("all routes have positive limit and windowSeconds", () => {
    for (const [route, cfg] of Object.entries(ROUTE_RATE_LIMITS)) {
      expect(cfg.limit, `${route}.limit`).toBeGreaterThan(0);
      expect(cfg.windowSeconds, `${route}.windowSeconds`).toBeGreaterThan(0);
    }
  });

  it("check-image has same limit as check (AI-heavy)", () => {
    expect(ROUTE_RATE_LIMITS['check-image'].limit).toBe(ROUTE_RATE_LIMITS['check'].limit);
  });
});

// ── applyRateLimitHeaders ───────────────────────────────────────────────────

describe("applyRateLimitHeaders", () => {
  function captureHeaders() {
    const headers: Record<string, string> = {};
    const setHeader = (k: string, v: string) => { headers[k] = v; };
    return { headers, setHeader };
  }

  it("sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on allowed request", () => {
    const { headers, setHeader } = captureHeaders();
    applyRateLimitHeaders(setHeader, { allowed: true, remaining: 9, limit: 10, reset: 1700000000 });
    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('9');
    expect(headers['X-RateLimit-Reset']).toBe('1700000000');
    expect(headers['Retry-After']).toBeUndefined();
  });

  it("also sets Retry-After on rejected request", () => {
    const { headers, setHeader } = captureHeaders();
    const futureReset = Math.floor(Date.now() / 1000) + 3500;
    applyRateLimitHeaders(setHeader, { allowed: false, remaining: 0, limit: 10, reset: futureReset });
    expect(headers['Retry-After']).toBeDefined();
    const retryAfter = parseInt(headers['Retry-After'], 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3500);
  });

  it("Retry-After is at least 1 second", () => {
    const { headers, setHeader } = captureHeaders();
    // reset in the past (edge case)
    const pastReset = Math.floor(Date.now() / 1000) - 10;
    applyRateLimitHeaders(setHeader, { allowed: false, remaining: 0, limit: 5, reset: pastReset });
    expect(parseInt(headers['Retry-After'], 10)).toBeGreaterThanOrEqual(1);
  });

  it("does not set Retry-After for allowed requests with remaining 0", () => {
    // remaining=0 but allowed=true shouldn't get Retry-After
    const { headers, setHeader } = captureHeaders();
    applyRateLimitHeaders(setHeader, { allowed: true, remaining: 0, limit: 1, reset: 9999999999 });
    expect(headers['Retry-After']).toBeUndefined();
  });
});
