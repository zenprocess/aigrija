const SANITY_API_VERSION = '2024-01-01';
function getConfig(env) {
    return {
        projectId: env.SANITY_PROJECT_ID || '',
        dataset: env.SANITY_DATASET || 'production',
        apiVersion: SANITY_API_VERSION,
        useCdn: true,
    };
}
export async function sanityFetch(env, query, params = {}) {
    const config = getConfig(env);
    const url = new URL(`https://${config.projectId}.${config.useCdn ? 'apicdn' : 'api'}.sanity.io/v${config.apiVersion}/data/query/${config.dataset}`);
    url.searchParams.set('query', query);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(`$${key}`, JSON.stringify(value));
    }
    const sanityController = new AbortController();
    const sanityTimeoutId = setTimeout(() => sanityController.abort(), 5000);
    let res;
    try {
        res = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
            signal: sanityController.signal,
        });
    }
    finally {
        clearTimeout(sanityTimeoutId);
    }
    if (!res.ok) {
        throw new Error(`Sanity API error: ${res.status}`);
    }
    const data = (await res.json());
    return data.result;
}
