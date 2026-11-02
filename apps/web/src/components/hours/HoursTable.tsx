'use client';

import type { HoursException, Locale, TimeInterval, WeeklyHours } from '@/content/types';
import { useNow } from '@/hooks/useNow';
import { getDictionary } from '@/i18n';
import { formatCalendarDate } from '@/lib/format';
import { toZonedDateTime, WEEKDAYS } from '@/lib/hours';

interface HoursTableProps {
  readonly locale: Locale;
  readonly weekly: WeeklyHours;
  readonly exceptions: readonly HoursException[];
}

/** "06:30–18:00" never splits; multiple intervals may wrap between each other. */
function Intervals({ intervals }: { intervals: readonly TimeInterval[] }) {
  return intervals.map((i, index) => (
    <span key={i.open} className="whitespace-nowrap">
      {index > 0 ? ', ' : ''}
      {i.open}–{i.close}
    </span>
  ));
}

/**
 * Full weekly schedule; today's row is highlighted once the client knows the date.
 * A description list rather than a <table>: rows reflow (the time moves under the day)
 * at narrow widths and large text sizes, which a two-column table cannot do (NFR-A-04).
 */
export function HoursTable({ locale, weekly, exceptions }: HoursTableProps) {
  const t = getDictionary(locale);
  const now = useNow();
  const local = now ? toZonedDateTime(now) : null;
  const upcoming = local ? exceptions.filter((e) => e.date >= local.date) : exceptions;

  return (
    <div>
      <dl aria-label={t.location.hoursLabel}>
        {WEEKDAYS.map((day) => {
          const isToday = local?.weekday === day;
          const intervals = weekly[day];
          return (
            <div
              key={day}
              aria-current={isToday ? 'date' : undefined}
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-espresso-900/10 px-3 py-3 last:border-0 ${
                isToday ? 'bg-caramel-300/25' : ''
              }`}
            >
              <dt className="font-medium">
                {t.weekdays[day]}
                {isToday ? (
                  <span className="ml-2 inline-block rounded-full bg-espresso-900 px-2 py-0.5 text-xs font-semibold text-cream-50">
                    {t.location.today}
                  </span>
                ) : null}
              </dt>
              <dd className="ml-auto text-right tabular-nums">
                {intervals.length === 0 ? (
                  <span className="text-muted">{t.location.closedAllDay}</span>
                ) : (
                  <Intervals intervals={intervals} />
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {upcoming.length > 0 ? (
        <div className="mt-6 rounded-2xl bg-cream-200/60 p-4">
          <h3 className="text-sm font-semibold">{t.location.exceptionsLabel}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {upcoming.map((e) => (
              <li key={e.date} className="flex flex-wrap justify-between gap-x-4 tabular-nums">
                <span>
                  {formatCalendarDate(e.date, locale)}
                  {e.note ? ` · ${e.note[locale]}` : ''}
                </span>
                <span className="ml-auto">
                  {e.intervals.length === 0 ? t.location.closedAllDay : <Intervals intervals={e.intervals} />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
