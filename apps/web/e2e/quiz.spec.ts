import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { createEmulatorUser, TEST_PASSWORD, uniqueEmail } from './helpers.ts';

const API_BASE = 'http://127.0.0.1:3001/v1/';
const FIRESTORE_DOCS = 'http://127.0.0.1:8080/v1/projects/demo-bata/databases/(default)/documents';

// Las respuestas correctas viven en el seed; el intento baraja preguntas y opciones, pero no el texto.
const seed = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../content/questions/seed.json'), 'utf8'),
) as {
  questions: {
    prompt: string;
    options: { id: string; text: string }[];
    correctOptionIds: string[];
  }[];
};

// El seed carga todas las preguntas como `draft`; deben ser visibles para el quiz.
test.beforeAll(async () => {
  const res = await fetch(`${FIRESTORE_DOCS}/appConfig/flags`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { showDraftQuestions: { booleanValue: true } } }),
  });
  if (!res.ok) throw new Error(`No se pudo activar los borradores: HTTP ${res.status}`);
});

/** Responde la pregunta en pantalla acertando o fallando, según el seed. */
async function answerCurrent(page: Page, outcome: 'correct' | 'wrong'): Promise<void> {
  const prompt = (await page.getByRole('heading', { level: 2 }).textContent())?.trim() ?? '';
  const question = seed.questions.find((q) => q.prompt === prompt);
  if (!question) throw new Error(`Pregunta fuera del seed: ${prompt}`);
  const options =
    outcome === 'correct'
      ? question.options.filter((o) => question.correctOptionIds.includes(o.id))
      : question.options.filter((o) => !question.correctOptionIds.includes(o.id)).slice(0, 1);
  for (const option of options) {
    await page.getByText(option.text, { exact: true }).first().click();
  }
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByText(outcome === 'correct' ? '¡Correcto!' : 'Incorrecto')).toBeVisible();
}

/** Recorre las N preguntas del intento y cierra el examen. */
async function answerAll(page: Page, outcome: 'correct' | 'wrong'): Promise<number> {
  const header = await page.getByText(/^Pregunta 1 de \d+$/).textContent();
  const total = Number(header?.match(/de (\d+)/)?.[1] ?? 0);
  if (!total) throw new Error('No se pudo leer el número de preguntas');
  for (let i = 0; i < total; i++) {
    await answerCurrent(page, outcome);
    if (i + 1 < total) {
      await page.getByRole('button', { name: /Siguiente pregunta/ }).click();
      await expect(page.getByText(`Pregunta ${i + 2} de ${total}`)).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Ver resultados' }).click();
    }
  }
  return total;
}

test('@emu registro, onboarding y examen perfecto: sella la misión y paga el XP', async ({
  page,
}) => {
  await page.goto('/registro');
  await page.getByLabel('Nombre').fill('Ana Pérez');
  await page.getByLabel('Correo electrónico').fill(uniqueEmail('quiz'));
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Completa tu perfil' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Acepto la/ })).toBeChecked();
  await expect(page.getByLabel('Nombre visible')).toHaveValue('Ana Pérez');
  await page.getByRole('checkbox', { name: /Acepto la/ }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Ana Pérez' })).toBeVisible();
  await expect(page.getByTestId('xp-pill')).toHaveText('0 XP');

  // Ir a la misión.
  await page.getByRole('link', { name: /Fundamentos de bioseguridad y asepsia/ }).click();
  await expect(page).toHaveURL(/\/mision\/m1-fundamentos$/);

  // Las reglas se ven antes de empezar.
  await expect(page.getByText(/Respondes cada pregunta una sola vez/)).toBeVisible();
  await page.getByRole('button', { name: 'Empezar misión' }).click();
  await expect(page.getByText(/1 \/ \d+/).or(page.getByText(/^Pregunta 1 de \d+$/))).toBeVisible({
    timeout: 8000,
  });

  // Acertar no paga XP: el XP es del examen, no de cada pregunta.
  await answerCurrent(page, 'correct');
  await expect(page.getByTestId('xp-pill')).toHaveText('0 XP');
  await expect(page.getByRole('button', { name: 'Responder' })).not.toBeVisible();

  // Terminar el resto del examen.
  const total = Number(
    (await page.getByText(/^Pregunta 1 de \d+$/).textContent())?.match(/de (\d+)/)?.[1] ?? 0,
  );
  for (let i = 1; i < total; i++) {
    await page.getByRole('button', { name: /Siguiente pregunta/ }).click();
    await expect(page.getByText(`Pregunta ${i + 1} de ${total}`)).toBeVisible();
    await answerCurrent(page, 'correct');
  }
  await page.getByRole('button', { name: 'Ver resultados' }).click();

  await expect(page.getByRole('heading', { name: '¡Misión sellada!' })).toBeVisible();
  await expect(page.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(page.getByText('+70', { exact: true })).toBeVisible();
  await expect(page.getByText(/incluye \+20 XP de misión perfecta/)).toBeVisible();

  // El perfil ya tiene el XP de la misión.
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page.getByTestId('xp-pill')).toHaveText('70 XP');
});

test('@emu fallar el examen no sella la misión ni da XP', async ({ page }) => {
  const email = uniqueEmail('falla');
  await createEmulatorUser(email);
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Completa tu perfil' })).toBeVisible();
  await page.getByLabel('Nombre visible').fill('Ana Pérez');
  await page.getByRole('checkbox', { name: /Acepto la/ }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Hola/ })).toBeVisible();

  await page
    .getByRole('link', { name: /Fundamentos de bioseguridad/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Empezar misión' }).click();
  await expect(page.getByText(/^Pregunta 1 de \d+$/)).toBeVisible({ timeout: 8000 });

  await answerAll(page, 'wrong');

  await expect(page.getByRole('heading', { name: 'No aprobaste' })).toBeVisible();
  await expect(page.getByRole('img', { name: '0 de 3 estrellas' })).toBeVisible();
  await expect(page.getByTestId('xp-pill')).toHaveText('0 XP');
  await expect(page.getByRole('button', { name: 'Reintentar misión' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preguntas para repasar' })).toBeVisible();

  // Sin XP y sin sello tras volver al inicio.
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page.getByTestId('xp-pill')).toHaveText('0 XP');
});

test('@emu botón Salir con confirmación cierra el intento y regresa al inicio', async ({
  page,
}) => {
  const email = uniqueEmail('salir');
  await createEmulatorUser(email);
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // Crear perfil (onboarding).
  await expect(page.getByRole('heading', { level: 1, name: 'Completa tu perfil' })).toBeVisible();
  await page.getByLabel('Nombre visible').fill('Ana Pérez');
  await page.getByRole('checkbox', { name: /Acepto la/ }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Hola/ })).toBeVisible();

  await page
    .getByRole('link', { name: /Fundamentos de bioseguridad/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Empezar misión' }).click();
  await expect(page.getByText(/^Pregunta 1 de \d+$/)).toBeVisible({ timeout: 8000 });

  // Salir con confirmación.
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, salir' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('xp-pill')).toHaveText('0 XP');
});

test('@emu un segundo 401 cierra la sesión y avisa que expiró', async ({ page }) => {
  const email = uniqueEmail('expira');
  await createEmulatorUser(email);
  await page.route('**/v1/**', (route) => {
    // El emulador de Auth también sirve `/v1/`; solo la API responde 401.
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
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByText('Tu sesión expiró, vuelve a iniciar sesión')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
});
