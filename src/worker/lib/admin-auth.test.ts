import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminAuth } from "../lib/admin-auth";
import { Hono } from "hono";

function makeApp(envOverrides: Record<string, unknown> = {}) {
  const app = new Hono<{ Bindings: any }>();
  app.use("/admin/*", adminAuth as any);
  app.get("/admin/test", (c) => c.json({ ok: true, email: c.get("adminEmail" as any) }));
  return app;
}

function makeKV(data: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(data));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    CACHE: makeKV(),
    BASE_URL: "https://example.com",
    ...overrides,
  };
}

describe("adminAuth middleware", () => {
  it("dev mode bypass works on localhost when no team domain and no JWT", async () => {
    const app = makeApp();
    const req = new Request("http://localhost/admin/test");
    const res = await app.fetch(req, makeEnv({ BASE_URL: "http://localhost:8787", CF_ACCESS_TEAM_DOMAIN: undefined }));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.email).toBe("dev@localhost");
  });

  it("dev mode bypass works on 127.0.0.1", async () => {
    const app = makeApp();
    const req = new Request("http://localhost/admin/test");
    const res = await app.fetch(req, makeEnv({ BASE_URL: "http://127.0.0.1:8787", CF_ACCESS_TEAM_DOMAIN: undefined }));
    expect(res.status).toBe(200);
  });

  it("production without CF_ACCESS_TEAM_DOMAIN and no JWT returns 401", async () => {
    const app = makeApp();
    const req = new Request("http://localhost/admin/test");
    const res = await app.fetch(req, makeEnv({ BASE_URL: "https://aigrija.ro", CF_ACCESS_TEAM_DOMAIN: undefined }));
    expect(res.status).toBe(401);
  });

  it("missing JWT with team domain set returns 401", async () => {
    const app = makeApp();
    const req = new Request("http://localhost/admin/test");
    const res = await app.fetch(req, makeEnv({ CF_ACCESS_TEAM_DOMAIN: "myteam" }));
    expect(res.status).toBe(401);
  });

  it("invalid JWT (malformed) returns 401", async () => {
    const app = makeApp();
    const req = new Request("http://localhost/admin/test", {
      headers: { "CF-Access-Jwt-Assertion": "not.a.valid.jwt.at.all" },
    });
    const res = await app.fetch(req, makeEnv({ CF_ACCESS_TEAM_DOMAIN: "myteam" }));
    expect(res.status).toBe(401);
  });

  it("JWT with no team domain is rejected — unverified JWTs are never trusted", async () => {
    const app = makeApp();
    const payload = { email: "admin@example.com", sub: "user123" };
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const fakeJwt = "header." + payloadB64 + ".signature";
    const req = new Request("http://localhost/admin/test", {
      headers: { "CF-Access-Jwt-Assertion": fakeJwt },
    });
    const res = await app.fetch(req, makeEnv({ CF_ACCESS_TEAM_DOMAIN: undefined }));
    // No team domain => cannot verify signature => always 401
    expect(res.status).toBe(401);
  });

  it("JWT with no team domain and no email returns 401", async () => {
    const app = makeApp();
    const payload = { sub: "user123" };
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const fakeJwt = "header." + payloadB64 + ".signature";
    const req = new Request("http://localhost/admin/test", {
      headers: { "CF-Access-Jwt-Assertion": fakeJwt },
    });
    const res = await app.fetch(req, makeEnv({ CF_ACCESS_TEAM_DOMAIN: undefined }));
    expect(res.status).toBe(401);
  });
});
