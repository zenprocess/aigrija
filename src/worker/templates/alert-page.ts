import type { Campaign } from '../data/campaigns';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderAlertPage(campaign: Campaign, baseUrl: string): string {
  const statusBadge = campaign.status === 'active' ? '🔴 Activa' : campaign.status === 'declining' ? '🟡 In scadere' : '🟢 Rezolvata';
  const severityBadge = campaign.severity === 'critical' ? '⚠️ Critica' : campaign.severity === 'high' ? '🔶 Ridicata' : '🔵 Medie';

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
<meta property="og:url" content="${baseUrl}/alerte/${campaign.slug}">
<meta property="og:type" content="article">
<link rel="canonical" href="${baseUrl}/alerte/${campaign.slug}">
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#1a1a1a;line-height:1.6}h1{color:#d32f2f;font-size:1.5rem}.badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:0.85rem;font-weight:600;margin-right:8px}.red-flag{background:#fff3e0;border-left:4px solid #ff9800;padding:12px;margin:8px 0}.advice{background:#e8f5e9;border-left:4px solid #4caf50;padding:12px;margin:8px 0}a{color:#1976d2}</style>
</head>
<body>
<nav><a href="/">ai-grija.ro</a> / <a href="/alerte">Alerte</a></nav>
<h1>${escapeHtml(campaign.name_ro)}</h1>
<p><span class="badge">${statusBadge}</span><span class="badge">${severityBadge}</span></p>
<p><strong>Entitate impersonata:</strong> ${escapeHtml(campaign.impersonated_entity)}</p>
<p>${escapeHtml(campaign.description_ro)}</p>
<h2>Cum functioneaza</h2>
<p>${escapeHtml(campaign.how_it_works_ro)}</p>
<h2>Semnale de alarma</h2>
${campaign.red_flags_ro.map(f => `<div class="red-flag">${escapeHtml(f)}</div>`).join('\n')}
<h2>Ce sa faci</h2>
${campaign.advice_ro.map(a => `<div class="advice">${escapeHtml(a)}</div>`).join('\n')}
${campaign.dnsc_alert_url ? `<p><a href="${escapeHtml(campaign.dnsc_alert_url)}" target="_blank" rel="noopener">Alerta oficiala DNSC</a></p>` : ''}
<p><small>Prima aparitie: ${campaign.first_seen}</small></p>
<hr>
<p><a href="/alerte">← Toate alertele</a> | <a href="/">Verifica un mesaj</a></p>
</body>
</html>`;
}

export function renderAlertsIndex(campaigns: Campaign[], baseUrl: string): string {
  const active = campaigns.filter(c => c.status === 'active');
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alerte phishing active in Romania — ai-grija.ro</title>
<meta name="description" content="Campaniile de phishing active in Romania. Protejati-va de fraude online.">
<meta property="og:title" content="Alerte phishing Romania — ai-grija.ro">
<link rel="canonical" href="${baseUrl}/alerte">
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#1a1a1a;line-height:1.6}h1{color:#d32f2f}.card{border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:12px 0}.card h3{margin:0 0 8px}a{color:#1976d2}</style>
</head>
<body>
<nav><a href="/">ai-grija.ro</a></nav>
<h1>Alerte phishing active in Romania</h1>
<p>${active.length} campanii active monitorizate</p>
${campaigns.map(c => `<div class="card">
<h3><a href="/alerte/${c.slug}">${escapeHtml(c.name_ro)}</a></h3>
<p>${escapeHtml(c.description_ro.substring(0, 150))}...</p>
<small>${c.severity} | ${c.status} | ${c.impersonated_entity}</small>
</div>`).join('\n')}
<hr>
<p><a href="/">← Verifica un mesaj suspect</a></p>
</body>
</html>`;
}
