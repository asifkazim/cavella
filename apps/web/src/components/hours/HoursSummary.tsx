import type { WeeklyHours } from '@/content/types';
import type { Dictionary } from '@/i18n';
import { groupWeeklyHours } from '@/lib/hours';

interface HoursSummaryProps {
  readonly weekly: WeeklyHours;
  readonly t: Dictionary;
}

/**
 * Compact grouped hours, e.g. "Mon–Fri 06:30–18:00". Each row wraps as a unit (time moves
 * under the day) instead of splitting "06:30–18:00" or overflowing at large text sizes.
 */
export function HoursSummary({ weekly, t }: HoursSummaryProps) {
  return (
    <dl className="space-y-1.5">
      {groupWeeklyHours(weekly).map((group) => (
        <div key={group.from} className="flex flex-wrap gap-x-4">
          <dt className="min-w-[4.5rem]">
            {t.weekdaysShort[group.from]}
            {group.from !== group.to ? `–${t.weekdaysShort[group.to]}` : ''}
          </dt>
          <dd className="tabular-nums">
            {group.intervals.length === 0
              ? t.location.closedAllDay
              : group.intervals.map((i, index) => (
                  <span key={i.open} className="whitespace-nowrap">
                    {index > 0 ? ', ' : ''}
                    {i.open}–{i.close}
                  </span>
                ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
