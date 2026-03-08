import type { MiddlewareHandler } from 'hono';
import type { Env } from './types';
import { structuredLog } from './logger';

interface CFAccessCert {
  kid: string;
  kty: string;
  use: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

interface CFAccessCerts {
  keys: CFAccessCert[];
  public_cert: { kid: string; cert: string };
  public_certs: { kid: string; cert: string }[];
}

interface JWTPayload {
  email?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  aud?: string | string[];
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseJWTPayload(token: string): JWTPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

async function fetchCFAccessCerts(teamDomain: string, kv: KVNamespace): Promise<CFAccessCerts | null> {
  const cacheKey = `cf_access_certs:${teamDomain}`;

  // Try KV cache first (1 hour TTL)
  const cached = await kv.get(cacheKey, 'json') as CFAccessCerts | null;
  if (cached) return cached;

  const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const resp = await fetch(certsUrl);
  if (!resp.ok) return null;

  const certs = await resp.json() as CFAccessCerts;
  await kv.put(cacheKey, JSON.stringify(certs), { expirationTtl: 3600 });
  return certs;
}

async function verifyJWT(token: string, teamDomain: string, kv: KVNamespace): Promise<JWTPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0]))) as { kid?: string; alg?: string };

  const certs = await fetchCFAccessCerts(teamDomain, kv);
  if (!certs) return null;

  // Find matching JWK key by kid
  const matchingKey = header.kid
    ? certs.keys.find((k) => k.kid === header.kid)
    : certs.keys[0];
  if (!matchingKey) return null;

  // Determine algorithm from JWK key type
  let algorithm: RsaHashedImportParams | EcKeyImportParams;
  let verifyAlgorithm: AlgorithmIdentifier | EcdsaParams;

  if (matchingKey.kty === 'RSA') {
    algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    verifyAlgorithm = 'RSASSA-PKCS1-v1_5';
  } else if (matchingKey.kty === 'EC') {
    algorithm = { name: 'ECDSA', namedCurve: matchingKey.crv ?? 'P-256' };
    verifyAlgorithm = { name: 'ECDSA', hash: 'SHA-256' };
  } else {
    return null;
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'jwk',
      matchingKey as JsonWebKey,
      algorithm,
      false,
      ['verify']
    );
  } catch {
    return null;
  }

  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as Uint8Array<ArrayBuffer>;
  const signature = base64urlDecode(parts[2]) as Uint8Array<ArrayBuffer>;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(verifyAlgorithm, cryptoKey, signature, signedData);
  } catch {
    return null;
  }

  if (!valid) return null;

  const payload = parseJWTPayload(token);
  if (!payload) return null;

  // Check expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export type AdminVariables = {
  adminEmail: string;
};

export const adminAuth: MiddlewareHandler<{ Bindings: Env; Variables: AdminVariables }> = async (c, next) => {
  const jwt = c.req.header('CF-Access-Jwt-Assertion');
  const teamDomain = (c.env as Env & { CF_ACCESS_TEAM_DOMAIN?: string }).CF_ACCESS_TEAM_DOMAIN;

  // Dev mode: only bypass auth on localhost with no team domain configured.
  // In production CF_ACCESS_TEAM_DOMAIN must be set and Zero Trust enforces auth.
  if (!jwt && !teamDomain) {
    const baseUrl = (c.env as Env & { BASE_URL?: string }).BASE_URL ?? '';
    let isLocal = false;
    try {
      const parsedUrl = new URL(baseUrl);
      isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    } catch {
      // not a valid URL — treat as non-local
    }
    if (isLocal) {
      structuredLog('warn', 'admin_auth_dev_mode_bypass', { stage: 'admin' });
      c.set('adminEmail', 'dev@localhost');
      return next();
    }
    // Production with no CF Access configured — deny
    return c.html('<h1>401 Unauthorized</h1><p>CF Access not configured. Set CF_ACCESS_TEAM_DOMAIN.</p>', 401);
  }

  if (!jwt) {
    return c.html('<h1>401 Unauthorized</h1><p>CF-Access-Jwt-Assertion header missing.</p>', 401);
  }

  if (!teamDomain) {
    // CF_ACCESS_TEAM_DOMAIN not set — admin authentication cannot function.
    // Returning 503 (not 401) to distinguish misconfiguration from an auth failure.
    // Never fall back to unverified JWT parsing.
    return c.html('<h1>503 Service Unavailable</h1><p>Admin authentication not configured. Set CF_ACCESS_TEAM_DOMAIN.</p>', 503);
  }

  const payload = await verifyJWT(jwt, teamDomain, c.env.CACHE);
  if (!payload) {
    return c.html('<h1>401 Unauthorized</h1><p>JWT verification failed.</p>', 401);
  }

  c.set('adminEmail', payload.email ?? payload.sub ?? 'unknown');
  return next();
};
