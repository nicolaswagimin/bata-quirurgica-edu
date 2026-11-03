import { expect, test } from '@playwright/test';
import { createUserWithProfile, loginViaUi } from './helpers.ts';

// Needs the local API (POST /quiz/practice): runs with `pnpm test:e2e:emu`.
test('@emu AR juego: pantalla completa, controles sin tocar y XP de práctica desde el backend', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { email } = await createUserWithProfile('Daniela Ruiz');
  await loginViaUi(page, email);
  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Daniela Ruiz' })).toBeVisible();

  await page.goto('/bata-ar');
  await expect(page.getByTestId('ar-status')).toHaveText('Detectando', { timeout: 30_000 });
  const stage = page.getByRole('region', { name: 'AR espejo' });
  // Instructions and buttons live over the camera image, which fills the viewport.
  const viewport = page.viewportSize();
  const box = await stage.boundingBox();
  expect(box?.width).toBe(viewport?.width);
  expect(box?.height).toBe(viewport?.height);
  await expect(page.getByTestId('ar-instruction')).toHaveText(/aléjate unos 2 metros/);

  // Start: the fake camera shows no person, so the game waits for the whole body.
  await stage.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByTestId('ar-instruction')).toHaveText('Aléjate hasta que se vea tu cuerpo');

  await page.waitForTimeout(3_000);
  const fpsText = (await page.getByText(/\d+ FPS · procesamiento en/).textContent()) ?? '';
  console.log(`AR fps (headless, fake camera): ${fpsText}`);

  await page.goto('/bata-ar?simularPracticaCompleta=1');
  await expect(page.getByTestId('ar-status')).toHaveText('Detectando', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('¡Práctica completa! +30 XP')).toBeVisible();
  await page.getByRole('button', { name: 'Jugar de nuevo' }).click();
  await expect(page.getByText(/Ya sumaste el XP de práctica de hoy/)).toBeVisible();
});
