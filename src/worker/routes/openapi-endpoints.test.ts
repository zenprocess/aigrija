import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { Env } from "../lib/types";
import { CheckEndpoint } from "./openapi-check";
import { CheckImageEndpoint } from "./openapi-check-image";
import { ShareEndpoint } from "./openapi-share";
import { CheckQrEndpoint } from "./openapi-check-qr";
import { AlertsEndpoint, AlertsEmergingEndpoint, AlertsBySlugEndpoint } from "./openapi-alerts";
import { HealthEndpoint } from "./openapi-health";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
});
afterEach(() => {
  vi.restoreAllMocks();
});

// --- helpers ---

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

function makeR2(files: Record<string, string> = {}): R2Bucket {
  const store = new Map(Object.entries(files));
  return {
    put: async (key: string, value: any, _opts?: any) => { store.set(key, typeof value === "string" ? value : "binary"); },
    get: async (key: string) => {
      const v = store.get(key);
      if (!v) return null;
      return { body: new ReadableStream({ start(ctrl) { ctrl.enqueue(new TextEncoder().encode(v)); ctrl.close(); } }), text: async () => v } as any;
    },
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

function makeD1(): D1Database {
  return {
    prepare: () => ({
      first: async () => ({ 1: 1 }),
      run: vi.fn(), all: vi.fn(), raw: vi.fn(), bind: vi.fn(),
    }),
    exec: vi.fn(), batch: vi.fn(), dump: vi.fn(),
  } as unknown as D1Database;
}

function makeQueue(): Queue {
  return { send: vi.fn(), sendBatch: vi.fn() } as unknown as Queue;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    CACHE: makeKV(),
    STORAGE: makeR2(),
    AI: makeAI(),
    DB: makeD1(),
    DRAFT_QUEUE: makeQueue(),
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

// --- app builders ---

function buildCheckApp() {
  const app = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(app, { docs_url: null });
  openapi.post("/api/check", CheckEndpoint);
  return app;
}

function buildImageApp() {
  const app = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(app, { docs_url: null });
  openapi.post("/api/check/image", CheckImageEndpoint);
  return app;
}

function buildShareApp() {
  const app = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(app, { docs_url: null });
  openapi.get("/api/share/:id", ShareEndpoint);
  return app;
}

function buildQrApp() {
  const app = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(app, { docs_url: null });
  openapi.post("/api/check-qr", CheckQrEndpoint);
  return app;
}

function buildAlertsApp() {
  const app = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(app, { docs_url: null });
  openapi.get("/api/alerts", AlertsEndpoint);
  openapi.get("/api/alerts/emerging", AlertsEmergingEndpoint);
  openapi.get("/api/alerts/:slug", AlertsBySlugEndpoint);
  return app;
}

function buildHealthApp() {
  const app = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(app, { docs_url: null });
  openapi.get("/health", HealthEndpoint);
  return app;
}

// --- POST /api/check (CheckEndpoint) ---

describe("CheckEndpoint — POST /api/check", () => {
  it("returns 200 with classification for valid text", async () => {
    const app = buildCheckApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Click here to verify your account urgently" }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.classification.verdict).toBeDefined();
    expect(body.rate_limit).toBeDefined();
    expect(body.share_url).toBeDefined();
  });

  it("returns 400 when text field is missing", async () => {
    const app = buildCheckApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for text shorter than 3 chars", async () => {
    const app = buildCheckApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "ab" }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const app = buildCheckApp();
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
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const kv = makeKV({ [rlKey("unknown", 3600)]: "1000" });
    const app = buildCheckApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Click here to claim your prize immediately" }),
      }),
      makeEnv({ CACHE: kv }),
      makeCtx()
    );
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toBeDefined();
  });

  it("returns fake safe response when honeypot field is filled", async () => {
    const app = buildCheckApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Phishing text", website: "http://spam.bot" }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification.verdict).toBe("likely_safe");
  });

  it("includes matched_campaigns in response", async () => {
    const app = buildCheckApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Urgent: verify your bank account now" }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.matched_campaigns)).toBe(true);
  });
});

// --- POST /api/check/image (CheckImageEndpoint) ---

