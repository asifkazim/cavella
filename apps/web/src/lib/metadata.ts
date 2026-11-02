import type { Metadata } from 'next';
import type { Locale } from '@/content/types';
import { defaultLocale, locales, localePath } from '@/i18n/config';

const OG_LOCALE: Record<Locale, string> = { pl: 'pl_PL', en: 'en_GB' };

/** Per-page metadata with canonical URL and hreflang alternates (FR-W-08, FR-W-11). */
export function pageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const languages: Record<string, string> = Object.fromEntries(locales.map((l) => [l, localePath(l, path)]));
  languages['x-default'] = localePath(defaultLocale, path);
  return {
    title,
    description,
    alternates: { canonical: localePath(locale, path), languages },
    openGraph: {
      type: 'website',
      siteName: 'Cavella',
      title,
      description,
      locale: OG_LOCALE[locale],
      url: localePath(locale, path),
    },
  };
}
