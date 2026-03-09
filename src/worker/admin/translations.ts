import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AdminVariables } from '../lib/admin-auth';
import { adminLayout } from './layout';

type AdminEnv = { Bindings: Env; Variables: AdminVariables };

const SUPPORTED_LANGS = ['ro', 'bg', 'hu', 'uk', 'en'] as const;
type Lang = typeof SUPPORTED_LANGS[number];

const LANG_LABELS: Record<Lang, string> = {
  ro: 'Romanian (reference)',
  bg: 'Bulgarian',
  hu: 'Hungarian',
  uk: 'Ukrainian',
  en: 'English',
};

const LANG_FULL_NAMES: Record<Exclude<Lang, 'ro'>, string> = {
  en: 'English',
  bg: 'Bulgarian',
  hu: 'Hungarian',
  uk: 'Ukrainian',
};

const MAX_PER_REQUEST = 50;

async function aiTranslate(ai: Ai, targetLang: string, sourceText: string): Promise<string> {
  const systemPrompt = `You are a professional translator. Translate the following text from Romanian to ${targetLang}. Return ONLY the translation, nothing else. Keep the same tone, formality, and formatting.`;
  // @ts-expect-error - Workers AI types don't include all model strings
  const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sourceText },
    ],
  });
  return (result as { response?: string }).response?.trim() || '';
}

// Flatten nested JSON into dot-separated keys
function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenKeys(v as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(v);
    }
  }
  return result;
}

// Reference keys hardcoded from ro.json (flattened)
import roJson from '../../ui/src/i18n/ro.json';
const RO_FLAT = flattenKeys(roJson as Record<string, unknown>);

async function getLangKeys(kv: KVNamespace, lang: Lang): Promise<Record<string, string>> {
  const base: Record<string, string> = lang === 'ro' ? { ...RO_FLAT } : {};
  try {
    const list = await kv.list({ prefix: `i18n:${lang}:` });
    await Promise.all(list.keys.map(async ({ name }) => {
      const key = name.replace(`i18n:${lang}:`, '');
      const val = await kv.get(name);
      if (val !== null) base[key] = val;
    }));
  } catch {
    // ignore
  }
  return base;
}

