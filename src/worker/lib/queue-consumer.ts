import type { Env } from './types';
import { generateDraft } from './draft-generator';
import { structuredLog } from './logger';

interface DraftQueueMessage {
  campaignId: string;
  requestedAt?: string;
}

export async function handleDraftQueue(
  batch: MessageBatch<DraftQueueMessage>,
  env: Env
): Promise<void> {
  structuredLog('info', '[queue-consumer] Processing batch', { size: batch.messages.length });

  for (const message of batch.messages) {
    const { campaignId } = message.body;
    try {
      structuredLog('info', '[queue-consumer] Generating draft', { campaignId });
      await generateDraft(campaignId, env);
      message.ack();
      structuredLog('info', '[queue-consumer] Draft done', { campaignId });
    } catch (err) {
      structuredLog('error', '[queue-consumer] Draft failed', { campaignId, error: String(err) });
      message.retry();
    }
  }
}
