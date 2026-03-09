import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';

type ComponentStatus = { status: 'healthy' | 'degraded' | 'unhealthy'; latency_ms?: number; error?: string };

const ComponentStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latency_ms: z.number().optional(),
  error: z.string().optional(),
});

const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string(),
  components: z.object({
    kv: ComponentStatusSchema,
    ai: ComponentStatusSchema,
    r2: ComponentStatusSchema,
    d1: ComponentStatusSchema,
    queue: ComponentStatusSchema,
  }),
});

export class HealthEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['System'],
    summary: 'Health check',
    description: 'Verifica starea serviciilor dependente (KV, AI, R2, D1, Queue).',
    responses: {
      '200': {
        description: 'Serviciu functional',
        content: { 'application/json': { schema: HealthResponseSchema } },
      },
      '503': {
        description: 'Serviciu degradat sau nefunctional',
        content: { 'application/json': { schema: HealthResponseSchema } },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const components: Record<string, ComponentStatus> = {
      kv: { status: 'unhealthy' },
      ai: { status: 'unhealthy' },
      r2: { status: 'unhealthy' },
      d1: { status: 'unhealthy' },
      queue: { status: 'unhealthy' },
    };

    // KV check
    try {
      const start = Date.now();
      await c.env.CACHE.get('health-probe');
      components.kv = { status: 'healthy', latency_ms: Date.now() - start };
    } catch (err) {
      components.kv = { status: 'unhealthy', error: err instanceof Error ? err.message : 'KV error' };
    }

    // AI binding check
    components.ai = { status: c.env.AI ? 'healthy' : 'unhealthy' };

    // R2 check
    try {
      const start = Date.now();
      await c.env.STORAGE.head('health-probe');
      components.r2 = { status: 'healthy', latency_ms: Date.now() - start };
    } catch (err) {
      components.r2 = { status: 'unhealthy', error: err instanceof Error ? err.message : 'R2 error' };
    }

    // D1 check
    try {
      const start = Date.now();
      await c.env.DB.prepare('SELECT 1').first();
      components.d1 = { status: 'healthy', latency_ms: Date.now() - start };
    } catch (err) {
      components.d1 = { status: 'unhealthy', error: err instanceof Error ? err.message : 'D1 error' };
    }

    // Queue binding check
    components.queue = { status: c.env.DRAFT_QUEUE ? 'healthy' : 'unhealthy' };

    const statuses = Object.values(components).map(c => c.status);
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (statuses.every(s => s === 'healthy')) {
      overall = 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }

    return c.json({
      status: overall,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      components,
    }, overall === 'healthy' ? 200 : 503);
  }
}

// --- Deep Health: smoke-test critical endpoints with payload validation ---

const EndpointStatusSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  latency_ms: z.number(),
  error: z.string().optional(),
});

const DeepHealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  duration_ms: z.number(),
  endpoints: z.record(z.string(), EndpointStatusSchema),
  summary: z.string(),
});

interface Probe {
  path: string;
  validate: (res: Response) => Promise<string | null>; // null = ok, string = error
}