describe("CheckImageEndpoint — POST /api/check/image", () => {
  function makeVisionAI(response: string = "Aceasta pare a fi phishing") {
    return {
      run: vi.fn().mockResolvedValue({ response }),
    } as any;
  }

  it("returns 200 for valid image upload", async () => {
    const formData = new FormData();
    const imageBlob = new Blob([new Uint8Array(100)], { type: "image/png" });
    formData.append("image", new File([imageBlob], "test.png", { type: "image/png" }));

    const app = buildImageApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check/image", { method: "POST", body: formData }),
      makeEnv({ AI: makeVisionAI() }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.classification.verdict).toBeDefined();
    expect(body.image_analysis).toBeDefined();
    expect(body.rate_limit).toBeDefined();
  });

  it("returns 200 with text context", async () => {
    const formData = new FormData();
    const imageBlob = new Blob([new Uint8Array(100)], { type: "image/jpeg" });
    formData.append("image", new File([imageBlob], "test.jpg", { type: "image/jpeg" }));
    formData.append("text", "Am primit acest mesaj de la banca");

    const app = buildImageApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check/image", { method: "POST", body: formData }),
      makeEnv({ AI: makeVisionAI("Mesaj suspect de phishing") }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
  });

  it("returns 400 when image field is missing", async () => {
    const formData = new FormData();
    formData.append("text", "some text");

    const app = buildImageApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check/image", { method: "POST", body: formData }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for unsupported image type", async () => {
    const formData = new FormData();
    const gifBlob = new Blob([new Uint8Array(100)], { type: "image/gif" });
    formData.append("image", new File([gifBlob], "test.gif", { type: "image/gif" }));

    const app = buildImageApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check/image", { method: "POST", body: formData }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 429 when rate limited", async () => {
    const kv = makeKV({ [rlKey("unknown", 3600)]: "1000" });
    const formData = new FormData();
    const imageBlob = new Blob([new Uint8Array(100)], { type: "image/png" });
    formData.append("image", new File([imageBlob], "test.png", { type: "image/png" }));

    const app = buildImageApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check/image", { method: "POST", body: formData }),
      makeEnv({ CACHE: kv }),
      makeCtx()
    );
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("handles vision model failure gracefully", async () => {
    const failAI = {
      run: vi.fn().mockRejectedValue(new Error("Vision model unavailable")),
    } as any;

    const formData = new FormData();
    const imageBlob = new Blob([new Uint8Array(100)], { type: "image/png" });
    formData.append("image", new File([imageBlob], "test.png", { type: "image/png" }));

    const app = buildImageApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check/image", { method: "POST", body: formData }),
      makeEnv({ AI: failAI }),
      makeCtx()
    );
    // Should still return 200 with a fallback classification
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.classification.verdict).toBe("suspicious");
  });
});

// --- GET /api/share/:id (ShareEndpoint) ---

describe("ShareEndpoint — GET /api/share/:id", () => {
  it("returns SVG for valid UUID with existing card", async () => {
    const uuid = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><text>test</text></svg>';
    const r2 = makeR2({ [`share/${uuid}.svg`]: svgContent });

    const app = buildShareApp();
    const res = await app.fetch(
      new Request(`http://localhost/api/share/${uuid}`),
      makeEnv({ STORAGE: r2 }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  it("returns 400 for invalid UUID format", async () => {
    const app = buildShareApp();
    const res = await app.fetch(
      new Request("http://localhost/api/share/not-a-uuid"),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when card is not found", async () => {
    const uuid = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const app = buildShareApp();
    const res = await app.fetch(
      new Request(`http://localhost/api/share/${uuid}`),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

// --- POST /api/check-qr (CheckQrEndpoint) ---

describe("CheckQrEndpoint — POST /api/check-qr", () => {
  it("returns 200 with url_analysis for valid URL", async () => {
    const app = buildQrApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_data: "https://example.com/some-path" }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.url_analysis).toBeDefined();
    expect(body.rate_limit).toBeDefined();
  });

  it("returns 400 when qr_data field is missing", async () => {
    const app = buildQrApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it("returns 422 for non-URL QR data", async () => {
    const app = buildQrApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_data: "just some random text not a url" }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.error.code).toBe("INVALID_QR");
  });

  it("returns 422 for non-http protocol", async () => {
    const app = buildQrApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_data: "ftp://files.example.com/data" }),
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(422);
  });

  it("returns 400 for invalid JSON body", async () => {
    const app = buildQrApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      }),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 429 when rate limited", async () => {
    const kv = makeKV({ [rlKey("unknown", 3600)]: "1000" });
    const app = buildQrApp();
    const res = await app.fetch(
      new Request("http://localhost/api/check-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_data: "https://example.com" }),
      }),
      makeEnv({ CACHE: kv }),
      makeCtx()
    );
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

// --- GET /api/alerts (AlertsEndpoint, AlertsEmergingEndpoint, AlertsBySlugEndpoint) ---

describe("AlertsEndpoint — GET /api/alerts", () => {
  it("returns 200 with campaigns array", async () => {
    const app = buildAlertsApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  it("filters by valid status query param", async () => {
    const app = buildAlertsApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts?status=active"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.campaigns.every((c: any) => c.status === "active")).toBe(true);
  });

  it("returns 400 for invalid status", async () => {
    const app = buildAlertsApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts?status=bogus"), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("AlertsBySlugEndpoint — GET /api/alerts/:slug", () => {
  it("returns 404 for non-existent slug", async () => {
    const app = buildAlertsApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts/non-existent-slug"), makeEnv(), makeCtx());
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("AlertsEmergingEndpoint — GET /api/alerts/emerging", () => {
  it("returns 200 with emerging array", async () => {
    const app = buildAlertsApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts/emerging"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.emerging).toBeDefined();
    expect(Array.isArray(body.emerging)).toBe(true);
  });
});

// --- GET /health (HealthEndpoint) ---

describe("HealthEndpoint — GET /health", () => {
  it("returns 200 when all components are healthy", async () => {
    const app = buildHealthApp();
    const res = await app.fetch(new Request("http://localhost/health"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("healthy");
    expect(body.components).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("returns 503 when AI binding is missing", async () => {
    const app = buildHealthApp();
    const res = await app.fetch(new Request("http://localhost/health"), makeEnv({ AI: null }), makeCtx());
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.components.ai.status).toBe("unhealthy");
  });
});

// --- rate limit response format consistency ---

describe("Rate limit response format", () => {
  it("rate limit error has consistent shape across endpoints", async () => {
    const kv = makeKV({ [rlKey("unknown", 3600)]: "1000" });

    const checkApp = buildCheckApp();
    const checkRes = await checkApp.fetch(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Test rate limit response format check" }),
      }),
      makeEnv({ CACHE: kv }),
      makeCtx()
    );
    expect(checkRes.status).toBe(429);
    const checkBody = await checkRes.json() as any;
    expect(checkBody.error).toBeDefined();
    expect(checkBody.error.code).toBe("RATE_LIMITED");
    expect(typeof checkBody.error.message).toBe("string");
  });
});
