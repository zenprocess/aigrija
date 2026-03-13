import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { escapeHtml } from '../lib/escape-html';
import { createRateLimiter, applyRateLimitHeaders, ROUTE_RATE_LIMITS } from '../lib/rate-limiter';

const OgImageQuerySchema = z.object({
  verdict: z.string().max(64).optional(),
  scam_type: z.string().max(256).optional(),
  confidence: z.coerce.number().min(0).max(100).optional(),
});

const OgAlertQuerySchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
});

const og = new Hono<{ Bindings: Env; Variables: AppVariables }>();

type VerdictType = 'phishing' | 'suspicious' | 'likely_safe';

interface VerdictStyle {
  color: string;
  label: string;
  icon: string;
  bgAccent: string;
}

const VERDICT_STYLES: Record<VerdictType, VerdictStyle> = {
  phishing: {
    color: '#ef4444',
    label: 'FRAUDĂ CONFIRMATĂ',
    icon: '⚠',
    bgAccent: '#7f1d1d',
  },
  suspicious: {
    color: '#f59e0b',
    label: 'SUSPECT',
    icon: '⚡',
    bgAccent: '#78350f',
  },
  likely_safe: {
    color: '#22c55e',
    label: 'PROBABIL SIGUR',
    icon: '✓',
    bgAccent: '#14532d',
  },
};



