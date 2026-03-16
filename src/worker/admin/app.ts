import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { adminAuth, type AdminVariables } from '../lib/admin-auth';
import { adminLayout } from './layout';
import { weightsAdmin } from './weights';
import { translationsAdmin } from './translations';
import { configAdmin } from './config';
import { campaignRoutes, campaignApiRoutes, scraperRoutes } from './campaigns';
import { translationReportsAdmin } from './translation-reports';
import { escapeHtml } from '../lib/escape-html';
import { analytics } from './analytics';
import { activity } from './activity';
import { drafts } from './drafts';
import { generateStandalonePostWithOverrides } from '../lib/draft-generator';
import { structuredLog } from '../lib/logger';
import { gdprAdmin } from './gdpr';
import { flagsAdmin } from './flags';
import { newsletterAdmin } from './newsletter';
import { cspNonceMiddleware, ADMIN_CSP, type CspVariables } from '../lib/csp';

type AdminEnv = { Bindings: Env; Variables: AdminVariables & CspVariables };

const admin = new Hono<AdminEnv>();

// Apply CF Access auth to all admin routes
admin.use('*', adminAuth);

// Content-Security-Policy middleware for all admin HTML responses — shared from lib/csp
admin.use('*', cspNonceMiddleware(ADMIN_CSP));

// --- Dashboard ---
admin.get('/', async (c) => {
  const email = c.get('adminEmail');

  let totalCampaigns = '—';
  let pendingDrafts = '—';
  let scraperRunsToday = '—';
  let scraperErrorsToday = '—';

  try {
    const [campaigns, pending, runs, errors] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM campaigns').first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM campaigns WHERE draft_status = 'pending'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM scraper_runs WHERE date(run_at) = date('now')").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM scraper_runs WHERE errors IS NOT NULL AND date(run_at) = date('now')").first<{ count: number }>(),
    ]);
    totalCampaigns = String(campaigns?.count ?? 0);
    pendingDrafts = String(pending?.count ?? 0);
    scraperRunsToday = String(runs?.count ?? 0);
    scraperErrorsToday = String(errors?.count ?? 0);
  } catch {
    // leave defaults as '—' if DB unavailable
  }

  const content = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Total Campaigns</div>
        <div class="text-2xl font-bold text-gray-800">${totalCampaigns}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Pending Drafts</div>
        <div class="text-2xl font-bold text-yellow-600">${pendingDrafts}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Scraper Runs Today</div>
        <div class="text-2xl font-bold text-blue-600">${scraperRunsToday}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-sm text-gray-500 mb-1">Scraper Errors</div>
        <div class="text-2xl font-bold text-red-600">${scraperErrorsToday}</div>
      </div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-gray-700 font-medium mb-2">Welcome, ${escapeHtml(email)}</h2>
      <p class="text-gray-500 text-sm">The admin panel is under construction. Use the navigation on the left to access available sections.</p>
    </div>`;
  return c.html(adminLayout('Dashboard', content, 'dashboard', email, c.get('cspNonce')));
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
  let recentDrafts: { id: string; title: string; threat_type: string | null; draft_status: string; created_at: string }[] = [];
  try {
    const rows = await c.env.DB.prepare(
      "SELECT id, title, threat_type, draft_status, created_at FROM campaigns WHERE source = 'ai-generated' ORDER BY created_at DESC LIMIT 10"
    ).all<{ id: string; title: string; threat_type: string | null; draft_status: string; created_at: string }>();
    recentDrafts = rows.results;
  } catch (err) {
    structuredLog('error', '[admin/generare-continut] DB error', { error: err instanceof Error ? err.message : String(err) });
  }

  const categoryLabels: Record<string, string> = {
    amenintari: 'Threats',
    ghid: 'Protection Guide',
    educatie: 'Education',
    povesti: 'Stories',
    rapoarte: 'Reports',
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

  const draftsHtml = recentDrafts.length
    ? recentDrafts.map(d => `
      <tr class="border-b hover:bg-gray-50">
        <td class="py-2 px-3 text-sm"><a href="/admin/campanii/${escapeHtml(d.id)}" class="text-blue-600 hover:underline">${escapeHtml(d.title)}</a></td>
        <td class="py-2 px-3 text-xs text-gray-500">${escapeHtml(categoryLabels[d.threat_type ?? ''] ?? (d.threat_type ?? '-'))}</td>
        <td class="py-2 px-3 text-xs text-gray-400">${escapeHtml((d.created_at ?? '').slice(0, 10))}</td>
        <td class="py-2 px-3">${statusBadge(escapeHtml(d.draft_status))}</td>
        <td class="py-2 px-3"><a href="/admin/campanii/${escapeHtml(d.id)}" class="text-xs text-blue-500 hover:underline">View</a></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="py-8 text-center text-gray-400 text-sm">No drafts generated yet.</td></tr>';

  const content = `
    <div class="max-w-2xl">
      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 class="text-gray-700 font-semibold mb-4">AI Article Generation</h2>
        <form id="gen-form" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-600 mb-1" for="category">Category</label>
            <select id="category" name="category" class="border rounded px-3 py-2 w-full text-sm">
              <option value="amenintari">Threats</option>
              <option value="ghid">Protection Guide</option>
              <option value="educatie">Education</option>
              <option value="povesti">Stories</option>
              <option value="rapoarte">Reports</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1" for="topic">Custom Topic (optional)</label>
            <input type="text" id="topic" name="topic" placeholder="Leave blank to auto-generate..." class="border rounded px-3 py-2 w-full text-sm"/>
            <p class="text-xs text-gray-400 mt-1">If you specify a topic, the title generation step is skipped.</p>
          </div>
          <button type="submit" id="gen-btn" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 text-sm font-medium">Generate</button>
        </form>
        <div id="gen-result" class="mt-4 hidden"></div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="text-gray-700 font-semibold mb-4">Recent AI Drafts</h2>
        <table class="w-full text-sm" id="drafts-table">
          <thead class="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th class="py-2 px-3">Title</th>
              <th class="py-2 px-3">Category</th>
              <th class="py-2 px-3">Date</th>
              <th class="py-2 px-3">Status</th>
              <th class="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody id="drafts-body">${draftsHtml}</tbody>
        </table>
      </div>
    </div>

    <script nonce="${c.get('cspNonce')}">
    document.getElementById('gen-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('gen-btn');
      const result = document.getElementById('gen-result');
      const category = document.getElementById('category').value;
      const topic = document.getElementById('topic').value.trim();

      btn.disabled = true;
      btn.textContent = 'Generating...';
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
          const link = document.createElement('a');
          link.href = '/admin/drafturi/' + data.id;
          link.className = 'underline font-medium';
          link.textContent = data.title;
          result.textContent = '';
          result.appendChild(document.createTextNode('Draft generated: '));
          result.appendChild(link);
          setTimeout(() => location.reload(), 2000);
        } else {
          result.className = 'mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800';
          result.textContent = 'Error: ' + (data.error || 'Unknown');
        }
      } catch (err) {
        result.className = 'mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800';
        result.textContent = 'Network error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate';
        result.classList.remove('hidden');
      }
    });
    </script>`;

  return c.html(adminLayout('AI Content Generation', content, 'generare-continut', email, c.get('cspNonce')));
});

