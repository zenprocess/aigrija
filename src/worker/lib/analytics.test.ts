import { describe, it, expect, vi } from 'vitest';
import { logEvent } from './analytics';

describe('logEvent', () => {
  it('calls writeDataPoint with correct schema', () => {
    const writeDataPoint = vi.fn();
    const env = { ANALYTICS: { writeDataPoint } } as any;

    logEvent(env, {
      endpoint: '/api/check',
      verdict: 'phishing',
      riskScore: 85,
      responseTimeMs: 320,
      country: 'RO',
      requestId: 'abc-123',
    });

    expect(writeDataPoint).toHaveBeenCalledOnce();
    const arg = writeDataPoint.mock.calls[0][0];
    expect(arg.blobs[0]).toBe('/api/check');
    expect(arg.blobs[1]).toBe('phishing');
    expect(arg.blobs[2]).toBe('RO');
    expect(arg.doubles[0]).toBe(320);
    expect(arg.doubles[1]).toBe(85);
    expect(arg.indexes[0]).toBe('abc-123');
  });

  it('is a no-op when ANALYTICS is undefined', () => {
    const env = {} as any;
    expect(() => logEvent(env, { endpoint: '/api/check' })).not.toThrow();
  });

  it('uses empty strings for optional fields when not provided', () => {
    const writeDataPoint = vi.fn();
    const env = { ANALYTICS: { writeDataPoint } } as any;
    logEvent(env, { endpoint: '/health' });
    const arg = writeDataPoint.mock.calls[0][0];
    expect(arg.blobs[1]).toBe('');
    expect(arg.blobs[2]).toBe('');
    expect(arg.doubles[0]).toBe(0);
    expect(arg.doubles[1]).toBe(0);
  });
});
