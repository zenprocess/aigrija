import type { Campaign } from '../data/campaigns';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildJsonLd(campaign: Campaign, baseUrl: string): string {
  const datePublished = campaign.first_seen;
  const pageUrl = `${baseUrl}/alerte/${campaign.slug}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Alerta phishing: ${campaign.name_ro}`,
    description: campaign.seo.description,
    url: pageUrl,
    publisher: {
      '@type': 'Organization',
      name: 'ai-grija.ro',
      url: 'https://ai-grija.ro',
    },
    datePublished,
    mainEntity: {
      '@type': 'Article',
      headline: campaign.name_ro,
      articleBody: campaign.description_ro,
    },
  };
  return JSON.stringify(ld);
}

export function renderAlertPage(campaign: Campaign, baseUrl: string, checksMatched?: number, reportCount?: number, lastReport?: string | null): string {
  const statusBadge = campaign.status === 'active' ? '🔴 Activa' : campaign.status === 'declining' ? '🟡 In scadere' : '🟢 Rezolvata';
  const severityBadge = campaign.severity === 'critical' ? '⚠️ Critica' : campaign.severity === 'high' ? '🔶 Ridicata' : '🔵 Medie';
  const escapedSlug = escapeHtml(campaign.slug);
  const escapedBase = escapeHtml(baseUrl);
  const jsonLd = buildJsonLd(campaign, baseUrl);

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(campaign.seo.title)}</title>
<meta name="description" content="${escapeHtml(campaign.seo.description)}">
<meta name="keywords" content="${campaign.seo.keywords.map(escapeHtml).join(', ')}">
<meta property="og:title" content="${escapeHtml(campaign.seo.og_title)}">
<meta property="og:description" content="${escapeHtml(campaign.seo.og_description)}">
<meta property="og:url" content="${escapedBase}/alerte/${escapedSlug}">
<meta property="og:type" content="article">
<link rel="canonical" href="${escapedBase}/alerte/${escapedSlug}">
<script type="application/ld+json">${jsonLd}</script>
<style>*{margin:0;padding:0;box-sizing:border-box}html{background:#0a0a0a;color:#e5e5e5;color-scheme:dark}body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6;padding:20px}main{max-width:720px;margin:0 auto}nav{margin-bottom:16px;color:#a3a3a3;font-size:0.9rem}h1{color:#fff;font-size:1.5rem;margin-bottom:12px}h2{color:#fff;font-size:1.1rem;margin:20px 0 8px}a{color:#22c55e;text-decoration:none}a:hover{text-decoration:underline}.badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;margin-right:8px;background:#1a1a1a;color:#e5e5e5}.red-flag{background:#1c1410;border-left:4px solid #ff9800;padding:12px;margin:8px 0;border-radius:0 4px 4px 0}.advice{background:#0d1a0d;border-left:4px solid #4caf50;padding:12px;margin:8px 0;border-radius:0 4px 4px 0}.counter{display:inline-flex;align-items:center;gap:8px;background:#1a1408;border:1px solid #ffc107;border-radius:8px;padding:10px 16px;margin:12px 0;font-size:0.9rem;font-weight:600;color:#ffc107}hr{border:none;border-top:1px solid #1f1f1f;margin:24px 0}small{color:#737373}p{margin:8px 0}</style>
</head>
<body>
<nav><a href="/">ai-grija.ro</a> / <a href="/alerte">Alerte</a></nav>
<main>
<h1>${escapeHtml(campaign.name_ro)}</h1>
<p><span class="badge">${statusBadge}</span><span class="badge">${severityBadge}</span></p>
${checksMatched && checksMatched > 0 ? '<p><span class="counter">🔍 ' + checksMatched + ' verificări au identificat această campanie</span></p>' : ''}
${reportCount !== undefined ? (reportCount > 0 ? '<p><span class="counter">📊 ' + reportCount + ' rapoarte primite' + (lastReport ? ' | Ultima raportare: ' + escapeHtml(lastReport) : '') + '</span></p>' : '<p><span class="counter">📊 Niciun raport încă</span></p>') : ''}
<p><strong>Entitate impersonata:</strong> ${escapeHtml(campaign.impersonated_entity)}</p>
<p>${escapeHtml(campaign.description_ro)}</p>
<h2>Cum functioneaza</h2>
<p>${escapeHtml(campaign.how_it_works_ro)}</p>
<h2>Semnale de alarma</h2>
${campaign.red_flags_ro.map(f => `<div class="red-flag">${escapeHtml(f)}</div>`).join('\n')}
<h2>Ce sa faci</h2>
${campaign.advice_ro.map(a => `<div class="advice">${escapeHtml(a)}</div>`).join('\n')}
${campaign.dnsc_alert_url ? `<p><a href="${escapeHtml(campaign.dnsc_alert_url)}" target="_blank" rel="noopener">Alerta oficiala DNSC</a></p>` : ''}
<p><small>Prima aparitie: ${escapeHtml(campaign.first_seen)}</small></p>
<hr>
<p><a href="/alerte">← Toate alertele</a> | <a href="/">Verifica un mesaj</a></p>
</main>
</body>
</html>`;
}

export function renderAlertsIndex(campaigns: Campaign[], baseUrl: string): string {
  const active = campaigns.filter(c => c.status === 'active');
  const escapedBase = escapeHtml(baseUrl);
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alerte phishing active in Romania — ai-grija.ro</title>
<meta name="description" content="Campaniile de phishing active in Romania. Protejati-va de fraude online.">
<meta property="og:title" content="Alerte phishing Romania — ai-grija.ro">
<link rel="canonical" href="${escapedBase}/alerte">
<style>*{margin:0;padding:0;box-sizing:border-box}html{background:#0a0a0a;color:#e5e5e5;color-scheme:dark}body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6;padding:20px}main{max-width:720px;margin:0 auto}nav{margin-bottom:16px;color:#a3a3a3;font-size:0.9rem}h1{color:#fff;font-size:1.75rem;margin-bottom:8px}a{color:#22c55e;text-decoration:none}a:hover{text-decoration:underline}.card{background:#141414;border:1px solid #1f1f1f;border-radius:8px;padding:16px;margin:12px 0}.card:hover{border-color:#22c55e}.card h2{margin:0 0 8px;font-size:1.1rem}.card h2 a{color:#fff}small{color:#737373}p{margin:8px 0}hr{border:none;border-top:1px solid #1f1f1f;margin:24px 0}</style>
</head>
<body>
<nav><a href="/">ai-grija.ro</a></nav>
<main>
<h1>Alerte phishing active in Romania</h1>
<p>${active.length} campanii active monitorizate</p>
${campaigns.map(c => `<div class="card">
<h2><a href="/alerte/${escapeHtml(c.slug)}">${escapeHtml(c.name_ro)}</a></h2>
<p>${escapeHtml(c.description_ro.substring(0, 150))}...</p>
<small>${escapeHtml(c.severity)} | ${escapeHtml(c.status)} | ${escapeHtml(c.impersonated_entity)}</small>
</div>`).join('\n')}
<hr>
<p><a href="/">← Verifica un mesaj suspect</a></p>
</main>
</body>
</html>`;
}
