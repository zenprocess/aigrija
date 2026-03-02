export function logEvent(env, data) {
    if (!env.ANALYTICS)
        return;
    try {
        env.ANALYTICS.writeDataPoint({
            blobs: [
                data.endpoint,
                data.verdict ?? '',
                data.country ?? '',
            ],
            doubles: [
                data.responseTimeMs ?? 0,
                data.riskScore ?? 0,
            ],
            indexes: [data.requestId ?? ''],
        });
    }
    catch {
        // Non-fatal: analytics failure should never break request handling
    }
}
