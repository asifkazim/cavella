import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StaffApp } from '@/components/staff/StaffApp';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).staff.metaTitle,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/** Staff console. Protected by the API: every action needs a staff session (ARCHITECTURE §7). */
export default async function StaffPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).staff;

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <div className="bg-espresso-900 text-cream-50">
        <div className="container-page pt-10 pb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{t.title}</h1>
        </div>
      </div>
      <div className="container-page py-8 sm:py-12">
        <StaffApp locale={locale} />
      </div>
    </main>
  );
}
