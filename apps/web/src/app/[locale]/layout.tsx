import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { fontClassNames } from '@/app/fonts';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { isLocale, locales } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import '../globals.css';

export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: '#2b1a12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: { default: t.meta.homeTitle, template: `%s` },
    description: t.meta.homeDescription,
    applicationName: t.meta.siteName,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <html lang={locale} className={fontClassNames}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-caramel-400 focus:px-5 focus:py-3 focus:font-semibold focus:text-espresso-950 focus:shadow-lg"
        >
          {t.a11y.skipToContent}
        </a>
        <SiteHeader locale={locale} />
        {children}
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
