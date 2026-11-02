import { ButtonLink } from '@/components/ui/Button';
import { ArrowRightIcon } from '@/components/ui/icons';
import type { Locale } from '@/content/types';
import { localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n';

/** Loyalty programme explainer on the homepage (PRD FR-W-09). */
export function LoyaltyTeaser({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).loyaltyTeaser;
  return (
    <section aria-labelledby="loyalty-teaser-title" className="bg-espresso-900 py-16 text-cream-50 sm:py-20">
      <div className="container-page flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2 id="loyalty-teaser-title" className="font-display text-4xl font-semibold tracking-tight">
            {t.title}
          </h2>
          <p className="mt-3 text-lg text-cream-200">{t.text}</p>
        </div>
        <div>
          <ButtonLink href={localePath(locale, '/card/')}>
            {t.cta}
            <ArrowRightIcon />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
