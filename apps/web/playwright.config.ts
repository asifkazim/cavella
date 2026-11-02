import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * E2E tests run against the production static export (`npm run build` first),
 * served by e2e/static-server.mjs — the same files Cloudflare Pages would serve.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'Europe/Warsaw',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node e2e/static-server.mjs',
    url: `http://localhost:${PORT}/pl/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
