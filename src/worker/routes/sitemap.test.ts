import { describe, it, expect, vi } from "vitest";
import { sitemap, escapeXml, buildUrlEntry, buildUrlset, isWellFormedXml, STATIC_PAGES } from "./sitemap";
import type { UrlEntry } from "./sitemap";
import { CAMPAIGNS } from "../data/campaigns";

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { BASE_URL: "https://ai-grija.ro", ...overrides };
}

function makeCtx(): any {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
}

// ─── Unit tests for XML helpers ──────────────────────────────────────────────

describe("escapeXml", () => {
  it("escapes ampersands", () => {
    expect(escapeXml("A&B")).toBe("A&amp;B");
  });

  it("escapes angle brackets", () => {
    expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes quotes", () => {
    expect(escapeXml('"hello\'')).toBe("&quot;hello&apos;");
  });

  it("returns unchanged string when no special chars", () => {
    expect(escapeXml("hello world")).toBe("hello world");
  });
});

describe("buildUrlEntry", () => {
  it("builds entry without lastmod", () => {
    const entry: UrlEntry = { loc: "https://example.com/", changefreq: "daily", priority: "1.0" };
    const xml = buildUrlEntry(entry);
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).not.toContain("<lastmod>");
  });

  it("builds entry with lastmod", () => {
    const entry: UrlEntry = { loc: "https://example.com/page", lastmod: "2026-03-01", changefreq: "weekly", priority: "0.8" };
    const xml = buildUrlEntry(entry);
    expect(xml).toContain("<lastmod>2026-03-01</lastmod>");
  });

  it("escapes special characters in loc", () => {
    const entry: UrlEntry = { loc: "https://example.com/a&b", changefreq: "monthly", priority: "0.5" };
    const xml = buildUrlEntry(entry);
    expect(xml).toContain("<loc>https://example.com/a&amp;b</loc>");
  });
});

describe("buildUrlset", () => {
  it("wraps entries in urlset", () => {
    const entries: UrlEntry[] = [
      { loc: "https://example.com/", changefreq: "daily", priority: "1.0" },
    ];
    const xml = buildUrlset(entries);
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("</urlset>");
  });

  it("handles empty entries", () => {
    const xml = buildUrlset([]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
  });
});

describe("isWellFormedXml", () => {
  it("accepts valid urlset XML", () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="x">\n</urlset>';
    expect(isWellFormedXml(xml)).toBe(true);
  });

  it("rejects XML without declaration", () => {
    expect(isWellFormedXml("<urlset></urlset>")).toBe(false);
  });

  it("rejects XML without closing tag", () => {
    expect(isWellFormedXml('<?xml version="1.0"?>\n<urlset>')).toBe(false);
  });

  it("rejects XML with unescaped ampersand", () => {
    const xml = '<?xml version="1.0"?>\n<urlset xmlns="x"><url><loc>http://a.com/a&b</loc></url></urlset>';
    expect(isWellFormedXml(xml)).toBe(false);
  });

  it("accepts XML with escaped ampersand", () => {
    const xml = '<?xml version="1.0"?>\n<urlset xmlns="x"><url><loc>http://a.com/a&amp;b</loc></url></urlset>';
    expect(isWellFormedXml(xml)).toBe(true);
  });
});

// ─── STATIC_PAGES coverage ──────────────────────────────────────────────────

describe("STATIC_PAGES", () => {
  it("includes homepage", () => {
    expect(STATIC_PAGES.some((p) => p.loc === "/")).toBe(true);
  });

  it("includes /alerte", () => {
    expect(STATIC_PAGES.some((p) => p.loc === "/alerte")).toBe(true);
  });

  it("includes policy pages", () => {
    expect(STATIC_PAGES.some((p) => p.loc === "/policies/privacy")).toBe(true);
    expect(STATIC_PAGES.some((p) => p.loc === "/policies/general-terms")).toBe(true);
    expect(STATIC_PAGES.some((p) => p.loc === "/gdpr")).toBe(true);
  });

  it("includes blog section pages", () => {
    expect(STATIC_PAGES.some((p) => p.loc === "/ghid")).toBe(true);
    expect(STATIC_PAGES.some((p) => p.loc === "/educatie")).toBe(true);
    expect(STATIC_PAGES.some((p) => p.loc === "/amenintari")).toBe(true);
    expect(STATIC_PAGES.some((p) => p.loc === "/rapoarte")).toBe(true);
    expect(STATIC_PAGES.some((p) => p.loc === "/povesti")).toBe(true);
    expect(STATIC_PAGES.some((p) => p.loc === "/presa")).toBe(true);
  });

  it("does not include admin routes", () => {
    expect(STATIC_PAGES.some((p) => p.loc.includes("/admin"))).toBe(false);
  });

  it("does not include API routes", () => {
    expect(STATIC_PAGES.some((p) => p.loc.includes("/api/"))).toBe(false);
  });
});

