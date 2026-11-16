import { expect, test } from '@playwright/test';
import privacidad from '../../../content/legal/privacidad.json' with { type: 'json' };

for (const path of ['/ingresar', '/registro', '/privacidad']) {
  test(`${path} responde 200 y tiene un solo h1`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });
}

test('un visitante anónimo en /perfil es redirigido a /ingresar', async ({ page }) => {
  await page.goto('/perfil');
  await expect(page).toHaveURL(
    (url) => url.pathname === '/ingresar' && url.searchParams.get('redirect') === '/perfil',
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
});

test('un visitante anónimo en / permanece en /', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toHaveCount(0);
});

for (const path of ['/login', '/login?redirect=%2Franking']) {
  test(`${path} redirige a /ingresar y conserva redirect`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/ingresar' &&
        url.searchParams.get('redirect') === (path.includes('?') ? '/ranking' : null),
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  });
}

test('/registro sin consentimiento muestra el error y no llama a Firebase Auth', async ({
  page,
}) => {
  const authRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('identitytoolkit') || url.includes(':9099')) authRequests.push(url);
  });
  await page.goto('/registro');
  await page.getByLabel('Nombre').fill('Ana Pérez');
  await page.getByLabel('Correo electrónico').fill('ana@ejemplo.test');
  await page.getByLabel('Contraseña').fill('Prueba-segura-123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(
    page.getByText('Debes aceptar la política de tratamiento de datos para continuar'),
  ).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  expect(authRequests).toEqual([]);
});

test('/ingresar expone correo, contraseña y el botón Iniciar sesión', async ({ page }) => {
  await page.goto('/ingresar');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('/privacidad muestra todas las secciones y el aviso de la cámara', async ({ page }) => {
  await page.goto('/privacidad');
  for (const section of privacidad.sections) {
    await expect(page.getByRole('heading', { level: 2, name: section.heading })).toBeVisible();
  }
  await expect(page.getByText('Ninguna imagen ni video se envía a ningún servidor')).toBeVisible();
});