function buildVerdictSvg(verdict: VerdictType, confidence: number, scam_type: string, counter?: number): string {
  const style = VERDICT_STYLES[verdict] || VERDICT_STYLES['suspicious'];
  const confidencePct = Math.round(Math.min(100, Math.max(0, confidence)));
  const barWidth = Math.round((confidencePct / 100) * 720);
  const safeScamType = escapeHtml(scam_type);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${style.bgAccent}"/>
      <stop offset="100%" style="stop-color:transparent"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Accent strip -->
  <rect x="0" y="0" width="8" height="630" fill="${style.color}"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="1200" height="4" fill="${style.color}" opacity="0.6"/>

  <!-- Brand -->
  <text x="60" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" fill="#94a3b8" letter-spacing="2">AI-GRIJA.RO</text>
  <text x="60" y="96" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#475569">Protecție împotriva fraudelor online</text>

  <!-- Divider -->
  <line x1="60" y1="116" x2="1140" y2="116" stroke="#334155" stroke-width="1"/>

  <!-- Verdict icon circle -->
  <circle cx="120" cy="240" r="60" fill="${style.bgAccent}" opacity="0.6"/>
  <text x="120" y="258" font-family="system-ui, -apple-system, sans-serif" font-size="48" fill="${style.color}" text-anchor="middle">${style.icon}</text>

  <!-- Verdict label -->
  <text x="210" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="${style.color}" letter-spacing="3">${style.label}</text>

  <!-- Scam type -->
  <text x="210" y="265" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="700" fill="#f1f5f9">${safeScamType.length > 28 ? safeScamType.slice(0, 28) + '...' : safeScamType}</text>

  <!-- Confidence section -->
  <text x="60" y="350" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#64748b" letter-spacing="1">NIVEL DE ÎNCREDERE</text>
  <rect x="60" y="365" width="720" height="12" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <rect x="60" y="365" width="${barWidth}" height="12" rx="6" fill="${style.color}" opacity="0.85"/>
  <text x="796" y="377" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="${style.color}">${confidencePct}%</text>

  <!-- Bottom advice -->
  <rect x="60" y="415" width="1080" height="2" fill="#1e293b"/>
  <text x="60" y="460" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#94a3b8">Verificați mesajele suspecte pe</text>
  <text x="60" y="490" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#38bdf8">ai-grija.ro</text>

  <!-- QR placeholder area -->
  <rect x="1020" y="415" width="120" height="120" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="1080" y="468" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#475569" text-anchor="middle">SCANAȚI</text>
  <text x="1080" y="484" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#475569" text-anchor="middle">PENTRU</text>
  <text x="1080" y="500" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#38bdf8" text-anchor="middle">ai-grija.ro</text>

  <!-- Footer -->
  <rect x="0" y="590" width="1200" height="40" fill="#0f172a" opacity="0.8"/>
  <text x="60" y="614" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#475569">Generat automat de AI-GRIJA.RO — Nu înlocuiește sfatul juridic profesional</text>
  <text x="900" y="614" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#475569" text-anchor="end">Proiect civic de Zen Labs</text>
  ${counter ? `<text x="600" y="580" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#334155" text-anchor="middle" opacity="0.7">1 din ${counter.toLocaleString('ro-RO')} verificări pe ai-grija.ro</text>` : ""}
</svg>`;
}

function buildAlertSvg(title: string, description: string): string {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="8" height="630" fill="#ef4444"/>
  <rect x="0" y="0" width="1200" height="4" fill="#ef4444" opacity="0.6"/>

  <!-- Brand -->
  <text x="60" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" fill="#94a3b8" letter-spacing="2">AI-GRIJA.RO</text>
  <text x="60" y="96" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#475569">Alertă de securitate</text>

  <!-- Divider -->
  <line x1="60" y1="116" x2="1140" y2="116" stroke="#334155" stroke-width="1"/>

  <!-- Alert icon -->
  <circle cx="120" cy="260" r="60" fill="#7f1d1d" opacity="0.6"/>
  <text x="120" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="56" fill="#ef4444" text-anchor="middle">!</text>

  <!-- ALERTĂ label -->
  <text x="210" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#ef4444" letter-spacing="4">ALERTĂ ACTIVĂ</text>

  <!-- Title -->
  <text x="210" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="700" fill="#f1f5f9">${safeTitle.length > 30 ? safeTitle.slice(0, 30) + '...' : safeTitle}</text>

  <!-- Description -->
  <text x="60" y="360" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="#94a3b8">${safeDesc.length > 70 ? safeDesc.slice(0, 70) + '...' : safeDesc}</text>

  <!-- CTA -->
  <rect x="60" y="415" width="1080" height="2" fill="#1e293b"/>
  <text x="60" y="470" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#94a3b8">Verificați și raportați fraude pe</text>
  <text x="60" y="502" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#38bdf8">ai-grija.ro</text>

  <!-- Footer -->
  <rect x="0" y="590" width="1200" height="40" fill="#0f172a" opacity="0.8"/>
  <text x="60" y="614" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#475569">AI-GRIJA.RO — Platformă de protecție împotriva fraudelor online în România</text>
  <text x="900" y="614" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#475569" text-anchor="end">Proiect civic de Zen Labs</text>
</svg>`;
}

// GET /og/image — dynamic SVG for social sharing (verdict)
og.get('/og/image', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await createRateLimiter(c.env.CACHE)(ip, ROUTE_RATE_LIMITS['og'].limit, ROUTE_RATE_LIMITS['og'].windowSeconds);
  applyRateLimitHeaders((k, v) => c.header(k, v), rl);
  if (!rl.allowed) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Limita de cereri depasita. Incercati din nou mai tarziu.' }, request_id: 'unknown' }, 429);
  }
  const _ogq = OgImageQuerySchema.safeParse({ verdict: c.req.query('verdict'), scam_type: c.req.query('scam_type'), confidence: c.req.query('confidence') });
  if (!_ogq.success) return c.json({ error: { code: 'VALIDATION_ERROR', message: _ogq.error.issues.map((i: { message: string }) => i.message).join('; ') } }, 400);
  const rawVerdict = _ogq.data.verdict || 'suspicious';
  const verdict: VerdictType = (['phishing', 'suspicious', 'likely_safe'] as const).includes(rawVerdict as VerdictType)
    ? (rawVerdict as VerdictType)
    : 'suspicious';
  // NOTE: The AI API returns confidence as a 0-1 float, but buildVerdictSvg
  // expects a 0-100 scale. Normalise here: if confidence <= 1, multiply by 100.
  const rawConfidence = parseFloat(c.req.query('confidence') || '75');
  const confidence = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
  const scam_type = c.req.query('scam_type') || 'Conținut suspect';
  const rawCounter = await c.env.CACHE.get('stats:total_checks');
  const counter = rawCounter ? Number(rawCounter) : undefined;
  const svg = buildVerdictSvg(verdict, confidence, scam_type, counter);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

