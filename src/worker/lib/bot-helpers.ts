import type { ClassificationResult } from './types';

/** Extract URLs from text */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  return text.match(urlRegex) ?? [];
}

/** FNV-1a 32-bit hash -> 8-char hex */
export function simpleHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function verdictEmoji(verdict: string): string {
  if (verdict === 'phishing') return '\u{1F534}';
  if (verdict === 'suspicious') return '\u{1F7E1}';
  return '\u{1F7E2}';
}

export function verdictLabel(verdict: string): string {
  if (verdict === 'phishing') return 'PHISHING DETECTAT';
  if (verdict === 'suspicious') return 'MESAJ SUSPECT';
  return 'PROBABIL SIGUR';
}

export interface FormatAnalysisOptions {
  format: 'html' | 'whatsapp';
  isForwarded?: boolean;
  cardUrl?: string;
}

export function formatAnalysisReply(
  result: Pick<ClassificationResult, 'verdict' | 'confidence' | 'red_flags' | 'explanation' | 'recommended_actions'>,
  urlFlags: string[],
  options: FormatAnalysisOptions
): string {
  const emoji = verdictEmoji(result.verdict);
  const label = verdictLabel(result.verdict);
  const confidencePct = Math.round(result.confidence * 100);

  const isHtml = options.format === 'html';
  const bold = (s: string) => (isHtml ? `<b>${s}</b>` : `*${s}*`);
  const italic = (s: string) => (isHtml ? `<i>${s}</i>` : `_${s}_`);
  const bullet = isHtml ? '\u2022' : '-';

  const lines: string[] = [
    `${emoji} ${bold(label)}`,
    italic(`Confidenta: ${confidencePct}%`),
    '',
  ];

  if (isHtml) {
    lines.push(`\u{1F4CB} ${bold('Explicatie:')}`);
  } else {
    lines.push('Explicatie:');
  }
  lines.push(result.explanation);

  const allFlags = [...result.red_flags, ...urlFlags];
  if (allFlags.length > 0) {
    if (isHtml) {
      lines.push('', `\u{1F6A9} ${bold('Semne de alarma:')}`);
    } else {
      lines.push('', 'Semne de alarma:');
    }
    for (const flag of allFlags) {
      lines.push(`${bullet} ${flag}`);
    }
  }

  if (result.recommended_actions.length > 0) {
    if (isHtml) {
      lines.push('', `\u2705 ${bold('Actiuni recomandate:')}`);
    } else {
      lines.push('', 'Actiuni recomandate:');
    }
    result.recommended_actions.forEach((action, i) => {
      lines.push(`${i + 1}. ${action}`);
    });
  }

  if (isHtml) {
    lines.push('', '\u{1F6E1}\uFE0F ai-grija.ro \u2014 Proiect civic de Zen Labs');
  } else {
    if (options.isForwarded) {
      lines.push('', '\u26A0\uFE0F Mesaj redirec\u021Bionat detectat \u2014 analizat automat.');
    }
    if (options.cardUrl) {
      lines.push('', `\u{1F4CA} Card verificare: ${options.cardUrl}`);
    }
    lines.push('', 'Verifica pe https://ai-grija.ro');
  }

  return lines.join('\n');
}
