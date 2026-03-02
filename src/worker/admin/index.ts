import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { adminAuth, type AdminVariables } from '../lib/admin-auth';
import { adminLayout } from './layout';
import { weightsAdmin } from './weights';
import { translationsAdmin } from './translations';
import { configAdmin } from './config';
import { campaignRoutes, campaignApiRoutes, scraperRoutes } from './campaigns';
import { translationReportsAdmin } from './translation-reports';
import { generateStandalonePost } from '../lib/draft-generator';

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
  try {
    await generateStandalonePost(c.env);
    return c.json({ ok: true, message: 'Content generated' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ ok: false, error: message }, 500);
  }
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
