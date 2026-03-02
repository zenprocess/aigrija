import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { adminAuth, type AdminVariables } from '../lib/admin-auth';
import { adminLayout } from './layout';
import { weightsAdmin } from './weights';
import { translationsAdmin } from './translations';
import { configAdmin } from './config';
import { campaignRoutes, campaignApiRoutes, scraperRoutes } from './campaigns';
import { translationReportsAdmin } from './translation-reports';
import { generateStandalonePost, generateStandalonePostWithOverrides } from '../lib/draft-generator';

type AdminEnv = { Bindings: Env; Variables: AdminVariables };

const admin = new Hono<AdminEnv>();

// Apply CF Access auth to all admin routes
admin.use('*', adminAuth);

// --- Dashboard ---
admin.get('/', (c) => {
  const email = c.get('adminEmail');
  const content = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Campanii totale</div>
        <div class="text-2xl font-bold text-gray-800">—</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Drafturi in asteptare</div>
        <div class="text-2xl font-bold text-yellow-600">—</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Rulari scraper azi</div>
        <div class="text-2xl font-bold text-blue-600">—</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Erori scraper</div>
        <div class="text-2xl font-bold text-red-600">—</div>
      </div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-gray-700 font-medium mb-2">Bun venit, ${email}</h2>
      <p class="text-gray-500 text-sm">Panoul de administrare este in constructie. Foloseste navigatia din stanga pentru a accesa sectiunile disponibile.</p>
    </div>`;
  return c.html(adminLayout('Dashboard', content, 'dashboard', email));
});

// --- Drafturi (placeholder) ---
const drafturiRouter = new Hono<AdminEnv>();
drafturiRouter.get('/', (c) => {
  const email = c.get('adminEmail');
  const content = `
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-gray-700 font-medium mb-2">Drafturi</h2>
      <p class="text-gray-500 text-sm">Drafturile generate de AI pentru aprobare vor aparea aici.</p>
    </div>`;
  return c.html(adminLayout('Drafturi', content, 'drafturi', email));
});

// --- Ponderi (placeholder) ---
const ponderiRouter = new Hono<AdminEnv>();
ponderiRouter.get('/', (c) => {
  const email = c.get('adminEmail');
  const content = `
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-gray-700 font-medium mb-2">Ponderi clasificare</h2>
      <p class="text-gray-500 text-sm">Ajustarea ponderilor pentru clasificarea amenintarilor va fi disponibila aici.</p>
    </div>`;
  return c.html(adminLayout('Ponderi', content, 'ponderi', email));
});

// --- Traduceri (placeholder) ---
const traduceriRouter = new Hono<AdminEnv>();
traduceriRouter.get('/', (c) => {
  const email = c.get('adminEmail');
  const content = `
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-gray-700 font-medium mb-2">Traduceri</h2>
      <p class="text-gray-500 text-sm">Override-urile de traducere pe limbi vor fi gestionate aici.</p>
    </div>`;
  return c.html(adminLayout('Traduceri', content, 'traduceri', email));
});

// --- Config (placeholder) ---
const configRouter = new Hono<AdminEnv>();
configRouter.get('/', (c) => {
  const email = c.get('adminEmail');
  const content = `
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-gray-700 font-medium mb-2">Configuratie</h2>
      <p class="text-gray-500 text-sm">Setarile generale ale aplicatiei vor fi disponibile aici.</p>
    </div>`;
  return c.html(adminLayout('Config', content, 'config', email));
});

// --- Generate Content API ---
admin.post('/api/generate-content', async (c) => {
  let body: { category?: string; topic?: string } = {};
  try {
    const raw = await c.req.text();
    if (raw) body = JSON.parse(raw);
  } catch { /* ignore, body is optional */ }
  try {
    const result = await generateStandalonePostWithOverrides(c.env, {
      category: body.category,
      topic: body.topic,
    });
    return c.json({ ok: true, id: result.id, title: result.title });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ ok: false, error: message }, 500);
  }
});

// --- AI Drafts JSON API ---
admin.get('/api/admin/drafts/ai-generated', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      "SELECT id, title, threat_type, draft_status, created_at FROM campaigns WHERE source = 'ai-generated' ORDER BY created_at DESC LIMIT 10"
    ).all<{ id: string; title: string; threat_type: string | null; draft_status: string; created_at: string }>();
    return c.json({ ok: true, data: rows.results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ ok: false, error: message }, 500);
  }
});

// --- Generare Continut HTML page ---
admin.get('/generare-continut', async (c) => {
  const email = c.get('adminEmail');
  let drafts: { id: string; title: string; threat_type: string | null; draft_status: string; created_at: string }[] = [];
  try {
    const rows = await c.env.DB.prepare(
      "SELECT id, title, threat_type, draft_status, created_at FROM campaigns WHERE source = 'ai-generated' ORDER BY created_at DESC LIMIT 10"
    ).all<{ id: string; title: string; threat_type: string | null; draft_status: string; created_at: string }>();
    drafts = rows.results;
  } catch (err) {
    console.error('[admin/generare-continut] DB error', err);
  }

  const categoryLabels: Record<string, string> = {
    amenintari: 'Amenintari',
    ghid: 'Ghid de protectie',
    educatie: 'Educatie',
    povesti: 'Povesti',
    rapoarte: 'Rapoarte',
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      generated: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
    };
    const cls = map[s] || 'bg-gray-100 text-gray-800';
    return `<span class="px-2 py-0.5 rounded-full text-xs ${cls}">${s}</span>`;
  };

  const draftsHtml = drafts.length
    ? drafts.map(d => `
      <tr class="border-b hover:bg-gray-50">
        <td class="py-2 px-3 text-sm"><a href="/admin/campanii/${d.id}" class="text-blue-600 hover:underline">${d.title}</a></td>
        <td class="py-2 px-3 text-xs text-gray-500">${categoryLabels[d.threat_type ?? ''] ?? (d.threat_type ?? '-')}</td>
        <td class="py-2 px-3 text-xs text-gray-400">${(d.created_at ?? '').slice(0, 10)}</td>
        <td class="py-2 px-3">${statusBadge(d.draft_status)}</td>
        <td class="py-2 px-3"><a href="/admin/campanii/${d.id}" class="text-xs text-blue-500 hover:underline">Vizualizeaza</a></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="py-8 text-center text-gray-400 text-sm">Niciun draft generat inca.</td></tr>';

  const content = `
    <div class="max-w-2xl">
      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 class="text-gray-700 font-semibold mb-4">Generare articol AI</h2>
        <form id="gen-form" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-600 mb-1" for="category">Categorie</label>
            <select id="category" name="category" class="border rounded px-3 py-2 w-full text-sm">
              <option value="amenintari">Amenintari</option>
              <option value="ghid">Ghid de protectie</option>
              <option value="educatie">Educatie</option>
              <option value="povesti">Povesti</option>
              <option value="rapoarte">Rapoarte</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1" for="topic">Subiect personalizat (optional)</label>
            <input type="text" id="topic" name="topic" placeholder="Lasa gol pentru a genera automat..." class="border rounded px-3 py-2 w-full text-sm"/>
            <p class="text-xs text-gray-400 mt-1">Daca specifici un subiect, pasul de generare titlu este omis.</p>
          </div>
          <button type="submit" id="gen-btn" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 text-sm font-medium">Genereaza</button>
        </form>
        <div id="gen-result" class="mt-4 hidden"></div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="text-gray-700 font-semibold mb-4">Drafturi AI recente</h2>
        <table class="w-full text-sm" id="drafts-table">
          <thead class="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th class="py-2 px-3">Titlu</th>
              <th class="py-2 px-3">Categorie</th>
              <th class="py-2 px-3">Data</th>
              <th class="py-2 px-3">Status</th>
              <th class="py-2 px-3">Actiuni</th>
            </tr>
          </thead>
          <tbody id="drafts-body">${draftsHtml}</tbody>
        </table>
      </div>
    </div>

    <script>
    document.getElementById('gen-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('gen-btn');
      const result = document.getElementById('gen-result');
      const category = document.getElementById('category').value;
      const topic = document.getElementById('topic').value.trim();

      btn.disabled = true;
      btn.textContent = 'Se genereaza...';
      result.className = 'mt-4 hidden';

      try {
        const res = await fetch('/admin/api/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, topic: topic || undefined }),
        });
        const data = await res.json();
        if (data.ok) {
          result.className = 'mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800';
          result.innerHTML = 'Draft generat: <a href="/admin/campanii/' + data.id + '" class="underline font-medium">' + data.title + '</a>';
          setTimeout(() => location.reload(), 2000);
        } else {
          result.className = 'mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800';
          result.textContent = 'Eroare: ' + (data.error || 'Necunoscuta');
        }
      } catch (err) {
        result.className = 'mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800';
        result.textContent = 'Eroare retea: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Genereaza';
        result.classList.remove('hidden');
      }
    });
    </script>`;

  return c.html(adminLayout('Generare Continut AI', content, 'generare-continut', email));
});

// Mount sub-routers — API routes must be mounted before HTML routes to avoid param conflicts
admin.route('/campanii/api', campaignApiRoutes);
admin.route('/campanii', campaignRoutes);
admin.route('/drafturi', drafturiRouter);
admin.route('/scrapere', scraperRoutes);
admin.route('/ponderi', weightsAdmin);
admin.route('/traduceri', translationsAdmin);
admin.route('/config', configAdmin);
admin.route('/rapoarte-traduceri', translationReportsAdmin);

export { admin };
