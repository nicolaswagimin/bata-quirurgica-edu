import { expect, test } from '@playwright/test';
import { createEmulatorUser, loginViaUi, uniqueEmail } from './helpers.ts';

/** Solo necesita Auth: el AR no consulta el API hasta cerrar la práctica. */
async function loginOnly(page: import('@playwright/test').Page): Promise<void> {
  const email = uniqueEmail('v2');
  await createEmulatorUser(email);
  await loginViaUi(page, email);
}

// `?practica=v2` carga la secuencia v3 (7 pasos por defecto, pendiente de validación). Sin la
// bandera, el AR sigue con la v1.
async function stampsFor(page: import('@playwright/test').Page, url: string) {
  await page.goto(url);
  // Espera a que el modelo esté cargado antes de arrancar: en frío tarda y el encuadre no avanza.
  await expect(page.getByTestId('ar-status')).toHaveText(/Detectando|Pose encontrada/, {
    timeout: 60_000,
  });
  const start = page.getByRole('button', { name: 'Comenzar' });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();
  // El encuadre simulado tiene cuerpo completo: pasa a la cuenta atrás y luego a jugar.
  return page.getByRole('list', { name: 'Pasos de la colocación' }).first().getByRole('listitem');
}

test('@emu práctica v2: la bandera carga la secuencia v3 en revisión', async ({ page }) => {
  test.setTimeout(90_000);
  await loginOnly(page);

  const stamps = await stampsFor(page, '/bata-ar?practica=v2&simularPose=1');
  await expect(stamps).toHaveCount(7, { timeout: 25_000 });
  await expect(stamps.first()).toContainText('Secado de manos');
  await expect(stamps.nth(2)).toContainText('Despliegue sin sacudir');
  await expect(stamps.last()).toContainText('Tarjeta de transferencia y giro');
  await expect(page.getByTestId('ar-practice-pending')).toHaveText('Secuencia en revisión');
});

test('@emu práctica v2: los puntos abiertos se configuran por URL', async ({ page }) => {
  test.setTimeout(90_000);
  await loginOnly(page);

  const stamps = await stampsFor(
    page,
    '/bata-ar?practica=v2&mascarilla=1&secado=0&giro=360&simularPose=1',
  );
  await expect(stamps).toHaveCount(7, { timeout: 25_000 });
  await expect(stamps.first()).toContainText('Mascarilla');
  await expect(stamps.nth(1)).toContainText('Tomar la bata por dentro');
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

test('@emu bata 3D: ?bata=3d monta el canvas y el espejo sigue', async ({ page }) => {
  test.setTimeout(90_000);
  await loginOnly(page);

  await page.goto('/bata-ar?bata=3d&simularPose=1');
  await expect(page.getByTestId('ar-status')).toHaveText(/Detectando|Pose encontrada/, {
    timeout: 60_000,
  });
  await expect(page.getByTestId('ar-gown-3d')).toBeVisible();
  const start = page.getByRole('button', { name: 'Comenzar' });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  const stamps = page
    .getByRole('list', { name: 'Pasos de la colocación' })
    .first()
    .getByRole('listitem');
  await expect(stamps).toHaveCount(6, { timeout: 25_000 });
});

test('@emu práctica v2: ayuda progresiva, saltar pasos y sin XP', async ({ page }) => {
  test.setTimeout(180_000);
  await loginOnly(page);
  // El XP solo lo decide el backend: una práctica con pasos saltados no debe enviarse.
  const practicePosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/quiz/practice')) {
      practicePosts.push(request.url());
    }
  });

  // `simularAyudaRapida` (solo build e2e) acelera la ayuda ×10: el botón sale a los 2,5 s.
  const stamps = await stampsFor(page, '/bata-ar?practica=v2&simularPose=1&simularAyudaRapida=1');
  await expect(stamps).toHaveCount(7, { timeout: 25_000 });
  await expect(page.getByTestId('ar-assist')).toBeVisible({ timeout: 30_000 });

  const skip = page.getByRole('button', { name: 'Saltar paso' });
  const results = page.getByRole('status', { name: 'Resultado de la práctica' });
  for (let i = 0; i < 7 && !(await results.isVisible()); i += 1) {
    await expect(skip.or(results)).toBeVisible({ timeout: 30_000 });
    if (await skip.isVisible()) await skip.click();
  }
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results).toContainText('esta práctica no suma XP');
  expect(practicePosts).toEqual([]);
});
