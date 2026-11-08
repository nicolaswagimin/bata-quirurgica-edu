import { expect, test } from '@playwright/test';
import { createEmulatorUser, loginViaUi, uniqueEmail } from './helpers.ts';

/** Solo necesita Auth: el AR no consulta el API hasta cerrar la práctica. */
async function loginOnly(page: import('@playwright/test').Page): Promise<void> {
  const email = uniqueEmail('v2');
  await createEmulatorUser(email);
  await loginViaUi(page, email);
}

// `?practica=v2` carga la secuencia validada (8 pasos). Sin la bandera, el AR sigue con la v1.
test('@emu práctica v2: la bandera carga los 8 pasos aprobados', async ({ page }) => {
  test.setTimeout(90_000);
  await loginOnly(page);

  await page.goto('/bata-ar?practica=v2&simularPose=1');
  // Espera a que el modelo esté cargado antes de arrancar: en frío tarda y el encuadre no avanza.
  await expect(page.getByTestId('ar-status')).toHaveText(/Detectando|Pose encontrada/, {
    timeout: 60_000,
  });
  const start = page.getByRole('button', { name: 'Comenzar' });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  // El encuadre simulado tiene cuerpo completo: pasa a la cuenta atrás y luego a jugar.
  const stamps = page
    .getByRole('list', { name: 'Pasos de la colocación' })
    .first()
    .getByRole('listitem');
  await expect(stamps).toHaveCount(8, { timeout: 25_000 });
  await expect(stamps.first()).toContainText('Mascarilla');
  await expect(stamps.last()).toContainText('Cierre de la solapa');
});

test('@emu práctica v2: sin la bandera se mantienen los 6 pasos actuales', async ({ page }) => {
  test.setTimeout(90_000);
  await loginOnly(page);

  await page.goto('/bata-ar?simularPose=1');
  await expect(page.getByTestId('ar-status')).toHaveText(/Detectando|Pose encontrada/, {
    timeout: 60_000,
  });
  const start = page.getByRole('button', { name: 'Comenzar' });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  const stamps = page
    .getByRole('list', { name: 'Pasos de la colocación' })
    .first()
    .getByRole('listitem');
  await expect(stamps).toHaveCount(6, { timeout: 25_000 });
  await expect(stamps.first()).toContainText('Mascarilla');
});

test('@emu bata viva: ?bata=vivo no rompe el espejo', async ({ page }) => {
  test.setTimeout(90_000);
  await loginOnly(page);

  await page.goto('/bata-ar?bata=vivo&simularPose=1');
  await expect(page.getByTestId('ar-status')).toHaveText(/Detectando|Pose encontrada/, {
    timeout: 60_000,
  });
  const start = page.getByRole('button', { name: 'Comenzar' });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  const stamps = page
    .getByRole('list', { name: 'Pasos de la colocación' })
    .first()
    .getByRole('listitem');
  await expect(stamps).toHaveCount(6, { timeout: 25_000 });
});
