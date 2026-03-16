import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  TelegramWebhookEndpoint,
  WhatsAppWebhookEndpoint,
  ContentWebhookEndpoint,
  GepaEvaluationsEndpoint,
} from './openapi-webhooks';

function makeEnv(overrides: Record<string, unknown> = {}): any {
  return { CACHE: {}, ...overrides };
}

describe('POST /webhook/telegram (TelegramWebhookEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new TelegramWebhookEndpoint();
    app.post('/webhook/telegram', (c) => endpoint.handle(c as any));
    return app;
  }

  it('returns ok: true for a valid update payload', async () => {
    const app = makeApp();
    const payload = {
      update_id: 1,
      message: {
        message_id: 42,
        chat: { id: 123, type: 'private' },
        text: '/start',
      },
    };
    const res = await app.fetch(
      new Request('http://localhost/webhook/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'test-secret',
        },
        body: JSON.stringify(payload),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 200 for callback_query update', async () => {
    const app = makeApp();
    const payload = {
      update_id: 2,
      callback_query: {
        id: 'cq-1',
        from: { id: 99 },
        data: 'some_action',
      },
    };
    const res = await app.fetch(
      new Request('http://localhost/webhook/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'test-secret',
        },
        body: JSON.stringify(payload),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
  });

  it('returns 200 for inline_query update', async () => {
    const app = makeApp();
    const payload = {
      update_id: 3,
      inline_query: {
        id: 'iq-1',
        from: { id: 99 },
        query: 'test query',
      },
    };
    const res = await app.fetch(
      new Request('http://localhost/webhook/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'secret',
        },
        body: JSON.stringify(payload),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
  });
});

describe('POST /webhook/whatsapp (WhatsAppWebhookEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new WhatsAppWebhookEndpoint();
    app.post('/webhook/whatsapp', (c) => endpoint.handle(c as any));
    return app;
  }

  it('returns ok: true for a valid WhatsApp message', async () => {
    const app = makeApp();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '40700000000', phone_number_id: 'phone-1' },
                messages: [
                  {
                    from: '40700000001',
                    id: 'msg-1',
                    timestamp: '1700000000',
                    type: 'text' as const,
                    text: { body: 'Hello' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
    const res = await app.fetch(
      new Request('http://localhost/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 200 even without messages in payload', async () => {
    const app = makeApp();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '40700000000', phone_number_id: 'phone-1' },
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
    const res = await app.fetch(
      new Request('http://localhost/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
  });
});

describe('POST /content/webhook (ContentWebhookEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new ContentWebhookEndpoint();
    app.post('/content/webhook', (c) => endpoint.handle(c as any));
    return app;
  }

  it('returns ok: true for Sanity cache invalidation', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/content/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'sanity-webhook-signature': 'valid-sig',
        },
        body: JSON.stringify({ _type: 'blogPost', _id: 'doc-1' }),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });

  it('returns 200 without signature header', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/content/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
  });
});

describe('GET /gepa/evaluations (GepaEvaluationsEndpoint)', () => {
  function makeApp() {
    const app = new Hono<{ Bindings: any }>();
    const endpoint = new GepaEvaluationsEndpoint();
    app.get('/gepa/evaluations', (c) => endpoint.handle(c as any));
    return app;
  }

  it('returns evaluation shape with empty list', async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request('http://localhost/gepa/evaluations?category=check-url', {
        headers: { 'x-admin-api-key': 'test-key' },
      }),
      makeEnv(), {} as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toHaveProperty('category');
    expect(body).toHaveProperty('count');
    expect(Array.isArray(body.evaluations)).toBe(true);
  });
});
