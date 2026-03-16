import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/types';
import { generateWeeklyDigest, type WeeklyDigest } from '../lib/weekly-digest';
import { structuredLog } from '../lib/logger';
import { createRateLimiter } from '../lib/rate-limiter';
import { recordConsent, revokeConsent } from '../lib/gdpr-consent';
import { idempotency } from '../middleware/idempotency';

const BUTTONDOWN_BASE = 'https://api.buttondown.com/v1';

const DigestEmailSchema = z.object({
  email: z.string().email('Adresa de e-mail invalida.'),
});

const weekly = new Hono<{ Bindings: Env }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityLabel(s: string): string {
  switch (s) {
    case 'critical': return 'Critica';
    case 'high': return 'Ridicata';
    case 'medium': return 'Medie';
    default: return 'Scazuta';
  }
}

function severityColor(s: string): string {
  switch (s) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    default: return '#22c55e';
  }
}

function buildJsonLd(digest: WeeklyDigest, baseUrl: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: `Digest Saptamanal Securitate Cibernetica — ${digest.weekOf}`,
    description: `Top ${digest.topScams.length} campanii de frauda detectate saptamana ${digest.weekOf}. Statistici comunitate si sfaturi de siguranta.`,
    url: `${baseUrl}/saptamanal`,
    publisher: {
      '@type': 'Organization',
      name: 'ai-grija.ro',
      url: 'https://ai-grija.ro',
    },
    datePublished: new Date().toISOString().split('T')[0],
  });
}

