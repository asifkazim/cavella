import { HeroArt } from '@/components/art/HeroArt';
import { OpenStatus } from '@/components/hours/OpenStatus';
import { ButtonLink } from '@/components/ui/Button';
import { ArrowRightIcon, MapPinIcon } from '@/components/ui/icons';
import { PlaceholderToken } from '@/components/ui/Placeholder';
import { openingHours } from '@/content/hours';
import { isPlaceholder } from '@/content/placeholder';
import type { Locale } from '@/content/types';
import { localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { getDirectionsLinks } from '@/lib/site';

/**
 * Above the fold on a 360×640 screen: brand (header), open/closed status, today's
 * hours, and the View menu + Get directions actions (PRD AC-W-01).
 */
export function Hero({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const directions = getDirectionsLinks();

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-espresso-900 text-cream-50">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(200,132,62,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(29,17,11,0.9),transparent_60%)]"
      />
      {/* Two columns only from lg: at tablet widths the headline needs the full width. */}
      <div className="container-page grid items-center gap-8 pt-8 pb-14 md:pt-16 md:pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:pt-24 lg:pb-24">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-caramel-300 uppercase sm:text-sm">{t.hero.eyebrow}</p>

          <div className="mt-4">
            <OpenStatus locale={locale} />
            {isPlaceholder(openingHours.weekly) ? (
              <p className="mt-1 pl-1 text-xs">
                <PlaceholderToken label={openingHours.weekly.label} tone="dark" />
              </p>
            ) : null}
          </div>

          <h1
            id="hero-title"
            className="mt-5 max-w-[15ch] font-display text-[2.35rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
          >
            {t.hero.title}
          </h1>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-cream-200 sm:mt-6 sm:text-lg">{t.hero.lead}</p>

          <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
            <ButtonLink href={localePath(locale, '/menu/')}>
              {t.hero.viewMenu}
              <ArrowRightIcon />
            </ButtonLink>
            <ButtonLink
              href={directions?.google ?? `${localePath(locale)}#location`}
              external={directions !== null}
              newTabLabel={t.a11y.opensInNewTab}
              variant="secondary-dark"
            >
              <MapPinIcon />
              {t.hero.getDirections}
            </ButtonLink>
          </div>
        </div>

        <HeroArt className="mx-auto w-full max-w-[22rem] lg:max-w-[30rem]" />
      </div>
    </section>
  );
}
