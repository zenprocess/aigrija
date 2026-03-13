import type { Hono } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { counter } from './counter';
import { alerts } from './alerts';
import { share } from './share';
import { sitemap } from './sitemap';
import { seo } from './seo';
import { telegram } from './telegram';
import { whatsapp } from './whatsapp';
import { report } from './report';
import { community } from './community';
import { og } from './og';
import { upload } from './upload';
import { checkQr } from './check-qr';
import { adminFlags } from './admin-flags';
import { blog } from './blog';
import { policies } from './policies';
import { card } from './card';
import { feed } from './feed';
import { weekly } from './weekly';
import { reportGenerator } from './report-generator';
import { metrics } from './metrics';
import { quiz } from './quiz';
import { translationReport } from './translation-report';
import { newsletter } from './newsletter';
import { gepa } from './gepa';
import { createOpenAPIApp } from '../lib/openapi';
import { CheckEndpoint } from './openapi-check';
import { AlertsEndpoint, AlertsEmergingEndpoint, AlertsBySlugEndpoint } from './openapi-alerts';
import { HealthEndpoint, DeepHealthEndpoint } from './openapi-health';
import { CheckImageEndpoint } from './openapi-check-image';
import { CheckQrEndpoint } from './openapi-check-qr';
import { CounterEndpoint } from './openapi-counter';
import { ReportsEndpoint } from './openapi-reports';
import { VoteEndpoint } from './openapi-vote';
import { FeedEndpoint } from './openapi-feed';
import { StatsEndpoint } from './openapi-stats';
import { BadgesEndpoint } from './openapi-badges';
import { DigestLatestEndpoint, DigestSubscribeEndpoint, DigestUnsubscribeEndpoint } from './openapi-digest';
import { NewsletterSubscribeEndpoint, NewsletterUnsubscribeEndpoint } from './openapi-newsletter';
import { TranslationReportEndpoint } from './openapi-translation-report';
import { QuizEndpoint, QuizCheckEndpoint } from './openapi-quiz';
import { MetricsEndpoint } from './openapi-metrics';
import { ShareEndpoint } from './openapi-share';
import { renderErrorPage } from '../lib/error-pages';

type AppType = Hono<{ Bindings: Env; Variables: AppVariables }>;

const FAVICON_ICO_B64 = 'AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAD/AAAAAA==';

export function registerRoutes(app: AppType): void {
  // Wrap with chanfana for OpenAPI docs at /docs
  const openapi = createOpenAPIApp(app);

  // OpenAPI-documented routes (chanfana — auto-generates /openapi.json)
  openapi.post('/api/check', CheckEndpoint);
  openapi.post('/api/check/image', CheckImageEndpoint);
  openapi.post('/api/check-qr', CheckQrEndpoint);
  openapi.get('/api/alerts', AlertsEndpoint);
  openapi.get('/api/alerts/emerging', AlertsEmergingEndpoint);
  openapi.get('/api/alerts/:slug', AlertsBySlugEndpoint);
  openapi.get('/health', HealthEndpoint);
  openapi.get('/health/deep', DeepHealthEndpoint);
  openapi.get('/api/counter', CounterEndpoint);
  openapi.get('/api/reports', ReportsEndpoint);
  openapi.post('/api/reports/:id/vote', VoteEndpoint);
  openapi.get('/api/feed/latest', FeedEndpoint);
  openapi.get('/api/stats', StatsEndpoint);
  openapi.get('/api/badges', BadgesEndpoint);
  openapi.get('/api/digest/latest', DigestLatestEndpoint);
  openapi.post('/api/digest/subscribe', DigestSubscribeEndpoint);
  openapi.post('/api/digest/unsubscribe', DigestUnsubscribeEndpoint);
  openapi.post('/api/newsletter/subscribe', NewsletterSubscribeEndpoint);
  openapi.post('/api/newsletter/unsubscribe', NewsletterUnsubscribeEndpoint);
  openapi.post('/api/translation-report', TranslationReportEndpoint);
  openapi.get('/api/quiz', QuizEndpoint);
  openapi.post('/api/quiz/check', QuizCheckEndpoint);
  openapi.get('/api/health/metrics', MetricsEndpoint);
  openapi.get('/api/share/:id', ShareEndpoint);

  // Admin feature flag routes
  app.route('/', adminFlags);

  // Plain Hono routes (no OpenAPI docs needed)
  app.route('/', counter);
  app.route('/', alerts);   // keeps /alerte SSR + legacy /api/alerts (chanfana takes priority)
  app.route('/', share);
  app.route('/', sitemap);
  app.route('/', seo);
  app.route('/', telegram);
  app.route('/', whatsapp);
  app.route('/', report);
  app.route('/', community);
  app.route('/', og);
  app.route('/', upload);
  app.route('/', checkQr);
  app.route('/', blog);
  app.route('/', policies);
  app.route('/', card);
  app.route('/', feed);
  app.route('/', weekly);
  app.route('/', reportGenerator);
  app.route('/', metrics);
  app.route('/', quiz);
  app.route('/', translationReport);
  app.route('/', newsletter);
  app.route('/', gepa);

  // Favicon ICO — served inline to avoid ASSETS binding dependency in unit tests
  app.get('/favicon.ico', (c) => {
    const raw = atob(FAVICON_ICO_B64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  });

  // Explicit service worker route — prevents SPA catch-all from serving HTML
  app.get('/sw.js', async (c) => {
    return c.body(
      '// Minimal SW for PWA installability\nself.addEventListener("install", () => self.skipWaiting());\nself.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));\n',
      200,
      { 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=0, must-revalidate' }
    );
  });

  // Asset fallback: for any route not matched by Hono, try the ASSETS binding.
  app.notFound(async (c) => {
    // Don't serve SPA fallback for file-extension requests (prevents /sw.js#/termeni leak)
    const pathExt = c.req.path.match(/\.\w{2,5}$/);
    if (pathExt) {
      const response = await c.env.ASSETS.fetch(c.req.raw);
      if (response.status !== 404 && !response.headers.get('content-type')?.includes('text/html')) {
        return new Response(response.body, response);
      }
      // Static file not found — return 404 directly, no SPA fallback
      const rid = c.get('requestId') || 'unknown';
      return c.json({ error: { code: 'NOT_FOUND', message: 'Fisierul nu a fost gasit.' }, request_id: rid }, 404);
    }
    const response = await c.env.ASSETS.fetch(c.req.raw);
    if (response.status !== 404) {
      return new Response(response.body, response);
    }
    const rid = c.get('requestId') || 'unknown';
    const accept = c.req.header('Accept') || '';
    if (accept.includes('text/html') && !accept.includes('application/json')) {
      return c.html(renderErrorPage(404, 'Pagina nu a fost gasita.', rid), 404);
    }
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pagina nu a fost gasita.' }, request_id: rid }, 404);
  });
}
