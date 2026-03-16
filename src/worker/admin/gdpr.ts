import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { adminLayout } from './layout';
import { type AdminVariables } from '../lib/admin-auth';
import { type CspVariables } from '../lib/csp';

type AdminEnv = { Bindings: Env; Variables: AdminVariables & CspVariables };

const CHANNELS = ['tg', 'wa', 'email'] as const;

/**
 * Collect all KV keys matching a user identifier across all channels.
 * Key patterns:
 *   consent:{channel}:{identifier}
 *   {channel}:subscriber:{identifier}
 */
async function collectUserKeys(kv: KVNamespace, identifier: string): Promise<string[]> {
  const keys: string[] = [];

  for (const channel of CHANNELS) {
    const consentKey = `consent:${channel}:${identifier}`;
    const subscriberKey = `${channel}:subscriber:${identifier}`;

    const [consentVal, subscriberVal] = await Promise.all([
      kv.get(consentKey),
      kv.get(subscriberKey),
    ]);

    if (consentVal !== null) keys.push(consentKey);
    if (subscriberVal !== null) keys.push(subscriberKey);
  }

  return keys;
}

export const gdprAdmin = new Hono<AdminEnv>();

/**
 * GET /gdpr
 * GDPR admin dashboard — lookup tool for export, purge, and consent-log operations.
 */
gdprAdmin.get('/', (c) => {
  const email = c.get('adminEmail');
  const nonce = c.get('cspNonce');
  const content = `
    <div class="max-w-xl">
      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 class="text-gray-700 font-semibold mb-4">GDPR User Lookup</h2>
        <p class="text-sm text-gray-500 mb-4">Enter a user identifier (Telegram ID, email, or phone) to export or purge their data.</p>
        <div class="space-y-3">
          <div>
            <label class="block text-sm text-gray-600 mb-1" for="gdpr-id">User Identifier</label>
            <input type="text" id="gdpr-id" placeholder="e.g. 123456789 or user@example.com"
              class="border rounded px-3 py-2 w-full text-sm"/>
          </div>
          <div class="flex gap-2 flex-wrap">
            <a id="btn-export" href="#" class="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium">Export Data</a>
            <a id="btn-consent" href="#" class="inline-block bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm font-medium">Consent Log</a>
            <a id="btn-purge" href="#" class="inline-block bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm font-medium">Purge Data</a>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
        <p><strong>Export:</strong> GET /admin/gdpr/export/:identifier</p>
        <p><strong>Consent Log:</strong> GET /admin/gdpr/consent-log/:identifier</p>
        <p><strong>Purge:</strong> DELETE /admin/gdpr/purge/:identifier</p>
      </div>
    </div>
    <script nonce="${nonce}">
    document.querySelectorAll('#btn-export,#btn-consent,#btn-purge').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const id = document.getElementById('gdpr-id').value.trim();
        if (!id) { alert('Enter a user identifier first.'); return; }
        const map = { 'btn-export': '/admin/gdpr/export/', 'btn-consent': '/admin/gdpr/consent-log/', 'btn-purge': null };
        if (this.id === 'btn-purge') {
          if (!confirm('Permanently delete all data for: ' + id + '?')) return;
          fetch('/admin/gdpr/purge/' + encodeURIComponent(id), { method: 'DELETE' })
            .then(r => r.json()).then(d => alert(d.ok ? 'Purged ' + d.deleted + ' keys.' : 'Error: ' + d.error));
        } else {
          window.location.href = map[this.id] + encodeURIComponent(id);
        }
      });
    });
    </script>`;
  return c.html(adminLayout('GDPR', content, 'gdpr', email, nonce));
});

/**
 * GET /gdpr/export/:identifier
 * Export all KV data for a user identified by Telegram ID, email, or phone.
 */
gdprAdmin.get('/export/:identifier', async (c) => {
  const identifier = c.req.param('identifier');

  if (!identifier) {
    return c.json({ ok: false, error: 'identifier required' }, 400);
  }

  const keys = await collectUserKeys(c.env.CACHE, identifier);

  const entries: Record<string, unknown> = {};
  await Promise.all(
    keys.map(async (key) => {
      const value = await c.env.CACHE.get(key, 'json');
      entries[key] = value;
    })
  );

  return c.json({
    ok: true,
    identifier,
    count: keys.length,
    data: entries,
  });
});

/**
 * DELETE /gdpr/purge/:identifier
 * Delete all KV entries (consent + subscriber records) for a user.
 */
gdprAdmin.delete('/purge/:identifier', async (c) => {
  const identifier = c.req.param('identifier');

  if (!identifier) {
    return c.json({ ok: false, error: 'identifier required' }, 400);
  }

  const keys = await collectUserKeys(c.env.CACHE, identifier);

  await Promise.all(keys.map((key) => c.env.CACHE.delete(key)));

  return c.json({
    ok: true,
    identifier,
    deleted: keys.length,
  });
});

/**
 * GET /gdpr/consent-log/:identifier
 * Return consent timeline from KV for all channels.
 * Key pattern: consent:{channel}:{identifier}
 */
gdprAdmin.get('/consent-log/:identifier', async (c) => {
  const identifier = c.req.param('identifier');

  if (!identifier) {
    return c.json({ ok: false, error: 'identifier required' }, 400);
  }

  const timeline: Array<{ key: string; channel: string; record: unknown }> = [];

  await Promise.all(
    CHANNELS.map(async (channel) => {
      const key = `consent:${channel}:${identifier}`;
      const record = await c.env.CACHE.get(key, 'json');
      if (record !== null) {
        timeline.push({ key, channel, record });
      }
    })
  );

  timeline.sort((a, b) => a.channel.localeCompare(b.channel));

  return c.json({
    ok: true,
    identifier,
    count: timeline.length,
    timeline,
  });
});
