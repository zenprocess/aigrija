/**
 * Client-side PII redaction for Romanian formats.
 * Call redactPII(text) before sending text to the API.
 */

const PATTERNS = [
  // CNP: 13-digit number starting with 1-8
  {
    regex: /\b([1-8]\d{12})\b/g,
    replace: (match) => match[0] + '*'.repeat(9) + match.slice(-3),
  },
  // IBAN: RO + 2 digits + 4 chars + 16 digits
  {
    regex: /\b(RO\d{2}[A-Z0-9]{4})\w{12,16}\b/gi,
    replace: (_, prefix) => `${prefix}${'*'.repeat(16)}`,
  },
  // Card numbers: 16 digits (with optional spaces/dashes)
  {
    regex: /\b(\d{4}[\s-]?)(\d{4}[\s-]?)(\d{4}[\s-]?)(\d{4})\b/g,
    replace: (_, _p1, _p2, _p3, last4) => `**** **** **** ${last4}`,
  },
  // Email: mask local part
  {
    regex: /\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    replace: (_, first, domain) => `${first}***${domain}`,
  },
  // Romanian phone: 07xx or +407xx
  {
    regex: /(\+40|0)(7\d{2})\s?(\d{3})\s?(\d{3})\b/g,
    replace: (_, prefix, mid, _p3, last3) => `${prefix}${mid}***${last3}`,
  },
  // Romanian ID card series: 2 uppercase letters + 6 digits (e.g., IF123456)
  {
    regex: /([A-Z]{2})\d{3}(\d{3})/g,
    replace: (_, prefix, last3) => `${prefix}•••${last3}`,
  },
];

/**
 * Redact PII from text.
 * @param {string} text
 * @returns {{ redacted: string, changed: boolean }}
 */
export function redactPII(text) {
  let redacted = text;
  for (const { regex, replace } of PATTERNS) {
    regex.lastIndex = 0;
    redacted = redacted.replace(regex, replace);
  }
  return { redacted, changed: redacted !== text };
}
