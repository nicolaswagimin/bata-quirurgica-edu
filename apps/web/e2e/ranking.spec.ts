import { expect, test } from '@playwright/test';
import {
  callApi,
  clearLeaderboard,
  createEmulatorUser,
  createGroup,
  createUserWithProfile,
  loginViaUi,
  uniqueEmail,
} from './helpers.ts';

const FIRESTORE_DOCS = 'http://127.0.0.1:8080/v1/projects/demo-bata/databases/(default)/documents';

// The seed loads every question as `draft`; drafts must be visible to be answered.
test.beforeAll(async () => {
  const res = await fetch(`${FIRESTORE_DOCS}/appConfig/flags`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { showDraftQuestions: { booleanValue: true } } }),
  });
  if (!res.ok) throw new Error(`No se pudo activar los borradores: HTTP ${res.status}`);
});

const answerQ01 = (idToken: string) =>
  callApi(idToken, 'POST', '/quiz/answer', { questionId: 'q01', selectedOptionIds: ['b'] });

test('@emu ranking vacío muestra el mensaje de bienvenida', async ({ page }) => {
  await clearLeaderboard();
  const email = uniqueEmail('vacio');
  await createEmulatorUser(email);
  await loginViaUi(page, email);
  await page.goto('/ranking');

  await expect(page.getByRole('heading', { level: 1, name: 'Ranking' })).toBeVisible();
  await expect(page.getByText('Aún no hay puntajes. ¡Responde tu primera misión!')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Mi grupo' })).toHaveCount(0);
});

test('@emu el ranking se actualiza en vivo y filtra por grupo', async ({ page }) => {
  const suffix = Date.now().toString(36);
  const group = await createGroup('Cirugía 7A');
  const me = await createUserWithProfile(`Yo ${suffix}`, group.joinCode);
  const mate = await createUserWithProfile(`Compañera ${suffix}`, group.joinCode);
  const outsider = await createUserWithProfile(`Externo ${suffix}`);

  await loginViaUi(page, me.email);
  await page.goto('/ranking');
  const rows = page.getByRole('list', { name: 'Posiciones' }).getByRole('listitem');
  await expect(rows.filter({ hasText: `Yo ${suffix}` })).toContainText('0 XP');

  // Another user's XP changes on the server: the open page updates without a reload.
  await answerQ01(mate.idToken);
  await expect(rows.first()).toContainText(`Compañera ${suffix}`);
  await expect(rows.first()).toContainText('10 XP');
  await answerQ01(outsider.idToken);
  await expect(rows.filter({ hasText: `Externo ${suffix}` })).toContainText('10 XP');
  expect(await rows.count()).toBeLessThanOrEqual(20);

  await page.getByRole('tab', { name: 'Mi grupo' }).click();
  await expect(page.getByRole('tab', { name: 'Mi grupo' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(rows.first()).toContainText(`Compañera ${suffix}`);
  await expect(rows.filter({ hasText: `Yo ${suffix}` })).toHaveCount(1);
  await expect(rows.filter({ hasText: `Externo ${suffix}` })).toHaveCount(0);
  await expect(rows).toHaveCount(2);
});
