import { describe, it, expect } from "vitest";
import { getFlag, setFlag } from "../lib/feature-flags";

function makeEnv(kvData: Record<string, string> = {}): any {
  const store = new Map(Object.entries(kvData));
  return {
    CACHE: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => { store.set(key, value); },
      delete: async () => {},
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
    } as unknown as KVNamespace,
  };
}

describe("getFlag", () => {
  it("returns true when KV has '1'", async () => {
    const env = makeEnv({ "ff:phishtank_enabled": "1" });
    const result = await getFlag(env, "phishtank_enabled", false);
    expect(result).toBe(true);
  });

  it("returns false when KV has '0'", async () => {
    const env = makeEnv({ "ff:vision_enabled": "0" });
    const result = await getFlag(env, "vision_enabled", true);
    expect(result).toBe(false);
  });

  it("returns default value when key not in KV", async () => {
    const env = makeEnv();
    expect(await getFlag(env, "phishtank_enabled", true)).toBe(true);
    expect(await getFlag(env, "phishtank_enabled", false)).toBe(false);
  });

  it("handles KV errors gracefully — returns default", async () => {
    const env = {
      CACHE: {
        get: async () => { throw new Error("KV unavailable"); },
      } as unknown as KVNamespace,
    };
    const result = await getFlag(env, "safe_browsing_enabled", true);
    expect(result).toBe(true);
  });
});

describe("setFlag", () => {
  it("stores true as '1'", async () => {
    const store: Record<string, string> = {};
    const env = {
      CACHE: {
        get: async (k: string) => store[k] ?? null,
        put: async (k: string, v: string) => { store[k] = v; },
      } as unknown as KVNamespace,
    };
    await setFlag(env, "vision_enabled", true);
    expect(store["ff:vision_enabled"]).toBe("1");
  });

  it("stores false as '0'", async () => {
    const store: Record<string, string> = {};
    const env = {
      CACHE: {
        get: async (k: string) => store[k] ?? null,
        put: async (k: string, v: string) => { store[k] = v; },
      } as unknown as KVNamespace,
    };
    await setFlag(env, "vision_enabled", false);
    expect(store["ff:vision_enabled"]).toBe("0");
  });
});
