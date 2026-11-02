import { describe, expect, it } from 'vitest';
import type { WeeklyHours } from '@/content/types';
import {
  addDays,
  getOpenStatus,
  groupWeeklyHours,
  parseTime,
  toZonedDateTime,
  validateHours,
  weekdayOf,
  type HoursInput,
} from './hours';

const WEEKDAY_ONLY: WeeklyHours = {
  mon: [{ open: '06:30', close: '18:00' }],
  tue: [{ open: '06:30', close: '18:00' }],
  wed: [{ open: '06:30', close: '18:00' }],
  thu: [{ open: '06:30', close: '18:00' }],
  fri: [{ open: '06:30', close: '18:00' }],
  sat: [{ open: '08:00', close: '15:00' }],
  sun: [],
};

const EVERY_DAY: WeeklyHours = {
  mon: [{ open: '06:30', close: '18:00' }],
  tue: [{ open: '06:30', close: '18:00' }],
  wed: [{ open: '06:30', close: '18:00' }],
  thu: [{ open: '06:30', close: '18:00' }],
  fri: [{ open: '06:30', close: '18:00' }],
  sat: [{ open: '06:30', close: '18:00' }],
  sun: [{ open: '06:30', close: '18:00' }],
};

const hours = (weekly: WeeklyHours, exceptions: HoursInput['exceptions'] = []): HoursInput => ({
  weekly,
  exceptions,
});

const at = (iso: string): Date => new Date(iso);

describe('calendar helpers', () => {
  it('parses HH:MM and rejects invalid times', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('06:30')).toBe(390);
    expect(parseTime('23:59')).toBe(1439);
    expect(() => parseTime('24:00')).toThrow(RangeError);
    expect(() => parseTime('6:30')).toThrow(RangeError);
  });

  it('computes weekdays and adds days across month and year boundaries', () => {
    expect(weekdayOf('2026-11-02')).toBe('mon');
    expect(weekdayOf('2026-11-01')).toBe('sun');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(() => weekdayOf('2026-02-30')).toThrow(RangeError);
  });

  it('converts instants to Warsaw wall-clock time, including after midnight', () => {
    // 23:30 UTC on Sun 1 Nov 2026 = 00:30 CET on Mon 2 Nov.
    expect(toZonedDateTime(at('2026-11-01T23:30:00Z'))).toEqual({
      date: '2026-11-02',
      weekday: 'mon',
      minutes: 30,
    });
  });
});

describe('getOpenStatus — AC-W-02 boundaries (Mon–Fri 06:30–18:00)', () => {
  // Monday 2 Nov 2026 is in winter time (CET, UTC+1).
  it('is closed one second before opening', () => {
    const status = getOpenStatus(at('2026-11-02T05:29:59Z'), hours(WEEKDAY_ONLY));
    expect(status).toEqual({
      state: 'closed',
      next: { date: '2026-11-02', weekday: 'mon', daysAhead: 0, opensAt: '06:30' },
    });
  });

  it('is open at exactly 06:30:00', () => {
    const status = getOpenStatus(at('2026-11-02T05:30:00Z'), hours(WEEKDAY_ONLY));
    expect(status).toEqual({ state: 'open', closesAt: '18:00', closesInMinutes: 690 });
  });

  it('is open at 17:59:59 and reports minutes to close', () => {
    const status = getOpenStatus(at('2026-11-02T16:59:59Z'), hours(WEEKDAY_ONLY));
    expect(status).toEqual({ state: 'open', closesAt: '18:00', closesInMinutes: 1 });
  });

  it('is closed at exactly 18:00:00 and points to the next morning', () => {
    const status = getOpenStatus(at('2026-11-02T17:00:00Z'), hours(WEEKDAY_ONLY));
    expect(status).toEqual({
      state: 'closed',
      next: { date: '2026-11-03', weekday: 'tue', daysAhead: 1, opensAt: '06:30' },
    });
  });
});

describe('getOpenStatus — DST transition days (open daily 06:30–18:00)', () => {
  // 29 Mar 2026: clocks go forward at 02:00 → CEST (UTC+2).
  it('handles the spring-forward day', () => {
    expect(getOpenStatus(at('2026-03-29T04:29:59Z'), hours(EVERY_DAY)).state).toBe('closed');
    expect(getOpenStatus(at('2026-03-29T04:30:00Z'), hours(EVERY_DAY)).state).toBe('open');
    expect(getOpenStatus(at('2026-03-29T15:59:59Z'), hours(EVERY_DAY)).state).toBe('open');
    expect(getOpenStatus(at('2026-03-29T16:00:00Z'), hours(EVERY_DAY)).state).toBe('closed');
  });

  // 25 Oct 2026: clocks go back at 03:00 → CET (UTC+1).
  it('handles the fall-back day', () => {
    expect(getOpenStatus(at('2026-10-25T05:29:59Z'), hours(EVERY_DAY)).state).toBe('closed');
    expect(getOpenStatus(at('2026-10-25T05:30:00Z'), hours(EVERY_DAY)).state).toBe('open');
    expect(getOpenStatus(at('2026-10-25T16:59:59Z'), hours(EVERY_DAY)).state).toBe('open');
    expect(getOpenStatus(at('2026-10-25T17:00:00Z'), hours(EVERY_DAY)).state).toBe('closed');
  });
});