async function getKvOverrides(kv: KVNamespace, lang: Lang): Promise<Set<string>> {
  const overrides = new Set<string>();
  try {
    const list = await kv.list({ prefix: `i18n:${lang}:` });
    for (const { name } of list.keys) {
      overrides.add(name.replace(`i18n:${lang}:`, ''));
    }
  } catch {
    // ignore
  }
  return overrides;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function translationsPage(activeLang: Lang, keys: Record<string, string>, overrides: Set<string>, email: string, search = ''): string {
  const tabs = SUPPORTED_LANGS.map(l => {
    const active = l === activeLang;
    return `<a href="/admin/traduceri?lang=${l}"
       class="px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${active ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}">
       ${LANG_LABELS[l]}
    </a>`;
  }).join('');

  const filteredEntries = Object.entries(RO_FLAT).filter(([k]) =>
    !search || k.toLowerCase().includes(search.toLowerCase())
  );

  const isRoLang = activeLang === 'ro';

  const rows = filteredEntries.map(([key, roVal]) => {
    const currentVal = keys[key] ?? '';
    const isOverride = overrides.has(key);
    const isRo = activeLang === 'ro';
    return `
    <tr class="border-b border-white/10 hover:bg-gray-50" data-key="${escHtml(key)}">
      <td class="py-2 px-3 align-top">
        <div class="text-xs font-mono text-gray-500">${escHtml(key)}</div>
        ${isOverride ? '<span class="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">override KV</span>' : ''}
      </td>
      <td class="py-2 px-3 align-top text-sm text-gray-400 max-w-xs">${escHtml(roVal)}</td>
      <td class="py-2 px-3 align-top">
        ${isRo
          ? `<span class="text-sm text-gray-700">${escHtml(roVal)}</span>`
          : `<div class="flex gap-2 items-start">
              <input type="text" value="${escHtml(currentVal)}" data-key="${escHtml(key)}" data-lang="${activeLang}"
                     class="flex-1 border border-gray-200 rounded px-2 py-1 text-sm translation-input"
                     placeholder="Translation...">
              <button onclick="saveSingle('${activeLang}','${escHtml(key)}',this)"
                      class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs shrink-0">Save</button>
              <button onclick="autoTranslateSingle('${activeLang}','${escHtml(key)}',this)"
                      class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs shrink-0" title="AI Auto-translate">AI</button>
              ${isOverride ? `<button onclick="deleteOverride('${activeLang}','${escHtml(key)}',this)"
                      class="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs shrink-0">X</button>` : ''}
            </div>`
        }
      </td>
    </tr>`;
  }).join('');

  const content = `
    <div class="flex border-b border-gray-200 mb-4">${tabs}</div>
    <div class="flex gap-3 mb-4">
      <form method="get" class="flex-1 flex gap-2">
        <input type="hidden" name="lang" value="${activeLang}">
        <input type="text" name="search" value="${search}" placeholder="Search key..."
               class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <button type="submit" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Search</button>
      </form>
      <a href="/admin/traduceri/api/export?lang=${activeLang}"
         class="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm flex items-center">Export JSON</a>
      <button onclick="showImport()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm">Import JSON</button>
      ${!isRoLang ? `<button onclick="autoTranslateAll('${activeLang}')" id="auto-translate-all-btn"
         class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm">Auto-translate missing</button>` : ''}
    </div>

    <div id="import-panel" class="hidden bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
      <h3 class="text-sm font-medium text-gray-700 mb-2">Bulk JSON Import for ${LANG_LABELS[activeLang]}</h3>
      <textarea id="import-json" rows="6" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono mb-2" placeholder='{"key.path": "valoare", ...}'></textarea>
      <button onclick="bulkImport('${activeLang}')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Import</button>
      <div id="import-result" class="mt-2 text-sm"></div>
    </div>

    <div id="auto-translate-progress" class="hidden bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
      <p class="text-sm text-purple-700" id="auto-translate-msg">Translating...</p>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full">
        <thead><tr class="text-xs text-gray-400 border-b border-white/10 bg-gray-50">
          <th class="text-left py-2 px-3 w-1/4">Key</th>
          <th class="text-left py-2 px-3 w-1/4">Romanian (reference)</th>
          <th class="text-left py-2 px-3">Current Value</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div id="save-notify" class="fixed bottom-4 right-4 hidden bg-green-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">Saved!</div>
    <div id="ai-notify" class="fixed bottom-4 right-4 hidden bg-purple-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">AI Translated!</div>

    <script>
    async function saveSingle(lang, key, btn) {
      const row = btn.closest('tr');
      const input = row.querySelector('.translation-input');
      const res = await fetch('/admin/traduceri/api/key', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({lang, key, value: input.value})
      });
      if (res.ok) { showNotify('save-notify'); btn.textContent = 'OK'; setTimeout(() => { btn.textContent = 'Save'; location.reload(); }, 1500); }
    }
    async function deleteOverride(lang, key, btn) {
      if (!confirm('Delete override? Will revert to static value.')) return;
      await fetch('/admin/traduceri/api/key', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({lang, key})
      });
      location.reload();
    }
    async function bulkImport(lang) {
      const txt = document.getElementById('import-json').value;
      let data;
      try { data = JSON.parse(txt); } catch { document.getElementById('import-result').textContent = 'Invalid JSON.'; return; }
      const res = await fetch('/admin/traduceri/api/import', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({lang, data})
      });
      const j = await res.json();
      document.getElementById('import-result').textContent = j.imported ? 'Imported ' + j.imported + ' keys.' : 'Import error.';
    }
    function showImport() { document.getElementById('import-panel').classList.toggle('hidden'); }
    function showNotify(id) {
      const el = document.getElementById(id || 'save-notify');
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 2000);
    }
    async function autoTranslateSingle(lang, key, btn) {
      const row = btn.closest('tr');
      const input = row.querySelector('.translation-input');
      const sourceText = row.querySelectorAll('td')[1].textContent.trim();
      const origText = btn.textContent;
      btn.textContent = '...';
      btn.disabled = true;
      try {
        const res = await fetch('/admin/traduceri/api/auto-translate', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({lang, key, sourceText})
        });
        const j = await res.json();
        if (j.ok) {
          input.value = j.translation;
          showNotify('ai-notify');
        } else {
          alert('Auto-translation error: ' + (j.error || 'unknown'));
        }
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    }
    async function autoTranslateAll(lang) {
      const btn = document.getElementById('auto-translate-all-btn');
      const progress = document.getElementById('auto-translate-progress');
      const msg = document.getElementById('auto-translate-msg');
      btn.disabled = true;
      btn.textContent = 'Translating...';
      progress.classList.remove('hidden');
      msg.textContent = 'Translating missing keys, please wait...';
      try {
        const res = await fetch('/admin/traduceri/api/auto-translate-all', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({lang})
        });
        const j = await res.json();
        if (j.ok) {
          msg.textContent = 'Translated: ' + j.translated + ' new keys. Skipped (already exist): ' + j.skipped + '.';
          setTimeout(() => location.reload(), 2000);
        } else {
          msg.textContent = 'Error: ' + (j.error || 'unknown');
        }
      } catch(e) {
        msg.textContent = 'Network error: ' + e.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Auto-translate missing';
      }
    }
    </script>`;

  return adminLayout('Translations', content, 'traduceri', email);
}

export const translationsAdmin = new Hono<AdminEnv>();

translationsAdmin.get('/', async (c) => {
  const email = c.get('adminEmail');
  const langParam = c.req.query('lang') ?? 'ro';
  const lang = SUPPORTED_LANGS.includes(langParam as Lang) ? (langParam as Lang) : 'ro';
  const search = c.req.query('search') ?? '';
  const [keys, overrides] = await Promise.all([
    getLangKeys(c.env.CACHE, lang),
    getKvOverrides(c.env.CACHE, lang),
  ]);
  return c.html(translationsPage(lang, keys, overrides, email, search));
});

translationsAdmin.get('/api/keys', async (c) => {
  const langParam = c.req.query('lang') ?? 'ro';
  const lang = SUPPORTED_LANGS.includes(langParam as Lang) ? (langParam as Lang) : 'ro';
  const keys = await getLangKeys(c.env.CACHE, lang);
  return c.json(keys);
});

translationsAdmin.put('/api/key', async (c) => {
  const { lang, key, value } = await c.req.json<{ lang: string; key: string; value: string }>();
  if (!lang || !key || value === undefined) return c.json({ error: 'Missing fields' }, 400);
  if (!SUPPORTED_LANGS.includes(lang as Lang)) return c.json({ error: 'Invalid lang' }, 400);
  await c.env.CACHE.put(`i18n:${lang}:${key}`, value);
  return c.json({ ok: true });
});

translationsAdmin.delete('/api/key', async (c) => {
  const { lang, key } = await c.req.json<{ lang: string; key: string }>();
  if (!lang || !key) return c.json({ error: 'Missing fields' }, 400);
  await c.env.CACHE.delete(`i18n:${lang}:${key}`);
  return c.json({ ok: true });
});

translationsAdmin.post('/api/import', async (c) => {
  const { lang, data } = await c.req.json<{ lang: string; data: Record<string, string> }>();
  if (!lang || !data || typeof data !== 'object') return c.json({ error: 'Invalid payload' }, 400);
  if (!SUPPORTED_LANGS.includes(lang as Lang)) return c.json({ error: 'Invalid lang' }, 400);
  let imported = 0;
  await Promise.all(Object.entries(data).map(async ([key, value]) => {
    await c.env.CACHE.put(`i18n:${lang}:${key}`, String(value));
    imported++;
  }));
  return c.json({ imported });
});

translationsAdmin.get('/api/export', async (c) => {
  const langParam = c.req.query('lang') ?? 'ro';
  const lang = SUPPORTED_LANGS.includes(langParam as Lang) ? (langParam as Lang) : 'ro';
  const keys = await getLangKeys(c.env.CACHE, lang);
  return new Response(JSON.stringify(keys, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${lang}.json"`,
    },
  });
});

