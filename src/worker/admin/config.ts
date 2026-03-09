import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AdminVariables } from '../lib/admin-auth';
import { adminLayout } from './layout';

type AdminEnv = { Bindings: Env; Variables: AdminVariables };

const FEATURE_FLAGS = [
  { name: 'dnsc_scraper', label: 'DNSC Scraper' },
  { name: 'anaf_scraper', label: 'ANAF Scraper' },
  { name: 'bitdefender_scraper', label: 'Bitdefender Scraper' },
  { name: 'ai_draft_generation', label: 'AI Draft Generation' },
  { name: 'community_voting', label: 'Community Voting' },
  { name: 'qr_scanner', label: 'QR Scanner' },
];

const RATE_LIMIT_ENDPOINTS = [
  { name: 'telegram', label: 'Telegram', default: 50 },
  { name: 'whatsapp', label: 'WhatsApp', default: 50 },
  { name: 'check', label: 'Check API', default: 100 },
  { name: 'community_vote', label: 'Community Voting', default: 10 },
];

const CIRCUIT_BREAKERS = ['safe-browsing', 'urlhaus', 'virustotal', 'rdap'];

const CACHE_PREFIXES = [
  { prefix: 'url-threat:', label: 'URL threat cache' },
  { prefix: 'rdap:', label: 'RDAP / Domains' },
  { prefix: 'content:', label: 'Content cache' },
  { prefix: 'i18n:', label: 'Translations (overrides)' },
];

async function getFlagStatus(kv: KVNamespace, name: string): Promise<{ enabled: boolean; changedAt: string | null }> {
  try {
    const raw = await kv.get(`config:flags:${name}`);
    if (raw) {
      const parsed = JSON.parse(raw) as { enabled: boolean; changedAt: string };
      return parsed;
    }
  } catch { /* ignore */ }
  return { enabled: true, changedAt: null };
}

async function getRateLimit(kv: KVNamespace, endpoint: string, def: number): Promise<number> {
  try {
    const raw = await kv.get(`config:ratelimit:${endpoint}`);
    if (raw) return parseInt(raw, 10);
  } catch { /* ignore */ }
  return def;
}

async function getCbState(kv: KVNamespace, name: string): Promise<string> {
  try {
    const raw = await kv.get(`cb:${name}`);
    if (raw) {
      const parsed = JSON.parse(raw) as { state: string };
      return parsed.state ?? 'closed';
    }
  } catch { /* ignore */ }
  return 'closed';
}

