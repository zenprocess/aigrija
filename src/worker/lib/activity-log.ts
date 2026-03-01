export async function logActivity(
  db: D1Database,
  action: string,
  entityType: string,
  entityId: string | null,
  adminEmail: string,
  details?: Record<string, unknown>
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO admin_activity (action, entity_type, entity_id, admin_email, details) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(action, entityType, entityId, adminEmail, details ? JSON.stringify(details) : null)
    .run();
}

export async function getRecentActivity(
  db: D1Database,
  limit = 100,
  filters?: { action?: string; adminEmail?: string; dateFrom?: string; dateTo?: string }
): Promise<Record<string, unknown>[]> {
  let query = 'SELECT * FROM admin_activity';
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (filters?.action) {
    conditions.push('action = ?');
    bindings.push(filters.action);
  }
  if (filters?.adminEmail) {
    conditions.push('admin_email = ?');
    bindings.push(filters.adminEmail);
  }
  if (filters?.dateFrom) {
    conditions.push('created_at >= ?');
    bindings.push(filters.dateFrom);
  }
  if (filters?.dateTo) {
    conditions.push('created_at <= ?');
    bindings.push(filters.dateTo);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(limit);

  const result = await db.prepare(query).bind(...bindings).all();
  return result.results as Record<string, unknown>[];
}
