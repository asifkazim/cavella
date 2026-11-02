import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CustomerCardApp } from '@/components/loyalty/CustomerCardApp';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).loyalty;
  return {
    ...pageMetadata(locale, '/card/', t.metaTitle, t.metaDescription),
    referrer: 'no-referrer',
  };
}

export default async function CardPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).loyalty;

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <div className="bg-espresso-900 text-cream-50">
        <div className="container-page pt-12 pb-10 sm:pt-16">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">{t.title}</h1>
        </div>
      </div>
      <div className="container-page py-10 sm:py-14">
        <CustomerCardApp locale={locale} />
      </div>
    </main>
  );
}
