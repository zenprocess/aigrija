import { Hono } from 'hono';
import type { Env } from '../lib/types';

// NOTE: /robots.txt and /sitemap.xml are handled by sitemap.ts (mounted first in index.ts).
// This file previously had duplicate handlers; they have been consolidated into sitemap.ts.

const seo = new Hono<{ Bindings: Env }>();

export { seo };
