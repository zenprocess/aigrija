import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { Env } from "../lib/types";
import { HealthEndpoint } from "./openapi-health";

function makeR2(opts: { throws?: boolean } = {}): R2Bucket {
  return {
    head: async (_key: string) => {
      if (opts.throws) throw new Error("R2 error");
      return null;
    },
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
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

function makeAI(): Ai {
  return {} as unknown as Ai;
}

function buildApp(env: any) {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.get("/health", HealthEndpoint);
  return honoApp;
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe("GET /health", () => {
  it("returns 200 when all components are healthy", async () => {
    const env = { CACHE: makeKV(), AI: makeAI(), STORAGE: makeR2() };
    const app = buildApp(env);
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("healthy");
    expect(body.components.kv.status).toBe("healthy");
    expect(body.components.ai.status).toBe("healthy");
    expect(body.components.r2.status).toBe("healthy");
  });

  it("returns 503 when KV is unhealthy", async () => {
    const env = { CACHE: makeKV({ throws: true }), AI: makeAI(), STORAGE: makeR2() };
    const app = buildApp(env);
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.status).toBe("unhealthy");
    expect(body.components.kv.status).toBe("unhealthy");
  });

  it("returns 503 when AI binding is missing", async () => {
    const env = { CACHE: makeKV(), AI: null, STORAGE: makeR2() };
    const app = buildApp(env);
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.ai.status).toBe("unhealthy");
  });

  it("returns 503 when R2 is unhealthy", async () => {
    const env = { CACHE: makeKV(), AI: makeAI(), STORAGE: makeR2({ throws: true }) };
    const app = buildApp(env);
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.r2.status).toBe("unhealthy");
  });

  it("response has version and timestamp fields", async () => {
    const env = { CACHE: makeKV(), AI: makeAI(), STORAGE: makeR2() };
    const app = buildApp(env);
    const res = await app.fetch(new Request("http://localhost/health"), env, makeCtx());
    const body = await res.json() as any;
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});
