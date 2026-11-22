import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

const styles = [
  'classic',
  'modern',
  'rustic',
  'corporate',
  'minimal',
  'frutiger-aero',
  'neo-brutalism',
  'glassmorphism',
  'neumorphism',
  'retro-pixel',
  'claymorphism',
];
const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function installFixture(page: Page, style: string, mode: string) {
  const unexpected: string[] = [];
  let preferences = {
    themeId: 'forest',
    languageTag: 'pt-BR',
    isDefault: false,
    appearance: { primary: '#287bc1', mode, style },
    supportedStyles: styles,
    supportedThemes: ['forest'],
    supportedLanguages: ['pt-BR', 'en-US'],
    updatedAtUtc: null,
  };
  const labels: Record<string, string> = {
    monitor: 'dashboard.menu.monitor',
    clips: 'dashboard.menu.clips',
    health: 'dashboard.menu.health',
    capture: 'dashboard.menu.capture',
    cameras: 'dashboard.menu.cameras',
    people: 'dashboard.menu.people',
    enrollments: 'dashboard.menu.biometricEnrollments',
    observations: 'dashboard.menu.biometricObservations',
    calibration: 'dashboard.menu.biometricCalibration',
    model: 'dashboard.menu.biometricModel',
    users: 'dashboard.menu.users',
    profiles: 'dashboard.menu.profiles',
    requests: 'dashboard.menu.accessRequests',
    systems: 'platform.systems.title',
    audit: 'dashboard.menu.audit',
  };
  const items = (ids: string[]) =>
    ids.map((itemId, sortOrder) => ({ itemId, sortOrder, labelKey: labels[itemId] }));
  const modules = [
    { moduleId: 'monitoring', items: items(['monitor', 'clips', 'health', 'capture', 'cameras', 'people']) },
    { moduleId: 'biometrics', items: items(['enrollments', 'observations', 'calibration', 'model']) },
    { moduleId: 'administration', items: items(['users', 'profiles', 'requests', 'systems', 'audit']) },
    { moduleId: 'activitywatch', items: [] },
  ].map((module, menuOrder) => ({
    ...module,
    menuOrder,
    displayNameKey: `modules.${module.moduleId}.name`,
    menuLabelKey: `modules.${module.moduleId}.menu`,
    contractVersion: '1.0',
    menuGroup: 'overview',
    menuIcon: 'settings',
    route: `/modules/${module.moduleId}`,
  }));
  const emptyPage = { items: [], page: 1, pageSize: 100, totalCount: 0, total: 0, nextCursor: null };
  const observation = {
    publicId: 'OBV000000000001',
    cameraPublicId: 'CAM000000000001',
    clipPublicId: null,
    observedAtUtc: '2026-11-13T12:00:00Z',
    ingestedAtUtc: '2026-11-13T12:00:01Z',
    matchStatus: 'unknown',
    bestPersonPublicId: null,
    bestScore: 0.2,
    margin: 0,
    policyVersion: 'synthetic.v1',
    candidateCount: 0,
    reviewStatus: 'pending',
    resolvedPersonPublicId: null,
    latestReviewPublicId: null,
  };
  const bodies: Record<string, unknown> = {
    '/api/v1/auth/session': { authenticated: true },
    '/api/v1/auth/me': { username: 'admin', role: 'Administrator', canMonitor: true },
    '/api/v1/portal/navigation': { residenceId: 'home', generatedAtUtc: '2026-11-13T12:00:00Z', modules },
    '/api/v1/cameras': [
      { cameraId: 'garage-01', status: 'stopped', streamEpoch: 'synthetic', liveUrl: null },
    ],
    '/api/v1/clients/presence': { activeClients: 1 },
    '/api/v1/biometrics/enrollments': [],
    '/api/v1/admin/users': {
      ...emptyPage,
      items: [{ publicId: 'USR000000000001', userName: 'synthetic-user', isActive: true }],
    },
    '/api/v1/admin/cameras': emptyPage,
    '/api/v1/admin/access-rules': [],
    '/api/v1/admin/permission-catalog': [],
    '/api/v1/admin/access-requests': emptyPage,
    '/api/v1/admin/portal-modules': emptyPage,
    '/api/v1/admin/integrations/activitywatch/credential': {
      integrationId: 'activitywatch',
      configured: false,
      source: 'none',
      keyVersion: null,
      updatedAtUtc: null,
      version: 0,
    },
    '/api/v1/admin/maintenance/backups/summary': {
      lastSuccessAtUtc: null,
      lastSuccessFileName: null,
      lastSuccessSizeBytes: null,
      lastSuccessSha256: null,
      artifactCount: 0,
      totalSizeBytes: 0,
      scheduleEnabled: false,
      scheduleIntervalHours: 24,
      scheduleRetentionCount: 3,
      lastFailureAtUtc: null,
    },
    '/api/v1/admin/events': emptyPage,
    '/api/v1/admin/known-people': emptyPage,
    '/api/v1/admin/identity-observations': { ...emptyPage, items: [observation], total: 1 },
    '/api/v1/admin/identity-observations/OBV000000000001': {
      summary: observation,
      candidates: [],
      reviews: [],
    },
    '/api/v1/admin/identity-match-policy': [],
    '/api/v1/admin/identity-match-policy/calibration': {
      fromUtc: '2026-08-07T00:00:00Z',
      toUtc: '2026-11-13T00:00:00Z',
      cameraPublicId: null,
      bins: 2,
      snapshotHash: 'synthetic',
      activePolicy: { threshold: 0.363, margin: 0.05, version: 'synthetic.v1' },
      genuineCount: 40,
      impostorCount: 40,
      excludedCount: 0,
      singleCandidateCount: 0,
      minimumSamplesPerClass: 30,
      canPromote: true,
      scoreBins: [
        { lowerBound: 0, upperBound: 0.5, genuineCount: 0, impostorCount: 40 },
        { lowerBound: 0.5, upperBound: 1, genuineCount: 40, impostorCount: 0 },
      ],
      marginBins: [
        { lowerBound: 0, upperBound: 0.5, genuineCount: 0, impostorCount: 0 },
        { lowerBound: 0.5, upperBound: 1, genuineCount: 40, impostorCount: 40 },
      ],
    },
    '/api/v1/portal/modules/activitywatch/summary': {
      schemaVersion: '1.0',
      moduleId: 'activitywatch',
      reachable: true,
      generatedAtUtc: '2026-11-13T12:00:00Z',
      windowStartUtc: '2026-11-13T08:00:00Z',
      windowEndUtc: '2026-11-13T12:00:00Z',
      totalActiveSeconds: 3600,
      truncated: false,
      applications: [{ app: 'Synthetic terminal', seconds: 3600, eventCount: 12 }],
      errorCode: null,
    },
  };
  await page.addInitScript(() => localStorage.setItem('garage-watch.locale.v1', 'pt-BR'));
  await page.route(/\/(?:api|health)\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/portal/preferences') {
      if (route.request().method() === 'PUT')
        preferences = { ...preferences, ...route.request().postDataJSON() };
      return route.fulfill(json(preferences));
    }
    if (path === '/api/v1/events') return route.fulfill({ status: 204 });
    if (Object.hasOwn(bodies, path)) return route.fulfill(json(bodies[path]));
    unexpected.push(`${route.request().method()} ${path}`);
    return route.fulfill({ status: 503, body: '' });
  });
  return unexpected;
}

