/**
 * Zod schemas for all user-facing API endpoints.
 * Import these in route handlers to validate and parse input.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /api/check  (openapi-check.ts — CheckEndpoint)
// ---------------------------------------------------------------------------
export const MAX_TEXT_LENGTH = 5000;
export const MAX_URL_LENGTH = 2048;

export const CheckRequestSchema = z.object({
  text: z
    .string('Campul text este obligatoriu.')
    .min(3, 'Textul este prea scurt pentru analiza (minim 3 caractere).')
    .max(MAX_TEXT_LENGTH, `Textul depaseste limita de ${MAX_TEXT_LENGTH} caractere.`),
  url: z
    .string()
    .max(MAX_URL_LENGTH, `URL-ul depaseste limita de ${MAX_URL_LENGTH} caractere.`)
    .url('URL-ul nu este valid.')
    .optional(),
});

export type CheckRequest = z.infer<typeof CheckRequestSchema>;

// ---------------------------------------------------------------------------
// POST /api/check-qr  (check-qr.ts)
// ---------------------------------------------------------------------------
export const CheckQrRequestSchema = z.object({
  qr_data: z
    .string('Campul qr_data este obligatoriu.')
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Campul qr_data nu poate fi gol.')),
});

export type CheckQrRequest = z.infer<typeof CheckQrRequestSchema>;

// ---------------------------------------------------------------------------
// GET /api/report/:type  (report.ts)
// ---------------------------------------------------------------------------
export const VALID_REPORT_TYPES = [
  'plangere-penala',
  'petitie-politie',
  'raport-dnsc',
  'sesizare-banca',
] as const;

export const ReportTypeSchema = z.enum(VALID_REPORT_TYPES, {
  error: `Tip de raport invalid. Tipuri acceptate: ${VALID_REPORT_TYPES.join(', ')}`,
});

export const ReportQuerySchema = z.object({
  scam_type: z.string().max(200).optional().default('fraud\u0103 online'),
  text: z.string().max(200).optional().default(''),
  url: z.string().max(MAX_URL_LENGTH).optional(),
  bank: z.string().max(100).optional(),
  verdict: z.string().max(50).optional().default('suspicious'),
  date: z.string().max(30).optional(),
});

export type ReportQuery = z.infer<typeof ReportQuerySchema>;

// ---------------------------------------------------------------------------
// GET /api/share/:id  (share.ts)
// ---------------------------------------------------------------------------
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ShareIdSchema = z
  .string('ID-ul share este obligatoriu.')
  .regex(UUID_REGEX, 'ID invalid. Se asteapta un UUID v4.');

export type ShareId = z.infer<typeof ShareIdSchema>;

// ---------------------------------------------------------------------------
// POST /api/check/image  (upload.ts)
// ---------------------------------------------------------------------------
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export const ImageUploadSchema = z.object({
  mimeType: z.enum(ALLOWED_IMAGE_TYPES, {
    error: 'Tipul imaginii nu este suportat. Acceptam PNG, JPG sau WEBP.',
  }),
  size: z.number().max(MAX_IMAGE_SIZE, 'Imaginea nu poate depasi 5MB.'),
  textContext: z.string().max(5000).optional().default(''),
});

export type ImageUpload = z.infer<typeof ImageUploadSchema>;

// ---------------------------------------------------------------------------
// Helper: format Zod errors into a human-readable Romanian string
// ---------------------------------------------------------------------------
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((e) => e.message).join(' ');
}
