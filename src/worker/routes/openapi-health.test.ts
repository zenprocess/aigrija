import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { Env } from "../lib/types";
import { HealthEndpoint, DeepHealthEndpoint } from "./openapi-health";

function makeR2(opts: { throws?: boolean } = {}): R2Bucket {
  return {
    head: async (_key: string) => {
      if (opts.throws) throw new Error("R2 error");
      return null;
    },
    get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn(),
  } as unknown as R2Bucket;
}

function makeKV(opts: { throws?: boolean } = {}): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => {
      if (opts.throws) throw new Error("KV error");
      return store.get(key) ?? null;
    },
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function makeAI(): Ai { return {} as unknown as Ai; }

function makeD1(opts: { throws?: boolean } = {}): D1Database {
  return {
    prepare: () => ({
      first: async () => {
        if (opts.throws) throw new Error("D1 error");
        return { 1: 1 };
      },
      run: vi.fn(), all: vi.fn(), raw: vi.fn(), bind: vi.fn(),
    }),
    exec: vi.fn(), batch: vi.fn(), dump: vi.fn(),
  } as unknown as D1Database;
}

function makeQueue(): Queue { return { send: vi.fn(), sendBatch: vi.fn() } as unknown as Queue; }

function makeCtx(): any {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
}

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.get("/health", HealthEndpoint);
  openapi.get("/health/deep", DeepHealthEndpoint);
  return honoApp;
}

function fullEnv(overrides: Record<string, unknown> = {}) {
  return {
    CACHE: makeKV(), AI: makeAI(), STORAGE: makeR2(),
    DB: makeD1(), DRAFT_QUEUE: makeQueue(),
    BASE_URL: "http://localhost",
    ...overrides,
  };
}

describe("GET /health", () => {
  it("returns 200 when all components are healthy", async () => {
    const env = fullEnv();
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("healthy");
    expect(body.components.kv.status).toBe("healthy");
    expect(body.components.ai.status).toBe("healthy");
    expect(body.components.r2.status).toBe("healthy");
    expect(body.components.d1.status).toBe("healthy");
    expect(body.components.queue.status).toBe("healthy");
  });

  it("returns 503 when KV is unhealthy", async () => {
    const env = fullEnv({ CACHE: makeKV({ throws: true }) });
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.kv.status).toBe("unhealthy");
    expect(body.components.kv.error).toBe("KV error");
  });

  it("returns 503 when AI binding is missing", async () => {
    const env = fullEnv({ AI: null });
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.ai.status).toBe("unhealthy");
  });

  it("returns 503 when R2 is unhealthy", async () => {
    const env = fullEnv({ STORAGE: makeR2({ throws: true }) });
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.r2.status).toBe("unhealthy");
  });

  it("returns 503 when D1 is unhealthy", async () => {
    const env = fullEnv({ DB: makeD1({ throws: true }) });
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.d1.status).toBe("unhealthy");
    expect(body.components.d1.error).toBe("D1 error");
  });

  it("returns 503 when Queue binding is missing", async () => {
    const env = fullEnv({ DRAFT_QUEUE: null });
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.queue.status).toBe("unhealthy");
  });

  it("response has version and timestamp fields", async () => {
    const env = fullEnv();
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    const body = await res.json() as any;
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});

