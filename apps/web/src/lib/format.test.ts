import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatPrice } from './format';

const NBSP = ' ';

describe('formatPrice', () => {
  it('formats Polish gross prices as "12,00 zł" (AC-W-03)', () => {
    expect(formatPrice(12, 'pl')).toBe(`12,00${NBSP}zł`);
    expect(formatPrice(9.5, 'pl')).toBe(`9,50${NBSP}zł`);
  });

  it('formats English prices with the PLN code', () => {
    expect(formatPrice(12, 'en')).toBe(`PLN${NBSP}12.00`);
  });

  it('rejects negative and non-finite amounts', () => {
    expect(() => formatPrice(-1, 'pl')).toThrow(RangeError);
    expect(() => formatPrice(Number.NaN, 'pl')).toThrow(RangeError);
  });
});

describe('formatCalendarDate', () => {
  it('formats a calendar date without shifting it across time zones', () => {
    expect(formatCalendarDate('2026-12-24', 'pl')).toBe('24 grudnia');
    expect(formatCalendarDate('2026-12-24', 'en')).toBe('24 December');
  });

  it('rejects malformed dates', () => {
    expect(() => formatCalendarDate('24.12.2026', 'pl')).toThrow(RangeError);
  });
});
