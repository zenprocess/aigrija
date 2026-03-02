/**
 * Multi-layer input validation middleware for ai-grija.ro
 *
 * L1 - Syntax:   format checks (URL format, email format, string length limits)
 * L2 - Semantic: meaning checks (URL has a reachable-looking domain, text plausibility)
 * L3 - Business: app rules (max message length, banned domains)
 *
 * Usage: import { validate, ValidationError } from './validation'
 * Then call validate(rules, data) which chains L1 -> L2 -> L3.
 */

export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_URL_LENGTH = 2048;
export const MAX_SHORT_STRING_LENGTH = 200;

export const BANNED_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwam.com',
  'trashmail.com',
  'yopmail.com',
  'sharklasers.com',
  'maildrop.cc',
  'discard.email',
  'fakeinbox.com',
  'getairmail.com',
  'tempr.email',
  'spamgourmet.com',
  'spamthisplease.com',
  'mailnull.com',
  'dispostable.com',
]);

export interface ValidationFailure {
  layer: 'L1' | 'L2' | 'L3';
  code: string;
  message: string;
}

export class ValidationError extends Error {
  readonly failures: ValidationFailure[];
  constructor(failures: ValidationFailure[]) {
    super(failures.map((f) => f.message).join('; '));
    this.name = 'ValidationError';
    this.failures = failures;
  }
}

// L1 - Syntax validators

export function validateEmailSyntax(email: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];

  if (!email || typeof email !== 'string') {
    errors.push({ layer: 'L1', code: 'EMAIL_REQUIRED', message: 'Adresa de email este obligatorie.' });
    return errors;
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    errors.push({
      layer: 'L1',
      code: 'EMAIL_TOO_LONG',
      message: `Adresa de email nu poate depasi ${MAX_EMAIL_LENGTH} de caractere.`,
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    errors.push({ layer: 'L1', code: 'EMAIL_INVALID_FORMAT', message: 'Adresa de email nu este valida.' });
  }

  return errors;
}

export function validateUrlSyntax(url: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];

  if (!url || typeof url !== 'string') {
    errors.push({ layer: 'L1', code: 'URL_REQUIRED', message: 'URL-ul este obligatoriu.' });
    return errors;
  }

  if (url.length > MAX_URL_LENGTH) {
    errors.push({
      layer: 'L1',
      code: 'URL_TOO_LONG',
      message: `URL-ul nu poate depasi ${MAX_URL_LENGTH} de caractere.`,
    });
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push({ layer: 'L1', code: 'URL_INVALID_PROTOCOL', message: 'URL-ul trebuie sa inceapa cu http:// sau https://.' });
    }
  } catch {
    errors.push({ layer: 'L1', code: 'URL_INVALID_FORMAT', message: 'URL-ul nu este valid.' });
  }

  return errors;
}

export function validatePhoneSyntax(phone: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];

  if (!phone || typeof phone !== 'string') {
    errors.push({ layer: 'L1', code: 'PHONE_REQUIRED', message: 'Numarul de telefon este obligatoriu.' });
    return errors;
  }

  const cleaned = phone.replace(/[\s\-().+]/g, '');
  if (!/^\d{7,15}$/.test(cleaned)) {
    errors.push({ layer: 'L1', code: 'PHONE_INVALID_FORMAT', message: 'Numarul de telefon nu este valid. Formatul acceptat: +40XXXXXXXXX sau 07XXXXXXXX.' });
  }

  return errors;
}

export function validateTextSyntax(
  text: string,
  opts: { fieldName?: string; minLength?: number; maxLength?: number } = {}
): ValidationFailure[] {
  const errors: ValidationFailure[] = [];
  const field = opts.fieldName ?? 'Textul';
  const min = opts.minLength ?? 1;
  const max = opts.maxLength ?? MAX_MESSAGE_LENGTH;

  if (!text || typeof text !== 'string') {
    errors.push({ layer: 'L1', code: 'TEXT_REQUIRED', message: `${field} este obligatoriu.` });
    return errors;
  }

  if (text.trim().length < min) {
    errors.push({ layer: 'L1', code: 'TEXT_TOO_SHORT', message: `${field} este prea scurt (minim ${min} caractere).` });
  }

  if (text.length > max) {
    errors.push({ layer: 'L1', code: 'TEXT_TOO_LONG', message: `${field} depaseste limita de ${max} de caractere.` });
  }

  return errors;
}

// L2 - Semantic validators

export function validateUrlSemantic(url: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return errors;
  }

  const hostname = parsed.hostname;

  // Check internal/loopback hosts first (localhost has no dot, so this must precede TLD check)
  const internalHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (internalHosts.includes(hostname.toLowerCase())) {
    errors.push({ layer: 'L2', code: 'URL_INTERNAL_HOST', message: 'URL-ul pointeaza catre o adresa interna si nu poate fi verificat.' });
    return errors;
  }

  const ipv4Regex = /^\d{1,3}(\.\d{1,3}){3}$/;
  const ipv6Regex = /^\[/;
  if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
    errors.push({ layer: 'L2', code: 'URL_RAW_IP', message: 'URL-ul contine o adresa IP in loc de un domeniu. Va rugam introduceti URL-ul complet al site-ului.' });
  }

  if (!hostname.includes('.')) {
    errors.push({ layer: 'L2', code: 'URL_NO_TLD', message: 'URL-ul nu contine un domeniu valid (lipseste extensia .com, .ro, etc.).' });
  }

  return errors;
}

