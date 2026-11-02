import { expect, test, type Page } from '@playwright/test';

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1024) < 768;

/** Opens the mobile panel when needed so main-nav links are visible. */
async function mainNav(page: Page, label = 'Nawigacja główna') {
  if (isMobile(page)) {
    await page.getByRole('button', { name: /menu nawigacji|navigation menu/i }).click();
  }
  return page.getByRole('navigation', { name: label }).filter({ visible: true });
}

test.describe('homepage', () => {
  test('root redirects to the Polish site', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/pl\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  });

  test('key information is above the fold on a 360×640 screen (AC-W-01)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.clock.setFixedTime(new Date('2026-11-02T09:00:00+01:00')); // Monday 09:00
    await page.goto('/pl/');

    // Header logo (the footer repeats the same link further down).
    await expect(page.getByRole('banner').getByRole('link', { name: 'Cavella — strona główna' })).toBeInViewport();
    await expect(page.getByText('Otwarte')).toBeInViewport();
    await expect(page.getByText('Dziś: 06:30–18:00')).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Zobacz menu' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('link', { name: /Wyznacz trasę/ }).first()).toBeInViewport({ ratio: 1 });
  });

  test('open-now status follows Europe/Warsaw time (AC-W-02)', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-02T17:59:00+01:00'));
    await page.goto('/en/');
    await expect(page.getByText('Closing soon')).toBeVisible();
    await expect(page.getByText('until 18:00')).toBeVisible();

    await page.clock.setFixedTime(new Date('2026-11-02T18:00:00+01:00'));
    await page.reload();
    await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('opens tomorrow at 06:30')).toBeVisible();
  });

  test('directions open Google Maps with coordinates (AC-W-04)', async ({ page }) => {
    await page.goto('/pl/');
    const link = page.getByRole('link', { name: /Wyznacz trasę/ }).last();
    await expect(link).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('unconfirmed content is visibly marked as a placeholder', async ({ page }) => {
    await page.goto('/pl/');
    await expect(page.locator('[data-placeholder="street address"]').first()).toHaveText(
      '[PLACEHOLDER: street address]',
    );
  });
});

test.describe('navigation', () => {
  test('main navigation reaches the menu and marks it current', async ({ page }) => {
    await page.goto('/pl/');
    const nav = await mainNav(page);
    await nav.getByRole('link', { name: 'Menu', exact: true }).click();
    await expect(page).toHaveURL(/\/pl\/menu\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible();
    if (!isMobile(page)) {
      await expect(nav.getByRole('link', { name: 'Menu', exact: true })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('mobile menu toggles, closes on Escape and returns focus', async ({ page }) => {
    test.skip(!isMobile(page), 'mobile-only control');
    await page.goto('/pl/');
    const toggle = page.getByRole('button', { name: 'Otwórz menu nawigacji' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();

    const closeButton = page.getByRole('button', { name: 'Zamknij menu nawigacji' });
    await expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-nav')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-nav')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Otwórz menu nawigacji' })).toBeFocused();
  });

  test('language switch keeps the current page (FR-W-08)', async ({ page }) => {
    await page.goto('/pl/menu/');
    if (isMobile(page)) await page.getByRole('button', { name: 'Otwórz menu nawigacji' }).click();
    await page.getByRole('link', { name: 'English' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/en\/menu\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 2, name: 'Coffee' })).toBeVisible();
  });

  test('pages declare hreflang alternates', async ({ page }) => {
    await page.goto('/pl/menu/');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/menu\/$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/pl\/menu\/$/);
  });

  test('unknown pages show the branded 404', async ({ page }) => {
    const response = await page.goto('/pl/does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Nie znaleziono strony' })).toBeVisible();
  });
});

test.describe('menu page', () => {
  test('category navigation jumps to a category', async ({ page }) => {
    await page.goto('/en/menu/');
    const categories = page.getByRole('navigation', { name: 'Menu categories' });
    await categories.getByRole('link', { name: 'Drinks' }).click();
    await expect(page).toHaveURL(/#drinks$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Drinks' })).toBeInViewport();
    await expect(categories.getByRole('link', { name: 'Drinks' })).toHaveAttribute('aria-current', 'location');
  });

  test('every menu item shows a price or a price placeholder (AC-W-03)', async ({ page }) => {
    await page.goto('/pl/menu/');
    const items = page.locator('section[id] > ul > li');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('dd').first()).toHaveText(/(\d+,\d{2}\s?zł)|\[PLACEHOLDER: price\]/);
    }
  });
});

test.describe('privacy (AC-W-08)', () => {
  test('public pages set no cookies and call no third-party hosts', async ({ page, context }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== 'localhost') external.push(url.href);
    });
    for (const path of ['/pl/', '/en/menu/']) {
      await page.goto(path);
      await page.waitForLoadState('load');
    }
    expect(external).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});
