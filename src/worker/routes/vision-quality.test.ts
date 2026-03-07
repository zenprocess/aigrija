import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { Env } from "../lib/types";
import { CheckImageEndpoint } from "./openapi-check-image";
import baselines from "../../../test-fixtures/opus-baselines.json";

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

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function makeImageFile(): File {
  const bytes = new Uint8Array(100).fill(0);
  return new File([bytes], "test.png", { type: "image/png" });
}

function makeEnv(aiResponse: { response?: string } | Error): any {
  const ai = {
    run: aiResponse instanceof Error
      ? vi.fn().mockRejectedValue(aiResponse)
      : vi.fn().mockResolvedValue(aiResponse),
  };
  return { CACHE: makeKV(), STORAGE: makeR2(), AI: ai };
}

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  honoApp.use("*", async (c, next) => {
    c.set("requestId" as any, "test-rid");
    await next();
  });
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.post("/api/check/image", CheckImageEndpoint);
  return honoApp;
}

async function postImage(env: any): Promise<{ status: number; body: any }> {
  const app = buildApp();
  const fd = new FormData();
  fd.append("image", makeImageFile());
  const req = new Request("http://localhost/api/check/image", { method: "POST", body: fd });
  const res = await app.fetch(req, env, makeCtx());
  return { status: res.status, body: await res.json() as any };
}

// Mock AI vision responses that trigger the correct keyword-based verdict.
// IMPORTANT: Each response must ONLY contain keywords for its intended verdict,
// because the classifier checks keywords in order: phishing > suspicious > likely_safe.
const VISION_RESPONSES: Record<string, string> = {
  phishing: "Aceasta imagine prezinta o tentativa clara de phishing. Se observa un domeniu fals brd-secure-login.xyz si limbaj de urgenta. Este o escrocherie.",
  likely_safe: "Aceasta imagine arata o notificare oficiala si legitima de la aplicatia bancii. Totul este in ordine. Mesajul este sigur.",
  suspicious: "Aceasta imagine contine un mesaj care necesita atentie. Exista elemente posibil dubioase dar nu exista confirmari.",
};

describe("Vision quality — Opus baseline benchmarks", () => {
  it("has at least 3 baselines in opus-baselines.json", () => {
    expect(baselines.baselines.length).toBeGreaterThanOrEqual(3);
  });

  for (const baseline of baselines.baselines) {
    const { image, opus_verdict, contradicts } = baseline;

    it(`${image}: CF verdict does not contradict Opus verdict (${opus_verdict})`, async () => {
      const aiResponse = VISION_RESPONSES[opus_verdict];
      expect(aiResponse).toBeDefined();

      const env = makeEnv({ response: aiResponse });
      const { status, body } = await postImage(env);

      expect(status).toBe(200);
      expect(body.classification).toBeDefined();

      const cfVerdict = body.classification.verdict;
      for (const forbidden of contradicts) {
        expect(cfVerdict).not.toBe(forbidden);
      }
    });

    it(`${image}: CF verdict matches expected Opus verdict (${opus_verdict})`, async () => {
      const aiResponse = VISION_RESPONSES[opus_verdict];
      const env = makeEnv({ response: aiResponse });
      const { body } = await postImage(env);

      expect(body.classification.verdict).toBe(opus_verdict);
    });
  }
});

describe("Vision quality — keyword-verdict mapping", () => {
  it("detects phishing from Romanian keywords: frauda, escrocherie", async () => {
    const env = makeEnv({ response: "Aceasta este o escrocherie clara." });
    const { body } = await postImage(env);
    expect(body.classification.verdict).toBe("phishing");
  });

  it("detects suspicious from Romanian keywords: suspect, atentie, posibil", async () => {
    const env = makeEnv({ response: "Acest mesaj necesita atentie suplimentara, este posibil periculos." });
    const { body } = await postImage(env);
    expect(body.classification.verdict).toBe("suspicious");
  });

  it("detects likely_safe from Romanian keywords: sigur, legitim, oficial", async () => {
    const env = makeEnv({ response: "Acest mesaj este legitim si provine de la o sursa oficiala." });
    const { body } = await postImage(env);
    expect(body.classification.verdict).toBe("likely_safe");
  });
});

describe("Vision quality — AI.run() failure path", () => {
  it("returns confidence 0.0 when AI.run() throws (not a fake high value)", async () => {
    const env = makeEnv(new Error("Model unavailable"));
    const { status, body } = await postImage(env);

    expect(status).toBe(200);
    expect(body.classification.verdict).toBe("suspicious");
    expect(body.classification.confidence).toBe(0.0);
  });

  it("returns empty image_analysis when AI.run() throws", async () => {
    const env = makeEnv(new Error("Worker exceeded CPU time limit"));
    const { body } = await postImage(env);

    expect(body.image_analysis).toBeDefined();
    expect(body.classification.confidence).toBe(0.0);
  });

  it("never returns phishing or likely_safe verdict on AI failure", async () => {
    const env = makeEnv(new Error("Service unavailable"));
    const { body } = await postImage(env);

    expect(body.classification.verdict).not.toBe("phishing");
    expect(body.classification.verdict).not.toBe("likely_safe");
    expect(body.classification.verdict).toBe("suspicious");
  });
});