function renderDigestHtml(digest: WeeklyDigest, baseUrl: string): string {
  const jsonLd = buildJsonLd(digest, baseUrl);
  const escapedBase = escapeHtml(baseUrl);

  const scamsHtml = digest.topScams.length > 0
    ? digest.topScams.map((s, i) => `
      <div class="scam-card">
        <div class="scam-rank">#${i + 1}</div>
        <div class="scam-info">
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" class="scam-title">${escapeHtml(s.title)}</a>
          <div class="scam-meta">
            <span class="severity-badge" style="background:${escapeHtml(severityColor(s.severity))}20;color:${escapeHtml(severityColor(s.severity))}">${escapeHtml(severityLabel(s.severity))}</span>
            <span class="report-count">${s.reportCount} raport${s.reportCount !== 1 ? 'e' : ''}</span>
          </div>
        </div>
      </div>`).join('\n')
    : '<p class="empty-state">Nu au fost detectate campanii noi in aceasta saptamana.</p>';

  const postsHtml = digest.blogPosts.length > 0
    ? digest.blogPosts.map(p => `
      <div class="post-card">
        <div class="post-date">${escapeHtml(p.date)}</div>
        <a href="/alerte/${escapeHtml(p.slug)}" class="post-title">${escapeHtml(p.title)}</a>
      </div>`).join('\n')
    : '<p class="empty-state">Niciun articol nou in aceasta saptamana.</p>';

  const tipsHtml = digest.tips.map(t => `
    <div class="tip-card">
      <span class="tip-icon">&#128737;</span>
      <span>${escapeHtml(t)}</span>
    </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Digest Saptamanal | ai-grija.ro</title>
<meta name="description" content="Top campanii de frauda si statistici de securitate cibernetica pentru saptamana ${escapeHtml(digest.weekOf)}.">
<meta property="og:title" content="Digest Saptamanal Securitate — ${escapeHtml(digest.weekOf)}">
<meta property="og:description" content="Top ${digest.topScams.length} campanii de frauda detectate. ${digest.stats.totalChecks} verificari efectuate de comunitate.">
<meta property="og:url" content="${escapedBase}/saptamanal">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ai-grija.ro">
<link rel="canonical" href="${escapedBase}/saptamanal">
<script type="application/ld+json">${jsonLd}</script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #0f0f13;
    color: #e2e8f0;
    min-height: 100vh;
    line-height: 1.6;
  }
  .container { max-width: 820px; margin: 0 auto; padding: 24px 16px 64px; }
  nav { margin-bottom: 24px; font-size: 0.85rem; color: #64748b; }
  nav a { color: #60a5fa; text-decoration: none; }
  nav a:hover { text-decoration: underline; }
  .hero { text-align: center; margin-bottom: 40px; }
  .hero-badge {
    display: inline-block; background: rgba(99,102,241,0.15); color: #818cf8;
    border: 1px solid rgba(99,102,241,0.3); border-radius: 999px;
    font-size: 0.8rem; font-weight: 600; padding: 4px 14px; letter-spacing: 0.05em;
    margin-bottom: 12px; text-transform: uppercase;
  }
  .hero h1 { font-size: 2rem; font-weight: 700; color: #f1f5f9; margin-bottom: 8px; }
  .hero .week-label { color: #94a3b8; font-size: 1.05rem; }
  .section { margin-bottom: 40px; }
  .section-title {
    font-size: 1.1rem; font-weight: 700; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    padding-bottom: 10px; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .glass-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 20px;
  }
  /* Stats grid */
  .stats-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
  @media(min-width:520px) { .stats-grid { grid-template-columns: repeat(4,1fr); } }
  .stat-box {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 16px; text-align: center;
  }
  .stat-number { font-size: 1.8rem; font-weight: 700; color: #818cf8; }
  .stat-label { font-size: 0.75rem; color: #64748b; margin-top: 4px; }
  /* Scam cards */
  .scam-card {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .scam-card:last-child { border-bottom: none; }
  .scam-rank {
    min-width: 28px; height: 28px; border-radius: 50%;
    background: rgba(99,102,241,0.2); color: #818cf8;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
  }
  .scam-title { color: #93c5fd; text-decoration: none; font-weight: 500; }
  .scam-title:hover { text-decoration: underline; }
  .scam-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
  .severity-badge {
    display: inline-block; font-size: 0.7rem; font-weight: 600;
    padding: 2px 8px; border-radius: 999px;
  }
  .report-count { font-size: 0.75rem; color: #64748b; }
  /* Blog posts */
  .post-card {
    padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex; align-items: baseline; gap: 12px;
  }
  .post-card:last-child { border-bottom: none; }
  .post-date { font-size: 0.75rem; color: #475569; min-width: 80px; }
  .post-title { color: #93c5fd; text-decoration: none; font-weight: 500; }
  .post-title:hover { text-decoration: underline; }
  /* Tips */
  .tip-card {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 0.9rem; color: #cbd5e1;
  }
  .tip-card:last-child { border-bottom: none; }
  .tip-icon { font-size: 1.1rem; flex-shrink: 0; }
  .empty-state { color: #475569; font-style: italic; font-size: 0.9rem; padding: 8px 0; }
  footer { text-align: center; color: #334155; font-size: 0.8rem; margin-top: 48px; }
  footer a { color: #475569; }
</style>
</head>
<body>
<div class="container">
  <nav><a href="/">ai-grija.ro</a> / <span>Digest Saptamanal</span></nav>

  <div class="hero">
    <div class="hero-badge">Digest Saptamanal</div>
    <h1>Securitate Cibernetica</h1>
    <p class="week-label">${escapeHtml(digest.weekOf)}</p>
  </div>

  <div class="section">
    <div class="section-title">&#128202; Statistici saptamana</div>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-number">${digest.stats.totalChecks.toLocaleString('ro')}</div>
        <div class="stat-label">Verificari totale</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${digest.stats.totalAlerts.toLocaleString('ro')}</div>
        <div class="stat-label">Alerte active</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${digest.stats.communityReports.toLocaleString('ro')}</div>
        <div class="stat-label">Rapoarte comunitate</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${digest.stats.quizCompletions.toLocaleString('ro')}</div>
        <div class="stat-label">Quiz-uri completate</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">&#128683; Top campanii de frauda</div>
    <div class="glass-card">
      ${scamsHtml}
    </div>
  </div>

  ${digest.blogPosts.length > 0 ? `
  <div class="section">
    <div class="section-title">&#128240; Articole recente</div>
    <div class="glass-card">
      ${postsHtml}
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">&#128161; Sfaturi de siguranta</div>
    <div class="glass-card">
      ${tipsHtml}
    </div>
  </div>

  <footer>
    <p>
      <a href="/">ai-grija.ro</a> &mdash;
      <a href="/alerte">Alerte active</a> &mdash;
      <a href="/politica-confidentialitate">Confidentialitate</a>
    </p>
    <p style="margin-top:8px">Digest generat automat &bull; Datele sunt agregate din surse publice</p>
  </footer>
</div>
</body>
</html>`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

weekly.get('/saptamanal', async (c) => {
  try {
    const digest = await generateWeeklyDigest(c.env);
    const baseUrl = c.env.BASE_URL ?? 'https://ai-grija.ro';
    const html = renderDigestHtml(digest, baseUrl);
    c.header('Cache-Control', 'public, max-age=3600');
    return c.html(html);
  } catch (err) {
    structuredLog('error', 'weekly_digest_render_failed', { error: String(err) });
    return c.html('<html><body><p>Digest indisponibil momentan. Incercati mai tarziu.</p></body></html>', 503);
  }
});

weekly.get('/api/digest/latest', async (c) => {
  try {
    const digest = await generateWeeklyDigest(c.env);
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json({ ok: true, digest });
  } catch (err) {
    structuredLog('error', 'weekly_digest_api_failed', { error: String(err) });
    return c.json({ ok: false, error: 'Digest indisponibil momentan.' }, 503);
  }
});

// Legacy stub — keep old route working
weekly.get('/api/weekly', async (c) => {
  return c.json({ ok: true, items: [] });
});

// ─── Email subscription endpoints (via Buttondown API, tag: digest) ───────────

weekly.post('/api/digest/subscribe', idempotency(), async (c) => {
  // Rate limit: 5 req/hr per IP
  const subIp = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (c.env.CACHE) {
    const subRl = await createRateLimiter(c.env.CACHE)(`digest-sub:${subIp}`, 5, 3600).catch(() => ({ allowed: true }));
    if (!subRl.allowed) {
      return c.json({ ok: false, error: 'Prea multe cereri. Încearcă din nou mai târziu.' }, 429);
    }
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'JSON invalid.' }, 400);
  }

  const parsed = DigestEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.issues.map(i => i.message).join('; ') }, 422);
  }

  const apiKey = c.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return c.json({ ok: false, error: 'Serviciu indisponibil momentan.' }, 503);
  }

  let bdRes: Response;
  try {
    bdRes = await fetch(`${BUTTONDOWN_BASE}/subscribers`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parsed.data.email, type: 'regular', tags: ['digest'] }),
    });
  } catch (err) {
    structuredLog('error', 'digest_subscribe_fetch_error', { error: String(err) });
    return c.json({ ok: false, error: 'Eroare la procesarea abonarii. Incearca din nou.' }, 502);
  }

  if (!bdRes.ok) {
    if (bdRes.status === 400) {
      return c.json({ ok: false, error: 'Aceasta adresa este deja abonata sau invalida.' }, 400);
    }
    const bdBody = await bdRes.json().catch(() => ({})) as Record<string, unknown>;
    structuredLog('error', 'digest_subscribe_upstream_error', { status: bdRes.status, body: bdBody });
    return c.json({ ok: false, error: 'Eroare la procesarea abonarii. Incearca din nou.' }, 502);
  }

  await recordConsent(c.env, 'email', parsed.data.email).catch(() => {});
  return c.json({ ok: true, message: 'Verifica email-ul pentru confirmare.' });
});

weekly.post('/api/digest/unsubscribe', idempotency(), async (c) => {
  // Rate limit: 5 req/hr per IP
  const unsubIp = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (c.env.CACHE) {
    const unsubRl = await createRateLimiter(c.env.CACHE)(`digest-unsub:${unsubIp}`, 5, 3600).catch(() => ({ allowed: true }));
    if (!unsubRl.allowed) {
      return c.json({ ok: false, error: 'Prea multe cereri. Încearcă din nou mai târziu.' }, 429);
    }
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'JSON invalid.' }, 400);
  }

  const parsed = DigestEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.issues.map(i => i.message).join('; ') }, 422);
  }

  const apiKey = c.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return c.json({ ok: false, error: 'Serviciu indisponibil momentan.' }, 503);
  }

  let bdRes: Response;
  try {
    bdRes = await fetch(`${BUTTONDOWN_BASE}/subscribers/${encodeURIComponent(parsed.data.email)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${apiKey}` },
    });
  } catch (err) {
    structuredLog('error', 'digest_unsubscribe_fetch_error', { error: String(err) });
    return c.json({ ok: false, error: 'Eroare la procesarea dezabonarii. Incearca din nou.' }, 502);
  }

  if (bdRes.status === 404) {
    return c.json({ ok: false, error: 'Aceasta adresa nu este abonata.' }, 404);
  }

  if (!bdRes.ok) {
    return c.json({ ok: false, error: 'Eroare la procesarea dezabonarii. Incearca din nou.' }, 502);
  }

  await revokeConsent(c.env, 'email', parsed.data.email).catch(() => {});
  return c.json({ ok: true, message: 'Ai fost dezabonat cu succes.' });
});


export { weekly };
