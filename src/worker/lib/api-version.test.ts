import { describe, it, expect, vi } from 'vitest';
import { API_VERSION, apiVersion } from './api-version';

describe('API_VERSION', () => {
  it('is a non-empty string', () => {
    expect(typeof API_VERSION).toBe('string');
    expect(API_VERSION.length).toBeGreaterThan(0);
  });
});

describe('apiVersion middleware', () => {
  it('returns a middleware function', () => {
    const mw = apiVersion();
    expect(typeof mw).toBe('function');
  });

  it('calls next and sets X-API-Version header', async () => {
    const mw = apiVersion();
    const next = vi.fn().mockResolvedValue(undefined);
    const headerFn = vi.fn();
    const c = { header: headerFn } as unknown as Parameters<typeof mw>[0];

    await mw(c, next);

    expect(next).toHaveBeenCalledOnce();
    expect(headerFn).toHaveBeenCalledWith('X-API-Version', API_VERSION);
  });
});
