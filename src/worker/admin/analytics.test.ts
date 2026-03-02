import { describe, it, expect, vi } from 'vitest';
import { analytics } from './analytics';

function makeD1(severityResults: any[] = [], monthResults: any[] = []) {
  let callCount = 0;
  const bindMock = {
    all: vi.fn(async () => {
      callCount++;
      if (callCount % 2 === 1) return { results: severityResults };
      return { results: monthResults };
    }),
    first: vi.fn(async () => null),
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

// Auth is now handled by adminAuth middleware in the admin app (admin/index.ts).
// The analytics sub-router itself does not perform auth — these tests exercise the route directly.
describe('analytics router', () => {
  it('returns 503 when ADMIN_DB not configured', async () => {
    const env = { ADMIN_DB: null };
    const req = new Request('http://localhost/');
    const res = await analytics.fetch(req, env, makeCtx());
    expect(res.status).toBe(503);
  });

  it('renders analytics page with charts', async () => {
    const env = {
      ADMIN_DB: makeD1(
        [{ severity: 'high', count: 5 }, { severity: 'low', count: 2 }],
        [{ month: '2025-01', count: 3 }]
      ),
    };
    const req = new Request('http://localhost/');
    const res = await analytics.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Analytics');
    expect(html).toContain('severityChart');
    expect(html).toContain('monthChart');
  });
});
