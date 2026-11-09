import { expect, test } from '@playwright/test';
import { createEmulatorUser, loginViaUi, uniqueEmail } from './helpers.ts';

test('@emu colocación estática 3D: selección y modelo ausente', async ({ page }) => {
  let releaseModels = () => {};
  const modelGate = new Promise<void>((resolve) => {
    releaseModels = resolve;
  });
  // Models are supplied separately: isolate navigation from asset availability and decoding.
  await page.route('**/models/v2/*.glb', async (route) => {
    if (route.request().url().endsWith('/paso-5.glb')) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' });
    } else if (route.request().method() === 'HEAD') {
      await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: '' });
    } else {
      // Keep loading until navigation aborts it; this test does not supply fake GLB bytes.
      await modelGate;
      await route.abort();
    }
  });
  const email = uniqueEmail('bata3d-steps');
  await createEmulatorUser(email);
  await loginViaUi(page, email);
  await page.goto('/bata-3d');
  const section = page.getByRole('region', { name: 'Colocación paso a paso en 3D' });
  await expect(section.getByRole('listitem')).toHaveCount(7);
  const fourth = section.getByRole('button', { name: '4. Brazos en las mangas' });
  await fourth.click();
  await expect(fourth).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('paso-3d-actual')).toContainText('Brazos en las mangas');
  await expect(page.getByTestId('paso-3d-actual')).toHaveAttribute('aria-live', 'polite');
  const viewer = section.locator('model-viewer');
  await expect(viewer).toHaveCount(1);
  await expect(viewer).toHaveJSProperty('src', '/models/v2/paso-4.glb');
  await expect(viewer).not.toHaveAttribute('ar');
  await expect(viewer).not.toHaveAttribute('auto-rotate');
  await section.getByRole('button', { name: 'Avanzar un paso en colocación 3D' }).click();
  await expect(section.getByText('Modelo no disponible')).toBeVisible();
  await expect(viewer).toHaveCount(0);
  releaseModels();
});
