import { describe, it, expect, vi } from 'vitest';
import { campaignApiRoutes } from './campaigns';

function makeD1(firstResult: any = null, allResults: any[] = []) {
  const bindMock = {
    first: vi.fn(async () => firstResult),
    all: vi.fn(async () => ({ results: allResults })),
    run: vi.fn(async () => ({ success: true })),
    bind: vi.fn(),
  };
  bindMock.bind = vi.fn(() => bindMock);
  return {
    prepare: vi.fn(() => bindMock),
    _bindMock: bindMock,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

// CF Access auth is handled upstream by admin/index.ts; simulate by setting adminEmail via context
// campaignApiRoutes has no auth middleware — it relies on CF Access applied by the parent admin router
function makeEnv(d1Override?: any) {
  const db = d1Override ?? makeD1();
  return { DB: db };
}

describe('campaignApiRoutes', () => {
  describe('GET /list', () => {
    it('returns paginated results', async () => {
      const env = makeEnv();
      env.DB._bindMock.first.mockResolvedValue({ total: 0 });
      env.DB._bindMock.all.mockResolvedValue({ results: [] });
      const req = new Request('http://localhost/list');
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('total');
      expect(json).toHaveProperty('pages');
    });
  });

  describe('GET /:id', () => {
    it('returns 404 for unknown id', async () => {
      const env = makeEnv();
      env.DB._bindMock.first.mockResolvedValue(null);
      const req = new Request('http://localhost/unknown-id');
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(404);
    });

    it('returns campaign data', async () => {
      const env = makeEnv();
      env.DB._bindMock.first.mockResolvedValue({
        id: 'abc', title: 'Test', slug: 'test', affected_brands: '["bcr"]', iocs: '[]',
      });
      const req = new Request('http://localhost/abc');
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.id).toBe('abc');
      expect(Array.isArray(json.affected_brands)).toBe(true);
    });
  });

  describe('POST /create', () => {
    it('creates a campaign and returns 201', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Campaign', severity: 'high' }),
      });
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.ok).toBe(true);
      expect(json.id).toBeTruthy();
    });

    it('returns 400 when title is missing', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: 'high' }),
      });
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /:id', () => {
    it('updates a campaign', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/abc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: 'critical' }),
      });
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.ok).toBe(true);
    });

    it('returns 400 with no fields', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/abc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /:id', () => {
    it('archives a campaign', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/abc', { method: 'DELETE' });
      const res = await campaignApiRoutes.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.ok).toBe(true);
    });
  });
});
