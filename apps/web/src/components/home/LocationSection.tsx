import { MapArt } from '@/components/art/MapArt';
import { HoursTable } from '@/components/hours/HoursTable';
import { ButtonLink } from '@/components/ui/Button';
import { ClockIcon, MapPinIcon, TramIcon } from '@/components/ui/icons';
import { EditableText, ExampleNote, PlaceholderToken } from '@/components/ui/Placeholder';
import { openingHours } from '@/content/hours';
import { location } from '@/content/location';
import { isPlaceholder, resolveEditable } from '@/content/placeholder';
import type { Locale } from '@/content/types';
import { getDictionary, interpolate } from '@/i18n';
import { getDirectionsLinks } from '@/lib/site';

/** Location and opening hours (FR-W-03, FR-W-07). No third-party map embed (NFR-C-03). */
export function LocationSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const directions = getDirectionsLinks();
  const weekly = resolveEditable(openingHours.weekly);
  const wayfinding = resolveEditable(location.wayfinding);

  return (
    <section id="location" aria-labelledby="location-title" className="py-20 sm:py-28">
      <div className="container-page">
        <h2 id="location-title" className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t.location.title}
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t.location.lead}</p>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Where */}
          <div className="overflow-hidden rounded-(--radius-card) bg-cream-50 ring-1 ring-espresso-900/5">
            <figure>
              <MapArt label={t.location.mapAlt} className="aspect-[20/13] w-full" />
              <figcaption className="px-6 pt-3 text-xs">
                <PlaceholderToken label="static map image" />
              </figcaption>
            </figure>

            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex gap-4">
                <MapPinIcon className="mt-0.5 shrink-0 text-2xl text-caramel-700" />
                <div>
                  <h3 className="text-sm font-semibold tracking-wider text-muted uppercase">{t.location.addressLabel}</h3>
                  <address className="mt-1 text-lg not-italic">
                    <EditableText value={location.streetAddress} />
                    <br />
                    <EditableText value={location.postalCode} /> <EditableText value={location.city} />
                  </address>
                </div>
              </div>

              <div className="flex gap-4">
                <TramIcon className="mt-0.5 shrink-0 text-2xl text-caramel-700" />
                <div>
                  <h3 className="text-sm font-semibold tracking-wider text-muted uppercase">{t.location.tramLabel}</h3>
                  <p className="mt-1 text-lg">
                    <EditableText value={location.tramStop} />
                  </p>
                  <p className="mt-1 text-muted">
                    {isPlaceholder(location.tramLines) ? (
                      <PlaceholderToken label={location.tramLines.label} />
                    ) : (
                      interpolate(t.location.tramLines, { lines: location.tramLines })
                    )}
                  </p>
                </div>
              </div>

              {wayfinding ? (
                <div>
                  <p className="leading-relaxed">{wayfinding[locale]}</p>
                  {isPlaceholder(location.wayfinding) ? (
                    <ExampleNote label={location.wayfinding.label} note={t.placeholder.note} />
                  ) : null}
                </div>
              ) : null}

              {directions ? (
                <div>
                  <div className="flex flex-wrap gap-3">
                    <ButtonLink href={directions.google} external newTabLabel={t.a11y.opensInNewTab}>
                      <MapPinIcon />
                      {t.location.googleMaps}
                    </ButtonLink>
                    <ButtonLink
                      href={directions.apple}
                      external
                      newTabLabel={t.a11y.opensInNewTab}
                      variant="secondary-light"
                    >
                      {t.location.appleMaps}
                    </ButtonLink>
                  </div>
                  {directions.isExample && isPlaceholder(location.geo) ? (
                    <ExampleNote label={location.geo.label} note={t.placeholder.note} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* When */}
          <div className="rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5 sm:p-8">
            <div className="flex items-center gap-3">
              <ClockIcon className="text-2xl text-caramel-700" />
              <h3 className="font-display text-2xl font-semibold">{t.location.hoursLabel}</h3>
            </div>
            <div className="mt-6">
              {weekly ? (
                <HoursTable locale={locale} weekly={weekly} exceptions={openingHours.exceptions} />
              ) : (
                <p className="rounded-2xl border border-dashed border-espresso-900/20 p-6 text-center text-muted">
                  {t.status.hoursUnavailable}
                </p>
              )}
              {isPlaceholder(openingHours.weekly) ? (
                <ExampleNote label={openingHours.weekly.label} note={t.placeholder.note} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
