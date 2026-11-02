import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FakeApi, STAFF_EMAIL, STAFF_PASSWORD } from './support/fake-api';
import { installFakeCamera, showQrToCamera } from './support/fake-camera';

/** Staff journeys (PRD J4–J7) against the fake API, with a fake camera. */

let api: FakeApi;

test.beforeEach(async ({ page }) => {
  api = new FakeApi();
  await api.install(page);
});

async function signIn(page: Page) {
  await page.goto('/pl/staff/');
  await page.getByLabel('E-mail').fill(STAFF_EMAIL);
  await page.getByLabel('Hasło').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page.getByRole('heading', { name: 'Zeskanuj kartę klienta' })).toBeVisible();
}

async function typeCode(page: Page, token: string) {
  await page.getByLabel('Kod karty (pod kodem QR klienta)').fill(token.match(/.{1,4}/g)!.join(' '));
  await page.getByRole('button', { name: 'Znajdź kartę' }).click();
  await expect(page.getByRole('heading', { name: 'Karta klienta' })).toBeVisible();
}

test('the staff console requires signing in', async ({ page }) => {
  await page.goto('/pl/staff/');
  await expect(page.getByRole('heading', { name: 'Logowanie obsługi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Zeskanuj kartę klienta' })).toHaveCount(0);

  await page.getByLabel('E-mail').fill(STAFF_EMAIL);
  await page.getByLabel('Hasło').fill('wrong password');
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Nieprawidłowy e-mail lub hasło.' })).toBeVisible();

  await page.getByLabel('Hasło').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page.getByRole('heading', { name: 'Zeskanuj kartę klienta' })).toBeVisible();
});

test('scan a card with the camera, see its balance, and add confirmed stamps', async ({ page, baseURL }) => {
  await installFakeCamera(page);
  const card = api.addCard({ stampProgress: 4 });
  await signIn(page);

  await page.getByRole('button', { name: 'Włącz aparat' }).click();
  await showQrToCamera(page, `${baseURL}/c#${card.token}`);

  await expect(page.getByRole('heading', { name: 'Karta klienta' })).toBeVisible({ timeout: 15_000 });
  const balance = page.getByTestId('staff-balance');
  await expect(balance).toContainText('4');

  await page.getByRole('button', { name: 'Więcej' }).click(); // 2 coffees
  await page.getByRole('button', { name: 'Dodaj pieczątki' }).click();
  await expect(page.getByRole('button', { name: 'Potwierdź: +2' })).toBeVisible();
  expect(api.requestsTo('POST', /\/stamps$/)).toHaveLength(0); // nothing is sent before confirming

  await page.getByRole('button', { name: 'Potwierdź: +2' }).click();
  const success = page.getByTestId('action-success');
  await expect(success).toContainText('Dodano pieczątki: 2.');
  await expect(success).toContainText('Klient zdobył kawę gratis!');
  expect(card.stampProgress).toBe(0);
  expect(card.rewardsAvailable).toBe(1);
});

test('a double tap on confirm sends exactly one request', async ({ page }) => {
  const card = api.addCard();
  await signIn(page);
  await typeCode(page, card.token);

  await page.getByRole('button', { name: 'Dodaj pieczątki' }).click();
  await page.getByRole('button', { name: 'Potwierdź: +1' }).dblclick();

  await expect(page.getByTestId('action-success')).toBeVisible();
  expect(api.requestsTo('POST', /\/stamps$/)).toHaveLength(1);
  expect(card.stampProgress).toBe(1);
});

