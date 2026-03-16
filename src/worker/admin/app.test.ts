import { describe, it, expect, vi } from 'vitest';
import { admin } from './app';

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function makeDB(firstResults: Record<string, number>[]) {
  let callIndex = 0;
  return {
    prepare: vi.fn(() => ({
      first: vi.fn(async () => firstResults[callIndex++] ?? { count: 0 }),
      bind: vi.fn(() => ({
        first: vi.fn(async () => firstResults[callIndex++] ?? { count: 0 }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ success: true })),
      })),
      all: vi.fn(async () => ({ results: [] })),
      run: vi.fn(async () => ({ success: true })),
    })),
  };
}

function makeEnv(db: ReturnType<typeof makeDB>) {
  return {
    DB: db,
    ASSETS: { fetch: vi.fn() },
    BASE_URL: 'http://localhost',
    CACHE: { get: vi.fn(async () => null), put: vi.fn(async () => {}) },
  };
}

describe('admin dashboard stat cards', () => {
  it('renders real counts from D1', async () => {
    const db = makeDB([
      { count: 42 },   // total campaigns
      { count: 7 },    // pending drafts
      { count: 5 },    // scraper runs today
      { count: 2 },    // scraper errors today
    ]);
    const env = makeEnv(db);
    const req = new Request('http://localhost/');
    const res = await admin.fetch(req, env as any, makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('>42<');
    expect(html).toContain('>7<');
    expect(html).toContain('>5<');
    expect(html).toContain('>2<');
  });

  it('falls back to — when DB throws', async () => {
    const db = {
      prepare: vi.fn(() => ({
        first: vi.fn(async () => { throw new Error('DB error'); }),
        bind: vi.fn(() => ({
          first: vi.fn(async () => { throw new Error('DB error'); }),
          all: vi.fn(async () => ({ results: [] })),
          run: vi.fn(async () => ({ success: true })),
        })),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ success: true })),
      })),
    };
    const env = makeEnv(db as any);
    const req = new Request('http://localhost/');
    const res = await admin.fetch(req, env as any, makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('—');
  });
});
