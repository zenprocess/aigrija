import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from './webhook-verify';

async function sign(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyWebhookSignature', () => {
  it('returns true for valid signature', async () => {
    const secret = 'my-secret';
    const body = '{"event":"test"}';
    const signature = await sign(body, secret);
    expect(await verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('returns false for invalid signature', async () => {
    expect(await verifyWebhookSignature('body', 'badsig', 'secret')).toBe(false);
  });

  it('returns false when body differs', async () => {
    const secret = 'my-secret';
    const signature = await sign('original-body', secret);
    expect(await verifyWebhookSignature('modified-body', signature, secret)).toBe(false);
  });
});