test('manual code entry, then a confirmed reward redemption', async ({ page }) => {
  const card = api.addCard({ stampProgress: 2, rewardsAvailable: 1 });
  await signIn(page);
  await typeCode(page, card.token);

  await page.getByRole('button', { name: 'Wydaj kawę gratis' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Wydać 1 kawę gratis?' })).toBeVisible();
  await page.getByRole('button', { name: 'Tak, wydaj' }).click();

  await expect(page.getByTestId('action-success')).toContainText('Kawa gratis wydana.');
  expect(card.rewardsAvailable).toBe(0);
  await expect(page.getByRole('button', { name: 'Wydaj kawę gratis' })).toBeDisabled();
});

test('cancelling a confirmation sends nothing', async ({ page }) => {
  const card = api.addCard({ rewardsAvailable: 1 });
  await signIn(page);
  await typeCode(page, card.token);

  await page.getByRole('button', { name: 'Wydaj kawę gratis' }).click();
  await page.getByRole('button', { name: 'Anuluj' }).click();

  expect(api.requestsTo('POST', /\/redemptions$/)).toHaveLength(0);
  expect(card.rewardsAvailable).toBe(1);
});

test('a lost connection is reported and the retry reuses the same idempotency key', async ({ page }) => {
  const card = api.addCard();
  await signIn(page);
  await typeCode(page, card.token);
  api.fail('POST', /\/stamps$/, 'network', 1);

  await page.getByRole('button', { name: 'Dodaj pieczątki' }).click();
  await page.getByRole('button', { name: 'Potwierdź: +1' }).click();
  await expect(page.getByTestId('action-error')).toContainText('Brak połączenia — nic nie zostało zapisane');

  await page.getByTestId('action-error').getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.getByTestId('action-success')).toContainText('Dodano pieczątki: 1.');

  const attempts = api.requestsTo('POST', /\/stamps$/);
  expect(attempts).toHaveLength(2);
  expect(attempts[0]!.headers['idempotency-key']).toBe(attempts[1]!.headers['idempotency-key']);
  expect(card.stampProgress).toBe(1);
});

test('a business rejection is shown clearly and cannot be blindly resent', async ({ page }) => {
  const card = api.addCard({ rewardsAvailable: 1 });
  await signIn(page);
  await typeCode(page, card.token);
  card.rewardsAvailable = 0; // redeemed elsewhere after the scan (PRD E-03)

  await page.getByRole('button', { name: 'Wydaj kawę gratis' }).click();
  await page.getByRole('button', { name: 'Tak, wydaj' }).click();

  const error = page.getByTestId('action-error');
  await expect(error).toContainText('Klient nie ma kawy gratis do odebrania.');
  await expect(error.getByRole('button', { name: 'Spróbuj ponownie' })).toHaveCount(0);
});

test('an expired session returns to the sign-in form', async ({ page }) => {
  const card = api.addCard();
  await signIn(page);
  await typeCode(page, card.token);
  api.signedIn = false;

  await page.getByRole('button', { name: 'Dodaj pieczątki' }).click();
  await page.getByRole('button', { name: 'Potwierdź: +1' }).click();

  await expect(page.getByRole('heading', { name: 'Logowanie obsługi' })).toBeVisible();
  await expect(page.getByText('Sesja wygasła. Zaloguj się ponownie.')).toBeVisible();
});

test('invalid codes are caught before any request, unknown cards are reported', async ({ page }) => {
  await signIn(page);

  await page.getByLabel('Kod karty (pod kodem QR klienta)').fill('too short');
  await page.getByRole('button', { name: 'Znajdź kartę' }).click();
  await expect(page.getByText('Kod karty ma 22 znaki')).toBeVisible();
  expect(api.requestsTo('POST', /\/lookup$/)).toHaveLength(0);

  await page.getByLabel('Kod karty (pod kodem QR klienta)').fill('AAECAwQFBgcICQoLDA0ODw');
  await page.getByRole('button', { name: 'Znajdź kartę' }).click();
  await expect(page.getByTestId('lookup-error')).toContainText('Nie znaleziono karty.');
});

test('a denied camera explains the manual fallback', async ({ page }) => {
  await installFakeCamera(page, 'denied');
  await signIn(page);

  await page.getByRole('button', { name: 'Włącz aparat' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Brak dostępu do aparatu' })).toBeVisible();
  await expect(page.getByLabel('Kod karty (pod kodem QR klienta)')).toBeVisible();
});

test('a QR code from another site is ignored by the scanner', async ({ page }) => {
  await installFakeCamera(page);
  const card = api.addCard();
  await signIn(page);

  await page.getByRole('button', { name: 'Włącz aparat' }).click();
  await showQrToCamera(page, `https://evil.example/c#${card.token}`);

  await expect(page.getByText('To nie jest karta Cavella.')).toBeVisible({ timeout: 15_000 });
  expect(api.requestsTo('POST', /\/lookup$/)).toHaveLength(0);
});

test('staff screens have no serious accessibility violations', async ({ page }) => {
  await page.goto('/pl/staff/');
  await expect(page.getByRole('heading', { name: 'Logowanie obsługi' })).toBeVisible();
  const login = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();

  const card = api.addCard({ stampProgress: 3, rewardsAvailable: 1 });
  await page.getByLabel('E-mail').fill(STAFF_EMAIL);
  await page.getByLabel('Hasło').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await typeCode(page, card.token);
  const panel = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();

  const serious = [...login.violations, ...panel.violations].filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
