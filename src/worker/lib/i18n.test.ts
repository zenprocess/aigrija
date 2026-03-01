import { describe, it, expect } from "vitest";
import { normalizeLang, getApiMessage } from "../lib/i18n";

describe("normalizeLang", () => {
  it("returns ro for null", () => expect(normalizeLang(null)).toBe("ro"));
  it("returns ro for undefined", () => expect(normalizeLang(undefined)).toBe("ro"));
  it("returns ro for empty string", () => expect(normalizeLang("")).toBe("ro"));
  it("returns ro by default for unsupported language", () => expect(normalizeLang("en")).toBe("ro"));
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