describe("GET /health/deep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with summary when all probes pass", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const path = new URL(url).pathname;
      if (path === '/health') return new Response(JSON.stringify({ status: 'healthy', components: {} }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/alerts') return new Response(JSON.stringify({ campaigns: [] }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/counter') return new Response(JSON.stringify({ total_checks: 42 }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/stats') return new Response(JSON.stringify({ checks: 100 }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/feed/latest') return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/quiz') return new Response(JSON.stringify({ questions: [], total: 0, lang: 'ro' }), { headers: { 'content-type': 'application/json' } });
      if (path === '/sitemap.xml') return new Response('<?xml version="1.0"?><urlset></urlset>', { headers: { 'content-type': 'application/xml' } });
      if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /admin/\nSitemap: http://localhost/sitemap.xml', { headers: { 'content-type': 'text/plain' } });
      return new Response('Not Found', { status: 404 });
    });
    vi.stubGlobal('fetch', mockFetch);

    const env = fullEnv();
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health/deep"), env, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("healthy");
    expect(body.summary).toBe("8/8 endpoints healthy.");
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
    expect(Object.keys(body.endpoints)).toHaveLength(8);
  });

  it("returns 503 with failed endpoint details when a probe fails", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const path = new URL(url).pathname;
      if (path === '/api/counter') return new Response('Internal Server Error', { status: 500 });
      if (path === '/health') return new Response(JSON.stringify({ status: 'healthy', components: {} }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/alerts') return new Response(JSON.stringify({ campaigns: [] }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/stats') return new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/feed/latest') return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/quiz') return new Response(JSON.stringify({ questions: [], total: 0, lang: 'ro' }), { headers: { 'content-type': 'application/json' } });
      if (path === '/sitemap.xml') return new Response('<urlset></urlset>', { headers: { 'content-type': 'application/xml' } });
      if (path === '/robots.txt') return new Response('User-agent: *\nSitemap: /sitemap.xml', { headers: { 'content-type': 'text/plain' } });
      return new Response('OK');
    });
    vi.stubGlobal('fetch', mockFetch);

    const env = fullEnv();
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health/deep"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.status).toBe("unhealthy");
    expect(body.endpoints['/api/counter'].status).toBe("unhealthy");
    expect(body.endpoints['/api/counter'].error).toBe("HTTP 500");
    expect(body.summary).toContain("Failed:");
    expect(body.summary).toContain("/api/counter");
  });

  it("detects invalid payload even on 200 response", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const path = new URL(url).pathname;
      // /api/counter returns 200 but wrong shape (missing total_checks)
      if (path === '/api/counter') return new Response(JSON.stringify({ count: 42 }), { headers: { 'content-type': 'application/json' } });
      if (path === '/health') return new Response(JSON.stringify({ status: 'healthy', components: {} }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/alerts') return new Response(JSON.stringify({ campaigns: [] }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/stats') return new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/feed/latest') return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/quiz') return new Response(JSON.stringify({ questions: [], total: 0, lang: 'ro' }), { headers: { 'content-type': 'application/json' } });
      if (path === '/sitemap.xml') return new Response('<urlset></urlset>', { headers: { 'content-type': 'application/xml' } });
      if (path === '/robots.txt') return new Response('User-agent: *\nSitemap: /sitemap.xml', { headers: { 'content-type': 'text/plain' } });
      return new Response('OK');
    });
    vi.stubGlobal('fetch', mockFetch);

    const env = fullEnv();
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health/deep"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.endpoints['/api/counter'].error).toBe("Missing or invalid total_checks field");
  });

  it("human-readable summary lists all failures", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const path = new URL(url).pathname;
      if (path === '/api/counter') return new Response('', { status: 500 });
      if (path === '/api/quiz') return new Response('', { status: 502 });
      if (path === '/health') return new Response(JSON.stringify({ status: 'healthy', components: {} }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/alerts') return new Response(JSON.stringify({ campaigns: [] }), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/stats') return new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } });
      if (path === '/api/feed/latest') return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      if (path === '/sitemap.xml') return new Response('<urlset></urlset>', { headers: { 'content-type': 'application/xml' } });
      if (path === '/robots.txt') return new Response('User-agent: *\nSitemap: /sitemap.xml', { headers: { 'content-type': 'text/plain' } });
      return new Response('OK');
    });
    vi.stubGlobal('fetch', mockFetch);

    const env = fullEnv();
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/health/deep"), env, makeCtx());
    const body = await res.json() as any;
    expect(body.summary).toBe("6/8 endpoints healthy. Failed: /api/counter (HTTP 500), /api/quiz (HTTP 502)");
  });
});