export function validateTextSemantic(text: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];

  if (!text || text.trim().length === 0) return errors;

  const trimmed = text.trim();
  if (trimmed.length > 5 && new Set(trimmed).size === 1) {
    errors.push({ layer: 'L2', code: 'TEXT_REPEATED_CHARS', message: 'Textul introdus nu pare a fi un mesaj real. Va rugam introduceti textul pe care doriti sa-l verificati.' });
  }

  if (!/[a-zA-Z0-9\u00C0-\u024F]/.test(trimmed)) {
    errors.push({ layer: 'L2', code: 'TEXT_NO_WORDS', message: 'Textul trebuie sa contina cuvinte sau cifre.' });
  }

  return errors;
}

// L3 - Business rule validators

export function validateMessageLengthBusiness(text: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];
  if (text && text.length > MAX_MESSAGE_LENGTH) {
    errors.push({
      layer: 'L3',
      code: 'MESSAGE_TOO_LONG',
      message: `Mesajul nu poate depasi ${MAX_MESSAGE_LENGTH} de caractere. Trimiteti doar fragmentul relevant.`,
    });
  }
  return errors;
}

export function validateEmailDomainBusiness(email: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];

  if (!email || !email.includes('@')) return errors;

  const domain = email.split('@').pop()?.toLowerCase() ?? '';
  if (BANNED_DOMAINS.has(domain)) {
    errors.push({
      layer: 'L3',
      code: 'EMAIL_BANNED_DOMAIN',
      message: 'Adresa de email foloseste un serviciu de email temporar. Va rugam folositi o adresa de email permanenta.',
    });
  }

  return errors;
}

export function validateUrlDomainBusiness(url: string): ValidationFailure[] {
  const errors: ValidationFailure[] = [];

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return errors;
  }

  const domain = hostname.replace(/^www\./, '');

  if (BANNED_DOMAINS.has(domain)) {
    errors.push({
      layer: 'L3',
      code: 'URL_BANNED_DOMAIN',
      message: 'Domeniul URL-ului nu poate fi verificat prin aceasta platforma.',
    });
  }

  return errors;
}

// Public validate() helper - chains L1 -> L2 -> L3

export type ValidationRule =
  | { type: 'email'; value: string }
  | { type: 'url'; value: string }
  | { type: 'phone'; value: string }
  | { type: 'text'; value: string; fieldName?: string; minLength?: number; maxLength?: number };

export function validate(rules: ValidationRule[]): void {
  const l1Failures: ValidationFailure[] = [];
  const l2Failures: ValidationFailure[] = [];
  const l3Failures: ValidationFailure[] = [];

  for (const rule of rules) {
    if (rule.type === 'email') {
      const l1 = validateEmailSyntax(rule.value);
      l1Failures.push(...l1);
      if (l1.length === 0) {
        l3Failures.push(...validateEmailDomainBusiness(rule.value));
      }
    } else if (rule.type === 'url') {
      const l1 = validateUrlSyntax(rule.value);
      l1Failures.push(...l1);
      if (l1.length === 0) {
        const l2 = validateUrlSemantic(rule.value);
        l2Failures.push(...l2);
        if (l2.length === 0) {
          l3Failures.push(...validateUrlDomainBusiness(rule.value));
        }
      }
    } else if (rule.type === 'phone') {
      l1Failures.push(...validatePhoneSyntax(rule.value));
    } else if (rule.type === 'text') {
      const l1 = validateTextSyntax(rule.value, {
        fieldName: rule.fieldName,
        minLength: rule.minLength,
        maxLength: rule.maxLength,
      });
      l1Failures.push(...l1);
      if (l1.length === 0) {
        const l2 = validateTextSemantic(rule.value);
        l2Failures.push(...l2);
        if (l2.length === 0) {
          l3Failures.push(...validateMessageLengthBusiness(rule.value));
        }
      }
    }
  }

  if (l1Failures.length > 0) throw new ValidationError(l1Failures);
  if (l2Failures.length > 0) throw new ValidationError(l2Failures);
  if (l3Failures.length > 0) throw new ValidationError(l3Failures);
}

// Pre-built validators for specific routes

export function validateCheckInput(body: { text?: unknown; url?: unknown }): void {
  const rules: ValidationRule[] = [];

  if (typeof body.text === 'string') {
    rules.push({ type: 'text', value: body.text, fieldName: 'Textul mesajului', minLength: 3, maxLength: MAX_MESSAGE_LENGTH });
  } else {
    throw new ValidationError([{ layer: 'L1', code: 'TEXT_REQUIRED', message: 'Campul text este obligatoriu.' }]);
  }

  if (typeof body.url === 'string' && body.url.trim().length > 0) {
    rules.push({ type: 'url', value: body.url });
  }

  validate(rules);
}

export function validateReportInput(body: {
  scam_type?: unknown;
  text?: unknown;
  url?: unknown;
  verdict?: unknown;
}): void {
  const rules: ValidationRule[] = [];

  if (typeof body.text === 'string' && body.text.trim().length > 0) {
    rules.push({ type: 'text', value: body.text, fieldName: 'Descrierea', minLength: 3, maxLength: MAX_MESSAGE_LENGTH });
  }

  if (typeof body.url === 'string' && body.url.trim().length > 0) {
    rules.push({ type: 'url', value: body.url });
  }

  if (typeof body.scam_type === 'string' && body.scam_type.trim().length > 0) {
    rules.push({ type: 'text', value: body.scam_type, fieldName: 'Tipul de frauda', minLength: 1, maxLength: MAX_SHORT_STRING_LENGTH });
  }

  validate(rules);
}

export function validateNewsletterSubscribeInput(body: { email?: unknown }): void {
  if (typeof body.email !== 'string' || body.email.trim().length === 0) {
    throw new ValidationError([{ layer: 'L1', code: 'EMAIL_REQUIRED', message: 'Adresa de email este obligatorie.' }]);
  }
  validate([{ type: 'email', value: body.email.trim() }]);
}
