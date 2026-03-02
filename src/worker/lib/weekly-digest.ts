import type { Env } from './types';

// ─── Legacy export (used by report-generator / card routes) ──────────────────

export interface WeeklyDigestResult {
  campaign: Record<string, unknown>;
  cardSvg: string;
}

/** @deprecated Use generateWeeklyDigest(env) instead */
export async function generateWeeklyDigestLegacy(env: Env): Promise<WeeklyDigestResult | null> {
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

// ─── New weekly digest types ──────────────────────────────────────────────────

export interface WeeklyDigestScam {
  title: string;
  url: string;
  reportCount: number;
  severity: string;
}

export interface WeeklyDigestStats {
  totalChecks: number;
  totalAlerts: number;
  quizCompletions: number;
  communityReports: number;
}

export interface WeeklyDigestPost {
  title: string;
  slug: string;
  date: string;
}

export interface WeeklyDigest {
  weekOf: string;
  topScams: WeeklyDigestScam[];
  stats: WeeklyDigestStats;
  blogPosts: WeeklyDigestPost[];
  tips: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROMANIAN_TIPS: string[] = [
  'Nu furnizati niciodata datele bancare prin SMS sau e-mail nesolicitat.',
  'Verificati intotdeauna adresa URL inainte de a introduce date personale.',
  'Raportati mesajele suspecte la DNSC sau politie pentru a proteja si pe altii.',
  'Bancile nu va vor cere niciodata parola sau codul PIN prin telefon.',
  'Activati autentificarea in doi pasi pentru conturile importante.',
  'Fiti sceptici fata de ofertele prea avantajoase - daca pare prea bun, probabil e frauda.',
  'Nu deschideti link-uri din mesaje primite de la numere necunoscute.',
];

function pickTips(count: number, weekYear: string): string[] {
  const seed = parseInt(weekYear.replace('-', ''), 10) || 0;
  const start = seed % ROMANIAN_TIPS.length;
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    selected.push(ROMANIAN_TIPS[(start + i) % ROMANIAN_TIPS.length]);
  }
  return selected;
}

/** Returns ISO week number (1-53) for a date */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Returns ISO week string "YYYY-WW" - kept for backward compat */
export function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Returns "YYYY-WW" digest cache key for the current week */
export function currentWeekKey(date: Date = new Date()): string {
  const week = getISOWeekNumber(date);
  return `${date.getFullYear()}-${String(week).padStart(2, '0')}`;
}

/** Human-readable week range: "24 Feb - 2 Mar 2026" */
export function weekLabel(date: Date = new Date()): string {
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const RO_MONTHS = [
    'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
    'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const fmtDay = (d: Date) => `${d.getDate()} ${RO_MONTHS[d.getMonth()]}`;
  return `${fmtDay(monday)} - ${fmtDay(sunday)} ${sunday.getFullYear()}`;
}

// ─── Main aggregation function ────────────────────────────────────────────────

export async function generateWeeklyDigest(env: Env): Promise<WeeklyDigest> {
  const weekKey = currentWeekKey();
  const cacheKey = `digest:${weekKey}`;

  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as WeeklyDigest;
    } catch {
      // Corrupted cache - recompute
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Top 10 scam campaigns from D1
  let topScams: WeeklyDigestScam[] = [];
  try {
    const rows = await env.DB.prepare(
      `SELECT id, title, source_url, severity, created_at
       FROM campaigns
       WHERE created_at >= ?
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       created_at DESC
       LIMIT 10`
    ).bind(sevenDaysAgo).all<{
      id: string;
      title: string;
      source_url: string | null;
      severity: string;
      created_at: string;
    }>();

    topScams = (rows.results ?? []).map((r, idx) => ({
      title: r.title,
      url: r.source_url ?? 'https://ai-grija.ro/alerte',
      reportCount: Math.max(1, 10 - idx),
      severity: r.severity ?? 'medium',
    }));
  } catch {
    // D1 unavailable
  }

  // KV aggregate stats
  let totalChecks = 0;
  let totalAlerts = 0;
  let quizCompletions = 0;
  let communityReports = 0;

  try {
    const checksRaw = await env.CACHE.get('stats:total_checks');
    totalChecks = Number(checksRaw) || 0;

    const alertsRaw = await env.CACHE.get('stats:total_alerts');
    totalAlerts = Number(alertsRaw) || 0;

    const quizRaw = await env.CACHE.get('stats:quiz_completions');
    quizCompletions = Number(quizRaw) || 0;

    const reportList = await env.CACHE.list({ prefix: 'report:', limit: 1000 });
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const key of reportList.keys) {
      if (key.metadata) {
        const meta = key.metadata as { timestamp?: number };
        if (meta.timestamp && meta.timestamp >= cutoff) {
          communityReports++;
        }
      }
    }
  } catch {
    // KV unavailable
  }

  // Recent published campaigns
  const blogPosts: WeeklyDigestPost[] = [];
  try {
    const blogRows = await env.DB.prepare(
      `SELECT id, title, updated_at
       FROM campaigns
       WHERE draft_status = 'published' AND updated_at >= ?
       ORDER BY updated_at DESC
       LIMIT 3`
    ).bind(sevenDaysAgo).all<{ id: string; title: string; updated_at: string }>();

    for (const r of blogRows.results ?? []) {
      blogPosts.push({
        title: r.title,
        slug: r.id,
        date: r.updated_at ? r.updated_at.split('T')[0] : '',
      });
    }
  } catch {
    // D1 unavailable
  }

  const digest: WeeklyDigest = {
    weekOf: weekLabel(),
    topScams,
    stats: { totalChecks, totalAlerts, quizCompletions, communityReports },
    blogPosts,
    tips: pickTips(3, weekKey),
  };

  const TTL_7_DAYS = 7 * 24 * 60 * 60;
  try {
    await env.CACHE.put(cacheKey, JSON.stringify(digest), { expirationTtl: TTL_7_DAYS });
  } catch {
    // KV write failure
  }

  return digest;
}
