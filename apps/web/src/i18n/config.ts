import type { Locale } from '@/content/types';

export const locales = ['pl', 'en'] as const satisfies readonly Locale[];
export const defaultLocale: Locale = 'pl';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Path for a page in a locale. `path` is locale-free, e.g. "/" or "/menu/". */
export function localePath(locale: Locale, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean}`;
}

/** Swaps the locale prefix of an existing pathname; falls back to the locale home. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const match = /^\/(pl|en)(\/.*)?$/.exec(pathname);
  return localePath(target, match?.[2] ?? '/');
}
