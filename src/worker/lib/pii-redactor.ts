/**
 * PII Redactor — removes Romanian personal identifiers before AI analysis.
 * All matched values are replaced with [REDACTAT] to protect privacy.
 */

interface RedactionResult {
  redacted: string;
  /** Number of PII tokens replaced */
  count: number;
}

function makePatterns() {
  return [
    // CNP — Cod Numeric Personal (13 digits starting with 1-8)
    { name: 'CNP', re: /\b[1-8]\d{12}\b/g },
    // Card numbers (16 digits, optionally grouped by 4 with space or dash)
    { name: 'CARD', re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
    // Romanian IBAN: RO + 2 check digits + 4 letters (bank) + 16 alphanumeric chars
    { name: 'IBAN', re: /\bRO\d{2}[A-Z]{4}[A-Z0-9]{16}\b/gi },
    // Romanian mobile/landline: 07x, 02x, or 03x — 10 digits total
    { name: 'PHONE', re: /\b0[237]\d{8}\b/g },
  ];
}

export function redactPii(text: string): RedactionResult {
  let redacted = text;
  let count = 0;

  // Fresh patterns per call — avoids lastIndex state pollution across invocations
  for (const { re } of makePatterns()) {
    const matches = redacted.match(re);
    if (matches) {
      count += matches.length;
      redacted = redacted.replace(re, '[REDACTAT]');
    }
  }

  return { redacted, count };
}
