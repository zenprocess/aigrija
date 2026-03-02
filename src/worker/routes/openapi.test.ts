import { describe, it, expect } from 'vitest';
import { openapi } from './openapi';

describe('GET /api/openapi.json', () => {
  it('returns valid OpenAPI 3.1 JSON', async () => {
    const res = await openapi.request('/api/openapi.json');
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBe('AI Grija API');
    expect(spec.paths).toBeDefined();
  });

  it('documents /api/check endpoint', async () => {
    const res = await openapi.request('/api/openapi.json');
    const spec = await res.json();
    expect(spec.paths['/api/check']).toBeDefined();
    expect(spec.paths['/api/check'].post).toBeDefined();
  });

  it('documents /health endpoint', async () => {
    const res = await openapi.request('/api/openapi.json');
    const spec = await res.json();
    expect(spec.paths['/health']).toBeDefined();
  });
});

describe('GET /api/docs', () => {
  it('returns HTML with Swagger UI', async () => {
    const res = await openapi.request('/api/docs');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('swagger-ui');
    expect(html).toContain('/api/openapi.json');
  });
});
