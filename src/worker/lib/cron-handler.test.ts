import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleScheduled } from './cron-handler';
import type { Env } from './types';

vi.mock('./scraper-runner', () => ({
  runScraper: vi.fn(),
}));
vi.mock('./scrapers/dnsc', () => ({
  dnscScraper: { name: 'dnsc' },
}));
vi.mock('./logger', () => ({
  structuredLog: vi.fn(),
}));
vi.mock('./draft-generator', () => ({
  generateMultipleDrafts: vi.fn(),
  generateStandalonePost: vi.fn(),
}));
vi.mock('./sanity-writer', () => ({
  publishToSanity: vi.fn(),
}));
vi.mock('./weekly-digest', () => ({
  generateWeeklyDigest: vi.fn(),
  getISOWeek: vi.fn().mockReturnValue('2026-W10'),
}));
vi.mock('./telegram-digest', () => ({
  sendDigestToTelegram: vi.fn(),
}));
vi.mock('./email-digest', () => ({
  sendDigestEmail: vi.fn(),
}));
vi.mock('./gdpr-consent', () => ({
  purgeInactiveSubscribers: vi.fn(),
}));
vi.mock('./r2-cleanup', () => ({
  deleteOldShareCards: vi.fn(),
}));

import { runScraper } from './scraper-runner';
import { structuredLog } from './logger';
import { generateMultipleDrafts, generateStandalonePost } from './draft-generator';
import { publishToSanity } from './sanity-writer';
import { generateWeeklyDigest } from './weekly-digest';
import { sendDigestToTelegram } from './telegram-digest';
import { sendDigestEmail } from './email-digest';
import { purgeInactiveSubscribers } from './gdpr-consent';
import { deleteOldShareCards } from './r2-cleanup';

function makeEvent(cron: string): ScheduledEvent {
  return { cron, scheduledTime: Date.now(), type: 'scheduled', noRetry() {} } as unknown as ScheduledEvent;
}

function makeEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
    },
    CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    STORAGE: {},
    DRAFT_QUEUE: null,
    AI: {},
    ...overrides,
  } as unknown as Env;
}

beforeEach(() => {
  vi.clearAllMocks();
});