// --- Sanity Studio SPA ---
admin.get('/studio', async (c) => {
  try {
    const url = new URL(c.req.url);
    url.pathname = '/studio/index.html';
    const response = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
    if (response.status === 404) {
      return c.text('Sanity Studio is not deployed in this environment', 404);
    }
    return response;
  } catch {
    return c.text('Sanity Studio is not available in this environment', 503);
  }
});
admin.get('/studio/*', async (c) => {
  try {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    if (response.status !== 404) {
      return response;
    }
    // SPA fallback — serve studio/index.html for client-side routing
    const url = new URL(c.req.url);
    url.pathname = '/studio/index.html';
    const fallback = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
    if (fallback.status === 404) {
      return c.text('Sanity Studio is not deployed in this environment', 404);
    }
    return fallback;
  } catch {
    return c.text('Sanity Studio is not available in this environment', 503);
  }
});

// Mount sub-routers — API routes must be mounted before HTML routes to avoid param conflicts
admin.route('/campanii/api', campaignApiRoutes);
admin.route('/campanii', campaignRoutes);
admin.route('/drafturi', drafts);
admin.route('/scrapere', scraperRoutes);
admin.route('/ponderi', weightsAdmin);
admin.route('/traduceri', translationsAdmin);
admin.route('/config', configAdmin);
admin.route('/rapoarte-traduceri', translationReportsAdmin);
admin.route('/analytics', analytics);
admin.route('/activity', activity);
admin.route("/gdpr", gdprAdmin);
admin.route("/flags", flagsAdmin);
admin.route('/abonati', newsletterAdmin);

export { admin };
