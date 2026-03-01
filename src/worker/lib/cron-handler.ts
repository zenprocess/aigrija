import type { Env } from './types';
import { runScraper } from './scraper-runner';
import { dnscScraper } from './scrapers/dnsc';
import { structuredLog } from './logger';

export async function handleScheduled(_event: ScheduledEvent, env: Env): Promise<void> {
  structuredLog('info', 'cron_start', { stage: 'cron' });

  const result = await runScraper(dnscScraper, env);

  structuredLog('info', 'cron_scraper_done', {
    stage: 'cron',
    source: result.source,
    itemsFound: result.itemsFound,
    itemsNew: result.itemsNew,
    errorCount: result.errors.length,
  });

  if (result.errors.length > 0) {
    structuredLog('warn', 'cron_scraper_errors', {
      stage: 'cron',
      source: result.source,
      errors: result.errors,
    });
  }
}
