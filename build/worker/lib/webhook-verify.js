export async function verifyWebhookSignature(body, signature, secret, _maxAgeSeconds = 300) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = [...new Uint8Array(sig)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return signature === expected;
}
