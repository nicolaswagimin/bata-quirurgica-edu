import { BataPasosSchema, CreditsSchema } from '@bata/shared/schemas';
import { expect, type Page, test } from '@playwright/test';
import creditsJson from '../../../content/credits.json' with { type: 'json' };
import pasosJson from '../../../content/protocolos/bata-pasos.json' with { type: 'json' };
import { createEmulatorUser, loginViaUi, uniqueEmail } from './helpers.ts';

const pasos = BataPasosSchema.parse(pasosJson);
const credits = CreditsSchema.parse(creditsJson);
const byOrder = <T extends { order: number }>(steps: T[]) =>
  [...steps].sort((a, b) => a.order - b.order);

async function openBata3d(page: Page): Promise<void> {
  const email = uniqueEmail('bata3d');
  await createEmulatorUser(email);
  await loginViaUi(page, email);
  await page.goto('/bata-3d');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('@emu modo 3D: pasos, navegación, retiro y zonas', async ({ page }) => {
  await openBata3d(page);
  const container = page.getByTestId('bata-3d');
  await expect(container.locator('video')).toBeVisible();
  await expect(container).toHaveAttribute('data-animate', 'true');

  const donning = byOrder(pasos.donning);
  const list = page.getByRole('list', { name: 'Colocación' });
  await expect(list.getByRole('listitem')).toHaveText(donning.map((s) => `${s.order}. ${s.title}`));

  const live = page.getByTestId('paso-actual');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(live).toContainText(donning[1]?.title ?? '');

  await page.getByRole('tab', { name: 'Retiro' }).click();
  const doffing = byOrder(pasos.doffing);
  await expect(page.getByRole('list', { name: 'Retiro' }).getByRole('listitem')).toHaveText(
    doffing.map((s) => `${s.order}. ${s.title}`),
  );
  await expect(live).toContainText(doffing[0]?.title ?? '');

  const zone = pasos.hotspots.find((h) => h.label === 'Zona estéril frontal');
  await page.getByRole('button', { name: 'Zona estéril frontal' }).click();
  await expect(page.getByText(zone?.description ?? '-')).toBeVisible();
});

test('@emu carga el procedimiento desde el propio origen y permite recorrer colocación y retiro', async ({
  page,
  baseURL,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await openBata3d(page);
  const container = page.getByTestId('bata-3d');
  await page.getByRole('button', { name: 'Explorar en 3D' }).click();
  await expect(container).toHaveAttribute('data-model', '/models/paso-1-anim.glb', {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(container).toHaveAttribute('data-model', '/models/paso-1-anim.glb', {
    timeout: 30_000,
  });

  const assets = requests.filter((u) => /\/(models|draco)\//.test(u));
  expect(assets.length).toBeGreaterThan(0);
  for (const url of assets) expect(url.startsWith(baseURL ?? '')).toBe(true);

  await page.getByRole('tab', { name: 'Retiro' }).click();
  await expect(page.getByTestId('paso-actual')).toContainText(pasos.doffing[0]?.title ?? '');
  await expect(container).toHaveAttribute('data-model', '/models/paso-1-anim.glb');
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
});

test('@emu al cambiar de paso el video salta al inicio del capítulo de ese paso', async ({
  page,
}) => {
  // Reduced motion keeps the film paused, so the position only moves when a step is chosen.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBata3d(page);
  const video = page.getByTestId('bata-3d').locator('video');
  const slider = page.getByRole('slider', { name: 'Recorrer el procedimiento' });

  // The chapters come from the served WebVTT file, read by the browser itself.
  const cues = await video.evaluate(async (el: HTMLVideoElement) => {
    const element = el.querySelector<HTMLTrackElement>('track[kind="chapters"]');
    if (!element) throw new Error('missing chapters track');
    element.track.mode = 'hidden';
    if (element.readyState !== HTMLTrackElement.LOADED)
      await new Promise((resolve, reject) => {
        element.addEventListener('load', resolve, { once: true });
        element.addEventListener('error', reject, { once: true });
      });
    return Array.from(element.track.cues ?? [], (cue) => ({
      start: cue.startTime,
      title: (cue as VTTCue).text,
    }));
  });
  const donning = byOrder(pasos.donning);
  const doffing = byOrder(pasos.doffing);
  expect(cues.map((c) => c.title)).toEqual([...donning, ...doffing].map((s) => s.title));

  const expectAt = async (seconds: number, title: string) => {
    await expect(page.getByTestId('paso-actual')).toContainText(title);
    await expect(slider).toHaveValue(String(seconds));
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBe(seconds);
  };

  await page.getByRole('button', { name: `3. ${donning[2]?.title}` }).click();
  await expectAt(cues[2]!.start, donning[2]!.title);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expectAt(cues[3]!.start, donning[3]!.title);
  await page.getByRole('tab', { name: 'Retiro' }).click();
  await expectAt(cues[donning.length]!.start, doffing[0]!.title);
  await page.getByRole('button', { name: `2. ${doffing[1]?.title}` }).click();
  await expectAt(cues[donning.length + 1]!.start, doffing[1]!.title);
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expectAt(cues[donning.length]!.start, doffing[0]!.title);
});

test('@emu modo 3D sin animación con prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBata3d(page);
  const container = page.getByTestId('bata-3d');
  await expect(container).toHaveAttribute('data-animate', 'false');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByTestId('paso-actual')).toContainText(
    byOrder(pasos.donning)[1]?.title ?? '',
  );
  await expect(container).toHaveAttribute('data-animate', 'false');
});

test('@emu créditos públicos sin iniciar sesión', async ({ page }) => {
  await page.goto('/creditos');
  await expect(page.getByRole('heading', { level: 1, name: 'Créditos' })).toBeVisible();
  for (const asset of credits.assets) {
    const item = page.getByRole('listitem').filter({ hasText: asset.title });
    await expect(item).toContainText(asset.author);
    await expect(item).toContainText(asset.license);
    await expect(item).toContainText(asset.modifications || 'Sin modificaciones');
  }
});
