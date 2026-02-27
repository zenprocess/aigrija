export async function checkRateLimit(
  cache: KVNamespace,
  identifier: string,
  limit: number = 20,
  windowSeconds: number = 3600
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const key = `rl:${identifier}`;
  const raw = await cache.get(key);

  if (raw === null) {
    await cache.put(key, '1', { expirationTtl: windowSeconds });
    return { allowed: true, remaining: limit - 1, limit };
  }

  const current = parseInt(raw);
  if (current >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  // Increment counter — note: KV put always resets TTL, creating a sliding window
  // We accept this tradeoff. For strict fixed windows, use Durable Objects instead.
  await cache.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return { allowed: true, remaining: limit - current - 1, limit };
}
