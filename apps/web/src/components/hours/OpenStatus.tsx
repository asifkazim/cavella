'use client';

import { openingHours } from '@/content/hours';
import { resolveEditable } from '@/content/placeholder';
import type { Locale } from '@/content/types';
import { useNow } from '@/hooks/useNow';
import { getDictionary } from '@/i18n';
import { getOpenStatus, intervalsForDate, toZonedDateTime } from '@/lib/hours';
import { describeStatus, describeToday, type StatusTone } from '@/lib/status-text';

const DOT: Record<StatusTone | 'loading', string> = {
  open: 'bg-emerald-400',
  closing: 'bg-amber-300',
  closed: 'bg-rose-400',
  loading: 'bg-cream-200/50 animate-pulse',
};

/**
 * Open-now badge (FR-W-02). Computed in the browser in Europe/Warsaw time; while the
 * page hydrates it shows a same-size loading state so nothing shifts (NFR-P-02 CLS).
 * Status is conveyed by text, never colour alone (NFR-A-03).
 */
export function OpenStatus({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const now = useNow();
  const weekly = resolveEditable(openingHours.weekly);

  if (!weekly) {
    return (
      <div className="inline-flex min-h-11 items-center rounded-[1.375rem] border border-cream-50/15 bg-cream-50/5 px-4 py-1.5 text-sm text-cream-100">
        {t.status.hoursUnavailable}
      </div>
    );
  }

  const hours = { weekly, exceptions: openingHours.exceptions };
  const text = now ? describeStatus(getOpenStatus(now, hours), t) : null;
  const today = now ? describeToday(intervalsForDate(toZonedDateTime(now).date, hours), t) : null;

  return (
    <div className="flex flex-col items-start gap-2">
      {/* Fixed radius (not rounded-full): a pill at normal sizes, a rounded box if the text wraps. */}
      <p className="inline-flex min-h-11 items-center gap-3 rounded-[1.375rem] border border-cream-50/15 bg-cream-50/5 px-4 py-1.5 text-[0.95rem] text-cream-100">
        <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${DOT[text?.tone ?? 'loading']}`} />
        {text ? (
          <span>
            <strong className="font-semibold text-cream-50">{text.label}</strong>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {text.detail}
          </span>
        ) : (
          <span className="text-cream-200">{t.status.loading}</span>
        )}
      </p>
      <p className="min-h-5 pl-1 text-sm text-cream-200">{today ?? ' '}</p>
    </div>
  );
}