async function tokenReaches(locator: Locator, property: string, token: string, value: string) {
  await expect(locator).toBeVisible();
  const previous = await locator.evaluate(
    (_element, args) => {
      const root = document.documentElement;
      const previous = root.style.getPropertyValue(args.token);
      root.style.setProperty(args.token, args.value);
      return previous;
    },
    { property, token, value },
  );
  try {
    await expect(locator).toHaveCSS(property, value);
  } finally {
    await locator.evaluate(
      (_element, args) => {
        if (args.previous) document.documentElement.style.setProperty(args.token, args.previous);
        else document.documentElement.style.removeProperty(args.token);
      },
      { token, previous },
    );
  }
}

test('hot style changes update mounted components and motion without reload', async ({ page }) => {
  const unexpected = await installFixture(page, 'classic', 'dark');
  await page.goto('/');
  await expect(page.locator('.camera-card')).toBeVisible();
  const signatures = new Set<string>();
  const animations = new Set<string>();
  for (const [index, style] of styles.entries()) {
    await page.locator('.theme-selector > summary').click();
    await page.locator('.theme-option').nth(index).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme-style', style);
    await expect(page.locator('.theme-selector')).not.toHaveAttribute('open');
    const observed = await page.locator('.camera-card').evaluate((element) => {
      const css = getComputedStyle(element);
      const entry = getComputedStyle(document.querySelector('.module-body') as Element);
      return {
        signature: [css.borderRadius, css.borderStyle, css.backgroundImage, css.boxShadow, css.fontFamily],
        animation: entry.animationName,
      };
    });
    signatures.add(JSON.stringify(observed.signature));
    animations.add(observed.animation);
  }
  expect(signatures.size).toBeGreaterThanOrEqual(9);
  expect(animations.size).toBeGreaterThanOrEqual(5);
  expect(unexpected).toEqual([]);
});

