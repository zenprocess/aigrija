import { describe, it, expect } from 'vitest';
import { counter } from './counter';

function makeEnv(adminKey = 'secret-key', kvStore: Record<string, string> = {}): any {
  return {
    ADMIN_API_KEY: adminKey,
    CACHE: {
      get: async (key: string) => kvStore[key] ?? null,
      put: async (key: string, value: string) => { kvStore[key] = value; },
    },
  };
}

describe('GET /api/counter', () => {
  it('returns 0 when no value stored', async () => {
    const req = new Request('http://localhost/api/counter', { method: 'GET' });
    const res = await counter.fetch(req, makeEnv(), {} as any);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body.total_checks).toBe(0);
  });

  it('returns stored count', async () => {
    const store = { 'stats:total_checks': '42' };
    const req = new Request('http://localhost/api/counter', { method: 'GET' });
    const res = await counter.fetch(req, makeEnv('key', store), {} as any);
    const body = await res.json() as any;
    expect(body.total_checks).toBe(42);
  });
});

describe('POST /api/counter', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new Request('http://localhost/api/counter', { method: 'POST' });
    const res = await counter.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong key', async () => {
    const req = new Request('http://localhost/api/counter', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-key' },
    });
    const res = await counter.fetch(req, makeEnv('secret-key'), {} as any);
    expect(res.status).toBe(401);
  });

  it('increments counter with correct key', async () => {
    const store: Record<string, string> = { 'stats:total_checks': '5' };
    const req = new Request('http://localhost/api/counter', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret-key' },
    });
    const res = await counter.fetch(req, makeEnv('secret-key', store), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_checks).toBe(6);
    expect(store['stats:total_checks']).toBe('6');
  });
});
