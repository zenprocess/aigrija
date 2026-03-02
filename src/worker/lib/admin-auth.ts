import type { MiddlewareHandler } from 'hono';
import type { Env } from './types';
import { toUint8Array } from './crypto-utils';
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

  const headerStr = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
  const kid = headerStr.kid as string | undefined;

  const certs = await fetchCFAccessCerts(teamDomain, kv);
  if (!certs) return null;

  // Find matching public cert by kid
  const matchingCert = certs.public_certs?.find((c) => c.kid === kid) ?? certs.public_certs?.[0];
  if (!matchingCert) return null;

  // Import the PEM public key
  const pemBody = matchingCert.cert
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s/g, '');

  let cryptoKey: CryptoKey;
  try {
    const derBytes = toUint8Array(base64urlDecode(pemBody));
    cryptoKey = await crypto.subtle.importKey(
      'spki',
      derBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch {
    // Try EC key fallback
    try {
      const derBytes = toUint8Array(base64urlDecode(pemBody));
      cryptoKey = await crypto.subtle.importKey(
        'spki',
        derBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
    } catch {
      return null;
    }
  }

  const signedData = toUint8Array(new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const signature = toUint8Array(base64urlDecode(parts[2]));

  let valid = false;
  try {
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
  } catch {
    try {
      valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        signature,
        signedData
      );
    } catch {
      return null;
    }
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
    // CF_ACCESS_TEAM_DOMAIN not set in production — deny all access.
    // JWT signature cannot be verified without the team domain.
    return c.html('<h1>401 Unauthorized</h1><p>CF_ACCESS_TEAM_DOMAIN not configured. Contact the administrator.</p>', 401);
  }

  const payload = await verifyJWT(jwt, teamDomain, c.env.CACHE);
  if (!payload) {
    return c.html('<h1>401 Unauthorized</h1><p>JWT verification failed.</p>', 401);
  }

  c.set('adminEmail', payload.email ?? payload.sub ?? 'unknown');
  return next();
};
