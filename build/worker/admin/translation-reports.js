import { Hono } from 'hono';
import { adminLayout } from './layout';
const translationReportsAdmin = new Hono();
function formatDate(ts) {
    return new Date(ts).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' });
}
function esc(s) {
    if (!s)
        return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
translationReportsAdmin.get('/', async (c) => {
    const email = c.get('adminEmail');
    const listResult = await c.env.CACHE.list({ prefix: 'translation-report:' });
    const keys = listResult.keys ?? [];
    const records = await Promise.all(keys.map(async (k) => {
        const raw = await c.env.CACHE.get(k.name);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }));
    const rows = records
        .filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((r) => `
      <tr class="border-t border-gray-100 hover:bg-gray-50">
        <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">${formatDate(r.timestamp)}</td>
        <td class="px-4 py-3 text-xs font-mono text-gray-700">${esc(r.lang)}</td>
        <td class="px-4 py-3 text-xs text-gray-600">${esc(r.page)}</td>
        <td class="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title="${esc(r.currentText)}">${esc(r.currentText)}</td>
        <td class="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title="${esc(r.suggestedText)}">${esc(r.suggestedText)}</td>
        <td class="px-4 py-3 text-xs text-gray-700 max-w-sm">${esc(r.comment)}</td>
        <td class="px-4 py-3">
          <form method="POST" action="/rapoarte-traduceri/${encodeURIComponent(r.id)}/resolve">
            <button type="submit"
              class="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded transition-colors">
              Rezolvat
            </button>
          </form>
        </td>
      </tr>`).join('');
    const content = `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="text-gray-700 font-medium">Rapoarte de traducere (${records.filter(Boolean).length})</h2>
      </div>
      ${rows.length === 0 ? '<div class="px-6 py-8 text-center text-gray-400 text-sm">Nu exista rapoarte inca.</div>' : `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Limba</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagina</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Text curent</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sugestie</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalii</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actiune</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`}
    </div>`;
    return c.html(adminLayout('Rapoarte traduceri', content, 'rapoarte-traduceri', email));
});
// Resolve (delete) a report
translationReportsAdmin.post('/:id/resolve', async (c) => {
    const id = c.req.param('id');
    const listResult = await c.env.CACHE.list({ prefix: 'translation-report:' });
    const keys = (listResult.keys ?? []);
    for (const k of keys) {
        const raw = await c.env.CACHE.get(k.name);
        if (!raw)
            continue;
        try {
            const record = JSON.parse(raw);
            if (record.id === id) {
                await c.env.CACHE.delete(k.name);
                break;
            }
        }
        catch { /* skip */ }
    }
    return c.redirect('/rapoarte-traduceri');
});
export { translationReportsAdmin };
