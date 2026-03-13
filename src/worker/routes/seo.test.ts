import { describe, it, expect } from 'vitest';
import { seo } from './seo';

describe('seo router', () => {
  it('is defined and is a Hono instance', () => {
    expect(seo).toBeDefined();
    expect(typeof seo.fetch).toBe('function');
  });

  it('returns 404 for unmatched routes (no handlers registered)', async () => {
    const req = new Request('http://localhost/nonexistent-seo-route');
    const res = await seo.fetch(req, {}, {} as any);
    expect(res.status).toBe(404);
  });
});
