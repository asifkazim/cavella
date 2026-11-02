import type { Metadata } from 'next';
import { fontClassNames } from '@/app/fonts';
import { Logo } from '@/components/brand/Logo';
import { localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import './globals.css';

/*
 * Exported as out/404.html. The app has two root layouts (`/[locale]` and `/`), so a
 * single global 404 is needed; the locale is unknown here, so it is bilingual (PL first).
 * Requires `experimental.globalNotFound` in next.config.ts.
 */
const pl = getDictionary('pl');
const en = getDictionary('en');

export const metadata: Metadata = {
  title: `404 — ${pl.notFound.title} · ${en.notFound.title}`,
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="pl" className={fontClassNames}>
      <body className="min-h-dvh bg-espresso-900 text-cream-50">
        <main className="container-page flex min-h-dvh flex-col justify-center py-16">
          <Logo />
          <p className="mt-12 font-display text-8xl font-semibold text-caramel-400">404</p>
          <h1 className="mt-4 font-display text-4xl font-semibold">{pl.notFound.title}</h1>
          <p className="mt-2 text-lg text-cream-200">{pl.notFound.text}</p>
          <p className="mt-8 flex flex-wrap gap-3">
            <a
              href={localePath('pl')}
              className="inline-flex min-h-12 items-center rounded-full bg-caramel-400 px-6 font-semibold text-espresso-950 hover:bg-caramel-300"
            >
              {pl.notFound.back}
            </a>
            <a
              href={localePath('en')}
              lang="en"
              hrefLang="en"
              className="inline-flex min-h-12 items-center rounded-full border border-cream-100/40 px-6 font-semibold hover:bg-cream-50/10"
            >
              {en.notFound.back}
            </a>
          </p>
          <p lang="en" className="mt-6 text-cream-200">
            {en.notFound.title}. {en.notFound.text}
          </p>
        </main>
      </body>
    </html>
  );
}
