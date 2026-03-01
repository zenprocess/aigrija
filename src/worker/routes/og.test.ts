import { describe, it, expect, vi } from "vitest";
import { og } from "./og";

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { BASE_URL: "https://ai-grija.ro", ...overrides };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe("GET /og/image", () => {
  it("returns SVG with correct content-type", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image?verdict=phishing&confidence=90&scam_type=Test"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  it("handles phishing verdict", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image?verdict=phishing&confidence=95"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("FRAUD");
  });

  it("handles likely_safe verdict", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image?verdict=likely_safe&confidence=80"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("22c55e");
  });

  it("falls back to suspicious for unknown verdict", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image?verdict=unknown"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("f59e0b");
  });

  it("normalizes 0-1 confidence to percentage", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image?verdict=phishing&confidence=0.85"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("85%");
  });

  it("uses defaults when params are missing", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  it("escapes HTML special chars in scam_type", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image?scam_type=%3Cscript%3E"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).not.toContain("<script>");
  });

  it("sets cache-control header", async () => {
    const res = await og.fetch(new Request("http://localhost/og/image"), makeEnv(), makeCtx());
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });
});

describe("GET /og/alert", () => {
  it("returns SVG with correct content-type", async () => {
    const res = await og.fetch(new Request("http://localhost/og/alert?title=Test&description=Desc"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  it("uses defaults when params are missing", async () => {
    const res = await og.fetch(new Request("http://localhost/og/alert"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
  });

  it("escapes HTML in title and description", async () => {
    const res = await og.fetch(new Request("http://localhost/og/alert?title=%3Cscript%3E&description=%3Cevil%3E"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("<evil>");
  });
});

describe("GET /og/:type", () => {
  it("returns HTML for verdict type", async () => {
    const res = await og.fetch(new Request("http://localhost/og/verdict?verdict=phishing&confidence=90&scam_type=Test"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("og:image");
  });

  it("returns HTML for alert type", async () => {
    const res = await og.fetch(new Request("http://localhost/og/alert?title=Alerta&description=Desc"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
  });

  it("returns 400 for unknown type", async () => {
    const res = await og.fetch(new Request("http://localhost/og/unknown"), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("HTML contains og:image meta tag pointing to image URL", async () => {
    const res = await og.fetch(new Request("http://localhost/og/verdict?verdict=phishing&confidence=0.9&scam_type=Frauda"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain('/og/image');
    expect(body).toContain('og:image');
  });
});
