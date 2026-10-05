// Shared e2e helpers for specs tagged @emu (they run inside `firebase emulators:exec`).
// UI contract these helpers rely on (built in step 2): the /login page has inputs labelled
// "Correo electrónico" and "Contraseña" and a button named "Iniciar sesión".
import type { Page } from '@playwright/test';

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const PROJECT_ID = 'demo-bata';

export const TEST_PASSWORD = 'Prueba-segura-123';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@ejemplo.test`;
}

export async function resetAuthEmulator(): Promise<void> {
  const res = await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`No se pudo limpiar el emulador de Auth: HTTP ${res.status}`);
}

export async function createEmulatorUser(
  email: string,
  password: string = TEST_PASSWORD,
): Promise<{ localId: string; idToken: string }> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`signUp en el emulador falló: HTTP ${res.status}`);
  return (await res.json()) as { localId: string; idToken: string };
}

export async function loginViaUi(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
