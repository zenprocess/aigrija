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
import { weekly } from './weekly';
import { reportGenerator } from './report-generator';
import { quiz } from './quiz';
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
import { idempotency } from '../middleware/idempotency';
import { renderErrorPage } from '../lib/error-pages';

type AppType = Hono<{ Bindings: Env; Variables: AppVariables }>;

const FAVICON_ICO_B64 = 'AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAD/AAAAAA==';

export function registerRoutes(app: AppType): void {
  // Wrap with chanfana for OpenAPI docs at /docs
  const openapi = createOpenAPIApp(app);

  // OpenAPI-documented routes (chanfana — auto-generates /openapi.json)
  /** @latency slow (5000ms) */
  openapi.post('/api/check', CheckEndpoint);
  /** @latency slow (5000ms) */
  openapi.post('/api/check/image', CheckImageEndpoint);
  /** @latency slow (5000ms) */
  openapi.post('/api/check-qr', CheckQrEndpoint);
  /** @latency ssr (500ms) */
  openapi.get('/api/alerts', AlertsEndpoint);
  /** @latency ssr (500ms) */
  openapi.get('/api/alerts/emerging', AlertsEmergingEndpoint);
  /** @latency ssr (500ms) */
  openapi.get('/api/alerts/:slug', AlertsBySlugEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/health', HealthEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/health/deep', DeepHealthEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/health', HealthEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/counter', CounterEndpoint);
  /** @latency medium (200ms) */
  openapi.get('/api/reports', ReportsEndpoint);
  /** @latency medium (200ms) */
  openapi.post('/api/reports/:id/vote', VoteEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/feed/latest', FeedEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/stats', StatsEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/badges', BadgesEndpoint);
  /** @latency medium (200ms) */
  openapi.get('/api/digest/latest', DigestLatestEndpoint);
  /** @latency medium (200ms) */
  openapi.post('/api/digest/subscribe', DigestSubscribeEndpoint);
  /** @latency medium (200ms) */
  openapi.post('/api/digest/unsubscribe', DigestUnsubscribeEndpoint);
  /** @latency medium (200ms) */
  openapi.post('/api/newsletter/subscribe', NewsletterSubscribeEndpoint);
  /** @latency medium (200ms) */
  openapi.post('/api/newsletter/unsubscribe', NewsletterUnsubscribeEndpoint);
  /** @latency medium (200ms) */
  // idempotency middleware applied before the endpoint to restore at-most-once semantics
  openapi.use('/api/translation-report', idempotency());
  openapi.post('/api/translation-report', TranslationReportEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/quiz', QuizEndpoint);
  /** @latency fast (50ms) */
  openapi.post('/api/quiz/check', QuizCheckEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/health/metrics', MetricsEndpoint);
  /** @latency fast (50ms) */
  openapi.get('/api/share/:id', ShareEndpoint);

  // Admin feature flag routes
  app.route('/', adminFlags);

  // Plain Hono routes (no OpenAPI docs needed)
  /** @latency fast (50ms) — POST /api/counter (admin increment) */
  app.route('/', counter);
  /** @latency ssr (500ms) — /alerte SSR pages */
  app.route('/', alerts);
  /** @latency fast (50ms) — OPTIONS /api/share/:id preflight */
  app.route('/', share);
  /** @latency fast (50ms) */
  app.route('/', sitemap);
  /** @latency fast (50ms) */
  app.route('/', seo);
  /** @latency external (10000ms) */
  app.route('/', telegram);
  /** @latency external (10000ms) */
  app.route('/', whatsapp);
  /** @latency medium (200ms) */
  app.route('/', report);
  /** @latency medium (200ms) */
  app.route('/', community);
  /** @latency ssr (500ms) */
  app.route('/', og);
  /** @latency slow (5000ms) */
  app.route('/', upload);
  /** @latency slow (5000ms) */
  app.route('/', checkQr);
  /** @latency ssr (500ms) */
  app.route('/', blog);
  /** @latency ssr (500ms) */
  app.route('/', policies);
  /** @latency ssr (500ms) */
  app.route('/', card);
  /** @latency medium (200ms) */
  app.route('/', weekly);
  /** @latency medium (200ms) */
  app.route('/', reportGenerator);
  /** @latency fast (50ms) — GET /api/quiz/:id (specific question, not in chanfana) */
  app.route('/', quiz);
  /** @latency medium (200ms) */
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

  // v1 API aliases: /api/v1/* rewrites to /api/* (ADR-0018 Phase 1)
  app.all('/api/v1/*', async (c) => {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace('/api/v1/', '/api/');
    const newReq = new Request(url.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    });
    return app.fetch(newReq, c.env, c.executionCtx);
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
