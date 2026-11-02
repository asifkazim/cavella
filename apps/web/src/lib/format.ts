import type { Locale } from '@/content/types';

const INTL_LOCALE: Record<Locale, string> = { pl: 'pl-PL', en: 'en-GB' };

const priceFormatters = new Map<Locale, Intl.NumberFormat>();

/** Gross PLN price, e.g. `12,00 zł` (pl) or `PLN 12.00` (en). PRD A-05, AC-W-03. */
export function formatPrice(amount: number, locale: Locale): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Invalid price: ${amount}`);
  }
  let formatter = priceFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    priceFormatters.set(locale, formatter);
  }
  // Normalise narrow/regular no-break spaces so output is stable across ICU versions.
  return formatter.format(amount).replace(/[  ]/g, ' ');
}

/** Calendar date `YYYY-MM-DD` as e.g. "24 grudnia" / "24 December" (no time-zone shift). */
export function formatCalendarDate(date: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError(`Invalid date: ${date}`);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function intlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}
