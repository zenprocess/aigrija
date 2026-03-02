const FIVE_YEARS_SECONDS = 5 * 365 * 24 * 60 * 60;
const TWELVE_MONTHS_MS = 12 * 30 * 24 * 60 * 60 * 1000;
function consentKey(channel, id) {
    return `consent:${channel}:${id}`;
}
function subscriberKey(channel, id) {
    return `${channel}:subscriber:${id}`;
}
export async function recordConsent(env, channel, id) {
    const now = new Date().toISOString();
    const consent = { consented_at: now, channel, id };
    await env.CACHE.put(consentKey(channel, id), JSON.stringify(consent), {
        expirationTtl: FIVE_YEARS_SECONDS,
    });
    const existing = await env.CACHE.get(subscriberKey(channel, id), 'json');
    const subscriber = {
        subscribed_at: existing?.subscribed_at ?? now,
        last_active: now,
        channel,
        id,
    };
    await env.CACHE.put(subscriberKey(channel, id), JSON.stringify(subscriber), {
        expirationTtl: FIVE_YEARS_SECONDS,
    });
}
export async function revokeConsent(env, channel, id) {
    await env.CACHE.delete(subscriberKey(channel, id));
    await env.CACHE.delete(consentKey(channel, id));
}
export async function isConsentValid(env, channel, id) {
    const value = await env.CACHE.get(consentKey(channel, id));
    return value !== null;
}
export async function updateLastActive(env, channel, id) {
    const key = subscriberKey(channel, id);
    const existing = await env.CACHE.get(key, 'json');
    if (!existing)
        return;
    const updated = { ...existing, last_active: new Date().toISOString() };
    await env.CACHE.put(key, JSON.stringify(updated), { expirationTtl: FIVE_YEARS_SECONDS });
}
export async function purgeInactiveSubscribers(env) {
    const channels = ['tg', 'wa', 'email'];
    let purged = 0;
    for (const channel of channels) {
        const prefix = `${channel}:subscriber:`;
        let cursor;
        do {
            const result = await env.CACHE.list({
                prefix,
                cursor,
            });
            for (const key of result.keys) {
                const record = await env.CACHE.get(key.name, 'json');
                if (!record)
                    continue;
                const lastActiveMs = new Date(record.last_active).getTime();
                const inactiveMs = Date.now() - lastActiveMs;
                if (inactiveMs > TWELVE_MONTHS_MS) {
                    await env.CACHE.delete(key.name);
                    await env.CACHE.delete(consentKey(channel, record.id));
                    purged++;
                }
            }
            cursor = result.list_complete ? undefined : result.cursor;
        } while (cursor);
    }
    return { purged };
}
