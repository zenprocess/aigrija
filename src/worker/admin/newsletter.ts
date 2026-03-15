import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AdminVariables } from '../lib/admin-auth';
import type { CspVariables } from '../lib/csp';
import { adminLayout } from './layout';
import { escapeHtml } from '../lib/escape-html';
import { structuredLog } from '../lib/logger';

type AdminEnv = { Bindings: Env; Variables: AdminVariables & CspVariables };

// ---- Types -----------------------------------------------------------------

interface ButtondownSubscriber {
  id: string;
  email: string;
  creation_date: string;
  subscriber_type: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

interface ButtondownListResponse {
  results: ButtondownSubscriber[];
  count: number;
  next: string | null;
  previous: string | null;
}

// ---- Helpers ---------------------------------------------------------------

export const BUTTONDOWN_API_BASE = 'https://api.buttondown.com/v1';
const PAGE_SIZE = 50;

export async function fetchButtondownSubscribers(
  apiKey: string,
  page: number
): Promise<ButtondownListResponse> {
  const url = `${BUTTONDOWN_API_BASE}/subscribers?page=${page}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Buttondown API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ButtondownListResponse>;
}

export async function deleteButtondownSubscriber(apiKey: string, email: string): Promise<void> {
  const searchUrl = `${BUTTONDOWN_API_BASE}/subscribers?email=${encodeURIComponent(email)}`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!searchRes.ok) {
    throw new Error(`Buttondown lookup error: ${searchRes.status}`);
  }
  const data = (await searchRes.json()) as ButtondownListResponse;
  if (!data.results || data.results.length === 0) {
    throw new Error('Subscriber not found in Buttondown');
  }
  const subscriberId = data.results[0].id;

  const delUrl = `${BUTTONDOWN_API_BASE}/subscribers/${subscriberId}`;
  const delRes = await fetch(delUrl, {
    method: 'DELETE',
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!delRes.ok && delRes.status !== 204) {
    throw new Error(`Buttondown delete error: ${delRes.status}`);
  }
}

// ---- Router ----------------------------------------------------------------

export const newsletterAdmin = new Hono<AdminEnv>();

newsletterAdmin.get('/', async (c) => {
  const email = c.get('adminEmail');
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

  const apiKey = c.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return c.html(adminLayout('Newsletter Subscribers', '<p class="text-red-500">BUTTONDOWN_API_KEY missing.</p>', 'abonati', email, c.get('cspNonce')), 500);
  }

  let data: ButtondownListResponse;
  try {
    data = await fetchButtondownSubscribers(apiKey, page);
  } catch (err) {
    structuredLog('error', 'admin_newsletter_list_failed', { error: String(err) });
    return c.html(adminLayout('Newsletter Subscribers', `<p class="text-red-500">Buttondown API Error: ${escapeHtml(String(err))}</p>`, 'abonati', email, c.get('cspNonce')), 502);
  }

  const totalPages = Math.ceil(data.count / PAGE_SIZE);

  const rowsHtml = data.results.map(s => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-2 px-3 text-sm">${escapeHtml(s.email)}</td>
      <td class="py-2 px-3 text-xs text-gray-500">${escapeHtml(s.subscriber_type)}</td>
      <td class="py-2 px-3 text-xs text-gray-400">${(s.creation_date ?? '').slice(0, 10)}</td>
      <td class="py-2 px-3 text-xs text-gray-400">${(s.tags ?? []).map(escapeHtml).join(', ')}</td>
      <td class="py-2 px-3">
        <button
          hx-delete="/admin/abonati/${encodeURIComponent(s.email)}"
          hx-confirm="Delete ${escapeHtml(s.email)}?"
          hx-target="closest tr"
          hx-swap="outerHTML"
          class="text-xs text-red-500 hover:underline">
          Delete
        </button>
      </td>
    </tr>`).join('');

  const paginationHtml = Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
    `<a href="?page=${p}" class="px-3 py-1 rounded border text-sm ${p === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}">${p}</a>`
  ).join('');

  const body = `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Newsletter Subscribers (${data.count})</h1>
      <a href="/admin/abonati/export" class="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Export CSV</a>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full bg-white rounded shadow text-sm">
        <thead class="bg-gray-100 text-left">
          <tr>
            <th class="py-2 px-3">Email</th>
            <th class="py-2 px-3">Type</th>
            <th class="py-2 px-3">Signup Date</th>
            <th class="py-2 px-3">Tags</th>
            <th class="py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="5" class="py-8 text-center text-gray-400">No subscribers</td></tr>'}</tbody>
      </table>
      <div class="flex gap-2 mt-4">${paginationHtml}</div>
    </div>`;

  return c.html(adminLayout('Newsletter Subscribers', body, 'abonati', email, c.get('cspNonce')));
});

newsletterAdmin.get('/export', async (c) => {
  const apiKey = c.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return c.text('BUTTONDOWN_API_KEY missing', 500);
  }

  const rows: ButtondownSubscriber[] = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const data = await fetchButtondownSubscribers(apiKey, page);
      rows.push(...data.results);
      hasMore = data.next !== null && data.results.length > 0;
      page++;
      if (page > 20) break; // Safety cap: max 1000 subscribers (20 pages × 50/page)
    }
  } catch (err) {
    structuredLog('error', 'admin_newsletter_export_failed', { error: String(err) });
    return c.text(`Export error: ${String(err)}`, 502);
  }

  const csvHeader = 'email,subscriber_type,creation_date,tags\n';
  const csvRows = rows.map(s => {
    const tags = (s.tags ?? []).join('|');
    return `"${s.email.replace(/"/g, '""')}","${s.subscriber_type}","${(s.creation_date ?? '').slice(0, 10)}","${tags}"`;
  }).join('\n');

  const csv = csvHeader + csvRows;
  const filename = `abonati-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

newsletterAdmin.delete('/:email', async (c) => {
  const rawEmail = c.req.param('email');
  const email = decodeURIComponent(rawEmail);
  const apiKey = c.env.BUTTONDOWN_API_KEY;

  if (!apiKey) {
    return c.html('<tr><td colspan="5" class="py-2 px-3 text-red-500 text-sm">BUTTONDOWN_API_KEY missing</td></tr>', 500);
  }

  try {
    await deleteButtondownSubscriber(apiKey, email);
  } catch (err) {
    structuredLog('error', 'admin_newsletter_delete_buttondown_failed', { email, error: String(err) });
    return c.html(`<tr><td colspan="5" class="py-2 px-3 text-red-500 text-sm">Buttondown Error: ${escapeHtml(String(err))}</td></tr>`, 502);
  }

  if (c.env.CACHE) {
    try {
      await c.env.CACHE.delete(`consent:email:${email}`);
      structuredLog('info', 'admin_newsletter_consent_purged', { email });
    } catch (err) {
      structuredLog('warn', 'admin_newsletter_consent_purge_failed', { email, error: String(err) });
    }
  }

  structuredLog('info', 'admin_newsletter_subscriber_deleted', { email });
  return c.html('');
});
