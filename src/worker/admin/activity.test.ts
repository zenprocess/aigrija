import { describe, it, expect, vi } from 'vitest';
import { activity } from './activity';

vi.mock('../lib/activity-log', () => ({
  getRecentActivity: vi.fn(async () => [
    {
      created_at: '2025-01-01T00:00:00Z',
      action: 'approve',
      entity_type: 'campaign',
      entity_id: 'abc',
      admin_email: 'admin@test.ro',
      details: null,
    },
  ]),
}));

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

// Auth is now handled by adminAuth middleware in the admin app (admin/index.ts).
// The activity sub-router itself does not perform auth — these tests exercise the route directly.
describe('activity router', () => {
  it('returns 503 when ADMIN_DB not configured', async () => {
    const env = { ADMIN_DB: null };
    const req = new Request('http://localhost/');
    const res = await activity.fetch(req, env, makeCtx());
    expect(res.status).toBe(503);
  });

  it('renders activity log page', async () => {
    const env = { ADMIN_DB: {} };
    const req = new Request('http://localhost/');
    const res = await activity.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Admin Activity');
    expect(html).toContain('approve');
    expect(html).toContain('admin@test.ro');
  });

  it('passes filter params to getRecentActivity', async () => {
    const { getRecentActivity } = await import('../lib/activity-log');
    const env = { ADMIN_DB: {} };
    const req = new Request('http://localhost/?action=approve&admin=admin@test.ro');
    await activity.fetch(req, env, makeCtx());
    expect(getRecentActivity).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.objectContaining({ action: 'approve', adminEmail: 'admin@test.ro' })
    );
  });

  it('returns 503 with error message when getRecentActivity throws', async () => {
    const { getRecentActivity } = await import('../lib/activity-log');
    vi.mocked(getRecentActivity).mockRejectedValueOnce(new Error('no such table: admin_activity'));
    const env = { ADMIN_DB: {} };
    const req = new Request('http://localhost/');
    const res = await activity.fetch(req, env, makeCtx());
    expect(res.status).toBe(503);
    const html = await res.text();
    expect(html).toContain('Activity log unavailable');
    expect(html).toContain('no such table: admin_activity');
  });

  it('escapes XSS in filter params', async () => {
    const env = { ADMIN_DB: {} };
    const req = new Request('http://localhost/?action=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    const res = await activity.fetch(req, env, makeCtx());
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
