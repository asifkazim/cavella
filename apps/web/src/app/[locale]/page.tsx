import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Hero } from '@/components/home/Hero';
import { Highlights } from '@/components/home/Highlights';
import { LocationSection } from '@/components/home/LocationSection';
import { LoyaltyTeaser } from '@/components/home/LoyaltyTeaser';
import { MenuPreview } from '@/components/home/MenuPreview';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return pageMetadata(locale, '/', t.meta.homeTitle, t.meta.homeDescription);
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <Hero locale={locale} />
      <Highlights locale={locale} />
      <MenuPreview locale={locale} />
      <LoyaltyTeaser locale={locale} />
      <LocationSection locale={locale} />
    </main>
  );
}
