import { describe, it, expect, vi } from "vitest";
import { weekly } from "./weekly";

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { ...overrides };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe("GET /api/weekly", () => {
  it("returns 200", async () => {
    const res = await weekly.fetch(new Request("http://localhost/api/weekly"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
  });

  it("returns ok:true with items array", async () => {
    const res = await weekly.fetch(new Request("http://localhost/api/weekly"), makeEnv(), makeCtx());
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
  });
});
