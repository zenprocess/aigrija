import { describe, it, expect, vi } from "vitest";
import { upload } from "./upload";


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
    const kv = makeKV({ [rlKey('unknown', 3600)]: '20' });
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

describe("AI fallback/degradation", () => {
  it("returns valid JSON when vision AI.run() throws an error (no text context)", async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error("Model unavailable")) };
    const env = makeEnv({ AI: ai });
    const fd = new FormData();
    fd.append("image", makeImageFile());
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.classification.verdict).toBe("suspicious");
    expect(["phishing", "suspicious", "likely_safe"]).toContain(body.classification.verdict);
    expect(body.classification.model_used).toBeDefined();
    expect(body.classification.ai_disclaimer).toBeDefined();
    expect(body.classification.recommended_actions).toBeInstanceOf(Array);
    expect(body.rate_limit).toBeDefined();
  });

  it("returns valid JSON when vision AI.run() times out", async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error("Worker exceeded CPU time limit")) };
    const env = makeEnv({ AI: ai });
    const fd = new FormData();
    fd.append("image", makeImageFile());
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    expect(body.classification.verdict).toBe("suspicious");
    expect(body.classification.confidence).toBeGreaterThanOrEqual(0);
    expect(body.classification.confidence).toBeLessThanOrEqual(1);
    expect(body.image_analysis).toBeDefined();
    expect(typeof body.image_analysis).toBe("string");
  });

  it("sets confidence to 0.60 (not based on failed analysis) when vision fails without text context", async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error("Model unavailable")) };
    const env = makeEnv({ AI: ai });
    const fd = new FormData();
    fd.append("image", makeImageFile());
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, env, makeCtx());
    const body = await res.json() as any;
    // When vision fails, visionVerdict defaults to 'suspicious' → confidence should be 0.60
    // This proves confidence is based on the fallback default, not the failed AI output
    expect(body.classification.confidence).toBe(0.60);
    expect(body.classification.verdict).toBe("suspicious");
  });

  it("falls back to text classifier when vision fails but text context is provided", async () => {
    // Vision fails, but text classifier should still work
    const classifierResult = {
      response: JSON.stringify({
        verdict: "phishing",
        confidence: 0.95,
        scam_type: "phishing-bancar",
        impersonated_entity: "BRD",
        red_flags: ["domeniu fals"],
        explanation: "Mesaj de phishing detectat.",
        recommended_actions: ["Nu accesati link-ul"],
      }),
    };
    const ai = {
      run: vi.fn()
        // First call: vision model → throws
        .mockRejectedValueOnce(new Error("Vision model unavailable"))
        // Second call: text classifier → succeeds
        .mockResolvedValueOnce(classifierResult),
    };
    const env = makeEnv({ AI: ai });
    const fd = new FormData();
    fd.append("image", makeImageFile());
    fd.append("text", "Contul tau BRD a fost blocat. Acceseaza urgent: brd-secure-login.xyz");
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.classification).toBeDefined();
    // Text classifier should produce a valid result despite vision failure
    expect(["phishing", "suspicious", "likely_safe"]).toContain(body.classification.verdict);
    expect(body.classification.confidence).toBeGreaterThan(0);
    expect(body.classification.model_used).toBeDefined();
  });

  it("does not use vision-derived confidence when vision AI returns empty response", async () => {
    // Vision returns empty/null — no description or response field
    const ai = { run: vi.fn().mockResolvedValue({}) };
    const env = makeEnv({ AI: ai });
    const fd = new FormData();
    fd.append("image", makeImageFile());
    const req = new Request("http://localhost/api/check/image", {
      method: "POST",
      body: fd,
    });
    const res = await upload.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // When vision returns empty, imageAnalysis is the fallback string
    // visionVerdict remains 'suspicious' (default), confidence should be 0.60
    expect(body.classification.verdict).toBe("suspicious");
    expect(body.classification.confidence).toBe(0.60);
  });
});
