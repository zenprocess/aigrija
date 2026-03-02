import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';
import { applyCorsHeaders, getCacheControl, handleCorsPreflight } from '../lib/cdn-headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ShareEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Share'],
    summary: 'Obtine cardul de distribuire',
    description: 'Returneaza imaginea SVG/PNG a cardului de distribuire generat dupa o analiza. Folosit pentru partajarea rezultatelor pe retele sociale.',
    request: {
      params: z.object({
        id: z.string().describe('UUID-ul cardului de distribuire'),
      }),
    },
    responses: {
      '200': {
        description: 'Imaginea cardului de distribuire (SVG sau PNG)',
      },
      '400': {
        description: 'ID invalid (nu este UUID)',
      },
      '404': {
        description: 'Cardul nu a fost gasit',
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const id = c.req.param('id');
    const rid = c.get('requestId') || 'unknown';
    const origin = c.req.header('Origin');

    if (!UUID_RE.test(id)) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'ID invalid. Se asteapta un UUID.' }, request_id: rid },
        400
      );
    }

    let obj = await c.env.STORAGE.get(`share/${id}.svg`);
    if (obj) {
      const headers = new Headers();
      headers.set('Content-Type', 'image/svg+xml');
      headers.set('Cache-Control', getCacheControl(`share/${id}.svg`));
      applyCorsHeaders(headers, origin);
      return new Response(obj.body, { headers });
    }

    obj = await c.env.STORAGE.get(`share/${id}.png`);
    if (obj) {
      const headers = new Headers();
      headers.set('Content-Type', 'image/png');
      headers.set('Cache-Control', getCacheControl(`share/${id}.png`));
      applyCorsHeaders(headers, origin);
      return new Response(obj.body, { headers });
    }

    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Cardul de distribuire nu a fost gasit.' }, request_id: rid },
      404
    );
  }
}
