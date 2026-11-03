import { expect, test } from '@playwright/test';
import { createUserWithProfile, loginViaUi } from './helpers.ts';

test('@emu Aprende: lección por misión, errores frecuentes, glosario y lista imprimible', async ({
  page,
}) => {
  const { email } = await createUserWithProfile('Daniela Ruiz');
  await loginViaUi(page, email);
  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Daniela Ruiz' })).toBeVisible();

  // Each mission on home links to its lesson.
  await expect(page.getByRole('link', { name: /^Lección de / })).toHaveCount(5);
  await page.getByRole('link', { name: 'Lee la lección' }).click();
  await expect(page).toHaveURL(/\/aprende\/m1-fundamentos$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Lo estéril se protege' }),
  ).toBeVisible();
  await expect(page.getByRole('note')).toContainText('pendiente de validación del director');
  await expect(page.getByRole('heading', { name: 'Errores frecuentes' })).toBeVisible();
  await expect(page.getByText('Así no').first()).toBeVisible();
  await expect(page.getByText('Así sí').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fuentes' })).toBeVisible();
  await expect(page.getByText(/OMS \(2018\)/).first()).toBeVisible();

  await page.getByRole('link', { name: 'Todas las lecciones' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Aprende' })).toBeVisible();
  for (const term of [
    'Campo estéril',
    'Técnica cerrada',
    'Circulante',
    'Instrumentador quirúrgico',
    'Zona estéril (de la bata)',
  ]) {
    await expect(page.getByRole('term').filter({ hasText: term })).toBeVisible();
  }

  await page.getByRole('link', { name: 'Abrir la lista de verificación' }).click();
  await expect(page.getByRole('button', { name: 'Imprimir la lista' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(11);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('banner')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Imprimir la lista' })).toBeHidden();
});
