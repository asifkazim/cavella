import type { Locale, MenuCategory } from '@/content/types';
import { getDictionary } from '@/i18n';
import { Price } from './Price';

export function MenuCategorySection({ category, locale }: { category: MenuCategory; locale: Locale }) {
  const t = getDictionary(locale);
  const headingId = `${category.id}-title`;

  return (
    <section id={category.id} aria-labelledby={headingId} className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <h2 id={headingId} className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {category.name[locale]}
        </h2>
        {category.intro ? <p className="mt-2 text-lg text-muted">{category.intro[locale]}</p> : null}
      </div>

      {category.items.length === 0 ? (
        <p className="mt-8 rounded-(--radius-card) border border-dashed border-espresso-900/20 p-8 text-center text-muted">
          {t.menuPage.emptyCategory}
        </p>
      ) : (
        <ul className="mt-8 grid gap-x-12 md:grid-cols-2">
          {category.items.map((item) => (
            <li
              key={item.id}
              className={`flex flex-col gap-3 border-b border-espresso-900/10 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${
                item.unavailable ? 'opacity-70' : ''
              }`}
            >
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold sm:text-2xl">{item.name[locale]}</h3>
                {item.description ? <p className="mt-1 leading-relaxed text-muted">{item.description[locale]}</p> : null}
                {item.tags?.length || item.unavailable ? (
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    {item.unavailable ? (
                      <li className="rounded-full bg-espresso-900 px-2.5 py-1 text-cream-50">{t.menuPage.unavailable}</li>
                    ) : null}
                    {item.tags?.map((tag) => (
                      <li key={tag} className="rounded-full bg-cream-200 px-2.5 py-1 text-espresso-800">
                        {t.menuPage.tags[tag]}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <dl className="shrink-0 space-y-1.5 text-[0.95rem] sm:text-right">
                {item.variants.map((variant, index) => (
                  <div key={`${variant.size ?? 'one'}-${index}`} className="flex items-baseline justify-between gap-4 sm:justify-end">
                    <dt className="text-muted">{variant.size ?? <span className="sr-only">{item.name[locale]}</span>}</dt>
                    <dd className="font-semibold">
                      <Price price={variant.price} locale={locale} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
