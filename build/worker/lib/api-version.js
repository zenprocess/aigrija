export const API_VERSION = '2026-03-01';
export function apiVersion() {
    return async (c, next) => {
        // Read Api-Version request header (for future use, currently ignored)
        // const requestedVersion = c.req.header('Api-Version');
        await next();
        c.header('X-API-Version', API_VERSION);
    };
}
