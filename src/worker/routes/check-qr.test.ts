import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
});
afterEach(() => {
  vi.restoreAllMocks();
});
import { checkQr } from "./check-qr";

function makeKV(data: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(data));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: any) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    CACHE: makeKV(),
    GOOGLE_SAFE_BROWSING_KEY: undefined,
    VIRUSTOTAL_API_KEY: undefined,
    URLHAUS_AUTH_KEY: undefined,
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe("POST /api/check-qr", () => {
  it("returns 400 when qr_data is missing", async () => {
    const req = new Request("http://localhost/api/check-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await checkQr.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when qr_data is empty string", async () => {
    const req = new Request("http://localhost/api/check-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: "   " }),
    });
    const res = await checkQr.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 422 for non-URL qr_data", async () => {
    const req = new Request("http://localhost/api/check-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: "just plain text, not a URL" }),
    });
    const res = await checkQr.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.error.code).toBe("INVALID_QR");
    expect(body.is_url).toBe(false);
  });

  it("returns 200 with url_analysis for valid URL", async () => {
    const req = new Request("http://localhost/api/check-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: "https://example.com" }),
    });
    const res = await checkQr.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.url_analysis).toBeDefined();
  });

  it("returns 429 when rate limited", async () => {
    // Seed counter at the check-qr limit (30) so next request is rejected
    const kv = makeKV({ "rl:unknown": "30" }); // at check-qr limit
    const env = makeEnv({ CACHE: kv });
    const req = new Request("http://localhost/api/check-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: "https://example.com" }),
    });
    const res = await checkQr.fetch(req, env, makeCtx());
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/check-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {{{",
    });
    const res = await checkQr.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("sets rate limit headers", async () => {
    const req = new Request("http://localhost/api/check-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: "https://example.com" }),
    });
    const res = await checkQr.fetch(req, makeEnv(), makeCtx());
    expect(res.headers.get("X-RateLimit-Limit")).not.toBeNull();
    expect(res.headers.get("X-RateLimit-Remaining")).not.toBeNull();
    expect(res.headers.get("X-RateLimit-Reset")).not.toBeNull();
  });
});
