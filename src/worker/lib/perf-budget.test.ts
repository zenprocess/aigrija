import { describe, it, expect } from 'vitest';
import { checkBudget } from './perf-budget';

describe('checkBudget', () => {
  it('returns not exceeded when under budget for /api/check (3000ms)', () => {
    const result = checkBudget('/api/check', 1000);
    expect(result.exceeded).toBe(false);
    expect(result.budget).toBe(3000);
  });

  it('returns exceeded when over budget for /api/check', () => {
    const result = checkBudget('/api/check', 3001);
    expect(result.exceeded).toBe(true);
    expect(result.budget).toBe(3000);
  });

  it('returns not exceeded for /api/alerts under 500ms', () => {
    const result = checkBudget('/api/alerts', 499);
    expect(result.exceeded).toBe(false);
    expect(result.budget).toBe(500);
  });

  it('returns exceeded for /api/alerts over 500ms', () => {
    const result = checkBudget('/api/alerts', 501);
    expect(result.exceeded).toBe(true);
  });

  it('returns budget 1000 for /admin', () => {
    const result = checkBudget('/admin', 999);
    expect(result.exceeded).toBe(false);
    expect(result.budget).toBe(1000);
  });

  it('returns default budget 5000 for unknown endpoint', () => {
    const result = checkBudget('/unknown/path', 4999);
    expect(result.exceeded).toBe(false);
    expect(result.budget).toBe(5000);
  });

  it('returns exceeded for unknown endpoint over 5000ms', () => {
    const result = checkBudget('/unknown', 5001);
    expect(result.exceeded).toBe(true);
    expect(result.budget).toBe(5000);
  });

  it('matches /api/check sub-path via prefix', () => {
    const result = checkBudget('/api/check/something', 100);
    expect(result.budget).toBe(3000);
  });
});
