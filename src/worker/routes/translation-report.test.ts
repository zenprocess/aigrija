import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { translationReport } from './translation-report';

function makeApp() {
  const store: Record<string, string> = {};
  const mockEnv = {
    CACHE: {
      get: async (k: string) => store[k] ?? null,
      put: async (k: string, v: string, _opts?: unknown) => { store[k] = v; },
      list: async () => ({ keys: [], list_complete: true, cursor: '' }),
      delete: async (k: string) => { delete store[k]; },
    },
  } as unknown as Env;

  const app = new Hono<{ Bindings: Env }>();
  app.route('/', translationReport);

  return { app, mockEnv };
}

describe('POST /api/translation-report', () => {
  it('returns 200 with ok:true for valid body', async () => {
    const { app, mockEnv } = makeApp();
    const res = await app.request(
      '/api/translation-report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'ro', comment: 'Text gresit pe pagina principala' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; id: string };
    expect(json.ok).toBe(true);
    expect(typeof json.id).toBe('string');
  });

  it('returns 400 when comment is missing', async () => {
    const { app, mockEnv } = makeApp();
    const res = await app.request(
      '/api/translation-report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'ro', currentText: 'ceva' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('MISSING_COMMENT');
  });

  it('returns 400 for empty body', async () => {
    const { app, mockEnv } = makeApp();
    const res = await app.request(
      '/api/translation-report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
  });
});
