import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import type { Env } from '../lib/types';
import { ShareEndpoint } from './openapi-share';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeR2(objects: Record<string, string> = {}): R2Bucket {
  return {
    get: async (key: string) => {
      const content = objects[key];
      if (!content) return null;
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content));
          controller.close();
        },
      });
      return { body, text: async () => content, arrayBuffer: async () => new ArrayBuffer(0) };
    },
    put: vi.fn(),
    delete: vi.fn(),
    head: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
  } as unknown as R2Bucket;
}

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return {
    STORAGE: makeR2(),
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

function buildApp() {
  const honoApp = new Hono<{ Bindings: Env }>();
  const openapi = fromHono(honoApp, { docs_url: null });
  openapi.get('/api/share/:id', ShareEndpoint);
  return honoApp;
}

describe('GET /api/share/:id', () => {
  it('returns 200 with SVG content when SVG card exists', async () => {
    const svgContent = '<svg><text>Test</text></svg>';
    const storage = makeR2({ [`share/${VALID_UUID}.svg`]: svgContent });
    const app = buildApp();
    const res = await app.fetch(
      new Request(`http://localhost/api/share/${VALID_UUID}`),
      makeEnv({ STORAGE: storage }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
  });

  it('returns 200 with PNG content when PNG card exists (no SVG)', async () => {
    const pngContent = '\x89PNG\r\n\x1a\n';
    const storage = makeR2({ [`share/${VALID_UUID}.png`]: pngContent });
    const app = buildApp();
    const res = await app.fetch(
      new Request(`http://localhost/api/share/${VALID_UUID}`),
      makeEnv({ STORAGE: storage }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/png');
  });

  it('returns 404 when card does not exist', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request(`http://localhost/api/share/${VALID_UUID}`),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/share/not-a-uuid'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when id is a short non-uuid string', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/share/abc123'),
      makeEnv(),
      makeCtx()
    );
    expect(res.status).toBe(400);
  });

  it('includes Cache-Control header in successful SVG response', async () => {
    const svgContent = '<svg></svg>';
    const storage = makeR2({ [`share/${VALID_UUID}.svg`]: svgContent });
    const app = buildApp();
    const res = await app.fetch(
      new Request(`http://localhost/api/share/${VALID_UUID}`),
      makeEnv({ STORAGE: storage }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBeDefined();
  });
});
