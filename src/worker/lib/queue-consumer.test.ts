import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleDraftQueue } from './queue-consumer';
import type { Env } from './types';

vi.mock('./draft-generator', () => ({
  generateDraft: vi.fn(),
}));

import { generateDraft } from './draft-generator';

const makeMessage = (campaignId: string) => ({
  body: { campaignId },
  ack: vi.fn(),
  retry: vi.fn(),
});

const makeBatch = (messages: ReturnType<typeof makeMessage>[]) => ({ messages });

const env = {} as unknown as Env;

describe('handleDraftQueue', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('acks message on successful draft generation', async () => {
    vi.mocked(generateDraft).mockResolvedValue(undefined as never);
    const msg = makeMessage('camp-1');
    await handleDraftQueue(makeBatch([msg]) as never, env);
    expect(generateDraft).toHaveBeenCalledWith('camp-1', env);
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it('retries message on failed draft generation', async () => {
    vi.mocked(generateDraft).mockRejectedValue(new Error('AI failure'));
    const msg = makeMessage('camp-2');
    await handleDraftQueue(makeBatch([msg]) as never, env);
    expect(msg.retry).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it('processes multiple messages in batch', async () => {
    vi.mocked(generateDraft).mockResolvedValue(undefined as never);
    const msgs = [makeMessage('a'), makeMessage('b'), makeMessage('c')];
    await handleDraftQueue(makeBatch(msgs) as never, env);
    expect(generateDraft).toHaveBeenCalledTimes(3);
    for (const m of msgs) expect(m.ack).toHaveBeenCalledOnce();
  });

  it('continues processing after one failure', async () => {
    vi.mocked(generateDraft)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(undefined as never);
    const msgs = [makeMessage('fail-1'), makeMessage('ok-2')];
    await handleDraftQueue(makeBatch(msgs) as never, env);
    expect(msgs[0].retry).toHaveBeenCalledOnce();
    expect(msgs[1].ack).toHaveBeenCalledOnce();
  });
});
