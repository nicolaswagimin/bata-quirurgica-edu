// Shared e2e helpers for specs tagged @emu (they run inside `firebase emulators:exec`).
// UI contract these helpers rely on (built in step 2): the /login page has inputs labelled
// "Correo electrónico" and "Contraseña" and a button named "Iniciar sesión".
import { POLICY_VERSION } from '@bata/shared/schemas';
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

const API_BASE = 'http://127.0.0.1:3001/v1';
const FIRESTORE_DOCS = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

function randomToken(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
    '',
  );
}

// Groups are server-only data: specs create them through the Firestore emulator REST API.
export async function createGroup(name: string): Promise<{ groupId: string; joinCode: string }> {
  const groupId = `g-${randomToken(10).toLowerCase()}`;
  const joinCode = randomToken(6);
  const res = await fetch(`${FIRESTORE_DOCS}/groups?documentId=${groupId}`, {
    method: 'POST',
    headers: OWNER,
    body: JSON.stringify({
      fields: { name: { stringValue: name }, joinCode: { stringValue: joinCode } },
    }),
  });
  if (!res.ok) throw new Error(`No se pudo crear el grupo: HTTP ${res.status}`);
  return { groupId, joinCode };
}

export function unusedJoinCode(): string {
  return randomToken(6);
}

export async function clearLeaderboard(): Promise<void> {
  const res = await fetch(`${FIRESTORE_DOCS}/leaderboard?pageSize=300`, { headers: OWNER });
  if (!res.ok) throw new Error(`No se pudo leer el leaderboard: HTTP ${res.status}`);
  const { documents = [] } = (await res.json()) as { documents?: { name: string }[] };
  for (const doc of documents) {
    const id = doc.name.split('/').pop() ?? '';
    const del = await fetch(`${FIRESTORE_DOCS}/leaderboard/${id}`, {
      method: 'DELETE',
      headers: OWNER,
    });
    if (!del.ok) throw new Error(`No se pudo borrar leaderboard/${id}: HTTP ${del.status}`);
  }
}

export async function callApi(
  idToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} falló: HTTP ${res.status} ${await res.text()}`);
  return res;
}

// Creates an Auth user plus its profile (POST /me), optionally inside a group.
export async function createUserWithProfile(
  displayName: string,
  groupCode?: string,
): Promise<{ email: string; idToken: string; localId: string }> {
  const email = uniqueEmail('perfil');
  const user = await createEmulatorUser(email);
  await callApi(user.idToken, 'POST', '/me', {
    displayName,
    consent: { policyVersion: POLICY_VERSION, accepted: true },
    ...(groupCode ? { groupCode } : {}),
  });
  return { email, ...user };
}
