import { expect, test } from '@playwright/test';
import { createEmulatorUser, loginViaUi, uniqueEmail, waitForHomeSettled } from './helpers.ts';

test('@emu el AR espejo detecta con cámara falsa y solo hace GET al propio origen', async ({
  page,
}) => {
  const email = uniqueEmail('ar');
  await createEmulatorUser(email);
  await loginViaUi(page, email);
  // Let the home page finish its own API call (GET /me) before watching the AR session;
  // `networkidle` alone can fire before that request starts.
  await waitForHomeSettled(page);

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
  await expect(page.getByTestId('ar-status')).toHaveText('Detectando', {
    timeout: 30_000,
  });

  await page.waitForTimeout(5_000);
  await expect(page.getByTestId('ar-status')).not.toHaveText(/Cámara|Modelo/);
  expect(offending).toEqual([]);
});

test('@emu si getUserMedia falla se ofrece el modo 3D', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Permiso denegado', 'NotAllowedError'));
  });
  const email = uniqueEmail('ar-err');
  await createEmulatorUser(email);
  await loginViaUi(page, email);

  await page.getByRole('navigation').getByRole('link', { name: 'AR espejo' }).click();
  await expect(page.getByText('No pudimos acceder a la cámara')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver la bata en 3D' })).toHaveAttribute(
    'href',
    '/bata-3d',
  );
});
