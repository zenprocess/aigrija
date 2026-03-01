import { Hono } from 'hono';
import type { Env } from '../lib/types';

// ---- Types ----------------------------------------------------------------

interface DbCampaign {
  id: string;
  title: string;
  slug: string;
  source: string | null;
  source_url: string | null;
  published_at: string | null;
  body_text: string | null;
  threat_type: string | null;
  affected_brands: string | null;
  iocs: string | null;
  severity: string | null;
  draft_status: string;
  archived: number;
  created_at: string;
}

// ---- Auth middleware -------------------------------------------------------

function adminAuth(app: Hono<{ Bindings: Env }>) {
  app.use('*', async (c, next) => {
    if (!c.env.ADMIN_API_KEY) return c.json({ error: 'Admin not configured' }, 503);
    const auth = c.req.header('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    // For HTML page routes also check cookie or query param for browser access
    const cookieToken = getCookieValue(c.req.header('Cookie') ?? '', 'admin_key');
    const queryToken = new URL(c.req.url).searchParams.get('admin_key') ?? '';
    const provided = token || cookieToken || queryToken;
    if (!provided || provided !== c.env.ADMIN_API_KEY) {
      // Return login prompt for HTML routes
      if (!c.req.path.includes('/api/')) {
        return c.html(loginPage(), 401);
      }
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return next();
  });
}

function getCookieValue(cookieHeader: string, name: string): string {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// ---- Helpers ---------------------------------------------------------------

function severityBadge(s: string | null): string {
  const map: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-400 text-black',
    low: 'bg-green-500 text-white',
  };
  const cls = (s && map[s]) || 'bg-gray-300 text-black';
  return `<span class="px-2 py-0.5 rounded text-xs font-semibold ${cls}">${s ?? 'N/A'}</span>`;
}

function statusPill(s: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    draft: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800',
  };
  const cls = map[s] || 'bg-gray-100 text-gray-800';
  return `<span class="px-2 py-0.5 rounded-full text-xs ${cls}">${s}</span>`;
}

function adminLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — Admin ai-grija.ro</title>
  <script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css"/>
</head>
<body class="bg-gray-50 min-h-screen">
  <nav class="bg-gray-900 text-white px-6 py-3 flex items-center gap-6">
    <span class="font-bold text-lg">ai-grija admin</span>
    <a href="/admin/campaigns" class="text-gray-300 hover:text-white text-sm">Campanii</a>
    <a href="/admin/scrapers" class="text-gray-300 hover:text-white text-sm">Scrapers</a>
  </nav>
  <main class="p-6">${body}</main>
</body>
</html>`;
}

function loginPage(): string {
  return `<!DOCTYPE html>
<html><body>
<form method="get" action="">
  <label>Admin Key: <input type="password" name="admin_key"/></label>
  <button type="submit">Login</button>
</form>
</body></html>`;
}

// ---- Router ----------------------------------------------------------------

export const campaignsRouter = new Hono<{ Bindings: Env }>();
adminAuth(campaignsRouter);

// --- API: list with pagination, search, filters ---
campaignsRouter.get('/campaigns/api/list', async (c) => {
  const { page = '1', limit = '20', q = '', source = '', severity = '', status = '' } = Object.fromEntries(new URL(c.req.url).searchParams);
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = ['archived = 0'];
  const params: unknown[] = [];

  if (q) {
    conditions.push("(title LIKE ? OR body_text LIKE ? OR slug LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (source) { conditions.push('source = ?'); params.push(source); }
  if (severity) { conditions.push('severity = ?'); params.push(severity); }
  if (status) { conditions.push('draft_status = ?'); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  let countRow: { total: number } | null = null;
  let rows: { results: DbCampaign[] } = { results: [] };
  try {
    countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM campaigns ${where}`
    ).bind(...params).first<{ total: number }>();

    rows = await c.env.DB.prepare(
      `SELECT id, title, slug, source, severity, draft_status, published_at, created_at
       FROM campaigns ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limitNum, offset).all<DbCampaign>();
  } catch (err) {
    console.error('[admin/campaigns] D1 list query failed:', err);
    return c.json({ error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 500);
  }

  return c.json({
    data: rows.results,
    total: countRow?.total ?? 0,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil((countRow?.total ?? 0) / limitNum),
  });
});

// --- API: single campaign ---
campaignsRouter.get('/campaigns/api/:id', async (c) => {
  let row: DbCampaign | null = null;
  try {
    row = await c.env.DB.prepare(
      'SELECT * FROM campaigns WHERE id = ?'
    ).bind(c.req.param('id')).first<DbCampaign>();
  } catch (err) {
    console.error('[admin/campaigns] D1 get query failed:', err);
    return c.json({ error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 500);
  }
  if (!row) return c.json({ error: 'Not found' }, 404);

  let affected_brands: string[] = [];
  let iocs: string[] = [];
  try { affected_brands = row.affected_brands ? JSON.parse(row.affected_brands) : []; } catch { affected_brands = []; }
  try { iocs = row.iocs ? JSON.parse(row.iocs) : []; } catch { iocs = []; }

  return c.json({ ...row, affected_brands, iocs });
});

// --- API: update campaign ---
campaignsRouter.put('/campaigns/api/:id', async (c) => {
  const id = c.req.param('id');
  let body: Partial<{ severity: string; threat_type: string; affected_brands: string[]; iocs: string[]; archived: number; draft_status: string }>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const updates: string[] = [];
  const vals: unknown[] = [];

  if (body.severity !== undefined) { updates.push('severity = ?'); vals.push(body.severity); }
  if (body.threat_type !== undefined) { updates.push('threat_type = ?'); vals.push(body.threat_type); }
  if (body.affected_brands !== undefined) { updates.push('affected_brands = ?'); vals.push(JSON.stringify(body.affected_brands)); }
  if (body.iocs !== undefined) { updates.push('iocs = ?'); vals.push(JSON.stringify(body.iocs)); }
  if (body.archived !== undefined) { updates.push('archived = ?'); vals.push(body.archived); }
  if (body.draft_status !== undefined) { updates.push('draft_status = ?'); vals.push(body.draft_status); }

  if (!updates.length) return c.json({ error: 'No fields to update' }, 400);
  vals.push(id);

  try {
    await c.env.DB.prepare(
      `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...vals).run();
  } catch (err) {
    console.error('[admin/campaigns] D1 update failed:', err);
    return c.json({ error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 500);
  }

  return c.json({ ok: true, id });
});

