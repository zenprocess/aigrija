import { describe, it, expect } from 'vitest';
import { validateCheckRequest, stripTrackingParams } from './validator';

describe('validateCheckRequest', () => {
  it('returns valid for correct input', () => {
    const result = validateCheckRequest({ text: 'Mesaj de test valid' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.text).toBe('Mesaj de test valid');
    }
  });

  it('rejects missing text', () => {
    const result = validateCheckRequest({ url: 'https://example.com' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Textul este obligatoriu');
  });

  it('rejects null body', () => {
    const result = validateCheckRequest(null);
    expect(result.valid).toBe(false);
  });

  it('rejects text shorter than 3 chars', () => {
    const result = validateCheckRequest({ text: 'ab' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('3');
  });

  it('rejects text longer than 5000 chars', () => {
    const result = validateCheckRequest({ text: 'a'.repeat(5001) });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('5000');
  });

  it('rejects all-whitespace text', () => {
    const result = validateCheckRequest({ text: '     ' });
    expect(result.valid).toBe(false);
  });

  it('rejects all-number text', () => {
    const result = validateCheckRequest({ text: '123456' });
    expect(result.valid).toBe(false);
  });

  it('trims whitespace from text', () => {
    const result = validateCheckRequest({ text: '  hello world  ' });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.text).toBe('hello world');
  });

  it('accepts valid URL and strips tracking params', () => {
    const result = validateCheckRequest({ text: 'Mesaj valid', url: 'https://example.com/page?utm_source=fb&id=123' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.url).toContain('id=123');
      expect(result.data.url).not.toContain('utm_source');
    }
  });

  it('rejects invalid URL', () => {
    const result = validateCheckRequest({ text: 'Mesaj valid', url: 'not-a-url' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('URL invalid');
  });

  it('accepts missing url field', () => {
    const result = validateCheckRequest({ text: 'Mesaj valid fara url' });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.url).toBeUndefined();
  });

  it('returns Romanian error messages', () => {
    const r1 = validateCheckRequest({});
    if (!r1.valid) expect(r1.error).toBe('Textul este obligatoriu');
    const r2 = validateCheckRequest({ text: 'ab' });
    if (!r2.valid) expect(r2.error).toBe('Textul trebuie să aibă între 3 și 5000 de caractere');
    const r3 = validateCheckRequest({ text: 'valid text', url: 'bad' });
    if (!r3.valid) expect(r3.error).toBe('URL invalid');
  });
});

describe('stripTrackingParams', () => {
  it('removes utm_* params', () => {
    const result = stripTrackingParams('https://example.com?utm_source=google&utm_medium=cpc&q=test');
    expect(result).not.toContain('utm_source');
    expect(result).not.toContain('utm_medium');
    expect(result).toContain('q=test');
  });

  it('removes fbclid and gclid', () => {
    const result = stripTrackingParams('https://example.com?fbclid=abc&gclid=def&page=1');
    expect(result).not.toContain('fbclid');
    expect(result).not.toContain('gclid');
    expect(result).toContain('page=1');
  });

  it('returns url unchanged if invalid', () => {
    expect(stripTrackingParams('not-a-url')).toBe('not-a-url');
  });
});
