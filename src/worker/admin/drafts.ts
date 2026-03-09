import { Hono } from 'hono';
import type { Env, Campaign } from '../lib/types';
import { structuredLog } from '../lib/logger';
import { markdownToHtml } from '../lib/markdown';
import { publishToSanity } from '../lib/sanity-writer';
import { generateDraft } from '../lib/draft-generator';
import { adminLayout } from './layout';

const drafts = new Hono<{ Bindings: Env }>();

// GET /admin/drafts — list campaigns with draft_status in (generated, approved)
drafts.get('/', async (c) => {
  const status = new URL(c.req.url).searchParams.get('status') || '';
  let query = `SELECT id, title, source, severity, threat_type, draft_status, created_at, updated_at FROM campaigns WHERE draft_status IN ('generated','approved','published','rejected')`;
  const bindings: unknown[] = [];
  if (status) {
    query = `SELECT id, title, source, severity, threat_type, draft_status, created_at, updated_at FROM campaigns WHERE draft_status = ?`;
    bindings.push(status);
  }

  const rows = await c.env.DB.prepare(query).bind(...(bindings as [unknown, ...unknown[]])).all<Campaign>();
  const campaigns = rows.results || [];

  const statusBadge = (s: string | undefined) => {
    const colors: Record<string, string> = {
      generated: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      published: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    const cls = colors[s || ''] || 'bg-gray-100 text-gray-600';
    return `<span class="px-2 py-0.5 rounded text-xs font-medium ${cls}">${s || '—'}</span>`;
  };

  const rows_html = campaigns.map((c) => `
    <tr class="border-t hover:bg-gray-50">
      <td class="py-2 px-3 text-sm font-medium"><a href="/admin/drafts/${c.id}" class="text-blue-600 hover:underline">${escHtml(c.title || '')}</a></td>
      <td class="py-2 px-3 text-sm text-gray-600">${escHtml(c.threat_type || '')}</td>
      <td class="py-2 px-3 text-sm">${escHtml(c.severity || '')}</td>
      <td class="py-2 px-3 text-sm">${statusBadge(c.draft_status)}</td>
      <td class="py-2 px-3 text-sm text-gray-500">${(c.updated_at || c.created_at || '').split('T')[0]}</td>
    </tr>
  `).join('');

  const filterLinks = ['', 'generated', 'approved', 'published', 'rejected'].map((s) =>
    `<a href="?status=${s}" class="px-3 py-1 rounded text-sm ${s === status ? 'bg-red-700 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}">${s || 'All'}</a>`
  ).join('');

  const body = `
    <div class="flex gap-2 mb-4">${filterLinks}</div>
    ${campaigns.length === 0 ? '<p class="text-gray-500">No drafts found.</p>' : `
    <div class="bg-white rounded shadow overflow-auto">
      <table class="w-full text-left">
        <thead class="bg-gray-100 text-xs uppercase text-gray-600">
          <tr>
            <th class="py-2 px-3">Title</th>
            <th class="py-2 px-3">Type</th>
            <th class="py-2 px-3">Severity</th>
            <th class="py-2 px-3">Status</th>
            <th class="py-2 px-3">Date</th>
          </tr>
        </thead>
        <tbody>${rows_html}</tbody>
      </table>
    </div>`}
  `;

  return c.html(adminLayout('AI Drafts', body));
});

// GET /admin/drafts/:id — review page
drafts.get('/:id', async (c) => {
  const id = c.req.param('id');
  const campaign = await c.env.DB.prepare(`SELECT * FROM campaigns WHERE id = ?`).bind(id).first<Campaign>();

  if (!campaign) {
    return c.text('Campaign not found', 404);
  }

  const draftHtml = campaign.draft_content
    ? markdownToHtml(campaign.draft_content)
    : '<p class="text-gray-400 italic">Draft not yet generated.</p>';

  const key = new URL(c.req.url).searchParams.get('key') || '';
  const authParam = key ? `?key=${encodeURIComponent(key)}` : '';

  const actionBtn = (action: string, label: string, color: string) =>
    `<form method="POST" action="/admin/drafts/${id}/${action}${authParam}" class="inline">
      <button type="submit" class="px-3 py-1.5 rounded text-sm font-medium text-white ${color} hover:opacity-90">${label}</button>
    </form>`;

  const body = `
    <div class="mb-4 flex flex-wrap gap-2">
      ${actionBtn('approve', 'Approve', 'bg-green-600')}
      ${actionBtn('publish', 'Publish to Sanity', 'bg-blue-600')}
      ${actionBtn('reject', 'Reject', 'bg-red-600')}
      ${actionBtn('regenerate', 'Regenerate', 'bg-yellow-600')}
      ${actionBtn('publish-multi', 'Multi-Publish', 'bg-purple-600')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left: original campaign data -->
      <div class="bg-white rounded shadow p-4">
        <h2 class="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Original Campaign Data</h2>
        <dl class="space-y-2 text-sm">
          <div><dt class="text-gray-500 font-medium">Title</dt><dd class="text-gray-900">${escHtml(campaign.title || '')}</dd></div>
          <div><dt class="text-gray-500 font-medium">Threat Type</dt><dd>${escHtml(campaign.threat_type || '')}</dd></div>
          <div><dt class="text-gray-500 font-medium">Severity</dt><dd>${escHtml(campaign.severity || '')}</dd></div>
          <div><dt class="text-gray-500 font-medium">Affected Brands</dt><dd>${escHtml(campaign.affected_brands || '')}</dd></div>
          <div><dt class="text-gray-500 font-medium">Source</dt><dd>${campaign.source_url ? `<a href="${escHtml(campaign.source_url)}" target="_blank" class="text-blue-600 underline">${escHtml(campaign.source_url)}</a>` : escHtml(campaign.source || '')}</dd></div>
          <div><dt class="text-gray-500 font-medium">Draft Status</dt><dd><span class="font-medium">${campaign.draft_status || '—'}</span></dd></div>
        </dl>
        <div class="mt-4">
          <dt class="text-gray-500 font-medium text-sm mb-1">Source Text</dt>
          <dd class="bg-gray-50 rounded p-2 text-xs text-gray-700 max-h-64 overflow-y-auto whitespace-pre-wrap">${escHtml((campaign.body_text || '').slice(0, 3000))}</dd>
        </div>
      </div>
      <!-- Right: AI draft preview -->
      <div class="bg-white rounded shadow p-4">
        <h2 class="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">AI-Generated Draft</h2>
        <div class="prose max-w-none text-sm overflow-y-auto max-h-[70vh]">${draftHtml}</div>
        <div class="mt-4 border-t pt-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Edit Draft</h3>
          <form method="POST" action="/admin/drafts/${id}/edit${authParam}">
            <textarea name="draft_content" rows="12" class="w-full border rounded p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400">${escHtml(campaign.draft_content || '')}</textarea>
            <button type="submit" class="mt-2 px-3 py-1.5 rounded bg-gray-700 text-white text-sm hover:bg-gray-800">Save Draft</button>
          </form>
        </div>
      </div>
    </div>
  `;

  return c.html(adminLayout(`Draft: ${campaign.title}`, body));
});

// POST /admin/drafts/:id/approve
drafts.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`UPDATE campaigns SET draft_status='approved', updated_at=? WHERE id=?`)
    .bind(new Date().toISOString(), id).run();
  structuredLog('info', '[admin/drafts] Approved', { campaignId: id });
  return c.redirect(`/admin/drafts/${id}`);
});

