import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestId } from './request-id';

function makeContext(path = '/api/check') {
  return {
    set: vi.fn(),
    header: vi.fn(),
    req: { path },
  } as unknown as Parameters<typeof requestId>[0];
}

describe('requestId middleware', () => {
  it('sets X-Request-Id header and calls next', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const c = makeContext();

    await requestId(c, next);

    expect(next).toHaveBeenCalledOnce();
    const headerFn = c.header as ReturnType<typeof vi.fn>;
    const requestIdCall = headerFn.mock.calls.find(([k]: [string]) => k === 'X-Request-Id');
    expect(requestIdCall).toBeDefined();
    expect(requestIdCall![1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('sets requestId on context', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const c = makeContext();

    await requestId(c, next);

    expect(c.set).toHaveBeenCalledWith('requestId', expect.any(String));
  });

  it('generates unique IDs each call', async () => {
    const ids: string[] = [];
    const makeC = () => ({
      set: vi.fn(),
      header: (_: string, v: string) => { ids.push(v); },
      req: { path: '/api/check' },
    });

    await requestId(makeC() as unknown as Parameters<typeof requestId>[0], vi.fn().mockResolvedValue(undefined));
    await requestId(makeC() as unknown as Parameters<typeof requestId>[0], vi.fn().mockResolvedValue(undefined));

    expect(ids[0]).not.toBe(ids[1]);
  });

  it('adds X-Response-Time header after next()', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const c = makeContext('/api/alerts');

    await requestId(c, next);

    const headerFn = c.header as ReturnType<typeof vi.fn>;
    const rtCall = headerFn.mock.calls.find(([k]: [string]) => k === 'X-Response-Time');
    expect(rtCall).toBeDefined();
    expect(rtCall![1]).toMatch(/^\d+ms$/);
  });

  it('logs a warning when budget is exceeded', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Simulate a slow next() for /api/alerts (budget 500ms)
    const next = vi.fn().mockImplementation(async () => {
      // Force durationMs > 500 by mocking Date.now
    });

    // Mock Date.now to simulate elapsed time exceeding budget
    let callCount = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 600; // 600ms elapsed
    });

    const c = makeContext('/api/alerts');
    await requestId(c, next);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[perf-budget]')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/alerts')
    );

    warnSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('does not log a warning when budget is not exceeded', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let callCount = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 100; // 100ms elapsed — well within any budget
    });

    const next = vi.fn().mockResolvedValue(undefined);
    const c = makeContext('/api/alerts');
    await requestId(c, next);

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    nowSpy.mockRestore();
  });
});
