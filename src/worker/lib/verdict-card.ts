export interface VerdictCardData {
  verdict: 'phishing' | 'suspicious' | 'likely_safe';
  riskScore: number;
  scamType?: string;
  domain?: string;
  flags?: string[];
}

const COLORS = { phishing: '#DC2626', suspicious: '#F59E0B', likely_safe: '#16A34A' };
const LABELS = { phishing: 'PHISHING DETECTAT', suspicious: 'MESAJ SUSPECT', likely_safe: 'PROBABIL SIGUR' };
const ICONS = { phishing: '🛡️🚫', suspicious: '⚠️', likely_safe: '✅' };

export async function generateVerdictCard(data: VerdictCardData): Promise<string> {
  const color = COLORS[data.verdict];
  const label = LABELS[data.verdict];
  const icon = ICONS[data.verdict];
  const scorePercent = Math.round(data.riskScore * 100);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="white"/>
  <rect width="1200" height="8" fill="${color}"/>
  <text x="60" y="120" font-family="Arial, sans-serif" font-size="72" fill="${color}" font-weight="bold">${icon} ${label}</text>
  <text x="60" y="200" font-family="Arial, sans-serif" font-size="40" fill="#374151">Scor risc: ${scorePercent}%</text>
  ${data.scamType ? `<text x="60" y="260" font-family="Arial, sans-serif" font-size="32" fill="#6B7280">Tip: ${data.scamType}</text>` : ''}
  ${data.domain ? `<text x="60" y="310" font-family="Arial, sans-serif" font-size="28" fill="#9CA3AF">Domeniu: ${escapeXml(data.domain)}</text>` : ''}
  <text x="60" y="580" font-family="Arial, sans-serif" font-size="36" fill="#2563EB" font-weight="bold">ai-grija.ro</text>
  <text x="400" y="580" font-family="Arial, sans-serif" font-size="24" fill="#9CA3AF">Verifică mesajele suspecte gratuit</text>
</svg>`;

  return svg;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function verdictCardHash(text: string, url?: string): string {
  const hourTs = Math.floor(Date.now() / 3_600_000);
  const raw = `${text}|${url ?? ''}|${hourTs}`;
  // Simple FNV-1a hash (no crypto needed for non-security hash)
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
