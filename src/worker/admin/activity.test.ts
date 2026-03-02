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

describe('activity router', () => {
  it('returns 401 without admin key', async () => {
    const env = { ADMIN_API_KEY: 'secret', ADMIN_DB: {} };
    const req = new Request('http://localhost/admin/activity');
    const res = await activity.fetch(req, env, makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 503 when ADMIN_DB not configured', async () => {
    const env = { ADMIN_API_KEY: 'secret', ADMIN_DB: null };
    const req = new Request('http://localhost/admin/activity', {
      headers: { 'x-admin-key': 'secret' },
    });
    const res = await activity.fetch(req, env, makeCtx());
    expect(res.status).toBe(503);
  });

  it('renders activity log page', async () => {
    const env = { ADMIN_API_KEY: 'secret', ADMIN_DB: {} };
    const req = new Request('http://localhost/admin/activity', {
      headers: { 'x-admin-key': 'secret' },
    });
    const res = await activity.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Activitate');
    expect(html).toContain('approve');
    expect(html).toContain('admin@test.ro');
  });

  it('accepts x-admin-key header for auth', async () => {
    const env = { ADMIN_API_KEY: 'secret', ADMIN_DB: {} };
    const req = new Request('http://localhost/admin/activity', {
      headers: { 'x-admin-key': 'secret' },
    });
    const res = await activity.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
  });

  it('passes filter params to getRecentActivity', async () => {
    const { getRecentActivity } = await import('../lib/activity-log');
    const env = { ADMIN_API_KEY: 'secret', ADMIN_DB: {} };
    const req = new Request('http://localhost/admin/activity?action=approve&admin=admin@test.ro', {
      headers: { 'x-admin-key': 'secret' },
    });
    await activity.fetch(req, env, makeCtx());
    expect(getRecentActivity).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.objectContaining({ action: 'approve', adminEmail: 'admin@test.ro' })
    );
  });
});
