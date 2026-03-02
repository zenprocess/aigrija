import { getAllOfficialDomains } from '../data/domains-whitelist';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { withRetry } from './retry';
import { structuredLog } from './logger';
import { getDomainIntel } from './domain-intel';
class HttpError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
const SAFE_BROWSING_THREAT_TYPES = [
    'MALWARE',
    'SOCIAL_ENGINEERING',
    'UNWANTED_SOFTWARE',
    'POTENTIALLY_HARMFUL_APPLICATION',
];
const URL_THREAT_CACHE_TTL_SAFE_MS = 86_400_000; // 24 hours — safe results
const URL_THREAT_CACHE_TTL_SAFE_KV = 86_400; // 24h in seconds
const URL_THREAT_CACHE_TTL_THREAT_MS = 3_600_000; // 1 hour — suspicious/malicious
const URL_THREAT_CACHE_TTL_THREAT_KV = 3_600; // 1h in seconds
async function checkPhishTank(url, apiKey, kv) {
    const doFetch = async () => {
        const formData = new URLSearchParams();
        formData.append('url', url);
        formData.append('format', 'json');
        formData.append('app_key', apiKey);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        let res;
        try {
            res = await fetch('https://checkurl.phishtank.com/checkurl/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'phishtank/ai-grija-ro' },
                body: formData.toString(),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeoutId);
        }
        if (!res.ok) {
            if (res.status >= 500) {
                const e = new HttpError(`PhishTank API ${res.status}`, res.status);
                throw e;
            }
            structuredLog('warn', '[url-analyzer] PhishTank API non-ok', { status: res.status });
            return { match: false };
        }
        const data = await res.json();
        const results = data.results;
        if (results && results.in_database && results.valid) {
            return { match: true, phish_url: results.phish_detail_url };
        }
        return { match: false };
    };
    try {
        if (kv) {
            const cb = new CircuitBreaker('phishtank', kv);
            return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
        }
        return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
    }
    catch (err) {
        if (err instanceof CircuitOpenError) {
            structuredLog('warn', '[url-analyzer] PhishTank circuit OPEN -- skipping');
        }
        else {
            structuredLog('warn', '[url-analyzer] PhishTank check failed (graceful degrade)', { error: String(err) });
        }
        return { match: false };
    }
}
function isRetryableHttpError(err) {
    if (err instanceof Error) {
        if (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout'))
            return true;
    }
    if (typeof err === 'object' && err !== null && 'status' in err) {
        const status = err.status;
        return status >= 500;
    }
    return false;
}
async function checkSafeBrowsing(url, apiKey, kv) {
    const doFetch = async () => {
        const body = {
            client: { clientId: 'ai-grija-ro', clientVersion: '1.0' },
            threatInfo: {
                threatTypes: SAFE_BROWSING_THREAT_TYPES,
                platformTypes: ['ANY_PLATFORM'],
                threatEntryTypes: ['URL'],
                threatEntries: [{ url }],
            },
        };
        const sbController = new AbortController();
        const sbTimeoutId = setTimeout(() => sbController.abort(), 5000);
        let res;
        try {
            res = await fetch('https://safebrowsing.googleapis.com/v4/threatMatches:find', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(body),
                signal: sbController.signal,
            });
        }
        finally {
            clearTimeout(sbTimeoutId);
        }
        if (!res.ok) {
            if (res.status >= 500) {
                const e = new HttpError(`Safe Browsing API ${res.status}`, res.status);
                throw e;
            }
            structuredLog('warn', '[url-analyzer] Safe Browsing API non-ok', { status: res.status });
            return { match: false, threats: [] };
        }
        const data = await res.json();
        const threats = (data.matches || []).map((m) => m.threatType);
        return { match: threats.length > 0, threats };
    };
    try {
        if (kv) {
            const cb = new CircuitBreaker('safe-browsing', kv);
            return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
        }
        return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
    }
    catch (err) {
        if (err instanceof CircuitOpenError) {
            structuredLog('warn', '[url-analyzer] Safe Browsing circuit OPEN -- skipping');
        }
        else {
            structuredLog('warn', '[url-analyzer] Safe Browsing check failed (graceful degrade)', { error: String(err) });
        }
        return { match: false, threats: [] };
    }
}
async function checkURLhaus(url, authKey, kv) {
    if (!authKey)
        return { match: false };
    const doFetch = async () => {
        const formData = new URLSearchParams();
        formData.append('url', url);
        const uhController = new AbortController();
        const uhTimeoutId = setTimeout(() => uhController.abort(), 5000);
        let res;
        try {
            res = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Auth-Key': authKey },
                body: formData.toString(),
                signal: uhController.signal,
            });
        }
        finally {
            clearTimeout(uhTimeoutId);
        }
        if (!res.ok) {
            if (res.status >= 500) {
                const e = new HttpError(`URLhaus API ${res.status}`, res.status);
                throw e;
            }
            structuredLog('warn', '[url-analyzer] URLhaus API non-ok', { status: res.status });
            return { match: false };
        }
        const data = await res.json();
        if (data.query_status === 'listed') {
            return { match: true, threat: data.threat };
        }
        return { match: false };
    };
    try {
        if (kv) {
            const cb = new CircuitBreaker('urlhaus', kv);
            return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
        }
        return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
    }
    catch (err) {
        if (err instanceof CircuitOpenError) {
            structuredLog('warn', '[url-analyzer] URLhaus circuit OPEN -- skipping');
        }
        else {
            structuredLog('warn', '[url-analyzer] URLhaus check failed (graceful degrade)', { error: String(err) });
        }
        return { match: false };
    }
}
async function checkVirusTotal(url, apiKey, kv) {
    const doFetch = async () => {
        // base64url encode the URL (no padding)
        const urlId = btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const vtController = new AbortController();
        const vtTimeoutId = setTimeout(() => vtController.abort(), 5000);
        let res;
        try {
            res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
                method: 'GET',
                headers: { 'x-apikey': apiKey },
                signal: vtController.signal,
            });
        }
        finally {
            clearTimeout(vtTimeoutId);
        }
        if (!res.ok) {
            if (res.status === 404) {
                return { match: false };
            }
            if (res.status >= 500) {
                const e = new HttpError(`VirusTotal API ${res.status}`, res.status);
                throw e;
            }
            structuredLog('warn', '[url-analyzer] VirusTotal API non-ok', { status: res.status });
            return { match: false };
        }
        const data = await res.json();
        const statsRaw = data.data?.attributes?.last_analysis_stats;
        if (!statsRaw)
            return { match: false };
        const stats = {
            malicious: statsRaw.malicious ?? 0,
            suspicious: statsRaw.suspicious ?? 0,
            harmless: statsRaw.harmless ?? 0,
        };
        const match = stats.malicious > 0 || stats.suspicious > 2;
        return { match, stats };
    };
    try {
        if (kv) {
            const cb = new CircuitBreaker('virustotal', kv);
            return await cb.execute(() => withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError }));
        }
        return await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryableHttpError });
    }
    catch (err) {
        if (err instanceof CircuitOpenError) {
            structuredLog('warn', '[url-analyzer] VirusTotal circuit OPEN -- skipping');
        }
        else {
            structuredLog('warn', '[url-analyzer] VirusTotal check failed (graceful degrade)', { error: String(err) });
        }
        return { match: false };
    }
}
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
export async function analyzeUrl(url, safeBrowsingKey, virusTotalKey, kv, urlhausAuthKey, phishtankApiKey) {
    let parsed;
    try {
        parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    }
    catch {
        return {
            url,
            is_suspicious: true,
            risk_score: 0.7,
            flags: ['URL invalid sau malformat'],
            safe_browsing_match: false,
            safe_browsing_threats: [],
            urlhaus_match: false,
            virustotal_match: false,
        };
    }
    const domain = parsed.hostname.toLowerCase();
    const flagsArr = [];
    let risk = 0;
    const officialDomains = getAllOfficialDomains();
    if (officialDomains.includes(domain)) {
        return {
            url,
            domain,
            is_suspicious: false,
            risk_score: 0,
            flags: [],
            safe_browsing_match: false,
            safe_browsing_threats: [],
            urlhaus_match: false,
            virustotal_match: false,
        };
    }
    if (parsed.protocol === 'http:') {
        flagsArr.push('Conexiune nesecurizata (HTTP)');
        risk += 0.2;
    }
    if (domain.length > 30) {
        flagsArr.push('Domeniu neobisnuit de lung');
        risk += 0.15;
    }
    if (/\d{4,}/.test(domain)) {
        flagsArr.push('Domeniu cu multe cifre');
        risk += 0.15;
    }
    if (domain.split('.').length > 3) {
        flagsArr.push('Prea multe subdomenii');
        risk += 0.1;
    }
    const lookalikes = ['ing', 'bcr', 'brd', 'anaf', 'fancourier', 'cnair', 'roviniete', 'bt', 'cec', 'unicredit'];
    const domainParts = domain.split(/[.\-]/);
    for (const brand of lookalikes) {
        const directMatch = domain.includes(brand);
        const fuzzyMatch = !directMatch && domainParts.some(part => part.length >= 2 && levenshtein(part, brand) <= 2);
        if ((directMatch || fuzzyMatch) && !officialDomains.some(d => domain.endsWith(d))) {
            flagsArr.push(`Posibil domeniu look-alike pentru ${brand}`);
            risk += 0.4;
            break;
        }
    }
    const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'rb.gy'];
    if (shorteners.some(s => domain === s)) {
        flagsArr.push('URL scurtat — destinatia reala este ascunsa');
        risk += 0.3;
    }
    const suspiciousTlds = ['.xyz', '.top', '.buzz', '.club', '.icu', '.pw', '.tk', '.ml', '.ga', '.cf'];
    if (suspiciousTlds.some(tld => domain.endsWith(tld))) {
        flagsArr.push('TLD frecvent asociat cu phishing');
        risk += 0.25;
    }
    // Check KV cache for external threat results
    let safeBrowsingMatch = false;
    let safeBrowsingThreats = [];
    let urlhausMatch = false;
    let urlhausThreat;
    let virustotalMatch = false;
    let virustotalStats;
    let phishtankMatch = false;
    let phishtankUrl;
    let domainAgeDays = null;
    let registrar = null;
    let creationDate = null;
    let isNewDomain = false;
    const cacheKey = `url-threat:${domain}`;
    let usedCache = false;
    if (kv) {
        try {
            const cached = await kv.get(cacheKey);
            if (cached) {
                const entry = JSON.parse(cached);
                const isThreat = !!(entry.safeBrowsing?.match || entry.urlhaus?.match || entry.virustotal?.match);
                const ttlMs = isThreat ? URL_THREAT_CACHE_TTL_THREAT_MS : URL_THREAT_CACHE_TTL_SAFE_MS;
                if (Date.now() - entry.cachedAt < ttlMs) {
                    safeBrowsingMatch = entry.safeBrowsing.match;
                    safeBrowsingThreats = entry.safeBrowsing.threats;
                    urlhausMatch = entry.urlhaus.match;
                    urlhausThreat = entry.urlhaus.threat;
                    virustotalMatch = entry.virustotal.match;
                    virustotalStats = entry.virustotal.stats;
                    if (entry.phishtank) {
                        phishtankMatch = entry.phishtank.match;
                        phishtankUrl = entry.phishtank.phish_url;
                    }
                    usedCache = true;
                }
            }
        }
        catch {
            // ignore cache read errors
        }
    }
    if (!usedCache) {
        const [sbResult, urlhausResult, vtResult, rdapResult, ptResult] = await Promise.allSettled([
            safeBrowsingKey ? checkSafeBrowsing(url, safeBrowsingKey, kv) : Promise.resolve(null),
            urlhausAuthKey ? checkURLhaus(url, urlhausAuthKey, kv) : Promise.resolve(null),
            virusTotalKey ? checkVirusTotal(url, virusTotalKey, kv) : Promise.resolve(null),
            getDomainIntel(domain, kv),
            phishtankApiKey ? checkPhishTank(url, phishtankApiKey, kv) : Promise.resolve(null),
        ]);
        if (sbResult.status === 'fulfilled' && sbResult.value) {
            safeBrowsingMatch = sbResult.value.match;
            safeBrowsingThreats = sbResult.value.threats;
        }
        if (urlhausResult.status === 'fulfilled' && urlhausResult.value) {
            urlhausMatch = urlhausResult.value.match;
            urlhausThreat = urlhausResult.value.threat;
        }
        if (vtResult.status === 'fulfilled' && vtResult.value) {
            virustotalMatch = vtResult.value.match;
            virustotalStats = vtResult.value.stats;
        }
        if (ptResult.status === 'fulfilled' && ptResult.value) {
            phishtankMatch = ptResult.value.match;
            phishtankUrl = ptResult.value.phish_url;
        }
        if (rdapResult.status === 'fulfilled' && rdapResult.value) {
            domainAgeDays = rdapResult.value.domain_age_days;
            registrar = rdapResult.value.registrar;
            creationDate = rdapResult.value.creation_date;
            isNewDomain = rdapResult.value.is_new_domain;
        }
        // Store in KV cache with expirationTtl (Finding 2 fix)
        if (kv) {
            const entry = {
                safeBrowsing: { match: safeBrowsingMatch, threats: safeBrowsingThreats },
                urlhaus: { match: urlhausMatch, threat: urlhausThreat },
                virustotal: { match: virustotalMatch, stats: virustotalStats },
                phishtank: { match: phishtankMatch, phish_url: phishtankUrl },
                cachedAt: Date.now(),
            };
            try {
                const isThreatResult = safeBrowsingMatch || urlhausMatch || virustotalMatch;
                const kvTtl = isThreatResult ? URL_THREAT_CACHE_TTL_THREAT_KV : URL_THREAT_CACHE_TTL_SAFE_KV;
                await kv.put(cacheKey, JSON.stringify(entry), { expirationTtl: kvTtl });
            }
            catch {
                // ignore cache write errors
            }
        }
    }
    if (phishtankMatch) {
        flagsArr.push('Detectat in baza de date PhishTank ca site de phishing');
        risk += 0.5;
    }
    if (safeBrowsingMatch) {
        flagsArr.push(`Detectat de Google Safe Browsing: ${safeBrowsingThreats.join(', ')}`);
        risk += 0.5;
    }
    if (urlhausMatch) {
        flagsArr.push(`Detectat in baza de date URLhaus: ${urlhausThreat ?? 'malware'}`);
        risk += 0.5;
    }
    if (virustotalMatch && virustotalStats) {
        flagsArr.push(`Detectat de VirusTotal: ${virustotalStats.malicious} motoare malitioase, ${virustotalStats.suspicious} suspecte`);
        if (virustotalStats.malicious > 0) {
            risk += 0.4;
        }
        else {
            risk += 0.2;
        }
    }
    if (domainAgeDays !== null && domainAgeDays < 30) {
        flagsArr.push(`Domeniu inregistrat recent (${domainAgeDays} zile)`);
        risk += 0.4;
    }
    else if (domainAgeDays !== null && domainAgeDays < 90) {
        flagsArr.push(`Domeniu relativ nou (${domainAgeDays} zile)`);
        risk += 0.2;
    }
    return {
        url,
        domain,
        is_suspicious: risk >= 0.3,
        risk_score: Math.min(risk, 1),
        flags: flagsArr,
        safe_browsing_match: safeBrowsingMatch,
        safe_browsing_threats: safeBrowsingThreats,
        urlhaus_match: urlhausMatch,
        urlhaus_threat: urlhausThreat,
        virustotal_match: virustotalMatch,
        virustotal_stats: virustotalStats,
        phishtank_match: phishtankMatch,
        phishtank_url: phishtankUrl,
        domain_age_days: domainAgeDays,
        registrar,
        creation_date: creationDate,
        is_new_domain: isNewDomain,
        cache_hit: usedCache,
    };
}
