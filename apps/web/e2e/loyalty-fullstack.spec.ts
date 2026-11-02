import { expect, test } from '@playwright/test';
import { installFakeCamera, showQrToCamera } from './support/fake-camera';

/**
 * End-to-end against the REAL API (Spring Boot + PostgreSQL), not the fake. Opt-in because it
 * needs the backend running at NEXT_PUBLIC_API_BASE_URL (default http://localhost:8080) with the
 * `dev` profile, CORS allowing this site's origin, and a staff account:
 *
 *   E2E_FULLSTACK=1 E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… npx playwright test loyalty-fullstack
 */
test.skip(!process.env.E2E_FULLSTACK, 'set E2E_FULLSTACK=1 with a running API to enable');

test('customer card → staff scan, stamp and redeem → customer sees the update', async ({ browser, baseURL }) => {
  const email = process.env.E2E_STAFF_EMAIL ?? '';
  const password = process.env.E2E_STAFF_PASSWORD ?? '';
  expect(email && password, 'E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD are required').toBeTruthy();

  // Customer: create a card on their phone.
  const customer = await (await browser.newContext()).newPage();
  await customer.goto('/en/card/');
  await customer.getByRole('button', { name: 'Get my card' }).click();
  await expect(customer.getByTestId('stamp-count')).toHaveText('0 of 6 stamps');
  const token = await customer.evaluate(() => (JSON.parse(localStorage.getItem('cavella.card')!) as { token: string }).token);

  // Staff: sign in on the kiosk phone and scan the customer's QR code with the camera.
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await installFakeCamera(staff);
  await staff.goto('/en/staff/');
  await staff.getByLabel('Email').fill(email);
  await staff.getByLabel('Password').fill(password);
  await staff.getByRole('button', { name: 'Sign in' }).click();
  await staff.getByRole('button', { name: 'Start camera' }).click();
  await showQrToCamera(staff, `${baseURL}/c#${token}`);
  await expect(staff.getByRole('heading', { name: 'Customer card' })).toBeVisible({ timeout: 15_000 });

  // Six coffees in two confirmed transactions of 3 (the per-transaction cap) unlock a reward …
  await staff.getByRole('button', { name: 'More' }).click();
  await staff.getByRole('button', { name: 'More' }).click();
  await expect(staff.getByRole('button', { name: 'More' })).toBeDisabled(); // cap reached
  for (const qty of [3, 3]) {
    await staff.getByRole('button', { name: 'Add stamps' }).click();
    await staff.getByRole('button', { name: `Confirm: +${qty}` }).dblclick(); // double tap: still one transaction
    await expect(staff.getByTestId('action-success')).toContainText(`Stamps added: ${qty}.`);
  }
  await expect(staff.getByTestId('action-success')).toContainText('The customer earned a free coffee!');

  // … the customer sees it …
  await customer.getByRole('button', { name: 'Refresh' }).click();
  await expect(customer.getByTestId('rewards-ready')).toContainText('Free coffees ready: 1');

  // … and the staff member redeems it exactly once.
  await staff.getByRole('button', { name: 'Give free coffee' }).click();
  await staff.getByRole('button', { name: 'Yes, give it' }).click();
  await expect(staff.getByTestId('action-success')).toContainText('Free coffee given.');
  await expect(staff.getByRole('button', { name: 'Give free coffee' })).toBeDisabled();

  await customer.getByRole('button', { name: 'Refresh' }).click();
  await expect(customer.getByTestId('stamp-count')).toHaveText('0 of 6 stamps');
  await expect(customer.getByTestId('rewards-ready')).toHaveCount(0);

  await staffContext.close();
});
