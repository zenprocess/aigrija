import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { Env } from "../lib/types";
import { CheckEndpoint } from "./openapi-check";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
});
afterEach(() => {
  vi.restoreAllMocks();
});


/** Compute the KV key for the current fixed window. */
function rlKey(identifier: string, windowSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const windowSlot = Math.floor(now / windowSeconds);
  return `rl:${identifier}:${windowSlot}`;
}
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

function makeR2(): R2Bucket {
  const store = new Map<string, string>();
  return {
    put: async (key: string, value: any, _opts?: any) => { store.set(key, typeof value === "string" ? value : ""); },
    get: async (key: string) => { const v = store.get(key); if (!v) return null; return { body: null, text: async () => v }; },
    delete: async () => {},
    head: async () => null,
    list: async () => ({ objects: [], truncated: false }),
  } as unknown as R2Bucket;
}

function makeAI() {
  return {
    run: vi.fn().mockResolvedValue({
      response: JSON.stringify({
        verdict: "phishing",
        confidence: 0.92,
        scam_type: "Bank impersonation",
        red_flags: ["Urgent language"],
        explanation: "This looks like phishing.",
        recommended_actions: ["Do not click links"],
      }),
    }),
  } as any;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    CACHE: makeKV(),
    STORAGE: makeR2(),
    AI: makeAI(),
    BASE_URL: "https://ai-grija.ro",
    GOOGLE_SAFE_BROWSING_KEY: undefined,
    VIRUSTOTAL_API_KEY: undefined,
    URLHAUS_AUTH_KEY: undefined,
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.post("/api/check", CheckEndpoint);
  return honoApp;
}

async function post(app: ReturnType<typeof buildApp>, body: unknown, env: any, ctx: ExecutionContext) {
  return app.fetch(
    new Request("http://localhost/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
    ctx
  );
}

describe("POST /api/check", () => {
  it("returns 200 for valid URL submission", async () => {
    const app = buildApp();
    const res = await post(app, { text: "Click here to verify your account urgently", url: "https://phishing-example.com" }, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.classification.verdict).toBeDefined();
    expect(body.rate_limit).toBeDefined();
  });

  it("returns 200 for valid image/text-only submission", async () => {
    const app = buildApp();
    const res = await post(app, { text: "Your bank account has been compromised, please verify immediately" }, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.matched_campaigns).toBeDefined();
  });

  it("returns fake safe response when honeypot field website is filled", async () => {
    const app = buildApp();
    const res = await post(app, { text: "Phishing text that should be flagged", website: "http://spam.bot" }, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification.verdict).toBe("likely_safe");
    expect(body.classification.confidence).toBeGreaterThan(0.9);
    expect(body.matched_campaigns).toEqual([]);
  });

  it("returns 400 for missing text field", async () => {
    const app = buildApp();
    const res = await post(app, {}, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 for text that is too short", async () => {
    const app = buildApp();
    const res = await post(app, { text: "ab" }, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json {{{",
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    const kv = makeKV({ [rlKey('unknown', 3600)]: '1000' }); // at test env limit (1000 req/hr)
    const app = buildApp();
    const res = await post(app, { text: "Click here to claim your prize immediately" }, makeEnv({ CACHE: kv }), makeCtx());
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("includes share_url in successful response", async () => {
    const app = buildApp();
    const res = await post(app, { text: "Urgent: verify your bank account now or it will be suspended" }, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.share_url).toBeDefined();
    expect(typeof body.share_url).toBe("string");
  });

  it("includes rate_limit object in successful response", async () => {
    const app = buildApp();
    const res = await post(app, { text: "You have won a prize, click here now" }, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.rate_limit.remaining).toBe("number");
    expect(typeof body.rate_limit.limit).toBe("number");
  });
});
