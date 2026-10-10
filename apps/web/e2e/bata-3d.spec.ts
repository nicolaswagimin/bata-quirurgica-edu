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
  await expect(container.locator('canvas')).toBeVisible();
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
