import { Hono } from 'hono';
import type { Env } from '../lib/types';

const analytics = new Hono<{ Bindings: Env }>();

analytics.get('/admin/analytics', async (c) => {
  const apiKey = c.req.header('x-admin-key') || c.req.query('key');
  if (apiKey !== c.env.ADMIN_API_KEY) return c.text('Unauthorized', 401);

  if (!c.env.ADMIN_DB) {
    return c.html('<h1>ADMIN_DB not configured</h1>', 503);
  }

  let severityRows: { results: { severity: string; count: number }[] } = { results: [] };
  let monthRows: { results: { month: string; count: number }[] } = { results: [] };
  try {
    [severityRows, monthRows] = await Promise.all([
      c.env.ADMIN_DB.prepare('SELECT severity, COUNT(*) as count FROM campaigns GROUP BY severity').all() as Promise<{ results: { severity: string; count: number }[] }>,
      c.env.ADMIN_DB.prepare("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM campaigns GROUP BY month ORDER BY month").all() as Promise<{ results: { month: string; count: number }[] }>,
    ]);
  } catch (err) {
    console.error('[admin/analytics] D1 query failed:', err);
    return c.html('<h1>Eroare baza de date</h1>', 500);
  }

  const severityData = JSON.stringify(
    severityRows.results.map(r => ({
      label: r.severity,
      count: r.count,
    }))
  );

  const monthData = JSON.stringify(
    monthRows.results.map(r => ({
      label: r.month,
      count: r.count,
    }))
  );

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8"/>
  <title>Analytics - Admin ai-grija.ro</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; background: #F9FAFB; }
    h1 { color: #111827; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
    .chart-box { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    nav a { margin-right: 16px; color: #2563EB; text-decoration: none; }
  </style>
</head>
<body>
  <nav>
    <a href="/admin/campaigns">Campanii</a>
    <a href="/admin/analytics">Analytics</a>
    <a href="/admin/activity">Activitate</a>
  </nav>
  <h1>📊 Analytics</h1>
  <div class="charts">
    <div class="chart-box">
      <h3>Distribuție severitate</h3>
      <canvas id="severityChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>Campanii pe lună</h3>
      <canvas id="monthChart"></canvas>
    </div>
  </div>
  <script>
    const severityData = ${severityData};
    const monthData = ${monthData};

    new Chart(document.getElementById('severityChart'), {
      type: 'pie',
      data: {
        labels: severityData.map(d => d.label),
        datasets: [{ data: severityData.map(d => d.count), backgroundColor: ['#DC2626','#F59E0B','#16A34A','#6B7280'] }]
      }
    });

    new Chart(document.getElementById('monthChart'), {
      type: 'bar',
      data: {
        labels: monthData.map(d => d.label),
        datasets: [{ label: 'Campanii', data: monthData.map(d => d.count), backgroundColor: '#2563EB' }]
      }
    });
  </script>
</body>
</html>`;

  return c.html(html);
});

export { analytics };
