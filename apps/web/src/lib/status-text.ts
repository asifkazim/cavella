import type { TimeInterval } from '@/content/types';
import type { Dictionary } from '@/i18n';
import { interpolate } from '@/i18n';
import { CLOSING_SOON_MINUTES, type OpenStatus } from './hours';

export type StatusTone = 'open' | 'closing' | 'closed';

export interface StatusText {
  readonly tone: StatusTone;
  /** "Open" / "Closing soon" / "Closed". */
  readonly label: string;
  /** "until 18:00" / "opens tomorrow at 06:30". */
  readonly detail: string;
}

/** Turns an open/closed status into localised display text (FR-W-02). */
export function describeStatus(status: OpenStatus, t: Dictionary): StatusText {
  if (status.state === 'open') {
    const closing = status.closesInMinutes <= CLOSING_SOON_MINUTES;
    return {
      tone: closing ? 'closing' : 'open',
      label: closing ? t.status.closingSoon : t.status.open,
      detail: interpolate(t.status.closesAt, { time: status.closesAt }),
    };
  }

  const { next } = status;
  let detail: string;
  if (!next) {
    detail = t.status.noUpcoming;
  } else if (next.daysAhead === 0) {
    detail = interpolate(t.status.opensToday, { time: next.opensAt });
  } else if (next.daysAhead === 1) {
    detail = interpolate(t.status.opensTomorrow, { time: next.opensAt });
  } else {
    detail = interpolate(t.status.opensOn, { day: t.weekdaysLocative[next.weekday], time: next.opensAt });
  }
  return { tone: 'closed', label: t.status.closed, detail };
}

/** "Today: 06:30–18:00" or "Closed today". */
export function describeToday(intervals: readonly TimeInterval[], t: Dictionary): string {
  if (intervals.length === 0) return t.status.todayClosed;
  return interpolate(t.status.todayHours, {
    hours: intervals.map((i) => `${i.open}–${i.close}`).join(', '),
  });
}
