import { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AdminVariables } from '../lib/admin-auth';
import { adminLayout } from './layout';
import { getWeights, saveWeights, getWeightHistory, DEFAULT_WEIGHTS, scoreUrlWithWeights, type RiskWeights } from '../lib/weights';

type AdminEnv = { Bindings: Env; Variables: AdminVariables };

const WEIGHT_LABELS: Record<keyof RiskWeights, string> = {
  safeBrowsingMatch: 'Google Safe Browsing',
  urlhausMatch: 'URLhaus',
  virustotalMalicious: 'VirusTotal (malitios)',
  virustotalSuspicious: 'VirusTotal (suspect)',
  domainAgeLt30: 'Domeniu < 30 zile',
  domainAgeLt90: 'Domeniu < 90 zile',
  httpNoTls: 'HTTP fara TLS',
  longDomain: 'Domeniu lung',
  manyDigits: 'Multe cifre',
  tooManySubdomains: 'Prea multe subdomenii',
  lookalikeBrand: 'Look-alike brand',
  urlShortener: 'URL shortener',
  suspiciousTld: 'TLD suspect',
};

const WEIGHT_GROUPS: { label: string; keys: (keyof RiskWeights)[] }[] = [
  { label: 'Threat Intelligence', keys: ['safeBrowsingMatch', 'urlhausMatch', 'virustotalMalicious', 'virustotalSuspicious'] },
  { label: 'Domain Heuristics', keys: ['domainAgeLt30', 'domainAgeLt90', 'httpNoTls', 'longDomain', 'manyDigits', 'tooManySubdomains'] },
  { label: 'Pattern Matching', keys: ['lookalikeBrand', 'urlShortener', 'suspiciousTld'] },
];

function weightRow(key: keyof RiskWeights, current: number, def: number): string {
  return `
  <tr class="border-b border-gray-100 hover:bg-gray-50">
    <td class="py-2 px-3 text-sm text-gray-700">${WEIGHT_LABELS[key]}</td>
    <td class="py-2 px-3">
      <input type="range" name="${key}" min="0" max="1" step="0.05" value="${current}"
             class="w-full accent-blue-600"
             oninput="this.nextElementSibling.value=this.value">
      <output class="text-xs text-gray-500 ml-1">${current}</output>
    </td>
    <td class="py-2 px-3 text-xs text-gray-400">${def}</td>
    <td class="py-2 px-3">
      <input type="number" name="${key}_num" min="0" max="1" step="0.05" value="${current}"
             class="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-right"
             oninput="document.querySelector('input[name=${key}]').value=this.value;document.querySelector('input[name=${key}] + output').value=this.value">
    </td>
  </tr>`;
}

function weightsPage(weights: RiskWeights, history: { weights: RiskWeights; savedAt: string }[], email: string): string {
  const groups = WEIGHT_GROUPS.map(g => `
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <h3 class="font-semibold text-gray-700 mb-3">${g.label}</h3>
      <table class="w-full">
        <thead><tr class="text-xs text-gray-400 border-b border-gray-100">
          <th class="text-left py-1 px-3">Indicator</th>
          <th class="text-left py-1 px-3">Valoare</th>
          <th class="text-left py-1 px-3">Default</th>
          <th class="text-left py-1 px-3">Numeric</th>
        </tr></thead>
        <tbody>${g.keys.map(k => weightRow(k, weights[k], DEFAULT_WEIGHTS[k])).join('')}</tbody>
      </table>
    </div>`).join('');

  const histRows = history.slice(0, 10).map(h => `
    <tr class="border-b border-gray-100 text-sm">
      <td class="py-2 px-3 text-gray-500">${new Date(h.savedAt).toLocaleString('ro-RO')}</td>
      <td class="py-2 px-3 font-mono text-xs text-gray-600">${Object.entries(h.weights).map(([k,v]) => `${k}:${v}`).join(' ')}</td>
    </tr>`).join('') || '<tr><td colspan="2" class="py-4 text-center text-gray-400 text-sm">Niciun istoric</td></tr>';

  const content = `
    <form id="weights-form" hx-post="/admin/ponderi/save" hx-target="#save-result" hx-swap="innerHTML">
      ${groups}
      <div class="flex gap-3 mb-6">
        <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Salveaza ponderi</button>
        <button type="button" onclick="resetDefaults()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium">Reseteaza la default</button>
      </div>
      <div id="save-result"></div>
    </form>

    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <h3 class="font-semibold text-gray-700 mb-3">Testeaza URL</h3>
      <div class="flex gap-2">
        <input id="test-url-input" type="url" placeholder="https://example.com"
               class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
               hx-get="/admin/ponderi/test" hx-trigger="keyup changed delay:600ms"
               hx-include="#weights-form" hx-target="#test-result" hx-swap="innerHTML"
               name="url">
        <button class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
                hx-get="/admin/ponderi/test" hx-include="#weights-form,#test-url-input"
                hx-target="#test-result" hx-swap="innerHTML">Testeaza</button>
      </div>
      <div id="test-result" class="mt-3"></div>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-4">
      <h3 class="font-semibold text-gray-700 mb-3">Istoric modificari (ultimele 10)</h3>
      <table class="w-full">
        <thead><tr class="text-xs text-gray-400 border-b border-gray-100">
          <th class="text-left py-1 px-3">Data</th>
          <th class="text-left py-1 px-3">Valori salvate</th>
        </tr></thead>
        <tbody>${histRows}</tbody>
      </table>
    </div>

    <script>
    function resetDefaults() {
      const defaults = ${JSON.stringify(DEFAULT_WEIGHTS)};
      for (const [k,v] of Object.entries(defaults)) {
        const slider = document.querySelector('input[name="' + k + '"]');
        const numInput = document.querySelector('input[name="' + k + '_num"]');
        const output = slider && slider.nextElementSibling;
        if (slider) slider.value = v;
        if (output) output.value = v;
        if (numInput) numInput.value = v;
      }
    }
    </script>`;

  return adminLayout('Ponderi clasificare', content, 'ponderi', email);
}

