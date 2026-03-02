const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
export function stripTrackingParams(url) {
    try {
        const parsed = new URL(url);
        for (const param of TRACKING_PARAMS) {
            parsed.searchParams.delete(param);
        }
        return parsed.toString();
    }
    catch {
        return url;
    }
}
export function validateCheckRequest(body) {
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Textul este obligatoriu' };
    }
    const raw = body;
    if (!raw.text || typeof raw.text !== 'string') {
        return { valid: false, error: 'Textul este obligatoriu' };
    }
    const text = raw.text.trim();
    if (text.length === 0) {
        return { valid: false, error: 'Textul este obligatoriu' };
    }
    if (text.length < 3 || text.length > 5000) {
        return { valid: false, error: 'Textul trebuie să aibă între 3 și 5000 de caractere' };
    }
    if (/^\d+$/.test(text)) {
        return { valid: false, error: 'Textul trebuie să aibă între 3 și 5000 de caractere' };
    }
    let url;
    if (raw.url !== undefined && raw.url !== null && raw.url !== '') {
        if (typeof raw.url !== 'string') {
            return { valid: false, error: 'URL invalid' };
        }
        try {
            new URL(raw.url);
            url = stripTrackingParams(raw.url);
        }
        catch {
            return { valid: false, error: 'URL invalid' };
        }
    }
    return { valid: true, data: { text, url } };
}
