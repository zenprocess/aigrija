import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../lib/types';

async function makeApp() {
  const { reportGenerator } = await import('./report-generator');
  const app = new Hono<{ Bindings: Env }>();
  app.route('/', reportGenerator);
  return app;
}

describe('GET /raport', () => {
  it('returns 200 with HTML form', async () => {
    const app = await makeApp();
    const res = await app.request('/raport');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Generator Raport Incident');
    expect(html).toContain('<form');
  });

  it('contains Romanian authority links', async () => {
    const app = await makeApp();
    const res = await app.request('/raport');
    const html = await res.text();
    expect(html).toContain('1911');
    expect(html).toContain('dnsc.ro');
    expect(html).toContain('politiaromana.ro');
    expect(html).toContain('cert.ro');
  });

  it('contains required form fields', async () => {
    const app = await makeApp();
    const res = await app.request('/raport');
    const html = await res.text();
    expect(html).toContain('incident-date');
    expect(html).toContain('description');
    expect(html).toContain('reporter-name');
    expect(html).toContain('reporter-email');
  });

  it('pre-fills verdict when query param provided', async () => {
    const app = await makeApp();
    const res = await app.request('/raport?verdict=phishing&scam_type=bank_impersonation');
    const html = await res.text();
    expect(html).toContain('Phishing');
    expect(html).toContain('Impersonare banc');
  });

  it('handles unknown verdict gracefully', async () => {
    const app = await makeApp();
    const res = await app.request('/raport?verdict=unknown');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Generator Raport Incident');
  });

  it('includes print button and report output section', async () => {
    const app = await makeApp();
    const res = await app.request('/raport');
    const html = await res.text();
    expect(html).toContain('Tipărește');
    expect(html).toContain('report-output');
  });

  it('is in Romanian language', async () => {
    const app = await makeApp();
    const res = await app.request('/raport');
    const html = await res.text();
    expect(html).toContain('lang="ro"');
    expect(html).toContain('Descrierea incidentului');
  });
});
