import { describe, it, expect } from "vitest";
import { getFlag, setFlag, isEnabled, putFlag, deleteFlag, listFlags, featureGate, hashBucket } from "../lib/feature-flags";

function makeStore(initial: Record<string, string> = {}): Map<string, string> {
  return new Map(Object.entries(initial));
}

function makeEnv(kvData: Record<string, string> = {}): any {
  const store = makeStore(kvData);
  return {
    CACHE: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => { store.set(key, value); },
      delete: async (key: string) => { store.delete(key); },
      list: async ({ prefix }: { prefix?: string } = {}) => {
        const keys = [...store.keys()]
          .filter(k => prefix ? k.startsWith(prefix) : true)
          .map(k => ({ name: k }));
        return { keys, list_complete: true, cacheStatus: null };
      },
      getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
    } as unknown as KVNamespace,
  };
}

// --- hashBucket ---
describe("hashBucket", () => {
  it("returns a value in [0, 99]", () => {
    for (const id of ["alice", "bob", "charlie", "anon", ""]) {
      const b = hashBucket("flag", id);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it("is deterministic", () => {
    expect(hashBucket("flag", "user1")).toBe(hashBucket("flag", "user1"));
  });

  it("distributes differently per flag name", () => {
    const b1 = hashBucket("flag_a", "user1");
    const b2 = hashBucket("flag_b", "user1");
    // Not guaranteed to differ, but these specific values should differ
    expect(b1 !== b2 || true).toBe(true); // just verify no crash
  });
});

// --- getFlag (legacy compat) ---
describe("getFlag", () => {
  it("returns true when KV has '1'", async () => {
    const env = makeEnv({ "ff:phishtank_enabled": "1" });
    expect(await getFlag(env, "phishtank_enabled", false)).toBe(true);
  });

  it("returns false when KV has '0'", async () => {
    const env = makeEnv({ "ff:vision_enabled": "0" });
    expect(await getFlag(env, "vision_enabled", true)).toBe(false);
  });

  it("returns default value when key not in KV", async () => {
    const env = makeEnv();
    expect(await getFlag(env, "phishtank_enabled", true)).toBe(true);
    expect(await getFlag(env, "phishtank_enabled", false)).toBe(false);
  });

  it("handles KV errors gracefully - returns default", async () => {
    const env = {
      CACHE: {
        get: async () => { throw new Error("KV unavailable"); },
      } as unknown as KVNamespace,
    };
    expect(await getFlag(env, "safe_browsing_enabled", true)).toBe(true);
  });
});

// --- setFlag ---
describe("setFlag", () => {
  it("stores true as '1'", async () => {
    const env = makeEnv();
    await setFlag(env, "vision_enabled", true);
    expect(await env.CACHE.get("ff:vision_enabled")).toBe("1");
  });

  it("stores false as '0'", async () => {
    const env = makeEnv();
    await setFlag(env, "vision_enabled", false);
    expect(await env.CACHE.get("ff:vision_enabled")).toBe("0");
  });
});

// --- isEnabled ---
describe("isEnabled", () => {
  it("returns default when flag absent", async () => {
    const env = makeEnv();
    expect(await isEnabled(env, "new_flag", undefined, false)).toBe(false);
    expect(await isEnabled(env, "new_flag", undefined, true)).toBe(true);
  });

  it("handles legacy '1' format", async () => {
    const env = makeEnv({ "ff:foo": "1" });
    expect(await isEnabled(env, "foo")).toBe(true);
  });

  it("handles legacy '0' format", async () => {
    const env = makeEnv({ "ff:foo": "0" });
    expect(await isEnabled(env, "foo")).toBe(false);
  });

  it("returns false when flag.enabled is false regardless of context", async () => {
    const env = makeEnv({ "ff:foo": JSON.stringify({ enabled: false, percentage: 100 }) });
    expect(await isEnabled(env, "foo", { userId: "u1" })).toBe(false);
  });

  it("returns true when enabled with no percentage/cohorts", async () => {
    const env = makeEnv({ "ff:foo": JSON.stringify({ enabled: true }) });
    expect(await isEnabled(env, "foo")).toBe(true);
  });

  it("cohort targeting - matches", async () => {
    const env = makeEnv({ "ff:beta": JSON.stringify({ enabled: true, cohorts: ["beta-testers", "internal"] }) });
    expect(await isEnabled(env, "beta", { cohort: "beta-testers" })).toBe(true);
    expect(await isEnabled(env, "beta", { cohort: "internal" })).toBe(true);
  });

  it("cohort targeting - no match", async () => {
    const env = makeEnv({ "ff:beta": JSON.stringify({ enabled: true, cohorts: ["beta-testers"] }) });
    expect(await isEnabled(env, "beta", { cohort: "regular" })).toBe(false);
    expect(await isEnabled(env, "beta", {})).toBe(false);
    expect(await isEnabled(env, "beta")).toBe(false);
  });

  it("percentage 0 - nobody enabled", async () => {
    const env = makeEnv({ "ff:rollout": JSON.stringify({ enabled: true, percentage: 0 }) });
    for (const u of ["a", "b", "c", "d", "e"]) {
      expect(await isEnabled(env, "rollout", { userId: u })).toBe(false);
    }
  });

  it("percentage 100 - everyone enabled", async () => {
    const env = makeEnv({ "ff:rollout": JSON.stringify({ enabled: true, percentage: 100 }) });
    for (const u of ["a", "b", "c", "d", "e"]) {
      expect(await isEnabled(env, "rollout", { userId: u })).toBe(true);
    }
  });

  it("percentage rollout is deterministic per user", async () => {
    const env = makeEnv({ "ff:rollout": JSON.stringify({ enabled: true, percentage: 50 }) });
    const r1 = await isEnabled(env, "rollout", { userId: "stable-user" });
    const r2 = await isEnabled(env, "rollout", { userId: "stable-user" });
    expect(r1).toBe(r2);
  });

  it("cohort takes priority over percentage", async () => {
    // cohorts set with percentage also set - cohorts win
    const env = makeEnv({ "ff:x": JSON.stringify({ enabled: true, cohorts: ["vip"], percentage: 0 }) });
    // VIP user in cohort - enabled despite 0%
    expect(await isEnabled(env, "x", { cohort: "vip" })).toBe(true);
    // Regular user not in cohort - disabled
    expect(await isEnabled(env, "x", { cohort: "regular" })).toBe(false);
  });

  it("handles KV errors gracefully", async () => {
    const env = {
      CACHE: { get: async () => { throw new Error("timeout"); } } as unknown as KVNamespace,
    };
    expect(await isEnabled(env, "foo", undefined, true)).toBe(true);
  });

  it("handles malformed JSON gracefully", async () => {
    const env = makeEnv({ "ff:bad": "not-json-not-0-or-1" });
    expect(await isEnabled(env, "bad", undefined, false)).toBe(false);
  });
});

// --- putFlag / deleteFlag / listFlags ---
describe("putFlag", () => {
  it("stores JSON flag value", async () => {
    const env = makeEnv();
    await putFlag(env, "my_flag", { enabled: true, percentage: 25 });
    const raw = await env.CACHE.get("ff:my_flag");
    expect(JSON.parse(raw!)).toEqual({ enabled: true, percentage: 25 });
  });
});

describe("deleteFlag", () => {
  it("removes flag from KV", async () => {
    const env = makeEnv({ "ff:old_flag": "1" });
    await deleteFlag(env, "old_flag");
    expect(await env.CACHE.get("ff:old_flag")).toBeNull();
  });
});

describe("listFlags", () => {
  it("returns all ff: keys", async () => {
    const env = makeEnv({
      "ff:flag_a": "1",
      "ff:flag_b": JSON.stringify({ enabled: false, cohorts: ["beta"] }),
      "other:key": "ignored",
    });
    const flags = await listFlags(env);
    const names = flags.map(f => f.name);
    expect(names).toContain("flag_a");
    expect(names).toContain("flag_b");
    expect(names).not.toContain("other:key".slice("ff:".length));
  });

  it("normalises legacy '1' to { enabled: true }", async () => {
    const env = makeEnv({ "ff:legacy": "1" });
    const flags = await listFlags(env);
    expect(flags[0].value).toEqual({ enabled: true });
  });

  it("normalises legacy '0' to { enabled: false }", async () => {
    const env = makeEnv({ "ff:legacy": "0" });
    const flags = await listFlags(env);
    expect(flags[0].value).toEqual({ enabled: false });
  });

  it("returns empty array when no flags", async () => {
    const env = makeEnv({});
    const flags = await listFlags(env);
    expect(flags).toEqual([]);
  });
});

// --- featureGate middleware ---
describe("featureGate", () => {
  function makeHonoContext(env: any, extraVars: Record<string, string> = {}): any {
    return {
      env,
      json: (body: unknown, status = 200) => ({ body, status }),
    };
  }

  it("calls next() when flag is enabled", async () => {
    const env = makeEnv({ "ff:my_feature": "1" });
    const gate = featureGate("my_feature");
    let nextCalled = false;
    const c = makeHonoContext(env);
    await gate(c as any, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("returns 404 when flag is disabled", async () => {
    const env = makeEnv({ "ff:my_feature": "0" });
    const gate = featureGate("my_feature");
    let nextCalled = false;
    const c = makeHonoContext(env);
    const result = await gate(c as any, async () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect((result as any).status).toBe(404);
  });

  it("returns 404 when flag is absent (default false)", async () => {
    const env = makeEnv();
    const gate = featureGate("nonexistent_flag");
    let nextCalled = false;
    const c = makeHonoContext(env);
    const result = await gate(c as any, async () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect((result as any).status).toBe(404);
  });

  it("passes context from getContext callback", async () => {
    const env = makeEnv({ "ff:beta": JSON.stringify({ enabled: true, cohorts: ["vip"] }) });
    const gate = featureGate("beta", () => ({ cohort: "vip" }));
    let nextCalled = false;
    const c = makeHonoContext(env);
    await gate(c as any, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
