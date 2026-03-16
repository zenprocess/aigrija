import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  ListFlagsEndpoint,
  UpdateFlagEndpoint,
  DeleteFlagEndpoint,
  ListCampaignsEndpoint,
  GetCampaignEndpoint,
  UpdateCampaignEndpoint,
  ArchiveCampaignEndpoint,
  PublishCampaignEndpoint,
  GenerateContentEndpoint,
  ListAiDraftsEndpoint,
  DeleteSubscriberEndpoint,
  UpdateWeightsEndpoint,
} from './openapi-admin';

function makeApp<T extends object>(method: string, path: string, EndpointClass: new () => { handle: (c: any) => any }) {
  const app = new Hono<{ Bindings: any }>();
  const endpoint = new EndpointClass();
  (app as any)[method](path, (c: any) => endpoint.handle(c));
  return app;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { CACHE: {}, DB: {}, ADMIN_DB: {}, AI: {}, ...overrides };
}

describe('GET /admin/flags (ListFlagsEndpoint)', () => {
  it('returns ok with empty flags map', async () => {
    const app = makeApp('get', '/admin/flags', ListFlagsEndpoint);
    const res = await app.fetch(new Request('http://localhost/admin/flags'), makeEnv(), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.flags).toBeDefined();
    expect(typeof body.flags).toBe('object');
  });
});

describe('PUT /admin/flags/:name (UpdateFlagEndpoint)', () => {
  it('returns ok with name and flag fields', async () => {
    const app = makeApp('put', '/admin/flags/:name', UpdateFlagEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/flags/my-flag', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('flag');
    expect(body.flag).toHaveProperty('enabled');
  });
});

describe('DELETE /admin/flags/:name (DeleteFlagEndpoint)', () => {
  it('returns ok with name field', async () => {
    const app = makeApp('delete', '/admin/flags/:name', DeleteFlagEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/flags/old-flag', { method: 'DELETE' }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('name');
  });
});

describe('GET /admin/campanii/api/list (ListCampaignsEndpoint)', () => {
  it('returns paginated empty list', async () => {
    const app = makeApp('get', '/admin/campanii/api/list', ListCampaignsEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/campanii/api/list'),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('pages');
  });

  it('returns default pagination values', async () => {
    const app = makeApp('get', '/admin/campanii/api/list', ListCampaignsEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/campanii/api/list'),
      makeEnv(), {} as any
    );
    const body = await res.json() as any;
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.total).toBe(0);
  });
});

describe('GET /admin/campanii/api/:id (GetCampaignEndpoint)', () => {
  it('returns 404 for unknown campaign', async () => {
    const app = makeApp('get', '/admin/campanii/api/:id', GetCampaignEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/campanii/api/nonexistent-id'),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /admin/campanii/api/:id (UpdateCampaignEndpoint)', () => {
  it('returns ok with id field', async () => {
    const app = makeApp('put', '/admin/campanii/api/:id', UpdateCampaignEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/campanii/api/campaign-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: 'high' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('id');
  });
});

describe('DELETE /admin/campanii/api/:id (ArchiveCampaignEndpoint)', () => {
  it('returns ok on archive', async () => {
    const app = makeApp('delete', '/admin/campanii/api/:id', ArchiveCampaignEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/campanii/api/campaign-1', { method: 'DELETE' }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});

describe('POST /admin/drafturi/:id/publish (PublishCampaignEndpoint)', () => {
  it('returns 501 not implemented stub', async () => {
    const app = makeApp('post', '/admin/drafturi/:id/publish', PublishCampaignEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/drafturi/campaign-1/publish', { method: 'POST' }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(501);
  });
});

describe('POST /admin/api/generate-content (GenerateContentEndpoint)', () => {
  it('returns 501 not implemented stub', async () => {
    const app = makeApp('post', '/admin/api/generate-content', GenerateContentEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'amenintari' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(501);
  });
});

describe('GET /admin/api/admin/drafts/ai-generated (ListAiDraftsEndpoint)', () => {
  it('returns ok with data array', async () => {
    const app = makeApp('get', '/admin/api/admin/drafts/ai-generated', ListAiDraftsEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/api/admin/drafts/ai-generated'),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('DELETE /admin/abonati/:email (DeleteSubscriberEndpoint)', () => {
  it('returns empty HTML response', async () => {
    const app = makeApp('delete', '/admin/abonati/:email', DeleteSubscriberEndpoint);
    const res = await app.fetch(
      new Request('http://localhost/admin/abonati/user%40example.com', { method: 'DELETE' }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('');
  });
});

describe('POST /admin/ponderi/save (UpdateWeightsEndpoint)', () => {
  it('returns HTML confirmation response', async () => {
    const app = makeApp('post', '/admin/ponderi/save', UpdateWeightsEndpoint);
    const body = new URLSearchParams({ safeBrowsingMatch: '0.9', urlhausMatch: '0.8' });
    const res = await app.fetch(
      new Request('http://localhost/admin/ponderi/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Ponderi salvate');
  });
});
