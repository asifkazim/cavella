import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { HoursSummary } from '@/components/hours/HoursSummary';
import { FacebookIcon, InstagramIcon, MailIcon, PhoneIcon, TiktokIcon } from '@/components/ui/icons';
import { EditableText, PlaceholderToken } from '@/components/ui/Placeholder';
import { business } from '@/content/business';
import { openingHours } from '@/content/hours';
import { location } from '@/content/location';
import { isPlaceholder, resolveEditable } from '@/content/placeholder';
import type { Locale, SocialNetwork } from '@/content/types';
import { localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n';

const SOCIAL_ICON: Record<SocialNetwork, (props: { className?: string }) => ReactNode> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TiktokIcon,
};

const SOCIAL_NAME: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

function FooterHeading({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mb-4 text-xs font-semibold tracking-[0.2em] text-caramel-300 uppercase">{children}</h2>;
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const weekly = resolveEditable(openingHours.weekly);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-espresso-950 pb-[max(2rem,env(safe-area-inset-bottom,0px))] text-cream-200">
      <div className="container-page grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link
            href={localePath(locale)}
            aria-label={t.a11y.homeLink}
            className="inline-flex min-h-11 items-center rounded-md text-cream-50"
          >
            <Logo />
          </Link>
          <p className="mt-4 max-w-xs leading-relaxed">{t.footer.tagline}</p>
        </div>

        <section aria-labelledby="footer-visit">
          <FooterHeading id="footer-visit">{t.footer.visit}</FooterHeading>
          <address className="space-y-1 leading-relaxed not-italic">
            <p>
              <EditableText value={location.streetAddress} tone="dark" />
            </p>
            <p>
              <EditableText value={location.postalCode} tone="dark" /> <EditableText value={location.city} tone="dark" />
            </p>
          </address>
          <div className="mt-5 text-sm">
            {weekly ? <HoursSummary weekly={weekly} t={t} /> : <p>{t.status.hoursUnavailable}</p>}
            {isPlaceholder(openingHours.weekly) ? (
              <p className="mt-2">
                <PlaceholderToken label={openingHours.weekly.label} tone="dark" />
              </p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="footer-follow">
          <FooterHeading id="footer-follow">{t.footer.follow}</FooterHeading>
          <ul className="space-y-3">
            {business.social.map(({ network, url }) => {
              const Icon = SOCIAL_ICON[network];
              return (
                <li key={network} className="flex items-center gap-3">
                  <Icon className="shrink-0 text-xl text-cream-50" />
                  {isPlaceholder(url) ? (
                    <span>
                      {SOCIAL_NAME[network]} <PlaceholderToken label={url.label} tone="dark" />
                    </span>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-4 hover:text-cream-50 hover:underline"
                    >
                      {SOCIAL_NAME[network]}
                      <span className="sr-only"> {t.a11y.opensInNewTab}</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="footer-contact">
          <FooterHeading id="footer-contact">{t.footer.contact}</FooterHeading>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <MailIcon className="shrink-0 text-xl text-cream-50" />
              {isPlaceholder(business.email) ? (
                <PlaceholderToken label={business.email.label} tone="dark" />
              ) : (
                <a href={`mailto:${business.email}`} className="underline-offset-4 hover:text-cream-50 hover:underline">
                  {business.email}
                </a>
              )}
            </li>
            <li className="flex items-center gap-3">
              <PhoneIcon className="shrink-0 text-xl text-cream-50" />
              {isPlaceholder(business.phone) ? (
                <PlaceholderToken label={business.phone.label} tone="dark" />
              ) : (
                <a href={`tel:${business.phone.replace(/\s+/g, '')}`} className="underline-offset-4 hover:text-cream-50 hover:underline">
                  {business.phone}
                </a>
              )}
            </li>
          </ul>
        </section>
      </div>

      <div className="container-page flex flex-col gap-3 border-t border-cream-50/10 pt-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {business.name}. {t.footer.rights}
        </p>
        <p>
          <span className="sr-only">{t.footer.company}: </span>
          <EditableText value={business.legalName} tone="dark" /> · {t.footer.taxId}{' '}
          <EditableText value={business.taxId} tone="dark" />
        </p>
      </div>
    </footer>
  );
}
