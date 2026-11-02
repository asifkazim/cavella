import type { ComponentType, SVGProps } from 'react';
import { BeanIcon, BoltIcon, TramIcon } from '@/components/ui/icons';
import type { Locale } from '@/content/types';
import { getDictionary } from '@/i18n';

const ICONS: readonly ComponentType<SVGProps<SVGSVGElement>>[] = [BoltIcon, BeanIcon, TramIcon];

export function Highlights({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <section aria-labelledby="highlights-title" className="py-20 sm:py-28">
      <div className="container-page">
        <h2 id="highlights-title" className="sr-only">
          {t.highlights.title}
        </h2>
        <ul className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          {t.highlights.items.map((item, index) => {
            const Icon = ICONS[index % ICONS.length] ?? BoltIcon;
            return (
              <li key={item.title} className="rounded-(--radius-card) bg-cream-50 p-7 shadow-[0_1px_0_rgba(43,26,18,0.06)] ring-1 ring-espresso-900/5">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-espresso-900 text-2xl text-caramel-300">
                  <Icon />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
