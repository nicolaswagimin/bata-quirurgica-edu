import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { createEmulatorUser, loginViaUi, uniqueEmail, waitForHomeSettled } from './helpers.ts';

const pasos = JSON.parse(
  readFileSync(new URL('../../../content/protocolos/bata-pasos.json', import.meta.url), 'utf8'),
) as { hotspots: { id: string; label: string; description: string }[] };

const GUIDE = 'Colócate de frente a la cámara, con hombros y caderas visibles';
const SLOW = 'Tu dispositivo va lento con la cámara. Prueba el modo 3D';

async function login(page: Page, prefix: string) {
  const email = uniqueEmail(prefix);
  await createEmulatorUser(email);
  await loginViaUi(page, email);
  // Let the home page finish its own API call before watching the AR session.
  await waitForHomeSettled(page);
}

test('@emu el AR completo guía el encuadre, muestra hotspots y solo hace GET al propio origen', async ({
  page,
}) => {
  // Loading MediaPipe plus a 5 s session runs past the default 30 s in headless Chromium.
  test.setTimeout(90_000);
  await login(page, 'ar-full');
  const origin = new URL(page.url()).origin;
  const offending: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' || new URL(request.url()).origin !== origin) {
      offending.push(`${request.method()} ${request.url()}`);
    }
  });

  // Client-side navigation: no reload, so no Auth/bootstrap traffic gets mixed in.
  await page.getByRole('navigation').getByRole('link', { name: 'AR espejo' }).click();
  await expect(page).toHaveURL(/\/bata-ar$/);
  await expect(page.getByTestId('ar-status')).toHaveText('Detectando', { timeout: 30_000 });
  // The fake camera shows no person, so there is no anchor.
  await expect(page.getByText(GUIDE)).toBeVisible();

  for (const hotspot of pasos.hotspots) {
    await page.getByRole('button', { name: hotspot.label, exact: true }).click();
    await expect(page.getByText(hotspot.description)).toBeVisible();
  }

  await page.waitForTimeout(5_000);
  await expect(page.getByTestId('ar-status')).not.toHaveText(/Cámara|Modelo/);
  expect(offending).toEqual([]);
});

test('@emu con FPS bajo se sugiere el modo 3D', async ({ page }) => {
  await login(page, 'ar-slow');
  await page.goto('/bata-ar?simularFpsBajo=1');
  await expect(page.getByRole('status').filter({ hasText: SLOW })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prueba el modo 3D' })).toHaveAttribute(
    'href',
    '/bata-3d',
  );
});

test('@emu ver en tu espacio define model-viewer y avisa si falta el modelo', async ({ page }) => {
  await login(page, 'ar-space');
  await page.getByRole('navigation').getByRole('link', { name: 'AR espejo' }).click();
  await page.getByRole('link', { name: 'Ver en tu espacio' }).click();
  await expect(page).toHaveURL(/\/bata-espacio$/);

  await expect(page.getByText('El modelo 3D definitivo aún no está disponible')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver la bata en 3D' })).toHaveAttribute(
    'href',
    '/bata-3d',
  );
  expect(await page.evaluate(() => customElements.get('model-viewer') !== undefined)).toBe(true);
  // No model-viewer with a src that does not exist.
  await expect(page.locator('model-viewer')).toHaveCount(0);
});

test('@emu ver en tu espacio usa model-viewer con AR cuando el modelo existe', async ({ page }) => {
  await page.route('**/models/bata.glb', (route) =>
    route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: '' }),
  );
  await login(page, 'ar-space-ok');
  await page.getByRole('navigation').getByRole('link', { name: 'AR espejo' }).click();
  await page.getByRole('link', { name: 'Ver en tu espacio' }).click();

  const viewer = page.locator('model-viewer');
  await expect(viewer).toHaveAttribute('ar-modes', 'webxr scene-viewer quick-look');
  // React 19 sets `src` as a property because model-viewer defines one.
  expect(await viewer.evaluate((el) => (el as HTMLElement & { src: string }).src)).toBe(
    '/models/bata.glb',
  );
});
