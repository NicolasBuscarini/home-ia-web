import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'federation.spec.ts',
  timeout: 45_000,
  grep: process.env.FEDERATION_TEST_GREP ? new RegExp(process.env.FEDERATION_TEST_GREP) : undefined,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.FEDERATION_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    headless: true,
  },
  webServer: {
    command:
      'VITE_HOST_ORIGIN=http://127.0.0.1:5193 npm run dev -- --host 127.0.0.1 --port 5193 --strictPort',
    url: 'http://127.0.0.1:5193',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /(?:federation|shellLoad|themeStyles)\.spec\.ts/,
    },
    {
      name: 'chromium-vite',
      testMatch: 'shellLoad.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5193' },
    },
  ],
});
