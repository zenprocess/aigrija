import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDigestMessage, sendDigestToTelegram } from './telegram-digest';
import type { WeeklyDigest } from './weekly-digest';
import type { Env } from './types';

const mockDigest: WeeklyDigest = {
  weekOf: '2026-W09',
  topScams: [
    { title: 'Frauda BRD', url: 'https://ai-grija.ro/alerte/brd', reportCount: 42, severity: 'critical' },
    { title: 'SMS ING fals', url: 'https://ai-grija.ro/alerte/ing', reportCount: 18, severity: 'high' },
    { title: 'Loteria falsa', url: 'https://ai-grija.ro/alerte/loterie', reportCount: 7, severity: 'medium' },
  ],
  stats: {
    totalChecks: 1234,
    totalAlerts: 56,
    quizCompletions: 89,
    communityReports: 23,
  },
  blogPosts: [
    { title: 'Cum să recunoști phishingul', slug: 'cum-recunosti-phishingul', date: '2026-03-01' },
  ],
  tips: ['Nu deschide niciodată link-uri din SMS-uri necunoscute.'],
};

describe('buildDigestMessage', () => {
  it('includes week identifier', () => {
    const msg = buildDigestMessage(mockDigest, 'https://ai-grija.ro');
    expect(msg).toContain('2026-W09');
  });

  it('includes stats', () => {
    const msg = buildDigestMessage(mockDigest, 'https://ai-grija.ro');
    expect(msg).toContain('1234');
    expect(msg).toContain('56');
  });

  it('includes top scam title', () => {
    const msg = buildDigestMessage(mockDigest, 'https://ai-grija.ro');
    expect(msg).toContain('Frauda BRD');
  });

  it('includes blog post link', () => {
    const msg = buildDigestMessage(mockDigest, 'https://ai-grija.ro');
    expect(msg).toContain('cum-recunosti-phishingul');
  });

  it('includes tip', () => {
    const msg = buildDigestMessage(mockDigest, 'https://ai-grija.ro');
    expect(msg).toContain('Nu deschide');
  });

  it('respects 4096 char Telegram limit', () => {
    const bigDigest: WeeklyDigest = {
      ...mockDigest,
      tips: ['x'.repeat(5000)],
    };
    const msg = buildDigestMessage(bigDigest, 'https://ai-grija.ro');
    expect(msg.length).toBeLessThanOrEqual(4096);
  });

  it('shows only top 3 scams', () => {
    const manyScams: WeeklyDigest = {
      ...mockDigest,
      topScams: [
        { title: 'Scam 1', url: 'https://example.com/1', reportCount: 10, severity: 'high' },
        { title: 'Scam 2', url: 'https://example.com/2', reportCount: 9, severity: 'medium' },
        { title: 'Scam 3', url: 'https://example.com/3', reportCount: 8, severity: 'low' },
        { title: 'Scam 4', url: 'https://example.com/4', reportCount: 7, severity: 'low' },
      ],
    };
    const msg = buildDigestMessage(manyScams, 'https://ai-grija.ro');
    expect(msg).toContain('Scam 1');
    expect(msg).toContain('Scam 3');
    expect(msg).not.toContain('Scam 4');
  });

  it('handles empty topScams gracefully', () => {
    const emptyDigest: WeeklyDigest = { ...mockDigest, topScams: [] };
    const msg = buildDigestMessage(emptyDigest, 'https://ai-grija.ro');
    expect(msg).toContain('Statistici');
    expect(msg).not.toContain('escrocherii');
  });
});

describe('sendDigestToTelegram', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns early when TELEGRAM_BOT_TOKEN missing', async () => {
    const env = { TELEGRAM_ADMIN_CHAT_ID: '123' } as unknown as Env;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await sendDigestToTelegram(env, mockDigest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns early when TELEGRAM_ADMIN_CHAT_ID missing', async () => {
    const env = { TELEGRAM_BOT_TOKEN: 'tok' } as unknown as Env;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await sendDigestToTelegram(env, mockDigest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls Telegram API with correct URL when configured', async () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'mytoken',
      TELEGRAM_ADMIN_CHAT_ID: '-100123',
      BASE_URL: 'https://ai-grija.ro',
    } as unknown as Env;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200 })
    );
    await sendDigestToTelegram(env, mockDigest);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('mytoken');
    expect(url).toContain('sendMessage');
  });

  it('does not throw when fetch fails', async () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'tok',
      TELEGRAM_ADMIN_CHAT_ID: '123',
      BASE_URL: 'https://ai-grija.ro',
    } as unknown as Env;
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
    await expect(sendDigestToTelegram(env, mockDigest)).resolves.toBeUndefined();
  });
});
