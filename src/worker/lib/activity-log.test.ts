import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logActivity, getRecentActivity } from './activity-log';

function makeDb(rows: unknown[] = []) {
  const runMock = vi.fn().mockResolvedValue({ success: true });
  const allMock = vi.fn().mockResolvedValue({ results: rows });
  const bindMock = vi.fn().mockReturnValue({ run: runMock, all: allMock });
  const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
  return { prepare: prepareMock, _runMock: runMock, _allMock: allMock, _bindMock: bindMock };
}

describe('logActivity', () => {
  it('inserts activity record with correct values', async () => {
    const db = makeDb();
    await logActivity(db as unknown as D1Database, 'create', 'campaign', '42', 'admin@example.com', { key: 'val' });
    expect(db.prepare).toHaveBeenCalledWith(
      'INSERT INTO admin_activity (action, entity_type, entity_id, admin_email, details) VALUES (?, ?, ?, ?, ?)'
    );
    expect(db._bindMock).toHaveBeenCalledWith('create', 'campaign', '42', 'admin@example.com', '{"key":"val"}');
    expect(db._runMock).toHaveBeenCalled();
  });

  it('handles null entityId and no details', async () => {
    const db = makeDb();
    await logActivity(db as unknown as D1Database, 'login', 'session', null, 'admin@example.com');
    expect(db._bindMock).toHaveBeenCalledWith('login', 'session', null, 'admin@example.com', null);
  });
});

describe('getRecentActivity', () => {
  it('returns rows from db', async () => {
    const mockRows = [{ id: 1, action: 'create', entity_type: 'campaign', entity_id: '1', admin_email: 'a@b.com', details: null, created_at: '2026-01-01' }];
    const db = makeDb(mockRows);
    const result = await getRecentActivity(db as unknown as D1Database);
    expect(result).toEqual(mockRows);
  });

  it('builds WHERE clause with filters', async () => {
    const db = makeDb([]);
    await getRecentActivity(db as unknown as D1Database, 10, { action: 'create', adminEmail: 'admin@example.com' });
    const query = db.prepare.mock.calls[0][0] as string;
    expect(query).toContain('WHERE');
    expect(query).toContain('action = ?');
    expect(query).toContain('admin_email = ?');
  });
});
