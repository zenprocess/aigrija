import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, { maxRetries: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw Object.assign(new Error('server error'), { status: 503 });
      return 'recovered';
    };
    const result = await withRetry(fn, { maxRetries: 2, backoffMs: 0 });
    expect(result).toBe('recovered');
    expect(calls).toBe(2);
  });

  it('does not retry on non-retryable error (4xx)', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw Object.assign(new Error('bad request'), { status: 400 });
    };
    await expect(withRetry(fn, { maxRetries: 2, backoffMs: 0 })).rejects.toThrow('bad request');
    expect(calls).toBe(1);
  });

  it('throws after exhausting retries', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw Object.assign(new Error('server error'), { status: 500 });
    };
    await expect(withRetry(fn, { maxRetries: 2, backoffMs: 0 })).rejects.toThrow('server error');
    expect(calls).toBe(3); // 1 initial + 2 retries
  });

  it('uses custom retryable predicate', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new Error('custom error');
    };
    const retryable = (err: unknown) => err instanceof Error && err.message === 'custom error';
    await expect(withRetry(fn, { maxRetries: 1, backoffMs: 0, retryable })).rejects.toThrow('custom error');
    expect(calls).toBe(2); // 1 + 1 retry
  });

  it('retries on timeout errors', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; }
      return 'ok';
    };
    const result = await withRetry(fn, { maxRetries: 1, backoffMs: 0 });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });
});
