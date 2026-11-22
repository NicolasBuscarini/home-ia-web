import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

test.use({ hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('garage-watch.locale.v1', 'pt-BR'));
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: { authenticated: false } }));
});

test('restores account appearance after reload and without local cache', async ({ page, browser }) => {
  let writes = 0;
  let stored = {
    themeId: 'forest',
    languageTag: 'pt-BR',
    isDefault: true,
    updatedAtUtc: null as string | null,
    supportedThemes: ['forest'],
    supportedLanguages: ['pt-BR', 'en-US'],
    appearance: { primary: '#8ce0b4', mode: 'dark', style: 'classic' },
  };
  async function installApi(target: Page) {
    await target.route('**/api/v1/auth/session', (route) => route.fulfill({ json: { authenticated: true } }));
    await target.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ json: { username: 'appearance-user', role: 'User', canMonitor: false } }),
    );
    await target.route('**/api/v1/portal/navigation', (route) =>
      route.fulfill({ json: { residenceId: 'home', generatedAtUtc: '2026-11-13T12:00:00Z', modules: [] } }),
    );
    await target.route('**/api/v1/access-requests/mine', (route) =>
      route.fulfill({ json: { request: null } }),
    );
    await target.route('**/api/v1/portal/preferences', async (route) => {
      if (route.request().method() === 'PUT') {
        writes++;
        stored = {
          ...stored,
          ...route.request().postDataJSON(),
          isDefault: false,
          updatedAtUtc: '2026-11-13T12:01:00Z',
        };
      }
      await route.fulfill({ json: stored });
    });
  }
  await installApi(page);
  await page.goto('/');
  await expect(page.locator('.user-identity-name')).toHaveText('appearance-user');
  expect(writes).toBe(0);
  await page.locator('.theme-trigger').click();
  const hex = page.getByRole('textbox', { name: 'Hex' });
  await hex.fill('#345678');
  await hex.press('Enter');
  await page.locator('label.theme-appearance-switch').click();
  await page.getByRole('button', { name: 'Glassmorphism' }).click();
  await expect
    .poll(() => stored.appearance)
    .toEqual({ primary: '#345678', mode: 'light', style: 'glassmorphism' });
  await page.reload();
  await expect(page.locator('.user-identity-name')).toHaveText('appearance-user');
  await expect(page.locator('html')).toHaveAttribute('data-theme-style', 'glassmorphism');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  const anotherBrowser = await browser.newContext();
  try {
    const fresh = await anotherBrowser.newPage();
    await installApi(fresh);
    await fresh.goto(new URL('/', page.url()).href);
    await expect(fresh.locator('.user-identity-name')).toHaveText('appearance-user');
    await expect(fresh.locator('html')).toHaveAttribute('data-theme-style', 'glassmorphism');
    await expect(fresh.locator('html')).toHaveAttribute('data-bs-theme', 'light');
    expect(
      await fresh.evaluate(() => JSON.parse(localStorage.getItem('garage-watch.color.v1') ?? '{}')),
    ).toEqual({ primary: '#345678', mode: 'light' });
  } finally {
    await anotherBrowser.close();
  }
});

test('loads the matrix, supports drag/keyboard/switch and restores color after reload', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entre no painel' })).toBeVisible();
  await page.locator('.theme-trigger').click();
  await expect(page.getByText('Predefinidos', { exact: true })).toHaveCount(0);
  const hue = page.getByRole('slider', { name: 'Matiz', exact: true });
  await hue.focus();
  await page.keyboard.press('Home');
  const matrix = page.getByRole('group', { name: 'Matriz de cores' });
  const box = await matrix.boundingBox();
  if (!box) throw new Error('Color matrix is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25, { steps: 6 });
  await page.mouse.up();
  const hex = page.getByRole('textbox', { name: 'Hex' });
  await expect(hex).toHaveValue('#bf3030');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(hex).toHaveValue('#804040');
  await matrix.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.move(box.x + box.width + 30, box.y - 30);
  await expect(hex).toHaveValue('#804040');
  await page.mouse.up();
  // A new captured drag works after cancellation and clamps outside the matrix.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 30, box.y - 30);
  await page.mouse.up();
  await expect(hex).toHaveValue('#ff0000');
  const saturation = page.getByRole('slider', { name: 'Saturação' });
  await saturation.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(saturation).toHaveValue('1');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('slider', { name: 'Brilho' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(hex).toHaveValue('#fffcfc');
  expect((await new AxeBuilder({ page }).include('.theme-selector').analyze()).violations).toEqual([]);
  const mode = page.getByRole('switch', { name: 'Modo escuro' });
  await mode.focus();
  await page.keyboard.press('Space');
  await expect(mode).not.toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await hex.fill('#123abc');
  await hex.press('Enter');
  await expect(page.getByRole('status', { name: 'Cor selecionada' })).toHaveText('#123abc');
  expect((await new AxeBuilder({ page }).include('.theme-selector').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('color-matrix-desktop.png') });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Entre no painel' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await page.locator('.theme-trigger').click();
  await expect(hex).toHaveValue('#123abc');
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('garage-watch.color.v1'))) ?? '{}'),
  ).toEqual({ primary: '#123abc', mode: 'light' });
  expect(errors).toEqual([]);
});

test('selects by touch and fits a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entre no painel' })).toBeVisible();
  await page.locator('.theme-trigger').click();
  const hue = page.getByRole('slider', { name: 'Matiz', exact: true });
  await hue.focus();
  await page.keyboard.press('Home');
  const matrix = page.getByRole('group', { name: 'Matriz de cores' });
  const box = await matrix.boundingBox();
  if (!box) throw new Error('Color matrix is not visible');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('textbox', { name: 'Hex' })).toHaveValue('#804040');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect((await new AxeBuilder({ page }).include('.theme-selector').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('color-matrix-mobile.png') });
});
