'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { CloseIcon, MapPinIcon, MenuIcon } from '@/components/ui/icons';
import type { Locale } from '@/content/types';
import { LanguageSwitcher } from './LanguageSwitcher';

export interface HeaderNavProps {
  readonly locale: Locale;
  readonly hrefs: { readonly home: string; readonly menu: string; readonly card: string; readonly location: string };
  readonly directionsHref: string | null;
  readonly labels: {
    readonly menu: string;
    readonly location: string;
    readonly card: string;
    readonly directions: string;
    readonly mainNav: string;
    readonly openMenu: string;
    readonly closeMenu: string;
    readonly homeLink: string;
    readonly languageSwitcher: string;
    readonly opensInNewTab: string;
    readonly languages: Readonly<Record<Locale, string>>;
  };
}

const DESKTOP_QUERY = '(min-width: 768px)';

export function HeaderNav({ locale, hrefs, directionsHref, labels }: HeaderNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // Escape closes the panel and returns focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // The panel is mobile-only: close it when the viewport grows to desktop width.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const menuActive = pathname.startsWith(hrefs.menu);
  const links = [
    { href: hrefs.menu, label: labels.menu, current: menuActive },
    { href: hrefs.card, label: labels.card, current: pathname.startsWith(hrefs.card) },
    { href: hrefs.location, label: labels.location, current: false },
  ];

  return (
    <div className="container-page flex h-(--header-height) items-center justify-between gap-4">
      <Link
        href={hrefs.home}
        aria-label={labels.homeLink}
        className="inline-flex min-h-11 min-w-0 items-center rounded-md text-cream-50"
        onClick={close}
      >
        <Logo />
      </Link>

      {/* Desktop navigation */}
      <nav aria-label={labels.mainNav} className="hidden items-center gap-2 md:flex">
        <ul className="flex items-center gap-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={link.current ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] font-medium transition-colors ${
                  link.current ? 'text-caramel-300' : 'text-cream-100 hover:text-cream-50'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <span aria-hidden="true" className="mx-2 h-6 w-px bg-cream-50/20" />
        <LanguageSwitcher current={locale} label={labels.languageSwitcher} names={labels.languages} />
        {directionsHref ? (
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-caramel-400 px-5 text-sm font-semibold text-espresso-950 transition-colors hover:bg-caramel-300"
          >
            <MapPinIcon className="text-base" />
            {labels.directions}
            <span className="sr-only"> {labels.opensInNewTab}</span>
          </a>
        ) : null}
      </nav>

      {/* Mobile toggle */}
      <button
        ref={toggleRef}
        type="button"
        className="inline-flex size-[48px] shrink-0 items-center justify-center rounded-full text-[26px] text-cream-50 transition-colors hover:bg-cream-50/10 md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? labels.closeMenu : labels.openMenu}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mobile panel */}
      <nav
        id="mobile-nav"
        aria-label={labels.mainNav}
        hidden={!open}
        className="absolute inset-x-0 top-full border-t border-cream-50/10 bg-espresso-950 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] shadow-2xl md:hidden"
      >
        <div className="container-page flex flex-col gap-2 pt-4">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={link.current ? 'page' : undefined}
                  onClick={close}
                  className={`flex min-h-14 items-center border-b border-cream-50/10 font-display text-2xl ${
                    link.current ? 'text-caramel-300' : 'text-cream-50'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <LanguageSwitcher
              current={locale}
              label={labels.languageSwitcher}
              names={labels.languages}
              onNavigate={close}
            />
            {directionsHref ? (
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-caramel-400 px-6 font-semibold text-espresso-950"
              >
                <MapPinIcon />
                {labels.directions}
                <span className="sr-only"> {labels.opensInNewTab}</span>
              </a>
            ) : null}
          </div>
        </div>
      </nav>
    </div>
  );
}
