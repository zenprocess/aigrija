import { describe, it, expect, vi } from 'vitest';
import { gepa } from './gepa';

vi.mock('../lib/gepa-benchmark', () => ({
  getPromptHistory: vi.fn(),
}));

import { getPromptHistory } from '../lib/gepa-benchmark';

function makeEnv(adminKey = 'admin-key'): any {
  return { ADMIN_API_KEY: adminKey };
}

describe('GET /gepa/evaluations', () => {
  it('returns 401 when no admin key header', async () => {
    const req = new Request('http://localhost/gepa/evaluations?category=test');
    const res = await gepa.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when wrong admin key', async () => {
    const req = new Request('http://localhost/gepa/evaluations?category=test', {
      headers: { 'x-admin-api-key': 'wrong-key' },
    });
    const res = await gepa.fetch(req, makeEnv('correct-key'), {} as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when category is missing', async () => {
    const req = new Request('http://localhost/gepa/evaluations', {
      headers: { 'x-admin-api-key': 'admin-key' },
    });
    const res = await gepa.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns evaluations on happy path', async () => {
    const mockEvals = [{ prompt: 'test', score: 0.9 }];
    vi.mocked(getPromptHistory).mockResolvedValue(mockEvals as any);

    const req = new Request('http://localhost/gepa/evaluations?category=phishing', {
      headers: { 'x-admin-api-key': 'admin-key' },
    });
    const res = await gepa.fetch(req, makeEnv(), {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.category).toBe('phishing');
    expect(body.count).toBe(1);
    expect(body.evaluations).toEqual(mockEvals);
  });
});
