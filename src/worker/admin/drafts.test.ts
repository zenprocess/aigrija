import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('./layout', () => ({
  adminLayout: vi.fn((title: string, content: string) => `<html>${title}${content}</html>`),
}));

vi.mock('../lib/markdown', () => ({
  markdownToHtml: vi.fn((s: string) => `<p>${s}</p>`),
}));

vi.mock('../lib/sanity-writer', () => ({
  publishToSanity: vi.fn(async () => ({ id: 'sanity-123' })),
}));

vi.mock('../lib/draft-generator', () => ({
  generateDraft: vi.fn(async () => {}),
}));

vi.mock('../lib/logger', () => ({
  structuredLog: vi.fn(),
}));

function makeD1(firstResult: any = null, allResults: any[] = []) {
  const bindMock = {
    first: vi.fn(async () => firstResult),
    all: vi.fn(async () => ({ results: allResults })),
    run: vi.fn(async () => ({ success: true })),
  };
  return {
    prepare: vi.fn(() => ({ bind: vi.fn(() => bindMock), ...bindMock })),
    _bindMock: bindMock,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function makeEnv(opts: { withQueue?: boolean; d1?: any } = {}) {
  const db = opts.d1 ?? makeD1();
  return {
    DB: db,
    ADMIN_API_KEY: 'test-key',
    DRAFT_QUEUE: opts.withQueue ? { send: vi.fn(async () => {}) } : undefined,
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: any }>();
  app.use('*', async (c, next) => {
    (c as any).env = { ...makeEnv(), ...(c as any).env };
    return next();
  });
  return app;
}

const AUTH = { Authorization: 'Bearer test-key' };

describe('drafts router', () => {
  it('GET / lists drafts', async () => {
    const { drafts } = await import('./drafts');
    const db = makeD1(null, []);
    db._bindMock.all.mockResolvedValue({ results: [] });
    const env = makeEnv({ d1: db });
    const req = new Request('http://localhost/', { headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Drafturi');
  });

  it('GET /:id returns 404 for unknown campaign', async () => {
    const { drafts } = await import('./drafts');
    const db = makeD1(null);
    const env = makeEnv({ d1: db });
    const req = new Request('http://localhost/nonexistent', { headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(404);
  });

  it('GET /:id renders campaign review page', async () => {
    const { drafts } = await import('./drafts');
    const campaign = {
      id: 'abc', title: 'Test Campaign', draft_content: '# Hello', draft_status: 'generated',
      threat_type: 'phishing', severity: 'high', affected_brands: 'BCR', source: 'dnsc',
      source_url: null, body_text: 'body text',
    };
    const db = makeD1(campaign);
    const env = makeEnv({ d1: db });
    const req = new Request('http://localhost/abc', { headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Test Campaign');
  });

  it('POST /:id/approve redirects', async () => {
    const { drafts } = await import('./drafts');
    const env = makeEnv();
    const req = new Request('http://localhost/abc/approve', { method: 'POST', headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/admin/drafts/abc');
  });

  it('POST /:id/reject redirects', async () => {
    const { drafts } = await import('./drafts');
    const env = makeEnv();
    const req = new Request('http://localhost/abc/reject', { method: 'POST', headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(302);
  });

  it('POST /:id/edit saves draft content', async () => {
    const { drafts } = await import('./drafts');
    const env = makeEnv();
    const form = new FormData();
    form.append('draft_content', 'New content here');
    const req = new Request('http://localhost/abc/edit', { method: 'POST', headers: AUTH, body: form });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(302);
  });

  it('POST /:id/publish calls publishToSanity', async () => {
    const { drafts } = await import('./drafts');
    const campaign = {
      id: 'abc', title: 'Test', draft_content: '# Hello', draft_status: 'approved',
    };
    const db = makeD1(campaign);
    const env = makeEnv({ d1: db });
    const req = new Request('http://localhost/abc/publish', { method: 'POST', headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    expect(json.sanityId).toBe('sanity-123');
  });

  it('POST /:id/publish returns 404 if campaign not found', async () => {
    const { drafts } = await import('./drafts');
    const db = makeD1(null);
    const env = makeEnv({ d1: db });
    const req = new Request('http://localhost/missing/publish', { method: 'POST', headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(404);
  });

  it('POST /:id/regenerate queues when DRAFT_QUEUE available', async () => {
    const { drafts } = await import('./drafts');
    const env = makeEnv({ withQueue: true });
    const req = new Request('http://localhost/abc/regenerate', { method: 'POST', headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(302);
  });

  it('POST /:id/publish-multi publishes multiple types', async () => {
    const { drafts } = await import('./drafts');
    const campaign = {
      id: 'abc', title: 'Test', draft_content: '# Hello', draft_status: 'approved',
    };
    const db = makeD1(campaign);
    const env = makeEnv({ d1: db });
    const req = new Request('http://localhost/abc/publish-multi', { method: 'POST', headers: AUTH });
    const res = await drafts.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.published)).toBe(true);
  });
});
