import type { Locale } from '@/content/types';
import { localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { getDirectionsLinks } from '@/lib/site';
import { HeaderNav } from './HeaderNav';

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <header className="sticky top-0 z-40 border-b border-cream-50/5 bg-espresso-950 pt-[env(safe-area-inset-top,0px)] text-cream-50">
      <div className="relative">
        <HeaderNav
          locale={locale}
          hrefs={{
            home: localePath(locale),
            menu: localePath(locale, '/menu/'),
            card: localePath(locale, '/card/'),
            location: `${localePath(locale)}#location`,
          }}
          directionsHref={getDirectionsLinks()?.google ?? null}
          labels={{
            menu: t.nav.menu,
            location: t.nav.location,
            card: t.nav.card,
            directions: t.nav.directions,
            mainNav: t.a11y.mainNav,
            openMenu: t.a11y.openMenu,
            closeMenu: t.a11y.closeMenu,
            homeLink: t.a11y.homeLink,
            languageSwitcher: t.a11y.languageSwitcher,
            opensInNewTab: t.a11y.opensInNewTab,
            languages: t.language,
          }}
        />
      </div>
    </header>
  );
}
