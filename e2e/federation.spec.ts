import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('garage-watch.locale.v1', 'pt-BR'));
  await page.route('**/api/v1/auth/session', (route) => route.fulfill(json({ authenticated: true })));
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill(json({ username: 'admin', role: 'Administrator', canMonitor: true })),
  );
  await page.route('**/api/v1/cameras', (route) =>
    route.fulfill(
      json([
        {
          cameraId: 'garage-01',
          status: 'capturing',
          streamEpoch: 'epoch-federation',
          liveUrl: '/api/v1/live/garage-01/index.m3u8',
        },
      ]),
    ),
  );
  await page.route('**/api/v1/clients/presence', (route) => route.fulfill(json({ activeClients: 1 })));
  await page.route('**/api/v1/portal/navigation', (route) =>
    route.fulfill(
      json({
        residenceId: 'home',
        generatedAtUtc: '2026-11-02T12:00:00Z',
        modules: [
          {
            moduleId: 'monitoring',
            displayNameKey: 'modules.monitoring.name',
            contractVersion: '1.0',
            menuGroup: 'overview',
            menuOrder: 10,
            menuIcon: 'camera',
            menuLabelKey: 'modules.monitoring.menu',
            route: '/modules/monitoring',
          },
          {
            moduleId: 'administration',
            displayNameKey: 'modules.administration.name',
            contractVersion: '1.0',
            menuGroup: 'administration',
            menuOrder: 90,
            menuIcon: 'settings',
            menuLabelKey: 'modules.administration.menu',
            route: '/modules/administration',
          },
        ],
      }),
    ),
  );
  await page.route('**/api/v1/portal/preferences', (route) =>
    route.fulfill(
      json({
        themeId: 'forest',
        languageTag: 'pt-BR',
        isDefault: true,
        updatedAtUtc: null,
        supportedThemes: ['forest', 'graphite', 'ocean', 'light'],
        supportedLanguages: ['pt-BR', 'en-US'],
      }),
    ),
  );
});

test('loads the federated monitoring module through the shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.user-identity-name')).toHaveText('admin');
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await expect(page.getByText('garage-01')).toBeVisible();
  await expect(page.getByText('Módulo indisponível')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});

test('keeps the shell accessible after the remote mounts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('garage-01')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.locator('#language-select').focus();
  await page.keyboard.press('Tab');
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(['SUMMARY', 'BUTTON']).toContain(focusedTag);
});
