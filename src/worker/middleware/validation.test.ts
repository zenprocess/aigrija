import { describe, it, expect } from 'vitest';
import {
  validateEmailSyntax,
  validateUrlSyntax,
  validatePhoneSyntax,
  validateTextSyntax,
  validateUrlSemantic,
  validateTextSemantic,
  validateEmailDomainBusiness,
  validateUrlDomainBusiness,
  validateMessageLengthBusiness,
  validate,
  validateCheckInput,
  validateReportInput,
  validateNewsletterSubscribeInput,
  ValidationError,
  MAX_MESSAGE_LENGTH,
  BANNED_DOMAINS,
} from './validation';

// ---------------------------------------------------------------------------
// L1 - Syntax validators
// ---------------------------------------------------------------------------

describe('validateEmailSyntax', () => {
  it('passes valid email', () => {
    expect(validateEmailSyntax('user@example.com')).toHaveLength(0);
    expect(validateEmailSyntax('a+b@sub.domain.ro')).toHaveLength(0);
  });

  it('fails missing @', () => {
    const errs = validateEmailSyntax('notanemail');
    expect(errs[0].code).toBe('EMAIL_INVALID_FORMAT');
    expect(errs[0].layer).toBe('L1');
  });

  it('fails empty string', () => {
    const errs = validateEmailSyntax('');
    expect(errs[0].code).toBe('EMAIL_REQUIRED');
  });

  it('fails too long email', () => {
    const long = 'a'.repeat(250) + '@b.com';
    const errs = validateEmailSyntax(long);
    expect(errs.some((e) => e.code === 'EMAIL_TOO_LONG')).toBe(true);
  });

  it('returns Romanian error message', () => {
    const errs = validateEmailSyntax('bad');
    expect(errs[0].message).toMatch(/email/i);
  });
});

describe('validateUrlSyntax', () => {
  it('passes valid http URL', () => {
    expect(validateUrlSyntax('http://example.com')).toHaveLength(0);
  });

  it('passes valid https URL', () => {
    expect(validateUrlSyntax('https://www.google.com/path?q=1')).toHaveLength(0);
  });

  it('fails ftp scheme', () => {
    const errs = validateUrlSyntax('ftp://example.com');
    expect(errs[0].code).toBe('URL_INVALID_PROTOCOL');
  });

  it('fails garbage string', () => {
    const errs = validateUrlSyntax('not a url at all');
    expect(errs[0].code).toBe('URL_INVALID_FORMAT');
  });

  it('fails too long URL', () => {
    const long = 'https://example.com/' + 'a'.repeat(2100);
    const errs = validateUrlSyntax(long);
    expect(errs.some((e) => e.code === 'URL_TOO_LONG')).toBe(true);
  });

  it('fails empty string', () => {
    const errs = validateUrlSyntax('');
    expect(errs[0].code).toBe('URL_REQUIRED');
  });
});

describe('validatePhoneSyntax', () => {
  it('passes Romanian mobile format', () => {
    expect(validatePhoneSyntax('0712345678')).toHaveLength(0);
    expect(validatePhoneSyntax('+40712345678')).toHaveLength(0);
    expect(validatePhoneSyntax('+40 712 345 678')).toHaveLength(0);
  });

  it('fails too short', () => {
    const errs = validatePhoneSyntax('123');
    expect(errs[0].code).toBe('PHONE_INVALID_FORMAT');
  });

  it('fails contains letters', () => {
    const errs = validatePhoneSyntax('abc-def-ghij');
    expect(errs[0].code).toBe('PHONE_INVALID_FORMAT');
  });

  it('fails empty', () => {
    const errs = validatePhoneSyntax('');
    expect(errs[0].code).toBe('PHONE_REQUIRED');
  });
});

describe('validateTextSyntax', () => {
  it('passes normal text', () => {
    expect(validateTextSyntax('Acesta este un mesaj normal.')).toHaveLength(0);
  });

  it('fails too short with custom minLength', () => {
    const errs = validateTextSyntax('ab', { minLength: 3 });
    expect(errs[0].code).toBe('TEXT_TOO_SHORT');
  });

  it('fails too long text', () => {
    const long = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
    const errs = validateTextSyntax(long, { maxLength: MAX_MESSAGE_LENGTH });
    expect(errs[0].code).toBe('TEXT_TOO_LONG');
  });

  it('fails empty string', () => {
    const errs = validateTextSyntax('');
    expect(errs[0].code).toBe('TEXT_REQUIRED');
  });

  it('uses custom field name in message', () => {
    const errs = validateTextSyntax('', { fieldName: 'Subiectul' });
    expect(errs[0].message).toContain('Subiectul');
  });
});

