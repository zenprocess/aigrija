import type { Env } from './types';
import type { WeeklyDigest } from './weekly-digest';
import { structuredLog } from './logger';

// ── HTML email builder ────────────────────────────────────────────────────────

function severityLabel(severity: string): string {
  if (severity === 'critical') return 'Critic';
  if (severity === 'high') return 'Ridicat';
  if (severity === 'medium') return 'Mediu';
  return 'Scăzut';
}

function severityColor(severity: string): string {
  if (severity === 'critical') return '#dc2626';
  if (severity === 'high') return '#ea580c';
  if (severity === 'medium') return '#d97706';
  return '#16a34a';
}

export function buildEmailHtml(digest: WeeklyDigest, email: string, baseUrl: string): string {
  const unsubUrl = `${baseUrl}/#/dezabonare?email=${encodeURIComponent(email)}`;

  const scamRows = digest.topScams.slice(0, 3).map(scam => {
    const color = severityColor(scam.severity);
    const label = severityLabel(scam.severity);
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
          <a href="${scam.url}" style="color:#1d4ed8;text-decoration:none;font-weight:600;">${scam.title}</a>
          <br>
          <span style="font-size:12px;color:#6b7280;">${scam.reportCount} raportări &nbsp;|&nbsp; </span>
          <span style="font-size:12px;color:${color};font-weight:600;">${label}</span>
        </td>
      </tr>`;
  }).join('');

  const blogSection = digest.blogPosts.length > 0 ? (() => {
    const post = digest.blogPosts[0];
    const postUrl = `${baseUrl}/blog/${post.slug}`;
    return `
      <h2 style="font-size:18px;color:#111827;margin:24px 0 8px;">📰 Articol nou</h2>
      <p style="margin:0;"><a href="${postUrl}" style="color:#1d4ed8;font-weight:600;">${post.title}</a></p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${post.date}</p>`;
  })() : '';

  const tipSection = digest.tips.length > 0 ? `
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px;margin:24px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0;font-weight:600;color:#1e40af;">💡 Sfatul săptămânii</p>
      <p style="margin:8px 0 0;color:#1e3a8a;">${digest.tips[0]}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Digest Săptămânal AI Grija — ${digest.weekOf}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#dc2626;padding:24px 32px;">
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">🛡️ AI Grija</h1>
            <p style="margin:4px 0 0;font-size:14px;color:#fecaca;">Digest Săptămânal — ${digest.weekOf}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;background:#fef2f2;border-bottom:1px solid #fee2e2;">
            <h2 style="font-size:16px;color:#991b1b;margin:0 0 12px;">📊 Statistici săptămână</h2>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding:8px;">
                  <div style="font-size:28px;font-weight:700;color:#dc2626;">${digest.stats.totalChecks.toLocaleString('ro-RO')}</div>
                  <div style="font-size:12px;color:#6b7280;">verificări</div>
                </td>
                <td style="text-align:center;padding:8px;">
                  <div style="font-size:28px;font-weight:700;color:#dc2626;">${digest.stats.totalAlerts.toLocaleString('ro-RO')}</div>
                  <div style="font-size:12px;color:#6b7280;">alerte</div>
                </td>
                <td style="text-align:center;padding:8px;">
                  <div style="font-size:28px;font-weight:700;color:#dc2626;">${digest.stats.communityReports.toLocaleString('ro-RO')}</div>
                  <div style="font-size:12px;color:#6b7280;">raportări comunitate</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <h2 style="font-size:18px;color:#111827;margin:0 0 8px;">🚨 Top escrocherii ale săptămânii</h2>
            <table width="100%" cellpadding="0" cellspacing="0">${scamRows}</table>
            ${blogSection}
            ${tipSection}
            <div style="text-align:center;margin:32px 0 16px;">
              <a href="${baseUrl}" style="background:#dc2626;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Verifică un mesaj acum</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Ai primit acest email pentru că ești abonat la digestul săptămânal AI Grija.<br>
              <a href="${unsubUrl}" style="color:#6b7280;">Dezabonare</a> &nbsp;|&nbsp;
              <a href="${baseUrl}" style="color:#6b7280;">ai-grija.ro</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
  <img src="https://cloud.umami.is/p/3ZlQkyHqz" width="1" height="1" alt="" style="display:block" />
</body>
</html>`;
}

// ── Subscriber helpers ────────────────────────────────────────────────────────

const SUBSCRIBERS_KEY = 'email:subscribers';

export async function getSubscribers(cache: KVNamespace): Promise<string[]> {
  const raw = await cache.get(SUBSCRIBERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addSubscriber(cache: KVNamespace, email: string): Promise<void> {
  const list = await getSubscribers(cache);
  const normalized = email.toLowerCase().trim();
  if (!list.includes(normalized)) {
    list.push(normalized);
    await cache.put(SUBSCRIBERS_KEY, JSON.stringify(list));
  }
}

export async function removeSubscriber(cache: KVNamespace, email: string): Promise<void> {
  const list = await getSubscribers(cache);
  const normalized = email.toLowerCase().trim();
  const updated = list.filter(e => e !== normalized);
  await cache.put(SUBSCRIBERS_KEY, JSON.stringify(updated));
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function sendDigestEmail(env: Env, digest: WeeklyDigest): Promise<void> {
  if (!env.CACHE) {
    structuredLog('warn', 'email_digest_no_cache', { stage: 'digest' });
    return;
  }

  const subscribers = await getSubscribers(env.CACHE);
  if (subscribers.length === 0) {
    structuredLog('info', 'email_digest_no_subscribers', { stage: 'digest', weekOf: digest.weekOf });
    return;
  }

  const baseUrl = env.BASE_URL ?? 'https://ai-grija.ro';
  const subject = `Digest Săptămânal AI Grija — ${digest.weekOf}`;
  let sent = 0;
  let failed = 0;

  for (const email of subscribers) {
    const htmlBody = buildEmailHtml(digest, email, baseUrl);
    const payload = {
      personalizations: [{ to: [{ email }] }],
      from: { email: 'digest@ai-grija.ro', name: 'AI Grija' },
      subject,
      content: [{ type: 'text/html', value: htmlBody }],
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (resp.ok || resp.status === 202) {
          sent++;
        } else {
          const errText = await resp.text().catch(() => '');
          structuredLog('error', 'email_digest_send_failed', {
            stage: 'digest',
            email,
            status: resp.status,
            error: errText,
          });
          failed++;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      structuredLog('error', 'email_digest_exception', {
        stage: 'digest',
        email,
        error: String(err),
      });
      failed++;
    }
  }

  structuredLog('info', 'email_digest_complete', {
    stage: 'digest',
    weekOf: digest.weekOf,
    sent,
    failed,
    total: subscribers.length,
  });
}
