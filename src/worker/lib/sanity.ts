import type { Env } from './types';

const SANITY_API_VERSION = '2024-01-01';

interface SanityConfig {
  projectId: string;
  dataset: string;
  apiVersion: string;
  useCdn: boolean;
}

function getConfig(env: Env): SanityConfig {
  return {
    projectId: env.SANITY_PROJECT_ID || '',
    dataset: env.SANITY_DATASET || 'production',
    apiVersion: SANITY_API_VERSION,
    useCdn: true,
  };
}

export async function sanityFetch<T>(
  env: Env,
  query: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  const config = getConfig(env);
  const url = new URL(
    `https://${config.projectId}.${config.useCdn ? 'apicdn' : 'api'}.sanity.io/v${config.apiVersion}/data/query/${config.dataset}`
  );
  url.searchParams.set('query', query);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`$${key}`, JSON.stringify(value));
  }

  const sanityController = new AbortController();
  const sanityTimeoutId = setTimeout(() => sanityController.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: sanityController.signal,
    });
  } finally {
    clearTimeout(sanityTimeoutId);
  }

  if (!res.ok) {
    throw new Error(`Sanity API error: ${res.status}`);
  }

  const data = (await res.json()) as { result: T };
  return data.result;
}
