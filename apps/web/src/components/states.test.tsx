import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { placeholder } from '@/content/placeholder';
import type { MenuCategory } from '@/content/types';

/**
 * Empty, loading and placeholder states that the real content never shows today.
 * Content modules are swapped with vi.doMock, so each test re-imports components.
 */
afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/content/menu');
  vi.doUnmock('@/content/hours');
});

const name = { pl: 'Kawa', en: 'Coffee' };

describe('menu empty states', () => {
  it('shows a message for a category without items', async () => {
    const { MenuCategorySection } = await import('./menu/MenuCategorySection');
    const empty: MenuCategory = { id: 'coffee', name, items: [] };
    const html = renderToStaticMarkup(<MenuCategorySection category={empty} locale="pl" />);
    expect(html).toContain('W tej kategorii nie ma dziś żadnych pozycji.');
    expect(html).not.toContain('<ul');
  });

  it('shows a message and no category bar when the whole menu is empty', async () => {
    vi.doMock('@/content/menu', () => ({ menu: [] }));
    const { default: MenuPage } = await import('@/app/[locale]/menu/page');
    const html = renderToStaticMarkup(await MenuPage({ params: Promise.resolve({ locale: 'en' }) }));
    expect(html).toContain('The menu is being updated. Please check back soon.');
    expect(html).not.toContain('Menu categories');
  });

  it('shows a message when no items are featured on the homepage', async () => {
    vi.doMock('@/content/menu', () => ({
      menu: [{ id: 'coffee', name, items: [{ id: 'a', name, variants: [{ size: null, price: 9 }] }] }],
    }));
    const { MenuPreview } = await import('./home/MenuPreview');
    const html = renderToStaticMarkup(<MenuPreview locale="en" />);
    expect(html).toContain('Our recommended items will appear here soon.');
  });

  it('marks unavailable items and renders confirmed prices', async () => {
    const { MenuCategorySection } = await import('./menu/MenuCategorySection');
    const category: MenuCategory = {
      id: 'coffee',
      name,
      items: [{ id: 'a', name, unavailable: true, variants: [{ size: '250 ml', price: 12 }] }],
    };
    const html = renderToStaticMarkup(<MenuCategorySection category={category} locale="pl" />);
    expect(html).toContain('Chwilowo niedostępne');
    expect(html).toContain('12,00 zł');
  });
});

describe('opening-hours states', () => {
  it('prerenders a loading state instead of a build-time open/closed status', async () => {
    const { OpenStatus } = await import('./hours/OpenStatus');
    const html = renderToStaticMarkup(<OpenStatus locale="pl" />);
    expect(html).toContain('Sprawdzamy godziny otwarcia…');
    expect(html).not.toMatch(/Otwarte|Zamknięte/);
  });

  it('says hours are coming soon when there are no hours at all', async () => {
    vi.doMock('@/content/hours', () => ({
      openingHours: { weekly: placeholder('weekly opening hours'), exceptions: [] },
    }));
    const { OpenStatus } = await import('./hours/OpenStatus');
    const { LocationSection } = await import('./home/LocationSection');
    expect(renderToStaticMarkup(<OpenStatus locale="en" />)).toContain('Opening hours coming soon');
    const section = renderToStaticMarkup(<LocationSection locale="en" />);
    expect(section).toContain('Opening hours coming soon');
    expect(section).not.toContain('aria-label="Opening hours"');
  });

  it('lists upcoming exceptions with formatted dates', async () => {
    const { HoursTable } = await import('./hours/HoursTable');
    const weekly = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    const html = renderToStaticMarkup(
      <HoursTable
        locale="pl"
        weekly={weekly}
        exceptions={[{ date: '2026-12-24', intervals: [{ open: '07:00', close: '12:00' }] }]}
      />,
    );
    expect(html).toContain('Zmiany w godzinach otwarcia');
    expect(html).toContain('24 grudnia');
    expect(html).toContain('07:00–12:00');
  });
});
