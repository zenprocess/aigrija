import { describe, it, expect } from 'vitest';
import {
  CheckRequestSchema,
  CheckQrRequestSchema,
  ReportTypeSchema,
  ReportQuerySchema,
  ShareIdSchema,
  ImageUploadSchema,
  formatZodError,
  MAX_TEXT_LENGTH,
  MAX_URL_LENGTH,
  MAX_IMAGE_SIZE,
  VALID_REPORT_TYPES,
} from './schemas';

// ---------------------------------------------------------------------------
// CheckRequestSchema
// ---------------------------------------------------------------------------
describe('CheckRequestSchema', () => {
  it('accepts valid text', () => {
    const result = CheckRequestSchema.safeParse({ text: 'Mesaj suspect de test' });
    expect(result.success).toBe(true);
  });

  it('accepts text with optional URL', () => {
    const result = CheckRequestSchema.safeParse({
      text: 'Mesaj suspect',
      url: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects text shorter than 3 chars', () => {
    const result = CheckRequestSchema.safeParse({ text: 'ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain('prea scurt');
    }
  });

  it('rejects text exceeding MAX_TEXT_LENGTH', () => {
    const result = CheckRequestSchema.safeParse({ text: 'a'.repeat(MAX_TEXT_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = CheckRequestSchema.safeParse({ text: 'Mesaj suspect', url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects URL exceeding MAX_URL_LENGTH', () => {
    const result = CheckRequestSchema.safeParse({
      text: 'Mesaj suspect',
      url: 'https://example.com/' + 'a'.repeat(MAX_URL_LENGTH),
    });
    expect(result.success).toBe(false);
  });

  it('allows missing url field', () => {
    const result = CheckRequestSchema.safeParse({ text: 'Un mesaj mai lung' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.url).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CheckQrRequestSchema
// ---------------------------------------------------------------------------
describe('CheckQrRequestSchema', () => {
  it('accepts valid qr_data and trims whitespace', () => {
    const result = CheckQrRequestSchema.safeParse({ qr_data: '  https://example.com  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.qr_data).toBe('https://example.com');
  });

  it('rejects missing qr_data', () => {
    const result = CheckQrRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) expect(formatZodError(result.error)).toContain('qr_data');
  });

  it('rejects empty string qr_data', () => {
    const result = CheckQrRequestSchema.safeParse({ qr_data: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string qr_data', () => {
    const result = CheckQrRequestSchema.safeParse({ qr_data: 123 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ReportTypeSchema
// ---------------------------------------------------------------------------
describe('ReportTypeSchema', () => {
  it.each(VALID_REPORT_TYPES)('accepts valid type: %s', (type) => {
    expect(ReportTypeSchema.safeParse(type).success).toBe(true);
  });

  it('rejects unknown type', () => {
    const result = ReportTypeSchema.safeParse('unknown-type');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain('Tip de raport invalid');
    }
  });
});

// ---------------------------------------------------------------------------
// ReportQuerySchema
// ---------------------------------------------------------------------------
describe('ReportQuerySchema', () => {
  it('fills defaults for missing optional fields', () => {
    const result = ReportQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verdict).toBe('suspicious');
      expect(result.data.text).toBe('');
    }
  });

  it('accepts all valid fields', () => {
    const result = ReportQuerySchema.safeParse({
      scam_type: 'phishing',
      text: 'text excerpt',
      url: 'https://bad.com',
      bank: 'BRD',
      verdict: 'phishing',
      date: '01.01.2025',
    });
    expect(result.success).toBe(true);
  });

  it('rejects scam_type longer than 200 chars', () => {
    const result = ReportQuerySchema.safeParse({ scam_type: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ShareIdSchema
// ---------------------------------------------------------------------------
describe('ShareIdSchema', () => {
  it('accepts valid UUID v4', () => {
    const result = ShareIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID string', () => {
    const result = ShareIdSchema.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain('UUID');
    }
  });

  it('rejects UUID v1 format', () => {
    // v1 UUID has different version digit (not 4)
    const result = ShareIdSchema.safeParse('550e8400-e29b-11d4-a716-446655440000');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ImageUploadSchema
// ---------------------------------------------------------------------------
describe('ImageUploadSchema', () => {
  it('accepts valid PNG upload', () => {
    const result = ImageUploadSchema.safeParse({
      mimeType: 'image/png',
      size: 1024,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.textContext).toBe('');
  });

  it('accepts jpeg with text context', () => {
    const result = ImageUploadSchema.safeParse({
      mimeType: 'image/jpeg',
      size: 500000,
      textContext: 'context text',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unsupported MIME type', () => {
    const result = ImageUploadSchema.safeParse({
      mimeType: 'image/gif',
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain('PNG');
    }
  });

  it('rejects file exceeding MAX_IMAGE_SIZE', () => {
    const result = ImageUploadSchema.safeParse({
      mimeType: 'image/png',
      size: MAX_IMAGE_SIZE + 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain('5MB');
    }
  });

  it('rejects textContext exceeding 5000 chars', () => {
    const result = ImageUploadSchema.safeParse({
      mimeType: 'image/webp',
      size: 100,
      textContext: 'x'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatZodError
// ---------------------------------------------------------------------------
describe('formatZodError', () => {
  it('joins multiple errors with space', () => {
    const result = CheckRequestSchema.safeParse({ text: 'ab', url: 'bad-url' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = formatZodError(result.error);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});