// POST /admin/drafts/:id/reject
drafts.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`UPDATE campaigns SET draft_status='rejected', updated_at=? WHERE id=?`)
    .bind(new Date().toISOString(), id).run();
  structuredLog('info', '[admin/drafts] Rejected', { campaignId: id });
  return c.redirect(`/admin/drafts/${id}`);
});

// POST /admin/drafts/:id/edit
drafts.post('/:id/edit', async (c) => {
  const id = c.req.param('id');
  let body: FormData;
  try {
    body = await c.req.formData();
  } catch {
    return c.text('Invalid form data', 400);
  }
  const content = body.get('draft_content')?.toString() || '';
  await c.env.DB.prepare(`UPDATE campaigns SET draft_content=?, draft_status='generated', updated_at=? WHERE id=?`)
    .bind(content, new Date().toISOString(), id).run();
  structuredLog('info', '[admin/drafts] Edited', { campaignId: id, contentLength: content.length });
  return c.redirect(`/admin/drafts/${id}`);
});

// POST /admin/drafts/:id/publish
drafts.post('/:id/publish', async (c) => {
  const id = c.req.param('id');
  const campaign = await c.env.DB.prepare(`SELECT * FROM campaigns WHERE id=?`).bind(id).first<Campaign>();
  if (!campaign) return c.text('Not found', 404);

  try {
    const result = await publishToSanity(campaign, campaign.draft_content || '', 'threatReport', c.env);
    await c.env.DB.prepare(`UPDATE campaigns SET draft_status='published', updated_at=? WHERE id=?`)
      .bind(new Date().toISOString(), id).run();
    structuredLog('info', '[admin/drafts] Published', { campaignId: id, sanityId: result.id });
    return c.json({ ok: true, sanityId: result.id });
  } catch (err) {
    structuredLog('error', '[admin/drafts] Publish failed', { campaignId: id, error: String(err) });
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// POST /admin/drafts/:id/regenerate
drafts.post('/:id/regenerate', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`UPDATE campaigns SET draft_status='pending', updated_at=? WHERE id=?`)
    .bind(new Date().toISOString(), id).run();

  if (c.env.DRAFT_QUEUE) {
    await c.env.DRAFT_QUEUE.send({ campaignId: id, requestedAt: new Date().toISOString() });
    structuredLog('info', '[admin/drafts] Queued for regeneration', { campaignId: id });
  } else {
    // Fallback: generate synchronously
    try {
      await generateDraft(id, c.env);
    } catch (err) {
      structuredLog('error', '[admin/drafts] Sync regeneration failed', { campaignId: id, error: String(err) });
    }
  }

  return c.redirect(`/admin/drafts/${id}`);
});

// POST /admin/drafts/:id/publish-multi
drafts.post('/:id/publish-multi', async (c) => {
  const id = c.req.param('id');
  const campaign = await c.env.DB.prepare(`SELECT * FROM campaigns WHERE id=?`).bind(id).first<Campaign>();
  if (!campaign) return c.text('Not found', 404);

  const results: { type: string; id: string }[] = [];
  const types = ['threatReport', 'guide', 'education'];

  for (const contentType of types) {
    try {
      const result = await publishToSanity(campaign, campaign.draft_content || '', contentType, c.env);
      results.push({ type: contentType, id: result.id });
    } catch (err) {
      structuredLog('error', '[admin/drafts] Multi-publish partial failure', { campaignId: id, contentType, error: String(err) });
    }
  }

  if (results.length > 0) {
    await c.env.DB.prepare(`UPDATE campaigns SET draft_status='published', updated_at=? WHERE id=?`)
      .bind(new Date().toISOString(), id).run();
  }

  return c.json({ ok: true, published: results });
});

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


export { drafts };