async function configPage(kv: KVNamespace, email: string): Promise<string> {
  const [flagStatuses, rateLimits, cbStates] = await Promise.all([
    Promise.all(FEATURE_FLAGS.map(f => getFlagStatus(kv, f.name).then(s => ({ ...f, ...s })))),
    Promise.all(RATE_LIMIT_ENDPOINTS.map(e => getRateLimit(kv, e.name, e.default).then(v => ({ ...e, value: v })))),
    Promise.all(CIRCUIT_BREAKERS.map(n => getCbState(kv, n).then(s => ({ name: n, state: s })))),
  ]);

  const flagRows = flagStatuses.map(f => {
    const checked = f.enabled ? 'checked' : '';
    const badge = f.enabled
      ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ON</span>'
      : '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">OFF</span>';
    return `
    <tr class="border-b border-gray-100">
      <td class="py-3 px-4 text-sm text-gray-700">${f.label}</td>
      <td class="py-3 px-4">${badge}</td>
      <td class="py-3 px-4 text-xs text-gray-400">${f.changedAt ? new Date(f.changedAt).toLocaleString('en-US') : '—'}</td>
      <td class="py-3 px-4">
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" ${checked} class="sr-only peer"
                 onchange="toggleFlag('${f.name}', this.checked)">
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </td>
    </tr>`;
  }).join('');

  const rlRows = rateLimits.map(r => `
    <tr class="border-b border-gray-100">
      <td class="py-3 px-4 text-sm text-gray-700">${r.label}</td>
      <td class="py-3 px-4">
        <input type="number" value="${r.value}" min="1" max="10000"
               class="border border-gray-200 rounded px-2 py-1 text-sm w-24"
               onchange="saveRateLimit('${r.name}', this.value)">
        <span class="text-xs text-gray-400 ml-1">/ hour</span>
      </td>
      <td class="py-3 px-4 text-xs text-gray-400">default: ${r.default}</td>
    </tr>`).join('');

  const cbStateClass = (s: string) =>
    s === 'closed' ? 'bg-green-100 text-green-700' :
    s === 'open' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';

  const cbRows = cbStates.map(cb => `
    <tr class="border-b border-gray-100">
      <td class="py-3 px-4 text-sm text-gray-700 font-mono">${cb.name}</td>
      <td class="py-3 px-4">
        <span class="text-xs px-2 py-0.5 rounded-full ${cbStateClass(cb.state)}">${cb.state}</span>
      </td>
      <td class="py-3 px-4">
        ${cb.state !== 'closed' ? `<button onclick="resetCb('${cb.name}')" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded">Reset (close)</button>` : '<span class="text-xs text-gray-300">OK</span>'}
      </td>
    </tr>`).join('');

  const cacheButtons = CACHE_PREFIXES.map(p => `
    <div class="flex items-center justify-between py-2 border-b border-gray-100">
      <span class="text-sm text-gray-700">${p.label} <span class="font-mono text-xs text-gray-400">${p.prefix}</span></span>
      <button onclick="flushCache('${p.prefix}')" class="text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded">Flush</button>
    </div>`).join('');

  const content = `
    <div id="config-notify" class="fixed bottom-4 right-4 hidden bg-green-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg"></div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Feature Flags -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="font-semibold text-gray-700 mb-3">Feature Flags</h3>
        <table class="w-full">
          <thead><tr class="text-xs text-gray-400 border-b border-gray-100">
            <th class="text-left py-2 px-4">Feature</th>
            <th class="text-left py-2 px-4">Status</th>
            <th class="text-left py-2 px-4">Modified</th>
            <th class="text-left py-2 px-4">Toggle</th>
          </tr></thead>
          <tbody>${flagRows}</tbody>
        </table>
      </div>

      <!-- Rate Limits -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="font-semibold text-gray-700 mb-3">Rate Limits</h3>
        <table class="w-full">
          <thead><tr class="text-xs text-gray-400 border-b border-gray-100">
            <th class="text-left py-2 px-4">Endpoint</th>
            <th class="text-left py-2 px-4">Limit / hour</th>
            <th class="text-left py-2 px-4">Default</th>
          </tr></thead>
          <tbody>${rlRows}</tbody>
        </table>
      </div>

      <!-- Circuit Breakers -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="font-semibold text-gray-700 mb-3">Circuit Breakers</h3>
        <table class="w-full">
          <thead><tr class="text-xs text-gray-400 border-b border-gray-100">
            <th class="text-left py-2 px-4">Service</th>
            <th class="text-left py-2 px-4">State</th>
            <th class="text-left py-2 px-4">Actions</th>
          </tr></thead>
          <tbody>${cbRows}</tbody>
        </table>
      </div>

      <!-- Cache Management -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="font-semibold text-gray-700 mb-3">Cache Management</h3>
        ${cacheButtons}
        <div id="cache-result" class="mt-3 text-sm"></div>
      </div>

    </div>

    <script>
    function notify(msg, ok = true) {
      const el = document.getElementById('config-notify');
      el.textContent = msg;
      el.className = 'fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm shadow-lg text-white ' + (ok ? 'bg-green-600' : 'bg-red-600');
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 2500);
    }
    async function toggleFlag(name, enabled) {
      const res = await fetch('/admin/config/flag', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name, enabled})
      });
      notify(res.ok ? 'Flag updated.' : 'Flag error.', res.ok);
      if (res.ok) setTimeout(() => location.reload(), 800);
    }
    async function saveRateLimit(endpoint, limit) {
      const res = await fetch('/admin/config/ratelimit', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({endpoint, limit: parseInt(limit, 10)})
      });
      notify(res.ok ? 'Rate limit saved.' : 'Rate limit error.', res.ok);
    }
    async function resetCb(name) {
      const res = await fetch('/admin/config/circuit-reset', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name})
      });
      notify(res.ok ? 'Circuit breaker reset.' : 'Reset error.', res.ok);
      if (res.ok) setTimeout(() => location.reload(), 800);
    }
    async function flushCache(prefix) {
      if (!confirm('Delete all keys with prefix "' + prefix + '"?')) return;
      const res = await fetch('/admin/config/cache-flush', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({prefix})
      });
      const j = await res.json();
      document.getElementById('cache-result').textContent = res.ok ? 'Deleted ' + (j.deleted ?? 0) + ' keys.' : 'Flush error.';
      notify(res.ok ? 'Cache flushed.' : 'Cache error.', res.ok);
    }
    </script>`;

  return adminLayout('System Configuration', content, 'config', email);
}

export const configAdmin = new Hono<AdminEnv>();

configAdmin.get('/', async (c) => {
  const email = c.get('adminEmail');
  return c.html(await configPage(c.env.CACHE, email));
});

configAdmin.post('/flag', async (c) => {
  const { name, enabled } = await c.req.json<{ name: string; enabled: boolean }>();
  const validNames = FEATURE_FLAGS.map(f => f.name);
  if (!name || !validNames.includes(name)) return c.json({ error: 'Invalid flag name' }, 400);
  await c.env.CACHE.put(`config:flags:${name}`, JSON.stringify({ enabled, changedAt: new Date().toISOString() }));
  return c.json({ ok: true });
});

configAdmin.post('/ratelimit', async (c) => {
  const { endpoint, limit } = await c.req.json<{ endpoint: string; limit: number }>();
  const validEndpoints = RATE_LIMIT_ENDPOINTS.map(e => e.name);
  if (!endpoint || !validEndpoints.includes(endpoint)) return c.json({ error: 'Invalid endpoint' }, 400);
  if (typeof limit !== 'number' || limit < 1) return c.json({ error: 'Invalid limit' }, 400);
  await c.env.CACHE.put(`config:ratelimit:${endpoint}`, String(limit));
  return c.json({ ok: true });
});

configAdmin.post('/circuit-reset', async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name || !CIRCUIT_BREAKERS.includes(name)) return c.json({ error: 'Invalid circuit breaker name' }, 400);
  await c.env.CACHE.delete(`cb:${name}`);
  return c.json({ ok: true });
});

configAdmin.post('/cache-flush', async (c) => {
  const { prefix } = await c.req.json<{ prefix: string }>();
  const validPrefixes = CACHE_PREFIXES.map(p => p.prefix);
  if (!prefix || !validPrefixes.includes(prefix)) return c.json({ error: 'Invalid prefix' }, 400);
  let deleted = 0;
  try {
    let cursor: string | undefined;
    do {
      const result = await c.env.CACHE.list({ prefix, cursor });
      await Promise.all(result.keys.map(k => c.env.CACHE.delete(k.name)));
      deleted += result.keys.length;
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
  } catch {
    return c.json({ error: 'Flush failed' }, 500);
  }
  return c.json({ ok: true, deleted });
});
