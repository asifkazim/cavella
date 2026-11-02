import { describe, expect, it } from 'vitest';
import { validateHours } from '@/lib/hours';
import { validateMenu } from '@/lib/menu';
import { business } from './business';
import { openingHours } from './hours';
import { location } from './location';
import { menu } from './menu';
import { isPlaceholder, resolveEditable } from './placeholder';
import type { LocalizedText } from './types';

/** Guards the owner-editable content files against typos that would break the site. */
describe('site content', () => {
  it('menu data is valid', () => {
    expect(validateMenu(menu)).toEqual([]);
  });

  it('every menu text exists in Polish and English', () => {
    const texts: LocalizedText[] = menu.flatMap((c) => [
      c.name,
      ...(c.intro ? [c.intro] : []),
      ...c.items.flatMap((i) => [i.name, ...(i.description ? [i.description] : [])]),
    ]);
    for (const text of texts) {
      expect(text.pl.trim()).not.toBe('');
      expect(text.en.trim()).not.toBe('');
    }
  });

  it('opening hours (confirmed or example) are valid', () => {
    const weekly = resolveEditable(openingHours.weekly);
    expect(weekly, 'weekly hours need a value or an example').toBeDefined();
    if (weekly) {
      expect(validateHours({ weekly, exceptions: openingHours.exceptions })).toEqual([]);
    }
  });

  it('location has usable coordinates for the Directions links', () => {
    const geo = resolveEditable(location.geo);
    expect(geo).toBeDefined();
    if (geo) {
      expect(Math.abs(geo.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(geo.lng)).toBeLessThanOrEqual(180);
    }
  });

  it('confirmed social links are https URLs', () => {
    for (const link of business.social) {
      if (!isPlaceholder(link.url)) {
        expect(link.url).toMatch(/^https:\/\//);
      }
    }
  });
});
