import { expect, test } from '@playwright/test';
import { createEmulatorUser, TEST_PASSWORD, uniqueEmail } from './helpers.ts';

const API_BASE = 'http://127.0.0.1:3001/v1/';
const FIRESTORE_DOCS = 'http://127.0.0.1:8080/v1/projects/demo-bata/databases/(default)/documents';

// The seed loads every question as `draft`; drafts must be visible for the quiz to show them.
test.beforeAll(async () => {
  const res = await fetch(`${FIRESTORE_DOCS}/appConfig/flags`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { showDraftQuestions: { booleanValue: true } } }),
  });
  if (!res.ok) throw new Error(`No se pudo activar los borradores: HTTP ${res.status}`);
});

test('@emu registro, onboarding y primera respuesta correcta suman XP', async ({ page }) => {
  await page.goto('/registro');
  await page.getByLabel('Nombre').fill('Ana Pérez');
  await page.getByLabel('Correo electrónico').fill(uniqueEmail('quiz'));
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Completa tu perfil' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Acepto la/ })).toBeChecked();
  await expect(page.getByLabel('Nombre visible')).toHaveValue('Ana Pérez');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Ana Pérez' })).toBeVisible();
  await expect(page.getByTestId('xp-pill')).toHaveText('0 XP');
  await expect(page.getByText('Nivel 1')).toBeVisible();
  await expect(page.getByText('0 días de racha')).toBeVisible();
  const missions = page.getByRole('listitem').filter({ hasText: /^Misión \d/ });
  await expect(missions.first()).toContainText('Fundamentos de bioseguridad y asepsia');

  await page.getByRole('link', { name: /Fundamentos de bioseguridad y asepsia/ }).click();
  await expect(page).toHaveURL(/\/mision\/m1-fundamentos$/);
  const first = page.getByRole('listitem').filter({ hasText: /^1\. / });
  await expect(first.getByText('Borrador')).toBeVisible();
  await first.getByLabel(/conjunto de prácticas que impiden/).check();
  await first.getByRole('button', { name: 'Responder' }).click();

  await expect(first.getByText('¡Correcto!')).toBeVisible();
  await expect(first.getByText(/La asepsia busca evitar la contaminación/)).toBeVisible();
  await expect(first.getByText(/Fuente: CDC, «Guideline for Disinfection/)).toContainText(
    '(2008), Definiciones y terminología',
  );
  await expect(first.getByText('+10 XP')).toBeVisible();
  await expect(page.getByTestId('xp-pill')).toHaveText('10 XP');
});

test('@emu un segundo 401 cierra la sesión y avisa que expiró', async ({ page }) => {
  const email = uniqueEmail('expira');
  await createEmulatorUser(email);
  await page.route('**/v1/**', (route) => {
    // The Auth emulator also serves `/v1/` paths; only the API answers 401.
    if (!route.request().url().startsWith(API_BASE)) return route.fallback();
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    return route.fulfill({
      status: 401,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Token inválido' } }),
    });
  });
  // Not loginViaUi: the app bounces back to /login too fast for its waitForURL.
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByText('Tu sesión expiró, vuelve a iniciar sesión')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
});
