import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { gdprAdmin } from './gdpr';

// Minimal in-memory KV mock
function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string, type?: string) {
      const raw = store.get(key) ?? null;
      if (raw === null) return null;
      if (type === 'json') return JSON.parse(raw);
      return raw;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [], list_complete: true };
    },
    async getWithMetadata(key: string) {
      return { value: store.get(key) ?? null, metadata: null };
    },
  } as unknown as KVNamespace;
}

function makeEnv(kv: KVNamespace) {
  return { CACHE: kv } as unknown as import('../lib/types').Env;
}

function buildApp(kv: KVNamespace) {
  const app = new Hono<{ Bindings: import('../lib/types').Env }>();
  app.route('/gdpr', gdprAdmin);
  return { app, env: makeEnv(kv) };
}

async function req(
  app: Hono,
  env: unknown,
  method: string,
  path: string
): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method }), env);
}

describe('GDPR admin endpoints', () => {
  let kv: KVNamespace;

  beforeEach(async () => {
    kv = makeKV();
    // Seed data for identifier "user123"
    await kv.put('consent:tg:user123', JSON.stringify({ consented_at: '2025-01-01T00:00:00Z', channel: 'tg', id: 'user123' }));
    await kv.put('tg:subscriber:user123', JSON.stringify({ subscribed_at: '2025-01-01T00:00:00Z', last_active: '2025-01-02T00:00:00Z', channel: 'tg', id: 'user123' }));
    await kv.put('consent:email:user123', JSON.stringify({ consented_at: '2025-01-03T00:00:00Z', channel: 'email', id: 'user123' }));
  });

  describe('GET /gdpr', () => {
    it('returns 200 with HTML dashboard', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'GET', '/gdpr');
      expect(res.status).toBe(200);
      const ct = res.headers.get('content-type') ?? '';
      expect(ct).toContain('text/html');
    });

    it('contains GDPR lookup form', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'GET', '/gdpr');
      const html = await res.text();
      expect(html).toContain('GDPR');
      expect(html).toContain('gdpr-id');
    });
  });

  describe('GET /gdpr/export/:identifier', () => {
    it('returns all KV entries for a known identifier', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'GET', '/gdpr/export/user123');
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.identifier).toBe('user123');
      expect(body.count).toBe(3);
      const data = body.data as Record<string, unknown>;
      expect(data['consent:tg:user123']).toBeTruthy();
      expect(data['tg:subscriber:user123']).toBeTruthy();
      expect(data['consent:email:user123']).toBeTruthy();
    });

    it('returns empty data for unknown identifier', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'GET', '/gdpr/export/nobody');
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.count).toBe(0);
    });
  });

  describe('DELETE /gdpr/purge/:identifier', () => {
    it('deletes all KV entries and returns count', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'DELETE', '/gdpr/purge/user123');
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.deleted).toBe(3);

      // Verify entries are gone
      expect(await kv.get('consent:tg:user123')).toBeNull();
      expect(await kv.get('tg:subscriber:user123')).toBeNull();
      expect(await kv.get('consent:email:user123')).toBeNull();
    });

    it('returns 0 deleted for unknown identifier', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'DELETE', '/gdpr/purge/nobody');
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.deleted).toBe(0);
    });
  });

  describe('GET /gdpr/consent-log/:identifier', () => {
    it('returns consent timeline sorted by channel', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'GET', '/gdpr/consent-log/user123');
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.count).toBe(2);
      const timeline = body.timeline as Array<{ channel: string }>;
      // sorted: email < tg
      expect(timeline[0].channel).toBe('email');
      expect(timeline[1].channel).toBe('tg');
    });

    it('returns empty timeline for unknown identifier', async () => {
      const { app, env } = buildApp(kv);
      const res = await req(app, env, 'GET', '/gdpr/consent-log/nobody');
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.count).toBe(0);
    });
  });
});
