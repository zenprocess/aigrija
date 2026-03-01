import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../lib/rate-limiter";

function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: any) => { store.set(key, value); },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

describe("checkRateLimit", () => {
  it("first request is allowed with remaining = limit - 1", async () => {
    const kv = makeKV();
    const result = await checkRateLimit(kv, "127.0.0.1", 5, 3600);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("returns allowed: false when at limit", async () => {
    const kv = makeKV();
    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv, "10.0.0.1", 5, 3600);
    }
    const result = await checkRateLimit(kv, "10.0.0.1", 5, 3600);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("different IPs are tracked separately", async () => {
    const kv = makeKV();
    // Exhaust ip1
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv, "1.1.1.1", 5, 3600);
    }
    const ip1 = await checkRateLimit(kv, "1.1.1.1", 5, 3600);
    const ip2 = await checkRateLimit(kv, "2.2.2.2", 5, 3600);
    expect(ip1.allowed).toBe(false);
    expect(ip2.allowed).toBe(true);
  });

  it("increments counter on each allowed request", async () => {
    const kv = makeKV();
    const r1 = await checkRateLimit(kv, "3.3.3.3", 10, 3600);
    const r2 = await checkRateLimit(kv, "3.3.3.3", 10, 3600);
    const r3 = await checkRateLimit(kv, "3.3.3.3", 10, 3600);
    expect(r1.remaining).toBe(9);
    expect(r2.remaining).toBe(8);
    expect(r3.remaining).toBe(7);
  });

  it("returns correct limit in response", async () => {
    const kv = makeKV();
    const result = await checkRateLimit(kv, "4.4.4.4", 20, 3600);
    expect(result.limit).toBe(20);
  });
});
