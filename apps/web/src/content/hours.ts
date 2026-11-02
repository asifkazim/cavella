import { placeholder } from './placeholder';
import type { OpeningHours } from './types';

/**
 * Opening hours, in Europe/Warsaw local time.
 *
 * ✏️ OWNER: replace `placeholder(...)` with the real `WeeklyHours` object
 * (the example's shape) and add public-holiday exceptions below.
 * The example keeps the open-now indicator working during development and is
 * shown on the site with a visible placeholder label.
 */
export const openingHours: OpeningHours = {
  weekly: placeholder('weekly opening hours', {
    mon: [{ open: '06:30', close: '18:00' }],
    tue: [{ open: '06:30', close: '18:00' }],
    wed: [{ open: '06:30', close: '18:00' }],
    thu: [{ open: '06:30', close: '18:00' }],
    fri: [{ open: '06:30', close: '18:00' }],
    sat: [{ open: '08:00', close: '15:00' }],
    sun: [],
  }),
  // [PLACEHOLDER: public holiday schedule] — e.g.
  // { date: '2026-12-24', intervals: [{ open: '07:00', close: '12:00' }], note: { pl: 'Wigilia', en: 'Christmas Eve' } },
  exceptions: [],
};
