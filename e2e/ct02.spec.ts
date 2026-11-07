import { expect, test } from '@playwright/test';

const username = process.env.CT02_USERNAME;
const password = process.env.CT02_PASSWORD;
const durationSeconds = Number(process.env.CT02_DURATION_SECONDS ?? '600');

test('CT02 anonymous clients cannot read the camera catalog', async ({ request, baseURL }) => {
  if (!baseURL) throw new Error('CT02_BASE_URL is required.');
  const response = await request.get(new URL('/api/v1/cameras', baseURL).toString());
  expect(response.status()).toBe(401);
});

for (const profile of [
  { name: 'desktop', viewport: { width: 1366, height: 768 } },
  { name: 'mobile-emulation', viewport: { width: 390, height: 844 }, isMobile: true },
]) {
  test(`CT02 ${profile.name}: protected live playback for ${durationSeconds}s`, async ({
    browser,
    baseURL,
  }) => {
    test.skip(!username || !password, 'CT02 credentials are required; values are never logged.');
    if (!baseURL) throw new Error('CT02_BASE_URL is required.');
    const loginName = username;
    const loginPassword = password;
    if (!loginName || !loginPassword) throw new Error('CT02 credentials are missing.');
    const context = await browser.newContext({ viewport: profile.viewport, isMobile: profile.isMobile });
    try {
      const anonymous = await context.newPage();
      const cameraDenied = await anonymous.request.get(new URL('/api/v1/cameras', baseURL).toString());
      expect(cameraDenied.status()).toBe(401);

      await anonymous.goto(baseURL);
      await anonymous.getByLabel('Usuário').fill(loginName);
      await anonymous.getByLabel('Senha', { exact: true }).fill(loginPassword);
      await anonymous.getByRole('button', { name: 'Entrar' }).click();

      const video = anonymous.getByLabel('Vídeo ao vivo da câmera');
      await expect(video).toBeVisible({ timeout: 60_000 });
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState), {
          timeout: 120_000,
          message: 'live video should become ready after authentication',
        })
        .toBeGreaterThanOrEqual(2);

      const authenticatedCameras = await anonymous.request.get(
        new URL('/api/v1/cameras', baseURL).toString(),
      );
      expect(authenticatedCameras.status()).toBe(200);
      const [camera] = (await authenticatedCameras.json()) as Array<{ cameraId: string }>;
      expect(camera?.cameraId).toBeTruthy();
      const anonymousContext = await browser.newContext();
      try {
        const playlistDenied = await anonymousContext.request.get(
          new URL(`/api/v1/live/${encodeURIComponent(camera.cameraId)}/index.m3u8`, baseURL).toString(),
        );
        expect(playlistDenied.status()).toBe(401);
      } finally {
        await anonymousContext.close();
      }
      const cookie = await context.cookies(baseURL);
      expect(cookie.some((item) => item.httpOnly && item.name)).toBe(true);

      await expect
        .poll(
          () =>
            video.evaluate((element: HTMLVideoElement) => ({
              paused: element.paused,
              frames: element.getVideoPlaybackQuality?.().totalVideoFrames ?? 0,
            })),
          { timeout: 120_000, message: 'muted live playback should begin' },
        )
        .toMatchObject({ paused: false });

      const initialFrames = await video.evaluate(
        (element: HTMLVideoElement) => element.getVideoPlaybackQuality?.().totalVideoFrames ?? 0,
      );
      const observations: Array<{ elapsedSeconds: number; totalVideoFrames: number }> = [];
      const startedAt = Date.now();
      while ((Date.now() - startedAt) / 1000 < durationSeconds) {
        await anonymous.waitForTimeout(5_000);
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const playback = await video.evaluate((element: HTMLVideoElement) => ({
          paused: element.paused,
          readyState: element.readyState,
          totalVideoFrames: element.getVideoPlaybackQuality?.().totalVideoFrames ?? 0,
          currentTime: element.currentTime,
        }));
        expect(playback.paused, `playback paused at ${Math.floor(elapsedSeconds)}s`).toBe(false);
        expect(
          playback.readyState,
          `media not ready at ${Math.floor(elapsedSeconds)}s`,
        ).toBeGreaterThanOrEqual(2);
        observations.push({ elapsedSeconds, totalVideoFrames: playback.totalVideoFrames });
      }

      const finalFrames = observations.at(-1)?.totalVideoFrames ?? initialFrames;
      expect(finalFrames).toBeGreaterThan(initialFrames);
      console.log(
        `CT02 ${profile.name}: sustained playback observed for ${Math.round((Date.now() - startedAt) / 1000)}s; ` +
          `${observations.length} samples; decoded frames increased; source-to-render latency p95 NOT MEASURED.`,
      );
    } finally {
      await context.close();
    }
  });
}

test('CT33 assisted panel inspection at desktop, mobile and 200% zoom', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(!username || !password, 'CT33 credentials are required; values are never logged.');
  if (!baseURL) throw new Error('CT33_BASE_URL is required.');
  const loginName = username ?? '';
  const loginPassword = password ?? '';
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.getByLabel('Usuário').fill(loginName);
    await page.getByLabel('Senha', { exact: true }).fill(loginPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByLabel('Vídeo ao vivo da câmera')).toBeVisible({ timeout: 60_000 });

    for (const viewport of [
      { width: 1366, height: 768, name: 'desktop-1366x768' },
      { width: 360, height: 800, name: 'mobile-360x800' },
      { width: 683, height: 384, name: 'zoom-200-equivalent' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(baseURL);
      await expect(page.getByLabel('Vídeo ao vivo da câmera')).toBeVisible({ timeout: 60_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${viewport.name} must not scroll horizontally`).toBeLessThanOrEqual(1);

      const control = page.locator('button:visible').first();
      await control.focus();
      const focusState = await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          focusVisible: element.matches(':focus-visible'),
          indicator: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
        };
      });
      expect(focusState.focusVisible, `${viewport.name} keyboard focus must be visible`).toBe(true);
      expect(focusState.indicator, `${viewport.name} must expose a focus indicator`).toBe(true);

      await page.screenshot({
        path: testInfo.outputPath(`ct33-${viewport.name}.png`),
        fullPage: true,
      });
    }
  } finally {
    await context.close();
  }
});
