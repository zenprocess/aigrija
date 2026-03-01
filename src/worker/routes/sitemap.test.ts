import { describe, it, expect, vi } from "vitest";
import { sitemap } from "./sitemap";
import { CAMPAIGNS } from "../data/campaigns";

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { BASE_URL: "https://ai-grija.ro", ...overrides };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe("GET /sitemap.xml", () => {
  it("returns XML with correct content-type", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
  });

  it("contains the base URL", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("https://ai-grija.ro");
  });

  it("contains campaign slugs", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    const body = await res.text();
    if (CAMPAIGNS.length > 0) {
      expect(body).toContain(`/alerte/${CAMPAIGNS[0].slug}`);
    }
  });

  it("is valid XML starting with xml declaration", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toMatch(/^<\?xml/);
    expect(body).toContain("<urlset");
    expect(body).toContain("</urlset>");
  });

  it("sets cache-control header", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });
});

describe("GET /robots.txt", () => {
  it("returns plain text with correct content-type", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("contains sitemap reference", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("https://ai-grija.ro/sitemap.xml");
  });

  it("allows all user-agents", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
  });
});
