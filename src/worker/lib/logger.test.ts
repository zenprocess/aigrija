import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { structuredLog } from './logger';

describe('structuredLog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs info to console.log with correct shape', () => {
    structuredLog('info', 'test_event', { stage: 'test' });
    expect(console.log).toHaveBeenCalledOnce();
    const parsed = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('test_event');
    expect(parsed.stage).toBe('test');
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('logs debug to console.log', () => {
    structuredLog('debug', 'debug_event');
    expect(console.log).toHaveBeenCalledOnce();
  });

  it('logs warn to console.warn', () => {
    structuredLog('warn', 'warn_event');
    expect(console.warn).toHaveBeenCalledOnce();
    const parsed = JSON.parse((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(parsed.level).toBe('warn');
  });

  it('logs error to console.error', () => {
    structuredLog('error', 'error_event', { request_id: 'abc' });
    expect(console.error).toHaveBeenCalledOnce();
    const parsed = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(parsed.level).toBe('error');
    expect(parsed.request_id).toBe('abc');
  });

  it('works with no meta argument', () => {
    expect(() => structuredLog('info', 'no_meta')).not.toThrow();
  });
});
