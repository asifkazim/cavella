import { expect, test } from '@playwright/test';

/** Regressions found in the UI/UX review. Each test pins one fixed issue. */

test.describe('responsive layout', () => {
  test('tablet hero gives the headline the full width (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/pl/');
    const h1 = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(h1?.width ?? 0).toBeGreaterThan(768 * 0.6);
  });

  test('a time range never splits across lines at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.clock.setFixedTime(new Date('2026-11-02T09:00:00+01:00')); // Monday is "today"
    await page.goto('/pl/');
    const hours = page.getByRole('definition').filter({ hasText: '06:30–18:00' });
    const count = await hours.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const range = hours.nth(i).locator('span.whitespace-nowrap').first();
      const box = await range.boundingBox();
      const lineHeight = await range.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
      expect(box?.height ?? 0).toBeLessThanOrEqual(lineHeight + 1);
    }
  });

  for (const path of ['/pl/', '/en/menu/']) {
    test(`no horizontal scrolling with 200% text at 320px on ${path} (NFR-A-04)`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      // The logotype must stay on one line.
      const logo = await page.getByRole('banner').getByText('Cavella', { exact: true }).boundingBox();
      expect(logo?.height ?? 99).toBeLessThan(40);
    });
  }
});

test.describe('touch targets (NFR-A-02)', () => {
  for (const path of ['/pl/', '/pl/menu/']) {
    test(`visible links and buttons are at least 44×44 on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('a, button')]
          .filter((el) => {
            const box = el.getBoundingClientRect();
            const hiddenSkipLink = el.classList.contains('sr-only');
            return !hiddenSkipLink && box.width > 0 && (box.width < 44 || box.height < 44);
          })
          .map((el) => `${el.textContent?.trim() || el.getAttribute('aria-label')} ${el.offsetWidth}x${el.offsetHeight}`),
      );
      expect(small).toEqual([]);
    });
  }
});

test.describe('menu scroll-spy', () => {
  test('highlights the category being read on a tall phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en/menu/');
    // Put the Sweets heading in the upper third, as a reader scrolling down would.
    await page.evaluate(() => {
      const top = document.getElementById('sweets')!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top - 220);
    });
    const nav = page.getByRole('navigation', { name: 'Menu categories' });
    await expect(nav.getByRole('link', { name: 'Sweets' })).toHaveAttribute('aria-current', 'location');
  });
});

test.describe('keyboard', () => {
  test('skip link is the first tab stop and moves focus to the main content', async ({ page }) => {
    await page.goto('/pl/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Przejdź do treści' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });
});
