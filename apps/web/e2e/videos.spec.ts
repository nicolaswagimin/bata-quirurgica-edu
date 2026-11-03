import { expect, type Locator, test } from '@playwright/test';
import { createUserWithProfile, loginViaUi } from './helpers.ts';

async function expectTeachingVideo(video: Locator, seconds: number) {
  await expect(video).toHaveAttribute('preload', 'none');
  await expect(video).toHaveAttribute('controls', '');
  await expect(video).not.toHaveAttribute('autoplay');
  await expect(video.locator('track[kind="captions"][srclang="es"][default]')).toHaveCount(1);
  await expect(video.locator('source[type="video/webm"]')).toHaveCount(1);
  await expect(video.locator('source[type="video/mp4"]')).toHaveCount(1);
  // The file really decodes (WebM: Playwright's Chromium has no H.264) and has the expected length.
  const duration = await video.evaluate(async (el: HTMLVideoElement) => {
    el.preload = 'metadata';
    el.load();
    await new Promise((resolve, reject) => {
      el.addEventListener('loadedmetadata', resolve, { once: true });
      el.addEventListener('error', reject, { once: true });
    });
    return el.duration;
  });
  expect(Math.round(duration)).toBe(seconds);
}

test('@emu videos educativos: lección, 3D y repaso en el inicio, sin reproducción automática', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { email } = await createUserWithProfile('Daniela Ruiz');
  await loginViaUi(page, email);
  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Daniela Ruiz' })).toBeVisible();

  // Home: the summary loads only near the viewport.
  const summary = page.getByRole('heading', { name: 'Repaso en video' });
  await expect(page.locator('video')).toHaveCount(0);
  await summary.scrollIntoViewIfNeeded();
  await expectTeachingVideo(page.locator('video[aria-label^="Resumen"]'), 90);

  await page.goto('/aprende/m4-campo-esteril');
  const zone = page.locator('video[aria-label="La zona estéril de la bata"]');
  await zone.scrollIntoViewIfNeeded();
  await expectTeachingVideo(zone, 18);

  await page.goto('/bata-3d');
  await page.getByRole('button', { name: /^3\. / }).click();
  const step = page.locator('video[aria-label^="Paso 3:"]');
  await step.scrollIntoViewIfNeeded();
  await expectTeachingVideo(step, 20);
});
