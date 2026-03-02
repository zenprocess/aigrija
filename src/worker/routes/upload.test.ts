import { describe, it, expect, vi } from "vitest";
import { upload } from "./upload";

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
  return {
    head: async () => null,
    get: async () => null,
    put: async () => null,
    delete: async () => {},
    list: async () => ({ objects: [], truncated: false }),
    createMultipartUpload: async () => ({}),
    resumeMultipartUpload: async () => ({}),
  } as unknown as R2Bucket;
}

function makeAI(response = { description: "Mesaj legitim" }): any {
  return { run: vi.fn().mockResolvedValue(response) };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    CACHE: makeKV(),
    STORAGE: makeR2(),
    AI: makeAI(),
    ...overrides,
  };
}

function makeImageFile(opts: { size?: number; type?: string; name?: string } = {}): File {
  const size = opts.size ?? 100;
  const type = opts.type ?? "image/png";
  const name = opts.name ?? "test.png";
  const bytes = new Uint8Array(size).fill(0);
  return new File([bytes], name, { type });
}

describe("POST /api/check/image", () => {
  it("returns 400 when no image field provided", async () => {
    const fd = new FormData();
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for unsupported content type (gif)", async () => {
    const fd = new FormData();
    fd.append("image", makeImageFile({ type: "image/gif", name: "anim.gif" }));
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for oversized image (>5MB)", async () => {
    const fd = new FormData();
    fd.append("image", makeImageFile({ size: 6 * 1024 * 1024, type: "image/png" }));
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 with classification for valid PNG image", async () => {
    const fd = new FormData();
    fd.append("image", makeImageFile({ type: "image/png" }));
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.image_analysis).toBeDefined();
  });

  it("returns 200 for valid JPEG image", async () => {
    const fd = new FormData();
    fd.append("image", makeImageFile({ type: "image/jpeg", name: "photo.jpg" }));
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
  });

  it("returns 200 for valid WEBP image", async () => {
    const fd = new FormData();
    fd.append("image", makeImageFile({ type: "image/webp", name: "img.webp" }));
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limited", async () => {
    const kv = makeKV({ "rl:unknown": "20" });
    const env = makeEnv({ CACHE: kv });
    const fd = new FormData();
    fd.append("image", makeImageFile());
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, env, makeCtx());
    expect(res.status).toBe(429);
  });
});