// GET /og/alert — SVG for alert campaign sharing
og.get('/og/alert', (c) => {
  const _alq = OgAlertQuerySchema.safeParse({ title: c.req.query('title'), description: c.req.query('description') });
  if (!_alq.success) return c.json({ error: { code: 'VALIDATION_ERROR', message: _alq.error.issues.map((i: { message: string }) => i.message).join('; ') } }, 400);
  const title = _alq.data.title || 'Alertă Fraudă';
  const description = _alq.data.description || 'O nouă campanie de fraudă a fost detectată în România.';

  const svg = buildAlertSvg(title, description);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

// GET /og/:type — HTML page with correct og:image meta tags for social crawlers
og.get('/og/:type', (c) => {
  const type = c.req.param('type');
  const baseUrl = c.env.BASE_URL || 'https://ai-grija.ro';
  const query = c.req.raw.url.split('?')[1] || '';

  let imageUrl: string;
  let pageTitle: string;
  let pageDescription: string;

  // Build a sanitized image URL: reconstruct from validated/escaped params only
  // to prevent XSS via raw query string injection into HTML attributes.
  if (type === 'verdict') {
    const rawVerdict = c.req.query('verdict') || 'suspicious';
    const verdict = (['phishing', 'suspicious', 'likely_safe'] as const).includes(rawVerdict as 'phishing' | 'suspicious' | 'likely_safe')
      ? rawVerdict : 'suspicious';
    const rawConfidence = c.req.query('confidence') || '75';
    const confidence = String(parseFloat(rawConfidence) || 75);
    const scam_type = encodeURIComponent(c.req.query('scam_type') || 'Continut suspect');
    imageUrl = escapeHtml(`${baseUrl}/og/image?verdict=${verdict}&confidence=${confidence}&scam_type=${scam_type}`);
    const verdictLabel = verdict === 'phishing' ? 'Fraudă confirmată' : verdict === 'likely_safe' ? 'Probabil sigur' : 'Suspect';
    pageTitle = escapeHtml(`Verificare ai-grija.ro — ${verdictLabel}`);
    pageDescription = escapeHtml('Am verificat un mesaj suspect pe ai-grija.ro. Protejează-te și tu!');
  } else if (type === 'alert') {
    const title = encodeURIComponent(c.req.query('title') || 'Alerta Frauda');
    const description = encodeURIComponent(c.req.query('description') || 'Alerta de securitate activa.');
    imageUrl = escapeHtml(`${baseUrl}/og/alert?title=${title}&description=${description}`);
    pageTitle = escapeHtml(c.req.query('title') || 'Alertă Fraudă — ai-grija.ro');
    pageDescription = escapeHtml(c.req.query('description') || 'Alertă de securitate activă pe ai-grija.ro.');
  } else {
    const rid = (c.get('requestId')) || 'unknown'; return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Tip OG invalid. Folositi: verdict sau alert.' }, request_id: rid }, 400);
  }

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8"/>
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}"/>
  <meta property="og:title" content="${pageTitle}"/>
  <meta property="og:description" content="${pageDescription}"/>
  <meta property="og:image" content="${imageUrl}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${baseUrl}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:image" content="${imageUrl}"/>
  <meta http-equiv="refresh" content="0; url=${baseUrl}"/>
</head>
<body>
  <p>Redirecționare către <a href="${baseUrl}">ai-grija.ro</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
});

export { og };

