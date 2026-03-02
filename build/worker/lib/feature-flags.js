export async function getFlag(env, flag, defaultValue) {
    try {
        const value = await env.CACHE.get(`ff:${flag}`);
        if (value === null)
            return defaultValue;
        return value === '1';
    }
    catch {
        return defaultValue;
    }
}
export async function setFlag(env, flag, value) {
    await env.CACHE.put(`ff:${flag}`, value ? '1' : '0');
}
export const FLAG_DEFAULTS = {
    phishtank_enabled: true,
    vision_enabled: false,
    gemma_fallback_enabled: true,
    safe_browsing_enabled: true,
};
