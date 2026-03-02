import { describe, it, expect, vi } from "vitest";
import { share } from "./share";

function makeR2(objects: Record<string, string> = {}): R2Bucket {
  return {
    get: async (key: string) => {
      const content = objects[key];
      if (!content) return null;
      return { body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(content)); c.close(); } }) };
    },
    put: vi.fn(),
    head: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  } as unknown as R2Bucket;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { STORAGE: makeR2(), ...overrides };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /api/share/:id", () => {
  it("returns 400 for invalid UUID", async () => {
    const res = await share.fetch(new Request("http://localhost/api/share/not-a-uuid"), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.message).toContain("UUID");
  });

  it("returns 404 when neither SVG nor PNG exists", async () => {
    const res = await share.fetch(new Request(`http://localhost/api/share/${VALID_UUID}`), makeEnv(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns SVG when SVG exists", async () => {
    const r2 = makeR2({ [`share/${VALID_UUID}.svg`]: "<svg/>" });
    const res = await share.fetch(new Request(`http://localhost/api/share/${VALID_UUID}`), makeEnv({ STORAGE: r2 }), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(res.headers.get("Cache-Control")).toContain("max-age=2592000");
  });

  it("falls back to PNG when SVG is missing", async () => {
    const r2 = makeR2({ [`share/${VALID_UUID}.png`]: "PNG_DATA" });
    const res = await share.fetch(new Request(`http://localhost/api/share/${VALID_UUID}`), makeEnv({ STORAGE: r2 }), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});
