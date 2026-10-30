import { defineConfig } from '@playwright/test';

const durationSeconds = Number(process.env.CT02_DURATION_SECONDS ?? '600');

if (!Number.isFinite(durationSeconds) || durationSeconds < 1) {
  throw new Error('CT02_DURATION_SECONDS must be a positive number.');
}

export default defineConfig({
  testDir: './e2e',
  timeout: (durationSeconds + 120) * 1000,
  expect: { timeout: 30_000 },
  workers: 2,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    locale: 'pt-BR',
    baseURL: process.env.CT02_BASE_URL ?? 'http://127.0.0.1:5173',
    ignoreHTTPSErrors: false,
  },
});
