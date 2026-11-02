'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/content/types';
import { locales, switchLocalePath } from '@/i18n/config';

interface LanguageSwitcherProps {
  readonly current: Locale;
  readonly label: string;
  readonly names: Readonly<Record<Locale, string>>;
  readonly onNavigate?: () => void;
}

export function LanguageSwitcher({ current, label, names, onNavigate }: LanguageSwitcherProps) {
  const pathname = usePathname();
  return (
    <ul aria-label={label} className="flex items-center gap-1 text-sm font-semibold">
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <li key={locale}>
            <Link
              href={switchLocalePath(pathname, locale)}
              hrefLang={locale}
              lang={locale}
              aria-current={active ? 'true' : undefined}
              onClick={onNavigate}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 uppercase tracking-wider transition-colors ${
                active ? 'bg-cream-50/12 text-cream-50' : 'text-cream-200 hover:text-cream-50'
              }`}
            >
              <span aria-hidden="true">{locale}</span>
              <span className="sr-only">{names[locale]}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
