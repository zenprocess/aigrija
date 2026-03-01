import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { getRecentActivity } from '../lib/activity-log';

const activity = new Hono<{ Bindings: Env }>();

activity.get('/admin/activity', async (c) => {
  const apiKey = c.req.header('x-admin-key') || c.req.query('key');
  if (apiKey !== c.env.ADMIN_API_KEY) return c.text('Unauthorized', 401);

  if (!c.env.ADMIN_DB) {
    return c.html('<h1>ADMIN_DB not configured</h1>', 503);
  }

  const actionFilter = c.req.query('action');
  const adminFilter = c.req.query('admin');
  const dateFrom = c.req.query('from');
  const dateTo = c.req.query('to');

  const activities = await getRecentActivity(c.env.ADMIN_DB, 100, {
    action: actionFilter,
    adminEmail: adminFilter,
    dateFrom,
    dateTo,
  });

  const rows = activities
    .map(a => `<tr>
      <td>${a.created_at}</td>
      <td>${a.action}</td>
      <td>${a.entity_type}</td>
      <td>${a.entity_id ?? '-'}</td>
      <td>${a.admin_email}</td>
      <td><pre style="margin:0;font-size:11px;">${a.details ?? '-'}</pre></td>
    </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8"/>
  <title>Activitate Admin - ai-grija.ro</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1400px; margin: 20px auto; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #E5E7EB; padding: 8px 12px; text-align: left; font-size: 13px; }
    th { background: #F3F4F6; font-weight: 600; }
    tr:hover { background: #F9FAFB; }
    nav a { margin-right: 16px; color: #2563EB; text-decoration: none; }
    .filters { display: flex; gap: 12px; margin: 16px 0; }
    .filters input { padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 4px; }
  </style>
</head>
<body>
  <nav>
    <a href="/admin/campaigns">Campanii</a>
    <a href="/admin/analytics">Analytics</a>
    <a href="/admin/activity">Activitate</a>
  </nav>
  <h1>📋 Jurnal Activitate Admin</h1>
  <form method="GET" class="filters">
    <input name="action" placeholder="Acțiune" value="${actionFilter ?? ''}"/>
    <input name="admin" placeholder="Email admin" value="${adminFilter ?? ''}"/>
    <input name="from" type="date" value="${dateFrom ?? ''}"/>
    <input name="to" type="date" value="${dateTo ?? ''}"/>
    <button type="submit">Filtrează</button>
  </form>
  <table>
    <thead>
      <tr><th>Data</th><th>Acțiune</th><th>Entitate</th><th>ID</th><th>Admin</th><th>Detalii</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;">Nu există activitate înregistrată.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

  return c.html(html);
});

export { activity };
