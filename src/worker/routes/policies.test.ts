import { describe, it, expect } from 'vitest';
import { policies } from './policies';

async function get(path: string): Promise<Response> {
  return policies.request(path);
}

describe('policies routes', () => {
  describe('GET /policies/privacy', () => {
    it('returns 200 with default lang (ro)', async () => {
      const res = await get('/policies/privacy');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('lang="ro"');
    });

    it('returns 200 with ?lang=en', async () => {
      const res = await get('/policies/privacy?lang=en');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('lang="en"');
      expect(html).toContain('Privacy Policy');
    });

    it('contains translation disclaimer when lang != ro', async () => {
      const res = await get('/policies/privacy?lang=en');
      const html = await res.text();
      expect(html).toContain('disclaimer');
      expect(html).toContain('Romanian version shall prevail');
    });

    it('does NOT contain disclaimer when lang=ro', async () => {
      const res = await get('/policies/privacy?lang=ro');
      const html = await res.text();
      expect(html).not.toContain('Romanian version shall prevail');
      expect(html).not.toContain('class="disclaimer"');
    });

    it('contains hreflang links', async () => {
      const res = await get('/policies/privacy');
      const html = await res.text();
      expect(html).toContain('hreflang="ro"');
      expect(html).toContain('hreflang="en"');
      expect(html).toContain('hreflang="bg"');
      expect(html).toContain('hreflang="hu"');
      expect(html).toContain('hreflang="uk"');
    });

    it('returns 400 for unknown/invalid lang', async () => {
      const res = await get('/policies/privacy?lang=fr');
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /policies/general-terms', () => {
    it('returns 200 with default lang (ro)', async () => {
      const res = await get('/policies/general-terms');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('lang="ro"');
    });

    it('returns 200 with ?lang=en', async () => {
      const res = await get('/policies/general-terms?lang=en');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('General Terms');
    });

    it('contains translation disclaimer for bg', async () => {
      const res = await get('/policies/general-terms?lang=bg');
      const html = await res.text();
      expect(html).toContain('disclaimer');
    });

    it('does NOT contain disclaimer when lang=ro', async () => {
      const res = await get('/policies/general-terms');
      const html = await res.text();
      expect(html).not.toContain('class="disclaimer"');
    });

    it('contains hreflang links', async () => {
      const res = await get('/policies/general-terms');
      const html = await res.text();
      expect(html).toContain('hreflang="ro"');
      expect(html).toContain('hreflang="en"');
    });
  });

  describe('GET /gdpr', () => {
    it('returns 200', async () => {
      const res = await get('/gdpr');
      expect(res.status).toBe(200);
    });

    it('returns 200 with ?lang=en', async () => {
      const res = await get('/gdpr?lang=en');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('GDPR');
      expect(html).toContain('Data Deletion');
    });

    it('contains translation disclaimer for hu', async () => {
      const res = await get('/gdpr?lang=hu');
      const html = await res.text();
      expect(html).toContain('disclaimer');
    });

    it('does NOT contain disclaimer for ro', async () => {
      const res = await get('/gdpr?lang=ro');
      const html = await res.text();
      expect(html).not.toContain('class="disclaimer"');
    });

    it('contains hreflang links', async () => {
      const res = await get('/gdpr');
      const html = await res.text();
      expect(html).toContain('hreflang="ro"');
      expect(html).toContain('hreflang="uk"');
    });

    it('contains ANSPDCP reference', async () => {
      const res = await get('/gdpr');
      const html = await res.text();
      expect(html).toContain('ANSPDCP');
    });

    it('contains contact email', async () => {
      const res = await get('/gdpr');
      const html = await res.text();
      expect(html).toContain('contact@ai-grija.ro');
    });
  });
});