// ─── Integration tests for GET /sitemap.xml ─────────────────────────────────

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

  it("contains all static pages", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    const body = await res.text();
    for (const page of STATIC_PAGES) {
      expect(body).toContain(`https://ai-grija.ro${page.loc}`);
    }
  });

  it("contains campaign slugs (static fallback)", async () => {
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
    expect(isWellFormedXml(body)).toBe(true);
  });

  it("includes lastmod timestamps", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("<lastmod>");
  });

  it("sets cache-control header", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });

  it("sets X-Cache MISS on first request (no KV)", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), makeEnv(), makeCtx());
    expect(res.headers.get("X-Cache")).toBe("MISS");
  });

  it("always includes all static CAMPAIGNS slugs (source of truth for SSR)", async () => {
    // Static CAMPAIGNS is the only source for /alerte/:slug SSR — all must appear
    const env = makeEnv();
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), env, makeCtx());
    const body = await res.text();
    expect(body).toContain("/alerte/apel-fals-ing-romania-2025");
    expect(body).toContain("/alerte/fanbox-sms-phishing-2025");
    expect(body).toContain("/alerte/email-fals-anaf-amenzi-2025");
    expect(body).toContain("/alerte/rovinieta-cnair-false-2025");
    expect(body).toContain("/alerte/mesaje-false-politia-romana-2025");
    expect(body).toContain("/alerte/deepfake-investitii-false-2025");
  });

  it("excludes D1-only campaigns not in static CAMPAIGNS to prevent 404s", async () => {
    // D1 may have extra campaigns that have no SSR detail page → they would 404
    const mockDb = {
      prepare: () => ({
        all: async () => ({
          results: [
            // D1-only slug (not in static CAMPAIGNS) — must NOT appear in sitemap
            { slug: "d1-only-campaign-not-in-static-2025", updated_at: "2026-01-01T00:00:00Z" },
            // This slug IS in static CAMPAIGNS — lastmod can be enriched from D1
            { slug: "apel-fals-ing-romania-2025", updated_at: "2026-02-01T00:00:00Z" },
          ],
        }),
        bind: () => ({}),
        first: async () => null,
        run: async () => ({}),
        raw: async () => [],
      }),
      exec: async () => ({}),
      batch: async () => [],
      dump: async () => new ArrayBuffer(0),
    };
    const env = makeEnv({ DB: mockDb });
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), env, makeCtx());
    const body = await res.text();
    // D1-only campaign must NOT appear (its /alerte/:slug would return 404)
    expect(body).not.toContain("/alerte/d1-only-campaign-not-in-static-2025");
    // Static CAMPAIGNS still appear (with D1-enriched lastmod when available)
    expect(body).toContain("/alerte/apel-fals-ing-romania-2025");
    // Other static campaigns also appear
    expect(body).toContain("/alerte/fanbox-sms-phishing-2025");
  });

  it("falls back to static CAMPAIGNS when D1 is unavailable", async () => {
    const env = makeEnv(); // no DB binding
    const res = await sitemap.fetch(new Request("http://localhost/sitemap.xml"), env, makeCtx());
    const body = await res.text();
    // All static CAMPAIGNS must still appear without D1
    expect(body).toContain("/alerte/apel-fals-ing-romania-2025");
    expect(body).toContain("/alerte/fanbox-sms-phishing-2025");
  });
});

// ─── Integration tests for GET /robots.txt ──────────────────────────────────

describe("GET /robots.txt", () => {
  it("returns plain text with correct content-type", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("contains both sitemap references", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("Sitemap: https://ai-grija.ro/sitemap.xml");
    expect(body).toContain("Sitemap: https://ai-grija.ro/sitemap-content.xml");
  });

  it("allows all user-agents with crawl-delay", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
    expect(body).toContain("Crawl-delay: 1");
  });

  it("disallows admin, api, health, and debug endpoints", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("Disallow: /admin/");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /health");
    expect(body).toContain("Disallow: /_debug/");
  });

  it("disallows internal-only routes (og, card, cdn-cgi)", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    const body = await res.text();
    expect(body).toContain("Disallow: /og/");
    expect(body).toContain("Disallow: /card/");
    expect(body).toContain("Disallow: /cdn-cgi/");
  });

  it("blocks AI training crawlers", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    const body = await res.text();
    const aiCrawlers = ['GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Google-Extended', 'Bytespider', 'ClaudeBot'];
    for (const bot of aiCrawlers) {
      expect(body).toContain(`User-agent: ${bot}`);
    }
  });

  it("sets long cache-control header", async () => {
    const res = await sitemap.fetch(new Request("http://localhost/robots.txt"), makeEnv(), makeCtx());
    expect(res.headers.get("Cache-Control")).toContain("max-age=86400");
  });
});