describe('getOpenStatus — schedule shapes', () => {
  it('skips a closed Sunday when looking for the next opening', () => {
    // Saturday 7 Nov 2026, 16:00 CET — after Saturday close.
    const status = getOpenStatus(at('2026-11-07T15:00:00Z'), hours(WEEKDAY_ONLY));
    expect(status).toEqual({
      state: 'closed',
      next: { date: '2026-11-09', weekday: 'mon', daysAhead: 2, opensAt: '06:30' },
    });
  });

  it('applies a closed-day exception instead of the weekly schedule', () => {
    const status = getOpenStatus(
      at('2026-11-11T10:00:00Z'), // Wed 11 Nov (Independence Day), 11:00 CET
      hours(WEEKDAY_ONLY, [{ date: '2026-11-11', intervals: [] }]),
    );
    expect(status).toEqual({
      state: 'closed',
      next: { date: '2026-11-12', weekday: 'thu', daysAhead: 1, opensAt: '06:30' },
    });
  });

  it('applies special hours from an exception', () => {
    const special = hours(WEEKDAY_ONLY, [{ date: '2026-12-24', intervals: [{ open: '07:00', close: '12:00' }] }]);
    expect(getOpenStatus(at('2026-12-24T10:30:00Z'), special)).toEqual({
      state: 'open',
      closesAt: '12:00',
      closesInMinutes: 30,
    });
    expect(getOpenStatus(at('2026-12-24T11:00:00Z'), special).state).toBe('closed');
  });

  it('supports a midday break', () => {
    const split: WeeklyHours = { ...WEEKDAY_ONLY, mon: [{ open: '06:30', close: '11:00' }, { open: '12:00', close: '18:00' }] };
    expect(getOpenStatus(at('2026-11-02T10:30:00Z'), hours(split))).toEqual({
      state: 'closed',
      next: { date: '2026-11-02', weekday: 'mon', daysAhead: 0, opensAt: '12:00' },
    });
    expect(getOpenStatus(at('2026-11-02T11:00:00Z'), hours(split)).state).toBe('open');
  });

  it('returns no next opening when nothing is scheduled', () => {
    const closed: WeeklyHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    expect(getOpenStatus(at('2026-11-02T10:00:00Z'), hours(closed))).toEqual({ state: 'closed', next: null });
  });
});

describe('groupWeeklyHours', () => {
  it('groups consecutive days with identical hours', () => {
    expect(groupWeeklyHours(WEEKDAY_ONLY)).toEqual([
      { from: 'mon', to: 'fri', intervals: [{ open: '06:30', close: '18:00' }] },
      { from: 'sat', to: 'sat', intervals: [{ open: '08:00', close: '15:00' }] },
      { from: 'sun', to: 'sun', intervals: [] },
    ]);
  });

  it('does not merge non-adjacent days', () => {
    const alternating: WeeklyHours = { ...EVERY_DAY, tue: [], thu: [] };
    expect(groupWeeklyHours(alternating).map((g) => `${g.from}-${g.to}`)).toEqual([
      'mon-mon',
      'tue-tue',
      'wed-wed',
      'thu-thu',
      'fri-sun',
    ]);
  });
});

describe('validateHours', () => {
  it('accepts a valid schedule', () => {
    expect(validateHours(hours(WEEKDAY_ONLY))).toEqual([]);
  });

  it('reports malformed, inverted, overlapping and duplicate entries', () => {
    const bad: WeeklyHours = {
      ...WEEKDAY_ONLY,
      mon: [{ open: '6:30', close: '18:00' }],
      tue: [{ open: '18:00', close: '06:30' }],
      wed: [{ open: '06:30', close: '12:00' }, { open: '11:00', close: '18:00' }],
    };
    const problems = validateHours(
      hours(bad, [
        { date: '2026-12-24', intervals: [] },
        { date: '2026-12-24', intervals: [] },
        { date: '2026-13-01', intervals: [] },
      ]),
    );
    expect(problems).toEqual([
      'mon[0]: times must be HH:MM (24-hour)',
      'tue[0]: open must be before close (no overnight intervals)',
      'wed[1]: intervals must be sorted and non-overlapping',
      'exception 2026-12-24: duplicate date',
      'exception 2026-13-01: invalid date',
    ]);
  });
});
