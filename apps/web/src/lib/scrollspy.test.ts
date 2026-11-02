import { describe, expect, it } from 'vitest';
import { activeSection } from './scrollspy';

const sections = [
  { id: 'coffee', top: -900 },
  { id: 'toast', top: -200 },
  { id: 'sweets', top: 300 },
  { id: 'drinks', top: 700 },
];

describe('activeSection', () => {
  it('returns the last section whose top passed the reading line', () => {
    expect(activeSection(sections, 160, false)).toBe('toast');
  });

  it('returns null above the first section', () => {
    expect(activeSection([{ id: 'coffee', top: 400 }], 160, false)).toBeNull();
  });

  it('selects the last section at the bottom of the page even if it is short', () => {
    expect(activeSection(sections, 160, true)).toBe('drinks');
  });

  it('handles an empty list', () => {
    expect(activeSection([], 160, true)).toBeNull();
  });
});