// ---------------------------------------------------------------------------
// L2 - Semantic validators
// ---------------------------------------------------------------------------

describe('validateUrlSemantic', () => {
  it('passes normal domain URL', () => {
    expect(validateUrlSemantic('https://phishing-site.ro/login')).toHaveLength(0);
  });

  it('fails raw IPv4', () => {
    const errs = validateUrlSemantic('http://192.168.1.1/login');
    expect(errs[0].code).toBe('URL_RAW_IP');
  });

  it('fails localhost', () => {
    const errs = validateUrlSemantic('http://localhost/admin');
    expect(errs[0].code).toBe('URL_INTERNAL_HOST');
  });

  it('fails 127.0.0.1 as internal host', () => {
    const errs = validateUrlSemantic('http://127.0.0.1/');
    // 127.0.0.1 is in the internalHosts list so URL_INTERNAL_HOST takes precedence
    expect(errs[0].code).toBe('URL_INTERNAL_HOST');
  });

  it('returns empty array for invalid URL (L1 handles it)', () => {
    expect(validateUrlSemantic('not-a-url')).toHaveLength(0);
  });
});

describe('validateTextSemantic', () => {
  it('passes normal Romanian text', () => {
    expect(validateTextSemantic('Va rugam sa verificati acest mesaj suspect primit pe WhatsApp.')).toHaveLength(0);
  });

  it('fails all-same character repeated', () => {
    const errs = validateTextSemantic('aaaaaaaaaa');
    expect(errs[0].code).toBe('TEXT_REPEATED_CHARS');
  });

  it('fails text with no alphanumeric characters', () => {
    const errs = validateTextSemantic('!!!@@@###$$$%%%');
    expect(errs[0].code).toBe('TEXT_NO_WORDS');
  });

  it('passes short repeated (<=5 chars)', () => {
    expect(validateTextSemantic('aaa')).toHaveLength(0);
  });

  it('passes empty string without errors', () => {
    expect(validateTextSemantic('')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// L3 - Business rule validators
// ---------------------------------------------------------------------------

describe('validateEmailDomainBusiness', () => {
  it('passes legitimate domain', () => {
    expect(validateEmailDomainBusiness('user@gmail.com')).toHaveLength(0);
    expect(validateEmailDomainBusiness('angajat@institutie.ro')).toHaveLength(0);
  });

  it('fails banned disposable domain', () => {
    const errs = validateEmailDomainBusiness('user@mailinator.com');
    expect(errs[0].code).toBe('EMAIL_BANNED_DOMAIN');
    expect(errs[0].layer).toBe('L3');
  });

  it('fails yopmail', () => {
    const errs = validateEmailDomainBusiness('anon@yopmail.com');
    expect(errs[0].code).toBe('EMAIL_BANNED_DOMAIN');
  });
});

describe('validateUrlDomainBusiness', () => {
  it('passes normal domain', () => {
    expect(validateUrlDomainBusiness('https://google.com')).toHaveLength(0);
  });

  it('fails banned domain in URL', () => {
    const errs = validateUrlDomainBusiness('https://mailinator.com/inbox');
    expect(errs[0].code).toBe('URL_BANNED_DOMAIN');
  });

  it('passes with www prefix for non-banned domain', () => {
    expect(validateUrlDomainBusiness('https://www.example.com')).toHaveLength(0);
  });
});

describe('validateMessageLengthBusiness', () => {
  it('passes text within limit', () => {
    expect(validateMessageLengthBusiness('mesaj normal')).toHaveLength(0);
  });

  it('fails text exceeding MAX_MESSAGE_LENGTH', () => {
    const long = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
    const errs = validateMessageLengthBusiness(long);
    expect(errs[0].code).toBe('MESSAGE_TOO_LONG');
    expect(errs[0].layer).toBe('L3');
  });
});

// ---------------------------------------------------------------------------
// validate() - chaining
// ---------------------------------------------------------------------------

describe('validate()', () => {
  it('passes valid email rule', () => {
    expect(() => validate([{ type: 'email', value: 'ok@example.com' }])).not.toThrow();
  });

  it('throws ValidationError for L1 failure', () => {
    expect(() => validate([{ type: 'email', value: 'not-an-email' }])).toThrow(ValidationError);
  });

  it('throws for L2 failure (raw IP)', () => {
    expect(() => validate([{ type: 'url', value: 'http://192.168.0.1/login' }])).toThrow(ValidationError);
  });

  it('throws for L3 failure (banned domain email)', () => {
    expect(() => validate([{ type: 'email', value: 'user@mailinator.com' }])).toThrow(ValidationError);
  });

  it('ValidationError contains failure details', () => {
    try {
      validate([{ type: 'email', value: 'bad' }]);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const ve = e as ValidationError;
      expect(ve.failures[0].layer).toBe('L1');
      expect(ve.failures[0].code).toBeDefined();
      expect(ve.message.length).toBeGreaterThan(0);
    }
  });

  it('stops at L1 when L1 fails (does not run L2/L3)', () => {
    // A raw IP URL would fail L2, but the bad syntax fails L1 first
    expect(() => validate([{ type: 'url', value: 'garbage' }])).toThrow(ValidationError);
  });

  it('passes valid text rule', () => {
    expect(() => validate([{ type: 'text', value: 'Mesaj normal de verificat.', minLength: 3 }])).not.toThrow();
  });

  it('passes valid phone rule', () => {
    expect(() => validate([{ type: 'phone', value: '+40712345678' }])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Route-specific helpers
// ---------------------------------------------------------------------------

describe('validateCheckInput', () => {
  it('passes valid text', () => {
    expect(() => validateCheckInput({ text: 'Mesaj suspect primit azi.' })).not.toThrow();
  });

  it('passes text + valid URL', () => {
    expect(() => validateCheckInput({ text: 'Verifica acest link.', url: 'https://example.ro' })).not.toThrow();
  });

  it('fails missing text', () => {
    expect(() => validateCheckInput({ text: undefined })).toThrow(ValidationError);
  });

  it('fails too short text', () => {
    expect(() => validateCheckInput({ text: 'ab' })).toThrow(ValidationError);
  });

  it('fails invalid URL', () => {
    expect(() => validateCheckInput({ text: 'Verifica.', url: 'not-a-url' })).toThrow(ValidationError);
  });

  it('skips URL validation when url is empty string', () => {
    expect(() => validateCheckInput({ text: 'Mesaj ok pentru validare.', url: '' })).not.toThrow();
  });
});

describe('validateReportInput', () => {
  it('passes valid report fields', () => {
    expect(() =>
      validateReportInput({ scam_type: 'phishing', text: 'Detalii despre incidentul raportat.', url: 'https://scam.ro', verdict: 'phishing' })
    ).not.toThrow();
  });

  it('passes with minimal fields', () => {
    expect(() => validateReportInput({})).not.toThrow();
  });

  it('fails invalid URL in report', () => {
    expect(() => validateReportInput({ url: 'htp://broken' })).toThrow(ValidationError);
  });

  it('fails very long scam_type', () => {
    expect(() => validateReportInput({ scam_type: 'a'.repeat(201) })).toThrow(ValidationError);
  });
});

describe('validateNewsletterSubscribeInput', () => {
  it('passes valid email', () => {
    expect(() => validateNewsletterSubscribeInput({ email: 'cititor@stire.ro' })).not.toThrow();
  });

  it('fails missing email', () => {
    expect(() => validateNewsletterSubscribeInput({})).toThrow(ValidationError);
  });

  it('fails invalid email format', () => {
    expect(() => validateNewsletterSubscribeInput({ email: 'not-valid' })).toThrow(ValidationError);
  });

  it('fails disposable email', () => {
    expect(() => validateNewsletterSubscribeInput({ email: 'anon@yopmail.com' })).toThrow(ValidationError);
  });

  it('trims whitespace before validating', () => {
    expect(() => validateNewsletterSubscribeInput({ email: '  user@gmail.com  ' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// BANNED_DOMAINS set sanity
// ---------------------------------------------------------------------------

describe('BANNED_DOMAINS', () => {
  it('contains known disposable providers', () => {
    expect(BANNED_DOMAINS.has('mailinator.com')).toBe(true);
    expect(BANNED_DOMAINS.has('yopmail.com')).toBe(true);
    expect(BANNED_DOMAINS.has('tempmail.com')).toBe(true);
  });

  it('does not contain legitimate providers', () => {
    expect(BANNED_DOMAINS.has('gmail.com')).toBe(false);
    expect(BANNED_DOMAINS.has('yahoo.com')).toBe(false);
    expect(BANNED_DOMAINS.has('outlook.com')).toBe(false);
  });
});
