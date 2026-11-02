import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryNav } from '@/components/menu/CategoryNav';
import { MenuCategorySection } from '@/components/menu/MenuCategorySection';
import { menu } from '@/content/menu';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return pageMetadata(locale, '/menu/', t.meta.menuTitle, t.meta.menuDescription);
}

export default async function MenuPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <div className="bg-espresso-900 text-cream-50">
        <div className="container-page pt-12 pb-10 sm:pt-16 sm:pb-14">
          <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-7xl">{t.menuPage.title}</h1>
          <p className="mt-3 max-w-xl text-lg text-cream-200">{t.menuPage.lead}</p>
        </div>
      </div>

      {menu.length === 0 ? (
        <div className="container-page py-20">
          <p className="rounded-(--radius-card) border border-dashed border-espresso-900/20 p-10 text-center text-lg text-muted">
            {t.menuPage.emptyMenu}
          </p>
        </div>
      ) : (
        <>
          <CategoryNav
            label={t.a11y.categoryNav}
            categories={menu.map((c) => ({ id: c.id, name: c.name[locale] }))}
          />
          <div className="container-page">
            {menu.map((category) => (
              <MenuCategorySection key={category.id} category={category} locale={locale} />
            ))}
            <p className="mb-20 rounded-(--radius-card) bg-cream-200/70 p-6 leading-relaxed">{t.menuPage.allergens}</p>
          </div>
        </>
      )}
    </main>
  );
}
