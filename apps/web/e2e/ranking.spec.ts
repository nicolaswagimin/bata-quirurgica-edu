import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const seed = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../content/questions/seed.json'), 'utf8'),
) as {
  questions: { id: string; correctOptionIds: string[] }[];
};

/** Aprueba una misión completa y devuelve el XP total del perfil. */
async function completeMission(idToken: string, missionId = 'm1-fundamentos'): Promise<number> {
  const attempt = (await (
    await callApi(idToken, 'POST', '/quiz/attempt', { missionId })
  ).json()) as { attemptId: string; questions: { id: string }[] };
  for (const question of attempt.questions) {
    const key = seed.questions.find((q) => q.id === question.id);
    if (!key) throw new Error(`Pregunta fuera del seed: ${question.id}`);
    await callApi(idToken, 'POST', '/quiz/answer', {
      attemptId: attempt.attemptId,
      questionId: question.id,
      selectedOptionIds: key.correctOptionIds,
    });
  }
  const result = (await (
    await callApi(idToken, 'POST', '/quiz/finish', { attemptId: attempt.attemptId })
  ).json()) as { totalXp: number };
  return result.totalXp;
}

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
  const mateXp = await completeMission(mate.idToken);
  await expect(rows.first()).toContainText(`Compañera ${suffix}`);
  await expect(rows.first()).toContainText(`${mateXp} XP`);
  const outsiderXp = await completeMission(outsider.idToken);
  await expect(rows.filter({ hasText: `Externo ${suffix}` })).toContainText(`${outsiderXp} XP`);
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
