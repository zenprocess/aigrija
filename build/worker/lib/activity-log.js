export async function logActivity(db, action, entityType, entityId, adminEmail, details) {
    await db
        .prepare('INSERT INTO admin_activity (action, entity_type, entity_id, admin_email, details) VALUES (?, ?, ?, ?, ?)')
        .bind(action, entityType, entityId, adminEmail, details ? JSON.stringify(details) : null)
        .run();
}
export async function getRecentActivity(db, limit = 100, filters) {
    let query = 'SELECT * FROM admin_activity';
    const conditions = [];
    const bindings = [];
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
    return result.results;
}
