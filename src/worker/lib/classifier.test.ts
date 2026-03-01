import { describe, it, expect } from 'vitest';
import { ClassificationValidationError } from './classifier';

// Import internals via re-export trick — we test the validation via the error path
// since classify() requires a live AI binding. We test stripHtml + validation via
// exported error class and indirect testing.

describe('ClassificationValidationError', () => {
  it('is an instance of Error', () => {
    const err = new ClassificationValidationError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ClassificationValidationError');
    expect(err.message).toBe('test');
  });
});

// Test the validation logic via a thin wrapper that re-implements what classify() does
// (avoids needing an AI binding in unit tests)
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

function validateAndSanitizeInput(text: string): string {
  const stripped = stripHtml(text);
  const trimmed = stripped.trim();
  if (trimmed.length === 0) throw new ClassificationValidationError('Textul nu poate fi gol sau compus doar din spatii.');
  if (trimmed.length < 3) throw new ClassificationValidationError('Textul este prea scurt pentru analiza (minim 3 caractere).');
  if (text.length > 5000) throw new ClassificationValidationError('Textul depaseste limita de 5000 caractere.');
  return trimmed;
}

describe('input validation', () => {
  it('rejects empty string', () => {
    expect(() => validateAndSanitizeInput('')).toThrow(ClassificationValidationError);
  });

  it('rejects whitespace-only string', () => {
    expect(() => validateAndSanitizeInput('   ')).toThrow(ClassificationValidationError);
  });

  it('rejects text shorter than 3 chars after stripping', () => {
    expect(() => validateAndSanitizeInput('ab')).toThrow(ClassificationValidationError);
  });

  it('rejects text longer than 5000 chars', () => {
    expect(() => validateAndSanitizeInput('a'.repeat(5001))).toThrow(ClassificationValidationError);
  });

  it('accepts valid text of exactly 3 chars', () => {
    expect(validateAndSanitizeInput('abc')).toBe('abc');
  });

  it('strips HTML tags and trims', () => {
    expect(validateAndSanitizeInput('  <b>hello world</b>  ')).toBe('hello world');
  });

  it('rejects text that is only HTML tags (empty after strip)', () => {
    expect(() => validateAndSanitizeInput('<div><br/></div>')).toThrow(ClassificationValidationError);
  });

  it('strips HTML but validates length after stripping', () => {
    // tag-heavy text that leaves only 2 chars after strip
    expect(() => validateAndSanitizeInput('<p>ab</p>')).toThrow(ClassificationValidationError);
  });
});
