import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { qrMatrix } from '../src/lib/loyalty/qr';
import { FakeApi, newToken } from './support/fake-api';

/** Customer card journeys (PRD J2, J3, J8; ADR-002) against the fake API. */

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = new FakeApi();
  await api.install(page);
});

async function storedToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('cavella.card');
    return raw ? (JSON.parse(raw) as { token: string }).token : null;
  });
}

function preloadCard(page: Page, token: string, balance?: { stampProgress: number; rewardsAvailable: number }) {
  return page.addInitScript(
    ([t, b]) => {
      if (!localStorage.getItem('cavella.card')) {
        localStorage.setItem('cavella.card', JSON.stringify({
          token: t,
          balance: b ? { ...b, stampsPerReward: 6 } : null,
          balanceAt: b ? new Date().toISOString() : null,
        }));
      }
    },
    [token, balance] as const,
  );
}

test('a customer gets a card without logging in and sees a scannable QR code', async ({ page, baseURL }) => {
  await page.goto('/pl/card/');
  await page.getByRole('button', { name: 'Załóż kartę' }).click();

  const qr = page.getByRole('img', { name: 'Kod QR Twojej karty lojalnościowej' });
  await expect(qr).toBeVisible();
  await expect(page.getByTestId('stamp-count')).toHaveText('0 z 6 pieczątek');
  await expect(page.getByText('Jeszcze 6 do kawy gratis')).toBeVisible();

  const token = await storedToken(page);
  expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  // The QR encodes exactly the card link (origin + /c#token).
  const expectedPath = qrMatrix(`${baseURL}/c#${token}`).path;
  await expect(qr.locator('path')).toHaveAttribute('d', expectedPath);
  // The card code under the QR is the same token, grouped for typing.
  await expect(page.getByTestId('card-code')).toHaveText(token!.match(/.{1,4}/g)!.join(' '));
});

test('the card credential never appears in URLs: only in the X-Card-Token header', async ({ page }) => {
  await page.goto('/pl/card/');
  await page.getByRole('button', { name: 'Załóż kartę' }).click();
  await expect(page.getByTestId('stamp-count')).toBeVisible();
  await page.getByRole('button', { name: 'Odśwież' }).click();
  await expect.poll(() => api.requestsTo('GET', /\/cards\/self$/).length).toBeGreaterThan(0);

  const token = (await storedToken(page))!;
  expect(page.url()).not.toContain(token);
  expect(api.requests.every((r) => !r.url.includes(token))).toBe(true);
  expect(api.requestsTo('GET', /\/cards\/self$/).every((r) => r.headers['x-card-token'] === token)).toBe(true);
});

test('a returning customer sees current stamps and a reward ready to redeem', async ({ page }) => {
  const card = api.addCard({ stampProgress: 4, rewardsAvailable: 1 });
  await preloadCard(page, card.token);

  await page.goto('/en/card/');

  await expect(page.getByTestId('stamp-count')).toHaveText('4 of 6 stamps');
  await expect(page.getByText('2 more to a free coffee')).toBeVisible();
  await expect(page.getByTestId('rewards-ready')).toContainText('Free coffees ready: 1');
});

test('opening a card link stores the card and removes the token from the address bar', async ({ page }) => {
  const card = api.addCard({ stampProgress: 2 });

  await page.goto(`/c#${card.token}`);

  await expect(page).toHaveURL(/\/(pl|en)\/card\/$/);
  await expect(page.getByTestId('stamp-count')).toContainText('2');
  expect(await storedToken(page)).toBe(card.token);
  expect(await page.evaluate(() => window.location.href)).not.toContain(card.token);
});

test('a different card from a link asks before replacing the stored one', async ({ page }) => {
  const current = api.addCard();
  const scanned = api.addCard({ stampProgress: 5 });
  await preloadCard(page, current.token);

  await page.goto(`/c#${scanned.token}`);
  await expect(page.getByRole('alertdialog', { name: /inna karta|different card/ })).toBeVisible();
  expect(await storedToken(page)).toBe(current.token);

  await page.getByRole('button', { name: /Przełącz|Switch/ }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  expect(await storedToken(page)).toBe(scanned.token);
});

test('offline: the last known balance and the QR stay usable, and retry recovers', async ({ page }) => {
  const card = api.addCard({ stampProgress: 3 });
  await preloadCard(page, card.token, { stampProgress: 3, rewardsAvailable: 0 });
  api.fail('GET', /\/cards\/self$/, 'network', 1);

  await page.goto('/pl/card/');

  await expect(page.getByRole('status').filter({ hasText: 'Brak połączenia' })).toBeVisible();
  await expect(page.getByTestId('stamp-count')).toHaveText('3 z 6 pieczątek');
  await expect(page.getByRole('img', { name: 'Kod QR Twojej karty lojalnościowej' })).toBeVisible();

  card.stampProgress = 4; // a stamp was added at the counter meanwhile
  await page.getByRole('status').getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.getByTestId('stamp-count')).toHaveText('4 z 6 pieczątek');
  await expect(page.getByText('Brak połączenia')).toBeHidden();
});

test('card creation failure is explained and can be retried', async ({ page }) => {
  api.fail('POST', /\/api\/v1\/cards$/, 'network', 1);
  await page.goto('/pl/card/');

  await page.getByRole('button', { name: 'Załóż kartę' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Nie udało się utworzyć karty' })).toBeVisible();

  await page.getByRole('button', { name: 'Załóż kartę' }).click();
  await expect(page.getByTestId('stamp-count')).toHaveText('0 z 6 pieczątek');
});

test('save options: card image download, copyable link with a warning, and recovery help', async ({ page, context, baseURL, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-specific');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Force the download path (the share sheet cannot be automated).
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined }));
  const card = api.addCard();
  await preloadCard(page, card.token);
  await page.goto('/pl/card/');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Zapisz obraz karty' }).click();
  expect((await download).suggestedFilename()).toBe('karta-cavella.png');

  await page.getByRole('button', { name: 'Kopiuj link do karty' }).click();
  await expect(page.getByText('Link skopiowany.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/c#${card.token}`);
  await expect(page.getByText('Kto ma ten link lub kod QR, może korzystać z Twojej karty')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Jak odzyskać kartę?' })).toBeVisible();
  await expect(page.getByText('Bez kopii karty nie da się odzyskać')).toBeVisible();
});

test('an unknown card is reported and can be removed from the device', async ({ page }) => {
  await preloadCard(page, newToken());
  await page.goto('/pl/card/');

  await expect(page.getByRole('heading', { name: 'Nie znaleźliśmy tej karty' })).toBeVisible();
  await page.getByRole('button', { name: 'Usuń kartę z tego urządzenia' }).click();
  await expect(page.getByRole('button', { name: 'Załóż kartę' })).toBeVisible();
  expect(await storedToken(page)).toBeNull();
});

test('the card page has no serious accessibility violations', async ({ page }) => {
  const card = api.addCard({ stampProgress: 2, rewardsAvailable: 1 });
  await preloadCard(page, card.token);
  await page.goto('/pl/card/');
  await expect(page.getByTestId('stamp-count')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});
