import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { withRetry } from './retry';
import { structuredLog } from './logger';

const RDAP_CACHE_TTL_KV = 86400; // 24 hours in seconds

export interface DomainIntel {
  domain_age_days: number | null;
  registrar: string | null;
  creation_date: string | null;
  is_new_domain: boolean; // < 30 days
}

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown[];
  handle?: string;
}

interface RdapResponse {
  events?: RdapEvent[];
  entities?: RdapEntity[];
}

function extractRegistrar(entities?: RdapEntity[]): string | null {
  if (!entities) return null;
  for (const entity of entities) {
    if (entity.roles && entity.roles.includes('registrar')) {
      if (Array.isArray(entity.vcardArray) && entity.vcardArray.length > 1) {
        const vcard = entity.vcardArray[1] as unknown[][];
        for (const field of vcard) {
          if (Array.isArray(field) && field[0] === 'fn' && typeof field[3] === 'string') {
            return field[3];
          }
        }
      }
      if (entity.handle) return entity.handle;
    }
  }
  return null;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout'))) return true;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    return (err as { status: number }).status >= 500;
  }
  return false;
}

export async function getDomainIntel(domain: string, kv?: KVNamespace): Promise<DomainIntel> {
  const nullResult: DomainIntel = {
    domain_age_days: null,
    registrar: null,
    creation_date: null,
    is_new_domain: false,
  };

  const cleanDomain = domain.replace(/^www\./, '');

  const cacheKey = 'rdap:' + cleanDomain;
  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as DomainIntel;
      }
    } catch {
      // ignore
    }
  }

  const doFetch = async (): Promise<DomainIntel> => {
    const res = await fetch('https://rdap.org/domain/' + cleanDomain, {
      headers: { Accept: 'application/rdap+json' },
      redirect: 'follow',
    });

    if (!res.ok) {
      if (res.status === 404) return nullResult;
      if (res.status >= 500) {
        const e = new Error('RDAP ' + res.status);
        (e as Error & { status: number }).status = res.status;
        throw e;
      }
      structuredLog('warn', '[domain-intel] RDAP non-ok', { status: res.status, domain: cleanDomain });
      return nullResult;
    }

    const data = await res.json() as RdapResponse;

    const registrationEvent = (data.events || []).find((e) => e.eventAction === 'registration');

    let domain_age_days: number | null = null;
    let creation_date: string | null = null;

    if (registrationEvent?.eventDate) {
      creation_date = registrationEvent.eventDate;
      const created = new Date(registrationEvent.eventDate).getTime();
      if (!isNaN(created)) {
        domain_age_days = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
      }
    }

    const registrar = extractRegistrar(data.entities);
    const is_new_domain = domain_age_days !== null && domain_age_days < 30;

    return { domain_age_days, registrar, creation_date, is_new_domain };
  };

  try {
    let result: DomainIntel;

    if (kv) {
      const cb = new CircuitBreaker('rdap', kv);
      result = await cb.execute(() =>
        withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryable })
      );
    } else {
      result = await withRetry(doFetch, { maxRetries: 1, backoffMs: 500, retryable: isRetryable });
    }

    if (kv) {
      try {
        await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: RDAP_CACHE_TTL_KV });
      } catch {
        // ignore
      }
    }

    return result;
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      structuredLog('warn', '[domain-intel] RDAP circuit OPEN -- skipping');
    } else {
      structuredLog('warn', '[domain-intel] RDAP lookup failed (graceful degrade)', { error: String(err), domain: cleanDomain });
    }
    return nullResult;
  }
}
