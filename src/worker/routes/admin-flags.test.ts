import { describe, it, expect, vi } from "vitest";
import { adminFlags } from "./admin-flags";

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
  return { CACHE: makeKV(), ADMIN_API_KEY: "test-secret-key", ...overrides };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe("Admin Flags auth middleware", () => {
  it("returns 503 when ADMIN_API_KEY is empty", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags", { headers: { Authorization: "Bearer x" } }), makeEnv({ ADMIN_API_KEY: "" }), makeCtx());
    expect(res.status).toBe(503);
  });

  it("returns 401 when Bearer token is wrong", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags", { headers: { Authorization: "Bearer wrong" } }), makeEnv(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags"), makeEnv(), makeCtx());
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/flags", () => {
  it("returns all flags with defaults", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags", { headers: { Authorization: "Bearer test-secret-key" } }), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.flags).toBeDefined();
    expect(typeof body.flags.phishtank_enabled).toBe("boolean");
    expect(typeof body.flags.gemma_fallback_enabled).toBe("boolean");
  });

  it("reflects KV-overridden flag values", async () => {
    const kv = makeKV({ "ff:phishtank_enabled": "0" });
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags", { headers: { Authorization: "Bearer test-secret-key" } }), makeEnv({ CACHE: kv }), makeCtx());
    const body = await res.json() as any;
    expect(body.flags.phishtank_enabled).toBe(false);
  });
});

describe("POST /api/admin/flags/:name", () => {
  it("sets a flag to true", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags/phishtank_enabled", { method: "POST", headers: { Authorization: "Bearer test-secret-key", "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true }) }), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.flag).toBe("phishtank_enabled");
    expect(body.enabled).toBe(true);
  });

  it("sets a flag to false", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags/gemma_fallback_enabled", { method: "POST", headers: { Authorization: "Bearer test-secret-key", "Content-Type": "application/json" }, body: JSON.stringify({ enabled: false }) }), makeEnv(), makeCtx());
    const body = await res.json() as any;
    expect(body.enabled).toBe(false);
  });

  it("returns 400 when enabled field is missing", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags/phishtank_enabled", { method: "POST", headers: { Authorization: "Bearer test-secret-key", "Content-Type": "application/json" }, body: JSON.stringify({}) }), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 when enabled is not a boolean", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags/phishtank_enabled", { method: "POST", headers: { Authorization: "Bearer test-secret-key", "Content-Type": "application/json" }, body: JSON.stringify({ enabled: "yes" }) }), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await adminFlags.fetch(new Request("http://localhost/api/admin/flags/phishtank_enabled", { method: "POST", headers: { Authorization: "Bearer test-secret-key", "Content-Type": "application/json" }, body: "not-json" }), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });
});
