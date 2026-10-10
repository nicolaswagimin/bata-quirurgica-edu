import { expect, test } from '@playwright/test';
import {
  createGroup,
  createUserWithProfile,
  loginViaUi,
  TEST_PASSWORD,
  unusedJoinCode,
} from './helpers.ts';

test('@emu unirse a un grupo con código existente e inexistente', async ({ page }) => {
  const group = await createGroup('Instrumentación 3B');
  const user = await createUserWithProfile('Laura Gómez');
  await loginViaUi(page, user.email);
  await page.goto('/perfil');

  await expect(page.getByRole('heading', { level: 1, name: 'Tu perfil' })).toBeVisible();
  await expect(page.getByText('Laura Gómez')).toBeVisible();
  const code = page.getByLabel('Código de grupo');
  const submit = page.getByRole('button', { name: 'Unirme al grupo' });

  await code.fill(unusedJoinCode());
  await submit.click();
  await expect(page.getByText('No encontramos un grupo con ese código')).toBeVisible();
  await expect(code).toHaveAttribute('aria-invalid', 'true');

  await code.fill(group.joinCode);
  await submit.click();
  await expect(page.getByText('Te uniste al grupo')).toBeVisible();
  await expect(page.getByText(/Ya perteneces a un grupo/)).toBeVisible();
});

test('@emu eliminar la cuenta cierra sesión y bloquea el siguiente ingreso', async ({ page }) => {
  const user = await createUserWithProfile('Mario Ruiz');
  await loginViaUi(page, user.email);
  await page.goto('/perfil');

  const dialog = page.getByRole('dialog', { name: '¿Eliminar tu cuenta?' });
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  await dialog.getByRole('button', { name: 'Sí, eliminar mi cuenta' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();

  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