const PROBES: Probe[] = [
  {
    path: '/health',
    validate: async (res) => {
      const body = await res.json() as any;
      if (!body.status) return 'Missing status field';
      if (!body.components) return 'Missing components field';
      if (body.status !== 'healthy') return `Infrastructure ${body.status}`;
      return null;
    },
  },
  {
    path: '/api/alerts',
    validate: async (res) => {
      const body = await res.json() as any;
      if (!body.campaigns) return 'Missing campaigns array';
      if (!Array.isArray(body.campaigns)) return 'campaigns is not an array';
      return null;
    },
  },
  {
    path: '/api/counter',
    validate: async (res) => {
      const body = await res.json() as any;
      if (typeof body.total !== 'number') return 'Missing or invalid total field';
      return null;
    },
  },
  {
    path: '/api/stats',
    validate: async (res) => {
      const body = await res.json() as any;
      if (!body || typeof body !== 'object') return 'Response is not a JSON object';
      return null;
    },
  },
  {
    path: '/api/feed/latest',
    validate: async (res) => {
      const body = await res.json() as any;
      if (!Array.isArray(body)) return 'Response is not an array';
      return null;
    },
  },
  {
    path: '/api/quiz',
    validate: async (res) => {
      const body = await res.json() as any;
      if (!Array.isArray(body)) return 'Response is not an array';
      return null;
    },
  },
  {
    path: '/sitemap.xml',
    validate: async (res) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('xml')) return `Expected XML content-type, got ${ct}`;
      const text = await res.text();
      if (!text.includes('<urlset')) return 'Missing <urlset> root element';
      return null;
    },
  },
  {
    path: '/robots.txt',
    validate: async (res) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/plain')) return `Expected text/plain, got ${ct}`;
      const text = await res.text();
      if (!text.includes('User-agent')) return 'Missing User-agent directive';
      if (!text.includes('Sitemap')) return 'Missing Sitemap directive';
      return null;
    },
  },
];

async function probeEndpoint(baseUrl: string, probe: Probe, fetchFn: typeof fetch = fetch): Promise<{ path: string; status: 'healthy' | 'unhealthy'; latency_ms: number; error?: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetchFn(`${baseUrl}${probe.path}`, { signal: controller.signal });
    const latency_ms = Date.now() - start;
    if (!res.ok) {
      return { path: probe.path, status: 'unhealthy', latency_ms, error: `HTTP ${res.status}` };
    }
    const validationError = await probe.validate(res);
    if (validationError) {
      return { path: probe.path, status: 'unhealthy', latency_ms, error: validationError };
    }
    return { path: probe.path, status: 'healthy', latency_ms };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { path: probe.path, status: 'unhealthy', latency_ms, error: msg.includes('abort') ? 'Timeout after 5000ms' : msg };
  } finally {
    clearTimeout(timeout);
  }
}

export class DeepHealthEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['System'],
    summary: 'Deep health check',
    description: 'Smoke-test endpointuri critice cu validare payload. Returneaza status per endpoint si sumar uman.',
    responses: {
      '200': {
        description: 'Toate endpointurile functioneaza si returneaza payload valid',
        content: { 'application/json': { schema: DeepHealthResponseSchema } },
      },
      '503': {
        description: 'Unul sau mai multe endpointuri au esuat sau returneaza payload invalid',
        content: { 'application/json': { schema: DeepHealthResponseSchema } },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const overallStart = Date.now();
    const baseUrl = c.env.BASE_URL || new URL(c.req.url).origin;

    // Use internal routing via appFetch to avoid CF 522 on self-referential requests
    const appFetch = c.get('appFetch');
    const fetchFn: typeof fetch = appFetch
      ? (input, init?) => appFetch(new Request(input.toString(), init))
      : fetch;

    const results = await Promise.allSettled(
      PROBES.map((probe) => probeEndpoint(baseUrl, probe, fetchFn))
    );

    const endpoints: Record<string, { status: 'healthy' | 'unhealthy'; latency_ms: number; error?: string }> = {};
    const failed: string[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { path, ...rest } = r.value;
        endpoints[path] = rest;
        if (rest.status === 'unhealthy') {
          failed.push(`${path} (${rest.error})`);
        }
      }
    }

    const total = PROBES.length;
    const passing = total - failed.length;
    const overall = failed.length === 0 ? 'healthy' : 'unhealthy';
    const summary = failed.length === 0
      ? `${total}/${total} endpoints healthy.`
      : `${passing}/${total} endpoints healthy. Failed: ${failed.join(', ')}`;

    return c.json({
      status: overall,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - overallStart,
      endpoints,
      summary,
    } as const, overall === 'healthy' ? 200 : 503);
  }
}
