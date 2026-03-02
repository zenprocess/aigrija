import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';

const BadgesResponseSchema = z.object({
  verified_by: z.string().describe('Furnizorul AI pentru verificari'),
  data_sources: z.array(z.string()).describe('Sursele de date folosite pentru analiza'),
  certifications: z.array(z.string()).describe('Certificarile si conformitatile platformei'),
});

export class BadgesEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Statistics'],
    summary: 'Insignele si certificarile platformei',
    description: 'Returneaza informatii despre sursele de date, furnizorul AI si certificarile platformei.',
    responses: {
      '200': {
        description: 'Insignele platformei',
        content: {
          'application/json': {
            schema: BadgesResponseSchema,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    return c.json({
      verified_by: 'Cloudflare Workers AI',
      data_sources: ['Google Safe Browsing', 'VirusTotal', 'URLhaus', 'PhishTank'],
      certifications: ['GDPR Compliant', 'No Data Stored'],
    });
  }
}
