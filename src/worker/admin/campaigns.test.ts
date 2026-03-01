import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { campaignsRouter } from './campaigns';

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

function makeEnv(d1Override?: any) {
  const db = d1Override ?? makeD1();
  return {
    DB: db,
    ADMIN_API_KEY: 'test-key',
  };
}

const AUTH_HEADERS = { Authorization: 'Bearer test-key' };

describe('campaignsRouter', () => {
  describe('GET /campaigns/api/list', () => {
    it('returns paginated results', async () => {
      const env = makeEnv();
      env.DB._bindMock.first.mockResolvedValue({ total: 0 });
      env.DB._bindMock.all.mockResolvedValue({ results: [] });
      const req = new Request('http://localhost/campaigns/api/list', { headers: AUTH_HEADERS });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('total');
      expect(json).toHaveProperty('pages');
    });

    it('returns 401 without auth', async () => {
      const env = makeEnv();
      env.DB._bindMock.first.mockResolvedValue({ total: 0 });
      env.DB._bindMock.all.mockResolvedValue({ results: [] });
      const req = new Request('http://localhost/campaigns/api/list');
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(401);
    });

    it('returns 503 when ADMIN_API_KEY not configured', async () => {
      const env = { DB: makeD1(), ADMIN_API_KEY: '' };
      const req = new Request('http://localhost/campaigns/api/list', { headers: AUTH_HEADERS });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(503);
    });
  });

  describe('GET /campaigns/api/:id', () => {
    it('returns 404 for unknown id', async () => {
      const env = makeEnv();
      env.DB._bindMock.first.mockResolvedValue(null);
      const req = new Request('http://localhost/campaigns/api/unknown-id', { headers: AUTH_HEADERS });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(404);
    });

    it('returns campaign data', async () => {
      const env = makeEnv();
      env.DB._bindMock.first.mockResolvedValue({
        id: 'abc', title: 'Test', slug: 'test', affected_brands: '["bcr"]', iocs: '[]',
      });
      const req = new Request('http://localhost/campaigns/api/abc', { headers: AUTH_HEADERS });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.id).toBe('abc');
      expect(Array.isArray(json.affected_brands)).toBe(true);
    });
  });

  describe('POST /campaigns/api/create', () => {
    it('creates a campaign and returns 201', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/campaigns/api/create', {
        method: 'POST',
        headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Campaign', severity: 'high' }),
      });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.ok).toBe(true);
      expect(json.id).toBeTruthy();
    });

    it('returns 400 when title is missing', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/campaigns/api/create', {
        method: 'POST',
        headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: 'high' }),
      });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /campaigns/api/:id', () => {
    it('updates a campaign', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/campaigns/api/abc', {
        method: 'PUT',
        headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: 'critical' }),
      });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.ok).toBe(true);
    });

    it('returns 400 with no fields', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/campaigns/api/abc', {
        method: 'PUT',
        headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /campaigns/api/:id', () => {
    it('archives a campaign', async () => {
      const env = makeEnv();
      const req = new Request('http://localhost/campaigns/api/abc', {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      });
      const res = await campaignsRouter.fetch(req, env, makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.ok).toBe(true);
    });
  });
});
