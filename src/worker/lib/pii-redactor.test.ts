import { describe, it, expect } from 'vitest';
import { redactPii } from './pii-redactor';

describe('redactPii', () => {
  it('redacts CNP (13 digits starting with 1-8)', () => {
    const { redacted, count } = redactPii('CNP-ul meu este 1234567890123 si datele mele.');
    expect(redacted).not.toContain('1234567890123');
    expect(redacted).toContain('[REDACTAT]');
    expect(count).toBe(1);
  });

  it('does not redact 13-digit numbers starting with 0 or 9', () => {
    const { redacted } = redactPii('numarul 0234567890123 nu este CNP');
    expect(redacted).not.toContain('[REDACTAT]');
  });

  it('redacts card numbers with spaces', () => {
    const { redacted, count } = redactPii('Card: 1234 5678 9012 3456');
    expect(redacted).not.toContain('1234 5678 9012 3456');
    expect(redacted).toContain('[REDACTAT]');
    expect(count).toBe(1);
  });

  it('redacts card numbers with dashes', () => {
    const { redacted } = redactPii('Card: 1234-5678-9012-3456');
    expect(redacted).toContain('[REDACTAT]');
  });

  it('redacts card numbers without separators', () => {
    const { redacted } = redactPii('Card: 1234567890123456');
    expect(redacted).toContain('[REDACTAT]');
  });

  it('redacts Romanian IBAN', () => {
    const { redacted, count } = redactPii('IBAN: RO49AAAA1B31007593840000');
    expect(redacted).not.toContain('RO49AAAA1B31007593840000');
    expect(redacted).toContain('[REDACTAT]');
    expect(count).toBe(1);
  });

  it('redacts IBAN case-insensitively', () => {
    const { redacted } = redactPii('iban: ro49aaaa1b31007593840000');
    expect(redacted).toContain('[REDACTAT]');
  });

  it('redacts Romanian mobile phone (07x)', () => {
    const { redacted, count } = redactPii('Suna-ma la 0723456789 urgent.');
    expect(redacted).not.toContain('0723456789');
    expect(redacted).toContain('[REDACTAT]');
    expect(count).toBe(1);
  });

  it('redacts Romanian landline (02x)', () => {
    const { redacted } = redactPii('Telefon fix: 0212345678');
    expect(redacted).toContain('[REDACTAT]');
  });

  it('redacts multiple PII types in one string', () => {
    const text = 'CNP: 1234567890123, card: 1234 5678 9012 3456, tel: 0723456789';
    const { redacted, count } = redactPii(text);
    expect(count).toBe(3);
    expect(redacted.split('[REDACTAT]').length).toBe(4);
  });

  it('returns count 0 and unchanged text when no PII found', () => {
    const text = 'Mesajul asta nu contine date personale.';
    const { redacted, count } = redactPii(text);
    expect(count).toBe(0);
    expect(redacted).toBe(text);
  });
});
