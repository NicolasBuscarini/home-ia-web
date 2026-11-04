import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const expectNoHorizontalOverflow = async (page: Page) => {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasOverflow).toBe(false);
};

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

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
            moduleId: 'activitywatch',
            displayNameKey: 'modules.activitywatch.name',
            contractVersion: '1.0',
            menuGroup: 'overview',
            menuOrder: 20,
            menuIcon: 'activity',
            menuLabelKey: 'modules.activitywatch.menu',
            route: '/modules/activitywatch',
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
  await page.route('**/api/v1/portal/modules/activitywatch/summary', (route) =>
    route.fulfill(
      json({
        schemaVersion: '1.0',
        moduleId: 'activitywatch',
        reachable: true,
        generatedAtUtc: '2026-11-03T12:00:00Z',
        windowStartUtc: '2026-11-03T08:00:00Z',
        windowEndUtc: '2026-11-03T12:00:00Z',
        totalActiveSeconds: 5400,
        truncated: false,
        applications: [{ app: 'Ptyxis', seconds: 3600, eventCount: 12 }],
        errorCode: null,
      }),
    ),
  );
  await page.route('**/api/v1/admin/portal-modules?page=1&pageSize=100', (route) =>
    route.fulfill(
      json({
        items: [
          {
            moduleId: 'monitoring',
            displayNameKey: 'modules.monitoring.name',
            contractVersion: '1.0',
            apiBaseUrl: '/',
            healthPath: '/api/v1/portal/modules/monitoring/health',
            requiredPermission: 'monitoring.read',
            menuGroup: 'overview',
            menuOrder: 10,
            menuIcon: 'camera',
            menuLabelKey: 'modules.monitoring.menu',
            isEnabled: true,
            version: 1,
            createdAtUtc: '2026-11-02T12:00:00Z',
            updatedAtUtc: '2026-11-02T12:00:00Z',
          },
        ],
        page: 1,
        pageSize: 100,
        totalCount: 1,
      }),
    ),
  );
  await page.route('**/api/v1/portal/health', (route) =>
    route.fulfill(
      json({
        schemaVersion: '1.0',
        residenceId: 'home',
        generatedAtUtc: '2026-11-04T12:00:00Z',
        portalStatus: 'healthy',
        status: 'degraded',
        modules: [
          {
            moduleId: 'monitoring',
            kind: 'module',
            status: 'healthy',
            enabled: true,
            contractVersion: '1.0',
            latencyMs: 12,
            checkedAtUtc: '2026-11-04T12:00:00Z',
            errorCode: null,
            capabilities: ['live.hls.read'],
          },
          {
            moduleId: 'activitywatch',
            kind: 'integration',
            status: 'unavailable',
            enabled: true,
            contractVersion: '1.0',
            latencyMs: 500,
            checkedAtUtc: '2026-11-04T12:00:00Z',
            errorCode: 'activitywatch_timeout',
            capabilities: [],
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
  await expect(page.getByRole('navigation', { name: 'Módulos da plataforma' })).toBeVisible();
  await expect(page.getByText('garage-01')).toBeVisible();
  await expect(page.getByText('Módulo indisponível')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});

test('keeps the mobile module drawer closed until the sandwich button is activated', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.user-identity-name')).toHaveText('admin');

  const nav = page.getByRole('navigation', { name: 'Módulos da plataforma' });
  const button = page.getByRole('button', { name: 'Módulos da plataforma' });
  await expect(nav).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  await button.click();
  await expect(nav).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');

  await nav.getByRole('button', { name: 'Sistemas' }).click();
  await expect(nav).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('keeps the shell accessible after the remote mounts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('garage-01')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.locator('#language-select').focus();
  await page.keyboard.press('Tab');
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(['SUMMARY', 'BUTTON']).toContain(focusedTag);
});

test('loads the federated activity watch module through the shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.user-identity-name')).toHaveText('admin');

  await page.getByRole('button', { name: 'Atividade' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Atividade do dispositivo' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Ptyxis/ })).toBeVisible();
  await expect(page.getByText('Módulo indisponível')).toHaveCount(0);
});

test('keeps the activity watch module accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Atividade' }).click();
  await expect(page.getByRole('row', { name: /Ptyxis/ })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.getByRole('button', { name: 'Atualizar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('row', { name: /Ptyxis/ })).toBeVisible();
});

test('loads the federated administration module and the aggregated health report', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.user-identity-name')).toHaveText('admin');

  await page.getByRole('button', { name: 'Sistemas' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Sistemas e integrações' })).toBeVisible();
  await expect(page.getByText('Módulo indisponível')).toHaveCount(0);

  await page.getByRole('button', { name: 'Verificar saúde' }).click();

  await expect(page.getByText('Estado agregado: Degradado · Portal: Saudável')).toBeVisible();
  const health = page.getByRole('region', { name: 'Saúde do portal e módulos' });
  await expect(health.getByRole('row', { name: /monitoring/ })).toBeVisible();
  await expect(health.getByRole('row', { name: /activitywatch/ })).toBeVisible();
  await expect(health.getByText('activitywatch_timeout')).toBeVisible();
  await expect(health.getByText('12 ms')).toBeVisible();
});

test('shows a sanitized error when the aggregated health report fails', async ({ page }) => {
  await page.route('**/api/v1/portal/health', (route) => route.fulfill({ status: 503, body: '' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Sistemas' }).click();
  await expect(page.getByRole('heading', { name: 'Sistemas e integrações' })).toBeVisible();

  await page.getByRole('button', { name: 'Verificar saúde' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível ler o relatório de saúde.' }),
  ).toBeVisible();
  const health = page.getByRole('region', { name: 'Saúde do portal e módulos' });
  await expect(health.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
});

test('keeps the administration health view accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sistemas' }).click();
  await expect(page.getByRole('heading', { name: 'Sistemas e integrações' })).toBeVisible();

  await page.getByRole('button', { name: 'Verificar saúde' }).click();
  await expect(page.getByText('Estado agregado: Degradado · Portal: Saudável')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('captures assisted inspection evidence for desktop, mobile and reflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sistemas' }).click();
  await page.getByRole('button', { name: 'Verificar saúde' }).click();
  await expect(page.getByText('Estado agregado: Degradado · Portal: Saudável')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('health-desktop.png'), fullPage: true });
  await expectNoHorizontalOverflow(page);

  const healthButton = page.getByRole('button', { name: 'Verificar saúde' });
  await healthButton.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const focusState = await healthButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(focusState.focusVisible, `keyboard focus must be visible: ${JSON.stringify(focusState)}`).toBe(true);
  expect(
    focusState.outlineStyle !== 'none' || focusState.boxShadow !== 'none',
    `focused button must expose a visible focus indicator: ${JSON.stringify(focusState)}`,
  ).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Módulos da plataforma' }).click();
  await page.getByRole('button', { name: 'Atividade' }).click();
  await expect(page.getByRole('heading', { name: 'Atividade do dispositivo' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('activity-mobile.png'), fullPage: true });
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Módulos da plataforma' }).click();
  await page.getByRole('button', { name: 'Sistemas' }).click();
  await expect(page.getByRole('heading', { name: 'Sistemas e integrações' })).toBeVisible();
  await page.getByRole('button', { name: 'Verificar saúde' }).click();
  await expect(page.getByText('Estado agregado: Degradado · Portal: Saudável')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('health-reflow-320.png'), fullPage: true });
  await expectNoHorizontalOverflow(page);
});
