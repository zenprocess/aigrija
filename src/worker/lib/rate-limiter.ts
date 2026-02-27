export async function checkRateLimit(
  cache: KVNamespace,
  identifier: string,
  limit: number = 20,
  windowSeconds: number = 3600
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rl:${identifier}`;
  const current = parseInt(await cache.get(key) || '0');
  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }
  await cache.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return { allowed: true, remaining: limit - current - 1 };
}
