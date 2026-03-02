export function structuredLog(level, message, meta = {}) {
    const enrichedMeta = { ...meta };
    const entry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...enrichedMeta,
    };
    if (level === 'error') {
        console.error(JSON.stringify(entry));
    }
    else if (level === 'warn') {
        console.warn(JSON.stringify(entry));
    }
    else {
        console.log(JSON.stringify(entry));
    }
}
