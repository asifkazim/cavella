import type { HoursException, TimeInterval, Weekday, WeeklyHours } from '@/content/types';

/** All opening-hours logic runs in the kiosk's time zone, never the visitor's (PRD A-06, E-16). */
export const BUSINESS_TIME_ZONE = 'Europe/Warsaw';

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** How far ahead to look for the next opening (covers a closed week plus exceptions). */
const LOOKAHEAD_DAYS = 14;

/** "Closes soon" threshold for the status badge. */
export const CLOSING_SOON_MINUTES = 30;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface LocalDateTime {
  /** `YYYY-MM-DD` in the business time zone. */
  readonly date: string;
  readonly weekday: Weekday;
  /** Minutes since local midnight (0–1439). */
  readonly minutes: number;
}

export type OpenStatus =
  | {
      readonly state: 'open';
      /** Local `HH:MM` when the current interval ends. */
      readonly closesAt: string;
      readonly closesInMinutes: number;
    }
  | {
      readonly state: 'closed';
      /** `null` when no opening is scheduled within the lookahead window. */
      readonly next: NextOpening | null;
    };

export interface NextOpening {
  readonly date: string;
  readonly weekday: Weekday;
  /** 0 = later today, 1 = tomorrow, … */
  readonly daysAhead: number;
  readonly opensAt: string;
}

export interface HoursInput {
  readonly weekly: WeeklyHours;
  readonly exceptions: readonly HoursException[];
}

/** Parses `HH:MM` into minutes since midnight. Throws on invalid input. */
export function parseTime(time: string): number {
  const match = TIME_RE.exec(time);
  if (!match) {
    throw new RangeError(`Invalid time "${time}", expected HH:MM (24-hour)`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(date);
  if (!match) {
    throw new RangeError(`Invalid date "${date}", expected YYYY-MM-DD`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`Invalid calendar date "${date}"`);
  }
  return { y, m, d };
}

/** Weekday of a calendar date (time-zone independent). */
export function weekdayOf(date: string): Weekday {
  const { y, m, d } = parseDate(date);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(jsDay + 6) % 7] as Weekday;
}

/** Adds whole calendar days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Converts an instant to wall-clock date/time in the given time zone (DST-aware). */
export function toZonedDateTime(instant: Date, timeZone: string = BUSINESS_TIME_ZONE): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((p) => p.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Missing "${type}" when formatting date in ${timeZone}`);
    }
    return value;
  };

  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    date,
    weekday: weekdayOf(date),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Intervals that apply on a date: an exception if one exists, otherwise the weekly schedule. */
export function intervalsForDate(date: string, hours: HoursInput): readonly TimeInterval[] {
  const exception = hours.exceptions.find((e) => e.date === date);
  return exception ? exception.intervals : hours.weekly[weekdayOf(date)];
}

/**
 * Open/closed status at `now` (PRD FR-W-02, AC-W-02).
 * An interval is half-open: open at `open`, closed from `close` (06:30–18:00 → open at
 * 06:30:00, closed at 18:00:00).
 */
export function getOpenStatus(now: Date, hours: HoursInput, timeZone: string = BUSINESS_TIME_ZONE): OpenStatus {
  const local = toZonedDateTime(now, timeZone);

  for (const interval of intervalsForDate(local.date, hours)) {
    const open = parseTime(interval.open);
    const close = parseTime(interval.close);
    if (local.minutes >= open && local.minutes < close) {
      return { state: 'open', closesAt: interval.close, closesInMinutes: close - local.minutes };
    }
  }

  for (let daysAhead = 0; daysAhead <= LOOKAHEAD_DAYS; daysAhead++) {
    const date = addDays(local.date, daysAhead);
    const upcoming = [...intervalsForDate(date, hours)]
      .sort((a, b) => parseTime(a.open) - parseTime(b.open))
      .find((i) => daysAhead > 0 || parseTime(i.open) > local.minutes);
    if (upcoming) {
      return {
        state: 'closed',
        next: { date, weekday: weekdayOf(date), daysAhead, opensAt: upcoming.open },
      };
    }
  }

  return { state: 'closed', next: null };
}

export interface WeekdayGroup {
  readonly from: Weekday;
  readonly to: Weekday;
  readonly intervals: readonly TimeInterval[];
}

/** Groups consecutive weekdays with identical hours, e.g. Mon–Fri 06:30–18:00. */
export function groupWeeklyHours(weekly: WeeklyHours): WeekdayGroup[] {
  const key = (intervals: readonly TimeInterval[]): string => intervals.map((i) => `${i.open}-${i.close}`).join(',');
  const groups: WeekdayGroup[] = [];
  for (const day of WEEKDAYS) {
    const intervals = weekly[day];
    const last = groups.at(-1);
    if (last && key(last.intervals) === key(intervals)) {
      groups[groups.length - 1] = { ...last, to: day };
    } else {
      groups.push({ from: day, to: day, intervals });
    }
  }
  return groups;
}

/** Returns human-readable problems with the hours data; empty when valid. */
export function validateHours(hours: HoursInput): string[] {
  const problems: string[] = [];

  const checkIntervals = (where: string, intervals: readonly TimeInterval[]): void => {
    let previousClose = -1;
    intervals.forEach((interval, index) => {
      if (!TIME_RE.test(interval.open) || !TIME_RE.test(interval.close)) {
        problems.push(`${where}[${index}]: times must be HH:MM (24-hour)`);
        return;
      }
      const open = parseTime(interval.open);
      const close = parseTime(interval.close);
      if (open >= close) {
        problems.push(`${where}[${index}]: open must be before close (no overnight intervals)`);
      }
      if (open < previousClose) {
        problems.push(`${where}[${index}]: intervals must be sorted and non-overlapping`);
      }
      previousClose = close;
    });
  };

  for (const day of WEEKDAYS) {
    checkIntervals(day, hours.weekly[day]);
  }

  const seen = new Set<string>();
  for (const exception of hours.exceptions) {
    try {
      parseDate(exception.date);
    } catch {
      problems.push(`exception ${exception.date}: invalid date`);
      continue;
    }
    if (seen.has(exception.date)) {
      problems.push(`exception ${exception.date}: duplicate date`);
    }
    seen.add(exception.date);
    checkIntervals(`exception ${exception.date}`, exception.intervals);
  }

  return problems;
}