describe('handleScheduled', () => {
  describe('scraper — 0 0 * * *', () => {
    it('runs the DNSC scraper and logs results', async () => {
      vi.mocked(runScraper).mockResolvedValue({
        source: 'dnsc',
        itemsFound: 3,
        itemsNew: 1,
        errors: [],
      });
      const env = makeEnv();
      await handleScheduled(makeEvent('0 0 * * *'), env);

      expect(runScraper).toHaveBeenCalledOnce();
      expect(structuredLog).toHaveBeenCalledWith('info', 'cron_scraper_done', expect.objectContaining({
        source: 'dnsc',
        itemsFound: 3,
        itemsNew: 1,
      }));
    });

    it('logs warnings when scraper returns errors', async () => {
      vi.mocked(runScraper).mockResolvedValue({
        source: 'dnsc',
        itemsFound: 2,
        itemsNew: 0,
        errors: ['fetch failed'],
      });
      await handleScheduled(makeEvent('0 0 * * *'), makeEnv());

      expect(structuredLog).toHaveBeenCalledWith('warn', 'cron_scraper_errors', expect.objectContaining({
        errors: ['fetch failed'],
      }));
    });
  });

  describe('R2 cleanup + drafts — 0 1 * * *', () => {
    it('calls deleteOldShareCards, draft generation, and sanity publish', async () => {
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 2, errors: 0, listed: 5 });
      const env = makeEnv();
      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(deleteOldShareCards).toHaveBeenCalledWith(env.STORAGE);
      expect(structuredLog).toHaveBeenCalledWith('info', 'cron_r2_cleanup_done', expect.any(Object));
    });

    it('logs error when R2 cleanup fails but continues', async () => {
      vi.mocked(deleteOldShareCards).mockRejectedValue(new Error('R2 down'));
      const env = makeEnv();
      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_r2_cleanup_failed', expect.objectContaining({
        error: 'Error: R2 down',
      }));
    });

    it('generates drafts for pending campaigns', async () => {
      const env = makeEnv();
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });
      const dbPrepare = vi.fn();
      const bindAll = vi.fn();
      // First call: pending campaigns for draft generation
      // Second call: generated campaigns for sanity publish
      bindAll.mockResolvedValueOnce({
        results: [{ id: 'c1', title: 'Test', draft_status: 'pending' }],
      }).mockResolvedValueOnce({ results: [] });
      dbPrepare.mockReturnValue({ bind: vi.fn().mockReturnValue({ all: bindAll, run: vi.fn() }) });
      (env as any).DB = { prepare: dbPrepare };

      vi.mocked(generateMultipleDrafts).mockResolvedValue(undefined);

      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(generateMultipleDrafts).toHaveBeenCalledWith('c1', env);
    });

    it('logs error when draft generation fails for a campaign', async () => {
      const env = makeEnv();
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });
      const bindAll = vi.fn();
      bindAll.mockResolvedValueOnce({
        results: [{ id: 'c1', title: 'Test', draft_status: 'pending' }],
      }).mockResolvedValueOnce({ results: [] });
      (env as any).DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ all: bindAll, run: vi.fn() }),
        }),
      };

      vi.mocked(generateMultipleDrafts).mockRejectedValue(new Error('AI unavailable'));

      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_draft_generation_failed', expect.objectContaining({
        campaignId: 'c1',
        error: 'Error: AI unavailable',
      }));
    });

    it('publishes generated drafts to Sanity and updates status', async () => {
      const env = makeEnv({ SANITY_WRITE_TOKEN: 'test-token' });
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });
      const runFn = vi.fn().mockResolvedValue({ success: true });
      const bindAll = vi.fn();
      // draft generation: no pending
      // sanity publish: one generated campaign with draft content
      bindAll.mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({
        results: [{
          id: 'c2',
          title: 'Campaign 2',
          draft_status: 'generated',
          draft_content: JSON.stringify([
            { type: 'blog', slug: 'test', content: 'Hello world' },
          ]),
        }],
      });
      (env as any).DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ all: bindAll, run: runFn }),
        }),
      };

      vi.mocked(publishToSanity).mockResolvedValue(undefined);

      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(publishToSanity).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c2' }),
        'Hello world',
        'blog',
        env,
      );
      expect(runFn).toHaveBeenCalled();
    });

    it('skips sanity publish when draft_content is empty', async () => {
      const env = makeEnv({ SANITY_WRITE_TOKEN: 'test-token' });
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });
      const bindAll = vi.fn();
      bindAll.mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({
        results: [{ id: 'c3', draft_status: 'generated', draft_content: null }],
      });
      (env as any).DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ all: bindAll, run: vi.fn() }),
        }),
      };

      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(publishToSanity).not.toHaveBeenCalled();
      expect(structuredLog).toHaveBeenCalledWith('warn', 'cron_sanity_no_content', expect.any(Object));
    });

    it('handles invalid JSON in draft_content', async () => {
      const env = makeEnv({ SANITY_WRITE_TOKEN: 'test-token' });
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });
      const bindAll = vi.fn();
      bindAll.mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({
        results: [{ id: 'c4', draft_status: 'generated', draft_content: 'not-json' }],
      });
      (env as any).DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ all: bindAll, run: vi.fn() }),
        }),
      };

      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(publishToSanity).not.toHaveBeenCalled();
      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_sanity_parse_failed', expect.objectContaining({
        campaignId: 'c4',
      }));
    });
  });

  describe('missing SANITY_WRITE_TOKEN — 0 1 * * *', () => {
    it('logs error and skips sanity publish when SANITY_WRITE_TOKEN is missing', async () => {
      const env = makeEnv();
      // Ensure no SANITY_WRITE_TOKEN is set
      delete (env as any).SANITY_WRITE_TOKEN;
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });

      await handleScheduled(makeEvent('0 1 * * *'), env);

      expect(structuredLog).toHaveBeenCalledWith('error', 'sanity_write_token_missing', expect.objectContaining({
        action: 'publish',
      }));
      // publishToSanity should never be called since we returned early
      expect(publishToSanity).not.toHaveBeenCalled();
    });

    it('does not throw when SANITY_WRITE_TOKEN is missing', async () => {
      const env = makeEnv();
      delete (env as any).SANITY_WRITE_TOKEN;
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });

      // Should not throw
      await expect(handleScheduled(makeEvent('0 1 * * *'), env)).resolves.toBeUndefined();
    });

    it('still runs draft generation even when SANITY_WRITE_TOKEN is missing', async () => {
      const env = makeEnv();
      delete (env as any).SANITY_WRITE_TOKEN;
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });

      await handleScheduled(makeEvent('0 1 * * *'), env);

      // Draft generation should still be called (it doesn't need the token)
      expect(structuredLog).toHaveBeenCalledWith('info', 'cron_draft_generation_start', expect.any(Object));
    });
  });

  describe('job isolation — 0 1 * * *', () => {
    it('runs sanity publish even if draft generation throws', async () => {
      const env = makeEnv({ SANITY_WRITE_TOKEN: 'test-token' });
      vi.mocked(deleteOldShareCards).mockResolvedValue({ deleted: 0, errors: 0, listed: 0 });
      // Make DB.prepare throw for draft generation
      const bindAll = vi.fn();
      bindAll.mockRejectedValueOnce(new Error('DB crash')).mockResolvedValueOnce({ results: [] });
      (env as any).DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ all: bindAll, run: vi.fn() }),
        }),
      };

      await handleScheduled(makeEvent('0 1 * * *'), env);

      // Sanity publish should still run
      expect(structuredLog).toHaveBeenCalledWith('info', 'cron_sanity_publish_start', expect.any(Object));
    });
  });

  describe('content generation — 0 2 * * 1-5', () => {
    it('generates standalone educational post', async () => {
      vi.mocked(generateStandalonePost).mockResolvedValue(undefined);
      await handleScheduled(makeEvent('0 2 * * 1-5'), makeEnv());

      expect(generateStandalonePost).toHaveBeenCalledOnce();
      expect(structuredLog).toHaveBeenCalledWith('info', 'cron_content_generation_done', expect.any(Object));
    });

    it('logs error when content generation fails', async () => {
      vi.mocked(generateStandalonePost).mockRejectedValue(new Error('AI quota exceeded'));
      await handleScheduled(makeEvent('0 2 * * 1-5'), makeEnv());

      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_content_generation_failed', expect.objectContaining({
        error: 'Error: AI quota exceeded',
      }));
    });
  });

  describe('weekly digest — 0 6 * * 1', () => {
    it('generates digest, sends to Telegram and email', async () => {
      const digest = { weekOf: '2026-W10', items: [] };
      vi.mocked(generateWeeklyDigest).mockResolvedValue(digest as any);
      vi.mocked(sendDigestToTelegram).mockResolvedValue(undefined);
      vi.mocked(sendDigestEmail).mockResolvedValue(undefined);

      await handleScheduled(makeEvent('0 6 * * 1'), makeEnv());

      expect(generateWeeklyDigest).toHaveBeenCalledOnce();
      expect(sendDigestToTelegram).toHaveBeenCalledWith(expect.anything(), digest);
      expect(sendDigestEmail).toHaveBeenCalledWith(expect.anything(), digest);
    });

    it('stops if digest generation fails', async () => {
      vi.mocked(generateWeeklyDigest).mockRejectedValue(new Error('DB error'));
      await handleScheduled(makeEvent('0 6 * * 1'), makeEnv());

      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_weekly_digest_generate_failed', expect.objectContaining({
        error: 'Error: DB error',
      }));
      expect(sendDigestToTelegram).not.toHaveBeenCalled();
      expect(sendDigestEmail).not.toHaveBeenCalled();
    });

    it('continues email send if Telegram fails', async () => {
      const digest = { weekOf: '2026-W10', items: [] };
      vi.mocked(generateWeeklyDigest).mockResolvedValue(digest as any);
      vi.mocked(sendDigestToTelegram).mockRejectedValue(new Error('Telegram down'));
      vi.mocked(sendDigestEmail).mockResolvedValue(undefined);

      await handleScheduled(makeEvent('0 6 * * 1'), makeEnv());

      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_weekly_digest_telegram_failed', expect.any(Object));
      expect(sendDigestEmail).toHaveBeenCalledWith(expect.anything(), digest);
    });

    it('logs error if email send fails', async () => {
      const digest = { weekOf: '2026-W10', items: [] };
      vi.mocked(generateWeeklyDigest).mockResolvedValue(digest as any);
      vi.mocked(sendDigestToTelegram).mockResolvedValue(undefined);
      vi.mocked(sendDigestEmail).mockRejectedValue(new Error('SMTP error'));

      await handleScheduled(makeEvent('0 6 * * 1'), makeEnv());

      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_weekly_digest_email_failed', expect.objectContaining({
        error: 'Error: SMTP error',
      }));
    });
  });

  describe('GDPR purge — 0 0 1 * *', () => {
    it('purges inactive subscribers and logs count', async () => {
      vi.mocked(purgeInactiveSubscribers).mockResolvedValue({ purged: 42 });
      await handleScheduled(makeEvent('0 0 1 * *'), makeEnv());

      expect(purgeInactiveSubscribers).toHaveBeenCalledOnce();
      expect(structuredLog).toHaveBeenCalledWith('info', 'cron_gdpr_purge_done', expect.objectContaining({
        purged: 42,
      }));
    });

    it('logs error when purge fails', async () => {
      vi.mocked(purgeInactiveSubscribers).mockRejectedValue(new Error('D1 locked'));
      await handleScheduled(makeEvent('0 0 1 * *'), makeEnv());

      expect(structuredLog).toHaveBeenCalledWith('error', 'cron_gdpr_purge_failed', expect.objectContaining({
        error: 'Error: D1 locked',
      }));
    });
  });

  describe('unknown cron', () => {
    it('logs warning for unrecognized cron expression', async () => {
      await handleScheduled(makeEvent('*/5 * * * *'), makeEnv());

      expect(structuredLog).toHaveBeenCalledWith('warn', 'cron_unknown', expect.objectContaining({
        cron: '*/5 * * * *',
      }));
    });
  });
});
