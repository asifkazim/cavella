import { describe, expect, it } from 'vitest';
import { switchLocalePath, localePath, isLocale } from './config';
import { en } from './dictionaries/en';
import { pl } from './dictionaries/pl';
import { interpolate } from './index';

/** Flattens a dictionary into `path → value` pairs. */
function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      for (const [k, v] of flatten(child, prefix ? `${prefix}.${key}` : key)) out.set(k, v);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

describe('dictionaries', () => {
  it('have the same keys and no empty strings (AC-W-10)', () => {
    const plEntries = flatten(pl);
    const enEntries = flatten(en);
    expect([...enEntries.keys()].sort()).toEqual([...plEntries.keys()].sort());
    for (const [key, value] of [...plEntries, ...enEntries]) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim(), key).not.toBe('');
    }
  });

  it('use the same interpolation tokens in both languages', () => {
    const tokens = (s: unknown): string[] => (typeof s === 'string' ? (s.match(/\{\w+\}/g) ?? []).sort() : []);
    const enEntries = flatten(en);
    for (const [key, value] of flatten(pl)) {
      expect(tokens(enEntries.get(key)), key).toEqual(tokens(value));
    }
  });
});

describe('locale helpers', () => {
  it('validates locales', () => {
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });

  it('builds and switches locale paths', () => {
    expect(localePath('en', '/menu/')).toBe('/en/menu/');
    expect(switchLocalePath('/pl/menu/', 'en')).toBe('/en/menu/');
    expect(switchLocalePath('/pl', 'en')).toBe('/en/');
    expect(switchLocalePath('/unknown', 'pl')).toBe('/pl/');
  });

  it('interpolates tokens and keeps unknown ones visible', () => {
    expect(interpolate('do {time}', { time: '18:00' })).toBe('do 18:00');
    expect(interpolate('{a} {b}', { a: 'x' })).toBe('x {b}');
  });
});
