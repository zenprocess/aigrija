import { describe, it, expect } from "vitest";
import { normalizeLang, getApiMessage } from "./i18n";
import { z } from "zod";
import {
  CheckRequestSchema,
  CheckQrRequestSchema,
  ReportTypeSchema,
  ShareIdSchema,
  ImageUploadSchema,
  formatZodError,
} from "./schemas";

// ── Romanian word / diacritic patterns ──────────────────────────────────────
const RO_PATTERNS = [
  /campul/i,
  /textul/i,
  /url/i,
  /imaginea/i,
  /minim/i,
  /depas/i,
  /invalid/i,
  /obligatoriu/i,
  /gol/i,
  /accepta/i,
  /suportat/i,
  /tip/i,
  /raport/i,
  /astept/i,
  /[À-ſ]/,   // any Latin extended / diacritic character
];

function isRomanian(msg: string): boolean {
  return RO_PATTERNS.some((p) => p.test(msg));
}

function zodErrorMsg(schema: z.ZodType, input: unknown): string {
  const result = schema.safeParse(input);
  if (result.success) return '';
  return formatZodError(result.error);
}

// ── i18n helper tests ────────────────────────────────────────────────────────
describe("normalizeLang", () => {
  it("returns ro for null", () => expect(normalizeLang(null)).toBe("ro"));
  it("returns ro for undefined", () => expect(normalizeLang(undefined)).toBe("ro"));
  it("returns ro for empty string", () => expect(normalizeLang("")).toBe("ro"));
  it("returns ro for unsupported language", () => expect(normalizeLang("en")).toBe("ro"));
  it("returns ro for 'fr'", () => expect(normalizeLang("fr")).toBe("ro"));
  it("returns ro when passed 'ro'", () => expect(normalizeLang("ro")).toBe("ro"));
  it("returns bg for 'bg'", () => expect(normalizeLang("bg")).toBe("bg"));
  it("returns hu for 'hu'", () => expect(normalizeLang("hu")).toBe("hu"));
  it("returns uk for 'uk'", () => expect(normalizeLang("uk")).toBe("uk"));
});

describe("getApiMessage", () => {
  it("returns Romanian message by default (null lang)", () => {
    const msg = getApiMessage("error.generic", null);
    expect(msg).toContain("eroare");
  });

  it("returns Romanian message for unsupported lang", () => {
    const msg = getApiMessage("error.generic", "de");
    expect(msg).toContain("eroare");
  });

  it("returns Bulgarian message for bg", () => {
    const msg = getApiMessage("error.generic", "bg");
    expect(msg).toContain("грешка");
  });

  it("returns Hungarian message for hu", () => {
    const msg = getApiMessage("error.generic", "hu");
    expect(msg).toContain("Hiba");
  });

  it("interpolates variables in message", () => {
    const msg = getApiMessage("error.rate_limit", "ro", { seconds: "60" });
    expect(msg).toContain("60");
    expect(msg).not.toContain("{{seconds}}");
  });

  it("returns success message for check_complete in ro", () => {
    const msg = getApiMessage("success.check_complete", "ro");
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ── Schema i18n completeness tests ──────────────────────────────────────────
describe("Schema error messages are in Romanian", () => {
  it("CheckRequestSchema: text too short", () => {
    const msg = zodErrorMsg(CheckRequestSchema, { text: "ab" });
    expect(msg.length).toBeGreaterThan(0);
    expect(isRomanian(msg)).toBe(true);
  });

  it("CheckRequestSchema: text too long", () => {
    const msg = zodErrorMsg(CheckRequestSchema, { text: "a".repeat(5001) });
    expect(isRomanian(msg)).toBe(true);
  });

  it("CheckRequestSchema: invalid URL", () => {
    const msg = zodErrorMsg(CheckRequestSchema, { text: "test text here", url: "not-a-url" });
    expect(isRomanian(msg)).toBe(true);
  });

  it("CheckQrRequestSchema: empty qr_data", () => {
    const msg = zodErrorMsg(CheckQrRequestSchema, { qr_data: "   " });
    expect(isRomanian(msg)).toBe(true);
  });

  it("ReportTypeSchema: invalid type", () => {
    const msg = zodErrorMsg(ReportTypeSchema, "invalid-type");
    expect(isRomanian(msg)).toBe(true);
  });

  it("ShareIdSchema: invalid UUID", () => {
    const msg = zodErrorMsg(ShareIdSchema, "not-a-uuid");
    expect(isRomanian(msg)).toBe(true);
  });

  it("ImageUploadSchema: unsupported mime type", () => {
    const msg = zodErrorMsg(ImageUploadSchema, { mimeType: "image/gif", size: 100 });
    expect(isRomanian(msg)).toBe(true);
  });

  it("ImageUploadSchema: file too large", () => {
    const msg = zodErrorMsg(ImageUploadSchema, { mimeType: "image/png", size: 6 * 1024 * 1024 });
    expect(isRomanian(msg)).toBe(true);
  });
});
