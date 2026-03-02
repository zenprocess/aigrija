import { structuredLog } from './logger';
export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number;
  retryable?: (err: unknown) => boolean;
}

function defaultRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // Retry on timeout or network errors
    if (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout')) return true;
    if (err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('fetch')) return true;
  }
  // Retry on HTTP 5xx via status property
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: number }).status;
    return status >= 500;
  }
  return false;
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.3);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const backoffMs = opts.backoffMs ?? 500;
  const isRetryable = opts.retryable ?? defaultRetryable;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isRetryable(err)) {
        const delay = jitter(backoffMs * Math.pow(2, attempt));
        structuredLog('warn', 'retry_attempt_failed', { stage: 'retry', attempt: attempt + 1, delayMs: delay, error: String(err) });
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  throw lastErr;
}