export const weightsAdmin = new Hono<AdminEnv>();

weightsAdmin.get('/', async (c) => {
  const email = c.get('adminEmail');
  const [weights, history] = await Promise.all([
    getWeights(c.env.CACHE),
    getWeightHistory(c.env.CACHE),
  ]);
  return c.html(weightsPage(weights, history, email));
});

weightsAdmin.post('/save', async (c) => {
  const form = await c.req.formData();
  const current = await getWeights(c.env.CACHE);
  const newWeights = { ...current };
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof RiskWeights)[]) {
    const val = parseFloat(form.get(key) as string);
    if (!isNaN(val) && val >= 0 && val <= 1) {
      newWeights[key] = val;
    }
  }
  await saveWeights(c.env.CACHE, newWeights);
  return c.html('<div class="text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm">Ponderi salvate cu succes.</div>');
});

weightsAdmin.post('/reset', async (c) => {
  await saveWeights(c.env.CACHE, { ...DEFAULT_WEIGHTS });
  return c.redirect('/admin/ponderi');
});

weightsAdmin.get('/test', async (c) => {
  const url = c.req.query('url') || '';
  if (!url) return c.html('<p class="text-gray-400 text-sm">Introduti un URL pentru testare.</p>');

  // Parse proposed weights from query params (sent via hx-include of form)
  const form = c.req.query();
  const current = await getWeights(c.env.CACHE);
  const proposed: RiskWeights = { ...current };
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof RiskWeights)[]) {
    const val = parseFloat(form[key]);
    if (!isNaN(val)) proposed[key] = val;
  }

  // Minimal heuristic flags from URL (no external calls in test mode)
  let parsed: URL;
  try { parsed = new URL(url.startsWith('http') ? url : `https://${url}`); } catch {
    return c.html('<p class="text-red-600 text-sm">URL invalid.</p>');
  }
  const domain = parsed.hostname.toLowerCase();
  const flags = {
    safeBrowsingMatch: false,
    urlhausMatch: false,
    virustotalMalicious: 0,
    virustotalSuspicious: 0,
    domainAgeDays: null as number | null,
    httpNoTls: parsed.protocol === 'http:',
    longDomain: domain.length > 30,
    manyDigits: /\d{4,}/.test(domain),
    tooManySubdomains: domain.split('.').length > 3,
    lookalikeBrand: ['ing','bcr','brd','anaf','fancourier','bt','cec'].some(b => domain.includes(b)),
    urlShortener: ['bit.ly','tinyurl.com','goo.gl','t.co','is.gd'].some(s => domain === s),
    suspiciousTld: ['.xyz','.top','.buzz','.club','.icu','.pw','.tk'].some(t => domain.endsWith(t)),
  };

  const withCurrent = scoreUrlWithWeights(current, flags);
  const withProposed = scoreUrlWithWeights(proposed, flags);

  const breakdownRows = Object.entries(withProposed.breakdown).map(([k, v]) =>
    `<tr><td class="py-1 px-2 text-xs text-gray-600">${WEIGHT_LABELS[k as keyof RiskWeights] ?? k}</td><td class="py-1 px-2 text-xs font-mono">${v.toFixed(2)}</td></tr>`
  ).join('') || '<tr><td colspan="2" class="text-gray-400 text-xs py-1 px-2">Niciun flag activ</td></tr>';

  return c.html(`
    <div class="grid grid-cols-2 gap-4 mb-3">
      <div class="bg-gray-50 rounded-lg p-3 text-center">
        <div class="text-xs text-gray-500 mb-1">Scor curent</div>
        <div class="text-xl font-bold ${withCurrent.score >= 0.5 ? 'text-red-600' : 'text-green-600'}">${(withCurrent.score * 100).toFixed(0)}%</div>
      </div>
      <div class="bg-blue-50 rounded-lg p-3 text-center">
        <div class="text-xs text-gray-500 mb-1">Scor propus</div>
        <div class="text-xl font-bold ${withProposed.score >= 0.5 ? 'text-red-600' : 'text-green-600'}">${(withProposed.score * 100).toFixed(0)}%</div>
      </div>
    </div>
    <table class="w-full"><thead><tr class="text-xs text-gray-400"><th class="text-left px-2">Factor</th><th class="text-left px-2">Contributie</th></tr></thead>
    <tbody>${breakdownRows}</tbody></table>`);
});

weightsAdmin.get('/history', async (c) => {
  const history = await getWeightHistory(c.env.CACHE);
  return c.json(history);
});
