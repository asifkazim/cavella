import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** AC-W-07: no serious or critical axe violations (WCAG 2.0/2.1/2.2 A + AA rules). */
const PAGES = ['/pl/', '/en/', '/pl/menu/', '/en/menu/', '/pl/missing-page/'];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    // Wait for client-only content (open-now status) to settle.
    await page.waitForLoadState('load');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
    ).toEqual([]);
  });
}

test('no serious accessibility violations with the mobile menu open', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1024) >= 768, 'mobile-only control');
  await page.goto('/pl/');
  await page.getByRole('button', { name: 'Otwórz menu nawigacji' }).click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
