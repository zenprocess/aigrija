/**
 * Constant-time comparison of two hex strings.
 * Uses crypto.subtle.timingSafeEqual (Cloudflare Workers) with a
 * constant-time XOR fallback for environments that lack it (e.g. Node test runner).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const subtle = crypto.subtle as unknown as { timingSafeEqual?(a: BufferSource, b: BufferSource): boolean };
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(bufA, bufB);
  }
  // Constant-time XOR fallback
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

export async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
  _maxAgeSeconds = 300
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = [...new Uint8Array(sig)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(signature, expected);
}
