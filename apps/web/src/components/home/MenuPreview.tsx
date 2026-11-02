import Link from 'next/link';
import { Price } from '@/components/menu/Price';
import { ButtonLink } from '@/components/ui/Button';
import { ArrowRightIcon } from '@/components/ui/icons';
import { menu } from '@/content/menu';
import type { Locale } from '@/content/types';
import { localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { featuredItems } from '@/lib/menu';

export function MenuPreview({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const items = featuredItems(menu);
  const menuHref = localePath(locale, '/menu/');

  return (
    <section aria-labelledby="menu-preview-title" className="bg-cream-50 py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 id="menu-preview-title" className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {t.menuPreview.title}
            </h2>
            <p className="mt-3 max-w-xl text-lg text-muted">{t.menuPreview.lead}</p>
          </div>
          <div className="hidden sm:block">
            <ButtonLink href={menuHref} variant="secondary-light">
              {t.menuPreview.cta}
              <ArrowRightIcon />
            </ButtonLink>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="mt-10 rounded-(--radius-card) border border-dashed border-espresso-900/20 p-8 text-center text-muted">
            {t.menuPreview.empty}
          </p>
        ) : (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map(({ categoryId, item }) => {
              const first = item.variants[0];
              return (
                <li key={item.id}>
                  <Link
                    href={`${menuHref}#${categoryId}`}
                    className="group flex h-full flex-col rounded-(--radius-card) bg-cream-100 p-6 ring-1 ring-espresso-900/5 transition-shadow hover:shadow-lg hover:shadow-espresso-900/5"
                  >
                    <span className="font-display text-2xl font-semibold group-hover:text-caramel-700">
                      {item.name[locale]}
                    </span>
                    {item.description ? (
                      <span className="mt-2 flex-1 leading-relaxed text-muted">{item.description[locale]}</span>
                    ) : (
                      <span className="flex-1" />
                    )}
                    {first ? (
                      <span className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-semibold">
                        <span className="whitespace-nowrap text-muted">{first.size ?? ' '}</span>
                        <span className="ml-auto">
                          <Price price={first.price} locale={locale} />
                        </span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 sm:hidden">
          <ButtonLink href={menuHref} variant="secondary-light" className="w-full">
            {t.menuPreview.cta}
            <ArrowRightIcon />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
