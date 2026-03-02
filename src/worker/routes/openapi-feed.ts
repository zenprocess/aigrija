import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { FeedEntry } from './feed';

const FEED_KEY = 'feed:latest';
const FEED_DISPLAY = 5;

const FeedEntrySchema = z.object({
  verdict: z.string().describe('Verdictul analizei (phishing, suspicious, likely_safe)'),
  scam_type: z.string().describe('Tipul de frauda detectat'),
  timestamp: z.number().describe('Timestamp Unix in milisecunde'),
});

export class FeedEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Feed'],
    summary: 'Ultimele verdicte de analiza',
    description: 'Returneaza cele mai recente 5 verdicte din feed-ul de analiza in timp real.',
    responses: {
      '200': {
        description: 'Lista ultimelor verdicte',
        content: {
          'application/json': {
            schema: z.array(FeedEntrySchema),
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const raw = await c.env.CACHE.get(FEED_KEY);
    let entries: FeedEntry[] = [];
    try { entries = raw ? JSON.parse(raw) : []; } catch { entries = []; }
    return c.json(entries.slice(0, FEED_DISPLAY));
  }
}
