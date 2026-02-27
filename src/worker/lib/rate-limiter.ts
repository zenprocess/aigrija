export async function checkRateLimit(
  cache: KVNamespace,
  identifier: string,
  limit: number = 20,
  windowSeconds: number = 3600
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rl:${identifier}`;
  const raw = await cache.get(key);

  if (raw === null) {
    // First request in window — set TTL only on first write
    await cache.put(key, '1', { expirationTtl: windowSeconds });
    return { allowed: true, remaining: limit - 1 };
  }

  const current = parseInt(raw);
  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Increment counter — note: KV put always resets TTL, creating a sliding window
  // Note: KV put always resets TTL. We accept this tradeoff — the window slides.
  // For strict fixed windows, use Durable Objects instead.
  await cache.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return { allowed: true, remaining: limit - current - 1 };
}