for (const style of styles) {
  for (const mode of ['dark', 'light']) {
    test(`eleven styles: ${style}/${mode} reaches real federated components`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      const unexpected = await installFixture(page, style, mode);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/');
      await expect(page.locator('.user-identity-name')).toHaveText('admin');
      await expect(page.locator('html')).toHaveAttribute('data-theme-style', style);
      await expect(page.locator('html')).toHaveAttribute('data-bs-theme', mode);
      await expect(page.locator('.camera-card')).toBeVisible();
      await expect(page.locator('.module-nav')).not.toContainText(/nav\./);
      await tokenReaches(
        page.locator('.app-header'),
        'border-top-left-radius',
        '--style-radius-card',
        '31px',
      );
      await tokenReaches(page.locator('.module-nav'), 'border-top-width', '--style-border-width', '3px');
      await tokenReaches(
        page.locator('.camera-card'),
        'border-top-left-radius',
        '--style-radius-card',
        '31px',
      );
      await tokenReaches(
        page.locator('#language-select'),
        'border-top-left-radius',
        '--style-radius-control',
        '19px',
      );
      await tokenReaches(
        page.locator('.header-logout'),
        'border-top-left-radius',
        '--style-button-radius',
        '17px',
      );
      await tokenReaches(page.locator('.header-logout'), 'transition-duration', '--style-motion', '0.73s');
      if (style === 'corporate') {
        const edges = await page.locator('.app-header').evaluate((el) => {
          const css = getComputedStyle(el);
          const accent = document.createElement('span');
          accent.style.color = 'var(--accent)';
          el.append(accent);
          const color = getComputedStyle(accent).color;
          accent.remove();
          return {
            color,
            border: css.borderLeftColor,
            width: Number.parseFloat(css.borderLeftWidth),
            top: Number.parseFloat(css.borderTopWidth),
          };
        });
        expect(edges.border).toBe(edges.color);
        expect(edges.width).toBeGreaterThan(edges.top);
      }
      const entry = await page.locator('.module-body').evaluate((element) => {
        const css = getComputedStyle(element);
        return {
          name: css.animationName,
          duration: css.animationDuration,
          easing: css.animationTimingFunction,
        };
      });
      expect(entry.name).not.toBe('none');
      if (style === 'retro-pixel') expect(entry.easing).toContain('steps');
      if (['minimal', 'corporate', 'neo-brutalism', 'neumorphism', 'retro-pixel'].includes(style)) {
        expect(await page.locator('body').evaluate((el) => getComputedStyle(el, '::before').display)).toBe(
          'none',
        );
        expect(await page.locator('body').evaluate((el) => getComputedStyle(el, '::after').display)).toBe(
          'none',
        );
        expect(
          await page.locator('body').evaluate((el) => getComputedStyle(el, '::before').animationName),
        ).toBe('none');
      }
      await page.screenshot({
        path: testInfo.outputPath(`${style}-${mode}-desktop.png`),
        fullPage: true,
        animations: 'disabled',
      });
      const violations = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(violations.violations, JSON.stringify(violations.violations)).toEqual([]);

      for (const name of ['Biometria', 'Acessos', 'Sistemas', 'Auditoria', 'Atividade']) {
        await test.step(`real remote: ${name}`, async () => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await page
            .getByRole('navigation', { name: 'Módulos da plataforma' })
            .getByRole('button', { name, exact: true })
            .click();
          await expect(page.locator('.module-header')).toBeVisible();
          if (name === 'Biometria') {
            await expect(page.locator('#biometrics-title')).toBeVisible();
            await page.locator('#module-subnav-biometrics-observations').click();
            await page.getByRole('button', { name: 'Abrir observação OBV000000000001' }).click();
            await expect(page.locator('.identity-review')).toBeVisible();
            await tokenReaches(
              page.locator('.identity-review'),
              'border-top-left-radius',
              '--style-radius-control',
              '19px',
            );
            const radio = page.locator('.identity-review input[type="radio"]:checked');
            await expect(radio).toBeVisible();
            expect(await radio.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
              mode === 'dark' ? '10160f' : 'fff',
            );
            const radioContrast = await radio.evaluate((el, dark) => {
              const background =
                getComputedStyle(el)
                  .backgroundColor.match(/[\d.]+/g)
                  ?.slice(0, 3)
                  .map(Number) ?? [];
              const luminance = (rgb: number[]) =>
                rgb
                  .map((value) => {
                    const c = value / 255;
                    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
                  })
                  .reduce((sum, value, index) => sum + value * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
              const levels = [luminance(background), luminance(dark ? [16, 22, 15] : [255, 255, 255])];
              return (Math.max(...levels) + 0.05) / (Math.min(...levels) + 0.05);
            }, mode === 'dark');
            expect(radioContrast).toBeGreaterThanOrEqual(3);
            await page.locator('#module-subnav-biometrics-calibration').click();
            await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
            await tokenReaches(
              page.locator('.style-inset').first(),
              'border-top-left-radius',
              '--style-radius-control',
              '19px',
            );
          } else if (name === 'Acessos') {
            await expect(page.getByRole('heading', { name: 'synthetic-user', exact: true })).toBeVisible();
          } else if (name === 'Sistemas') {
            await expect(
              page.getByRole('heading', { name: 'Sistemas e integrações', exact: true }),
            ).toBeVisible();
            await expect(
              page.getByText('Nenhum módulo está registrado no catálogo.', { exact: true }),
            ).toBeVisible();
          } else if (name === 'Auditoria') {
            await expect(
              page.getByText('Nenhum evento encontrado para os filtros atuais.', { exact: true }),
            ).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Auditoria', exact: true })).toBeVisible();
          } else {
            await expect(page.getByRole('row', { name: /Synthetic terminal/ })).toBeVisible();
          }
          await expect(page.getByRole('alert')).toHaveCount(0);
          await expect(page.locator('.module-section, .module-body .panel-card').first()).toBeVisible();
          await tokenReaches(
            page.locator('.module-header'),
            'border-top-left-radius',
            '--style-radius-card',
            '31px',
          );
          await tokenReaches(
            page.locator('.module-section, .module-body .panel-card').first(),
            'border-top-width',
            '--style-border-width',
            '3px',
          );
          await page.setViewportSize({ width: 320, height: 760 });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= 321)).toBe(true);
          await tokenReaches(
            page.locator('.app-header'),
            'border-top-left-radius',
            '--style-radius-card',
            '31px',
          );
        });
      }
      await page.screenshot({
        path: testInfo.outputPath(`${style}-${mode}-320.png`),
        fullPage: true,
        animations: 'disabled',
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await page.locator('.module-body').evaluate((el) => getComputedStyle(el).animationName)).toBe(
        'none',
      );
      expect(
        await page
          .locator('.header-logout')
          .evaluate((el) => Number.parseFloat(getComputedStyle(el).transitionDuration)),
      ).toBeLessThan(0.001);
      expect(
        await page.locator('body').evaluate((el) => getComputedStyle(el, '::before').animationName),
      ).toBe('none');
      expect(errors).toEqual([]);
      expect(unexpected).toEqual([]);
    });
  }
}