// --- API: create campaign manually ---
campaignsRouter.post('/campaigns/api/create', async (c) => {
  let body: Partial<{ title: string; slug: string; source: string; source_url: string; threat_type: string; severity: string }>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.title) return c.json({ error: 'title required' }, 400);

  const id = crypto.randomUUID();
  const slug = body.slug ?? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);

  try {
    await c.env.DB.prepare(
      `INSERT INTO campaigns (id, title, slug, source, source_url, threat_type, severity, draft_status, archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`
    ).bind(id, body.title, slug, body.source ?? 'manual', body.source_url ?? null, body.threat_type ?? null, body.severity ?? null, new Date().toISOString()).run();
  } catch (err) {
    console.error('[admin/campaigns] D1 insert failed:', err);
    return c.json({ error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 500);
  }

  return c.json({ ok: true, id }, 201);
});

// --- API: soft delete (archive) ---
campaignsRouter.delete('/campaigns/api/:id', async (c) => {
  try {
    await c.env.DB.prepare('UPDATE campaigns SET archived = 1 WHERE id = ?').bind(c.req.param('id')).run();
  } catch (err) {
    console.error('[admin/campaigns] D1 delete failed:', err);
    return c.json({ error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 500);
  }
  return c.json({ ok: true });
});

// --- HTML: campaign list page ---
campaignsRouter.get('/admin/campaigns', async (c) => {
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') ?? '';
  const source = url.searchParams.get('source') ?? '';
  const severity = url.searchParams.get('severity') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = ['archived = 0'];
  const params: unknown[] = [];
  if (q) { conditions.push("(title LIKE ? OR slug LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  if (source) { conditions.push('source = ?'); params.push(source); }
  if (severity) { conditions.push('severity = ?'); params.push(severity); }
  if (status) { conditions.push('draft_status = ?'); params.push(status); }
  const where = `WHERE ${conditions.join(' AND ')}`;

  let countRow: { total: number } | null = null;
  let rows: { results: DbCampaign[] } = { results: [] };
  try {
    countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM campaigns ${where}`).bind(...params).first<{ total: number }>();
    rows = await c.env.DB.prepare(
      `SELECT id, title, slug, source, severity, draft_status, published_at, created_at
       FROM campaigns ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all<DbCampaign>();
  } catch (err) {
    console.error('[admin/campaigns] D1 HTML list query failed:', err);
    return c.html(adminLayout('Eroare', '<p class="text-red-500">Eroare baza de date.</p>'), 500);
  }
  const total = countRow?.total ?? 0;
  const pages = Math.ceil(total / limit);

  const adminKey = getCookieValue(c.req.header('Cookie') ?? '', 'admin_key') || url.searchParams.get('admin_key') || '';
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(source && { source }), ...(severity && { severity }), ...(status && { status }), ...(adminKey && { admin_key: adminKey }), ...extra });
    return p.toString() ? `?${p.toString()}` : '';
  };

  const rowsHtml = rows.results.map(r => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-2 px-3"><a href="/admin/campaigns/${r.id}${adminKey ? '?admin_key=' + adminKey : ''}" class="text-blue-600 hover:underline text-sm">${escHtml(r.title)}</a></td>
      <td class="py-2 px-3 text-xs text-gray-500">${r.source ?? ''}</td>
      <td class="py-2 px-3">${severityBadge(r.severity)}</td>
      <td class="py-2 px-3">${statusPill(r.draft_status)}</td>
      <td class="py-2 px-3 text-xs text-gray-400">${(r.published_at ?? r.created_at ?? '').slice(0, 10)}</td>
      <td class="py-2 px-3 flex gap-2">
        <a href="/admin/campaigns/${r.id}${adminKey ? '?admin_key=' + adminKey : ''}" class="text-xs text-blue-500 hover:underline">Edit</a>
        <button hx-delete="/campaigns/api/${r.id}" hx-target="closest tr" hx-swap="outerHTML" hx-headers='{"Authorization":"Bearer ${adminKey}"}' class="text-xs text-red-500 hover:underline">Archive</button>
      </td>
    </tr>`).join('');

  const paginationHtml = Array.from({ length: pages }, (_, i) => i + 1).map(p => `
    <a href="/admin/campaigns${qs({ page: String(p) })}" class="px-3 py-1 rounded border text-sm ${p === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}">${p}</a>
  `).join('');

  const body = `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Campanii (${total})</h1>
      <a href="/admin/campaigns/new${adminKey ? '?admin_key=' + adminKey : ''}" class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ Campanie noua</a>
    </div>

    <div class="flex gap-2 mb-4 flex-wrap">
      <input
        type="text" name="q" value="${escHtml(q)}"
        placeholder="Cauta..."
        class="border rounded px-3 py-1.5 text-sm w-64"
        hx-get="/admin/campaigns${qs({})}"
        hx-target="#campaign-table-wrapper"
        hx-trigger="keyup changed delay:300ms"
        hx-push-url="true"
      />
      <select name="severity" class="border rounded px-2 py-1.5 text-sm" hx-get="/admin/campaigns" hx-target="#campaign-table-wrapper" hx-push-url="true">
        <option value="">Toate severit.</option>
        ${['critical','high','medium','low'].map(s => `<option value="${s}" ${severity === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <select name="status" class="border rounded px-2 py-1.5 text-sm" hx-get="/admin/campaigns" hx-target="#campaign-table-wrapper" hx-push-url="true">
        <option value="">Toate statusuri</option>
        ${['pending','draft','published'].map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>

    <div id="campaign-table-wrapper">
      <table class="w-full bg-white rounded shadow text-sm">
        <thead class="bg-gray-100 text-left">
          <tr>
            <th class="py-2 px-3">Titlu</th>
            <th class="py-2 px-3">Sursa</th>
            <th class="py-2 px-3">Severitate</th>
            <th class="py-2 px-3">Status</th>
            <th class="py-2 px-3">Data</th>
            <th class="py-2 px-3">Actiuni</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="6" class="py-8 text-center text-gray-400">Nicio campanie</td></tr>'}</tbody>
      </table>
      <div class="flex gap-2 mt-4">${paginationHtml}</div>
    </div>`;

  return c.html(adminLayout('Campanii', body));
});

// --- HTML: campaign detail/edit ---
campaignsRouter.get('/admin/campaigns/:id', async (c) => {
  if (c.req.param('id') === 'new') return c.redirect('/admin/campaigns/new');
  let row: DbCampaign | null = null;
  try {
    row = await c.env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(c.req.param('id')).first<DbCampaign>();
  } catch (err) {
    console.error('[admin/campaigns] D1 detail query failed:', err);
    return c.html(adminLayout('Eroare', '<p class="text-red-500">Eroare baza de date.</p>'), 500);
  }
  if (!row) return c.html(adminLayout('Not Found', '<p>Campanie negasita.</p>'), 404);

  let brands: string[] = [];
  let iocs: string[] = [];
  try { brands = row.affected_brands ? JSON.parse(row.affected_brands) : []; } catch { brands = []; }
  try { iocs = row.iocs ? JSON.parse(row.iocs) : []; } catch { iocs = []; }
  const adminKey = new URL(c.req.url).searchParams.get('admin_key') ?? '';

  const body = `
    <div class="mb-4"><a href="/admin/campaigns${adminKey ? '?admin_key=' + adminKey : ''}" class="text-blue-500 text-sm hover:underline">&larr; Inapoi</a></div>
    <h1 class="text-xl font-bold mb-4">${escHtml(row.title)}</h1>

    <div class="grid grid-cols-2 gap-6">
      <div class="bg-white rounded shadow p-4">
        <h2 class="font-semibold mb-3">Detalii</h2>
        <dl class="text-sm space-y-2">
          <dt class="text-gray-500">Sursa</dt><dd>${row.source ?? '-'}</dd>
          <dt class="text-gray-500">URL Sursa</dt><dd>${row.source_url ? `<a href="${escHtml(row.source_url)}" target="_blank" class="text-blue-500 hover:underline text-xs break-all">${escHtml(row.source_url)}</a>` : '-'}</dd>
          <dt class="text-gray-500">Publicat la</dt><dd>${row.published_at?.slice(0, 10) ?? '-'}</dd>
          <dt class="text-gray-500">Tip amenintare</dt><dd>${row.threat_type ?? '-'}</dd>
          <dt class="text-gray-500">Branduri afectate</dt><dd>${brands.join(', ') || '-'}</dd>
          <dt class="text-gray-500">Status draft</dt><dd>${statusPill(row.draft_status)}</dd>
        </dl>
      </div>

      <div class="bg-white rounded shadow p-4">
        <h2 class="font-semibold mb-3">Editeaza</h2>
        <form
          hx-put="/campaigns/api/${row.id}"
          hx-headers='{"Authorization":"Bearer ${adminKey}","Content-Type":"application/json"}'
          hx-swap="none"
          class="space-y-3 text-sm"
        >
          <div>
            <label class="block text-gray-500 mb-1">Severitate</label>
            <select name="severity" class="border rounded px-2 py-1.5 w-full">
              ${['critical','high','medium','low'].map(s => `<option value="${s}" ${row.severity === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-gray-500 mb-1">Tip amenintare</label>
            <input type="text" name="threat_type" value="${escHtml(row.threat_type ?? '')}" class="border rounded px-2 py-1.5 w-full"/>
          </div>
          <div>
            <label class="block text-gray-500 mb-1">Status draft</label>
            <select name="draft_status" class="border rounded px-2 py-1.5 w-full">
              ${['pending','draft','published'].map(s => `<option value="${s}" ${row.draft_status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">Salveaza</button>
        </form>
      </div>
    </div>

    ${iocs.length ? `
    <div class="bg-white rounded shadow p-4 mt-4">
      <h2 class="font-semibold mb-3">IOC-uri detectate</h2>
      <ul class="text-xs space-y-1 font-mono">
        ${iocs.map(i => `<li class="break-all text-red-700">${escHtml(i)}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${row.body_text ? `
    <div class="bg-white rounded shadow p-4 mt-4">
      <h2 class="font-semibold mb-3">Continut extras</h2>
      <p class="text-sm text-gray-700 leading-relaxed">${escHtml(row.body_text.slice(0, 2000))}${row.body_text.length > 2000 ? '...' : ''}</p>
    </div>` : ''}`;

  return c.html(adminLayout(row.title, body));
});

// --- HTML: new campaign form ---
campaignsRouter.get('/admin/campaigns/new', async (c) => {
  const adminKey = new URL(c.req.url).searchParams.get('admin_key') ?? '';
  const body = `
    <div class="mb-4"><a href="/admin/campaigns${adminKey ? '?admin_key=' + adminKey : ''}" class="text-blue-500 text-sm hover:underline">&larr; Inapoi</a></div>
    <h1 class="text-xl font-bold mb-4">Campanie noua</h1>
    <div class="bg-white rounded shadow p-6 max-w-lg">
      <form hx-post="/campaigns/api/create"
            hx-headers='{"Authorization":"Bearer ${adminKey}","Content-Type":"application/json"}'
            hx-swap="none"
            class="space-y-4 text-sm">
        <div>
          <label class="block text-gray-500 mb-1">Titlu *</label>
          <input type="text" name="title" required class="border rounded px-3 py-2 w-full"/>
        </div>
        <div>
          <label class="block text-gray-500 mb-1">Sursa</label>
          <input type="text" name="source" value="manual" class="border rounded px-3 py-2 w-full"/>
        </div>
        <div>
          <label class="block text-gray-500 mb-1">URL Sursa</label>
          <input type="url" name="source_url" class="border rounded px-3 py-2 w-full"/>
        </div>
        <div>
          <label class="block text-gray-500 mb-1">Severitate</label>
          <select name="severity" class="border rounded px-2 py-2 w-full">
            ${['critical','high','medium','low'].map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-gray-500 mb-1">Tip amenintare</label>
          <input type="text" name="threat_type" class="border rounded px-3 py-2 w-full"/>
        </div>
        <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 w-full">Creeaza</button>
      </form>
    </div>`;
  return c.html(adminLayout('Campanie noua', body));
});

// --- scraper runs page (redirect from /admin/scrapers) ---
campaignsRouter.get('/admin/scrapers', async (c) => {
  const adminKey = new URL(c.req.url).searchParams.get('admin_key') ?? '';
  let rows: { results: { id: string; source: string; items_found: number; items_new: number; errors: string | null; run_at: string }[] } = { results: [] };
  try {
    rows = await c.env.DB.prepare(
      'SELECT * FROM scraper_runs ORDER BY run_at DESC LIMIT 50'
    ).all<{ id: string; source: string; items_found: number; items_new: number; errors: string | null; run_at: string }>();
  } catch (err) {
    console.error('[admin/scrapers] D1 query failed:', err);
    return c.html(adminLayout('Eroare', '<p class="text-red-500">Eroare baza de date.</p>'), 500);
  }

  const tableRows = rows.results.map(r => `
    <tr class="border-b text-sm">
      <td class="py-2 px-3">${r.source}</td>
      <td class="py-2 px-3">${r.items_found}</td>
      <td class="py-2 px-3">${r.items_new}</td>
      <td class="py-2 px-3">${r.errors ? '<span class="text-red-500">Da</span>' : '<span class="text-green-500">Nu</span>'}</td>
      <td class="py-2 px-3 text-gray-400 text-xs">${r.run_at.slice(0, 19)}</td>
    </tr>`).join('');

  const body = `
    <h1 class="text-xl font-bold mb-4">Scraper Runs</h1>
    <form method="post" action="/admin/scrapers/run${adminKey ? '?admin_key=' + adminKey : ''}">
      <button type="submit" class="mb-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">Ruleaza DNSC acum</button>
    </form>
    <table class="w-full bg-white rounded shadow text-sm">
      <thead class="bg-gray-100 text-left">
        <tr>
          <th class="py-2 px-3">Sursa</th>
          <th class="py-2 px-3">Gasite</th>
          <th class="py-2 px-3">Noi</th>
          <th class="py-2 px-3">Erori</th>
          <th class="py-2 px-3">Data</th>
        </tr>
      </thead>
      <tbody>${tableRows || '<tr><td colspan="5" class="py-8 text-center text-gray-400">Nicio rulare</td></tr>'}</tbody>
    </table>`;

  return c.html(adminLayout('Scrapers', body));
});

// --- Manual scraper trigger ---
campaignsRouter.post('/admin/scrapers/run', async (c) => {
  const { runScraper } = await import('../lib/scraper-runner');
  const { dnscScraper } = await import('../lib/scrapers/dnsc');
  const result = await runScraper(dnscScraper, c.env);
  return c.json(result);
});

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
