import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { Env } from "../lib/types";
import { AlertsEndpoint } from "./openapi-alerts";
import { CAMPAIGNS } from "../data/campaigns";

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.get("/api/alerts", AlertsEndpoint);
  return honoApp;
}

function makeEnv(): any {
  return {};
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe("GET /api/alerts", () => {
  it("returns 200 with campaigns array", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.campaigns)).toBe(true);
  });

  it("returns all campaigns when no status filter", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts"), makeEnv(), makeCtx());
    const body = await res.json() as any;
    expect(body.campaigns.length).toBe(CAMPAIGNS.length);
  });

  it("filters campaigns by valid status", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts?status=active"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.campaigns.every((c: any) => c.status === "active")).toBe(true);
  });

  it("returns 400 for invalid status value", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts?status=invalid"), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("campaign objects have required fields", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/alerts"), makeEnv(), makeCtx());
    const body = await res.json() as any;
    if (body.campaigns.length > 0) {
      const c = body.campaigns[0];
      expect(c.id).toBeDefined();
      expect(c.slug).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.status).toBeDefined();
      expect(c.severity).toBeDefined();
    }
  });
});