translationsAdmin.post('/api/auto-translate', async (c) => {
  const { lang, key, sourceText } = await c.req.json<{ lang: string; key: string; sourceText: string }>();
  if (!lang || !key || !sourceText) return c.json({ error: 'Missing fields' }, 400);
  if (!SUPPORTED_LANGS.includes(lang as Lang) || lang === 'ro') return c.json({ error: 'Invalid lang' }, 400);
  if (sourceText.length > 2000) return c.json({ error: 'sourceText exceeds 2000 character limit' }, 400);

  const adminId = c.get('adminEmail');
  const perMinuteKey = `ratelimit:translate:${adminId}`;
  const perMinuteRaw = await c.env.CACHE.get(perMinuteKey);
  const perMinuteCount = perMinuteRaw ? parseInt(perMinuteRaw, 10) : 0;
  if (perMinuteCount >= 10) return c.json({ error: 'Rate limit exceeded: max 10 auto-translate requests per minute' }, 429);
  await c.env.CACHE.put(perMinuteKey, String(perMinuteCount + 1), { expirationTtl: 60 });

  const targetLanguage = LANG_FULL_NAMES[lang as Exclude<Lang, 'ro'>];

  try {
    const translation = await aiTranslate(c.env.AI, targetLanguage, sourceText);
    if (!translation) return c.json({ error: 'Empty AI response' }, 500);

    await c.env.CACHE.put(`i18n:${lang}:${key}`, translation);
    return c.json({ ok: true, translation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

translationsAdmin.post('/api/auto-translate-all', async (c) => {
  const { lang } = await c.req.json<{ lang: string }>();
  if (!lang || !SUPPORTED_LANGS.includes(lang as Lang) || lang === 'ro') {
    return c.json({ error: 'Invalid lang' }, 400);
  }

  const adminId = c.get('adminEmail');
  const perMinuteKey = `ratelimit:translate:${adminId}`;
  const perMinuteRaw = await c.env.CACHE.get(perMinuteKey);
  const perMinuteCount = perMinuteRaw ? parseInt(perMinuteRaw, 10) : 0;
  if (perMinuteCount >= 10) return c.json({ error: 'Rate limit exceeded: max 10 auto-translate requests per minute' }, 429);
  await c.env.CACHE.put(perMinuteKey, String(perMinuteCount + 1), { expirationTtl: 60 });

  const targetLanguage = LANG_FULL_NAMES[lang as Exclude<Lang, 'ro'>];
  const existingOverrides = await getKvOverrides(c.env.CACHE, lang as Lang);

  let translated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  const failedKeys: string[] = [];

  const missingEntries = Object.entries(RO_FLAT).filter(([key]) => !existingOverrides.has(key));
  const totalMissing = missingEntries.length;

  for (const [key, sourceText] of missingEntries) {
    if (processed >= MAX_PER_REQUEST) break;
    processed++;

    try {
      const translation = await aiTranslate(c.env.AI, targetLanguage, sourceText);
      if (translation) {
        await c.env.CACHE.put(`i18n:${lang}:${key}`, translation);
        translated++;
      } else {
        failed++;
        failedKeys.push(key);
      }
    } catch {
      failed++;
      failedKeys.push(key);
    }
  }

  skipped = existingOverrides.size;
  const remaining = totalMissing - translated;

  return c.json({ ok: true, translated, skipped, failed, remaining, failedKeys });
});
