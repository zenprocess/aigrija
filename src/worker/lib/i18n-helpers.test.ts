import { describe, it, expect } from 'vitest';
import { pluralize, formatDate, formatNumber } from './i18n-helpers';

describe('pluralize (Romanian)', () => {
  const forms = { one: '{n} mesaj', few: '{n} mesaje', other: '{n} de mesaje' };

  it('n=1 => one', () => {
    expect(pluralize(1, forms, 'ro')).toBe('1 mesaj');
  });

  it('n=2 => few', () => {
    expect(pluralize(2, forms, 'ro')).toBe('2 mesaje');
  });

  it('n=19 => few (0 < 19 < 20)', () => {
    expect(pluralize(19, forms, 'ro')).toBe('19 mesaje');
  });

  it('n=20 => other', () => {
    expect(pluralize(20, forms, 'ro')).toBe('20 de mesaje');
  });

  it('n=100 => other', () => {
    expect(pluralize(100, forms, 'ro')).toBe('100 de mesaje');
  });

  it('n=0 => few', () => {
    expect(pluralize(0, forms, 'ro')).toBe('0 mesaje');
  });

  it('n=101 => few (101 % 100 = 1, but 1 !== 1 check: 101 === 1 is false, then 0 < 101%100=1 < 20 => few)', () => {
    // 101 % 100 = 1, 0 < 1 < 20 => few
    expect(pluralize(101, forms, 'ro')).toBe('101 mesaje');
  });
});

describe('formatDate', () => {
  it('formats date in Romanian', () => {
    const result = formatDate('2026-03-01', 'ro');
    expect(result).toContain('2026');
  });

  it('accepts Date object', () => {
    const result = formatDate(new Date('2026-01-15'), 'ro');
    expect(result).toContain('2026');
  });
});

describe('formatNumber', () => {
  it('formats number in Romanian locale', () => {
    const result = formatNumber(1000, 'ro');
    // Romanian uses . as thousands separator
    expect(result).toMatch(/1[.,\s]000|1000/);
  });
});
