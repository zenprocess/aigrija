import type { Env } from './types';

export interface WeeklyDigestResult {
  campaign: Record<string, unknown>;
  cardSvg: string;
}

export async function generateWeeklyDigest(env: Env): Promise<WeeklyDigestResult | null> {
  if (!env.ADMIN_DB) return null;

  const campaign = await env.ADMIN_DB.prepare(
    `SELECT * FROM campaigns WHERE created_at > datetime('now', '-7 days')
     ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
     created_at DESC LIMIT 1`
  ).first() as Record<string, unknown> | null;

  if (!campaign) return null;

  const severity = String(campaign.severity ?? 'medium');
  const name = String(campaign.name_ro ?? campaign.name ?? 'Campanie necunoscuta');

  const cardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="white"/>
  <rect width="1200" height="8" fill="#DC2626"/>
  <text x="60" y="100" font-family="Arial, sans-serif" font-size="36" fill="#9CA3AF">FRAUDA SAPTAMANII</text>
  <text x="60" y="180" font-family="Arial, sans-serif" font-size="52" fill="#111827" font-weight="bold">${name}</text>
  <text x="60" y="260" font-family="Arial, sans-serif" font-size="36" fill="#DC2626">Severitate: ${severity.toUpperCase()}</text>
  <text x="60" y="580" font-family="Arial, sans-serif" font-size="32" fill="#2563EB" font-weight="bold">ai-grija.ro</text>
  <text x="350" y="580" font-family="Arial, sans-serif" font-size="22" fill="#9CA3AF">Verifică mesajele suspecte gratuit</text>
</svg>`;

  return { campaign, cardSvg };
}

export function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
