import { expect, type Page, test } from '@playwright/test';
import { createEmulatorUser, loginViaUi, uniqueEmail, waitForHomeSettled } from './helpers.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NDJSON = [
  { type: 'delta', text: 'Ata la bata ' },
  { type: 'delta', text: 'por detrás con ayuda.' },
  {
    type: 'citations',
    items: [{ n: 1, title: 'Manual de bioseguridad', org: 'MinSalud', section: 'Sección 4.2' }],
  },
  { type: 'done', latencyMs: 80 },
]
  .map((e) => `${JSON.stringify(e)}\n`)
  .join('');

async function mockChat(page: Page, status: number): Promise<{ calls: number }> {
  const counter = { calls: 0 };
  await page.route('**/v1/assistant/chat', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    counter.calls++;
    if (status === 200) {
      await route.fulfill({
        status,
        headers: { ...CORS, 'Content-Type': 'application/x-ndjson; charset=utf-8' },
        body: NDJSON,
      });
      return;
    }
    const code = status === 401 ? 'UNAUTHORIZED' : 'QUOTA_EXCEEDED';
    await route.fulfill({
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { code, message: 'x' } }),
    });
  });
  return counter;
}

async function stubSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance) => w.__spoken.push(u.text),
        cancel: () => undefined,
        getVoices: () => [],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

async function signIn(page: Page): Promise<void> {
  const email = uniqueEmail('asistente');
  await createEmulatorUser(email);
  await loginViaUi(page, email);
  await waitForHomeSettled(page);
}

async function ask(page: Page, question: string): Promise<void> {
  await page.getByRole('button', { name: 'Abrir asistente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Asistente de bioseguridad' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Tu pregunta').fill(question);
  await dialog.getByRole('button', { name: 'Enviar' }).click();
}

test('@emu el avatar del asistente está fijo arriba a la izquierda sin tocar la navegación', async ({
  page,
}) => {
  await signIn(page);
  for (const path of ['/', '/ranking', '/perfil']) {
    await page.goto(path);
    const avatar = page.getByRole('button', { name: 'Abrir asistente' });
    await expect(avatar).toBeVisible();
    const box = await avatar.boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Principal' }).boundingBox();
    if (!box || !nav) throw new Error('Sin caja del avatar o de la navegación');
    expect(box.x).toBeLessThanOrEqual(16);
    expect(box.y).toBeLessThanOrEqual(16);
    expect(box.width).toBeGreaterThanOrEqual(44);
    const intersects =
      box.x < nav.x + nav.width &&
      nav.x < box.x + box.width &&
      box.y < nav.y + nav.height &&
      nav.y < box.y + box.height;
    expect(intersects).toBe(false);
    const style = await avatar.evaluate((el) => {
      const s = getComputedStyle(el);
      return { position: s.position, zIndex: Number(s.zIndex) };
    });
    expect(style.position).toBe('fixed');
    expect(style.zIndex).toBeGreaterThanOrEqual(50);
  }
});

test('@emu la respuesta llega en streaming con citas y se lee en voz alta una vez', async ({
  page,
}) => {
  await stubSpeech(page);
  await mockChat(page, 200);
  await signIn(page);
  await page.getByRole('button', { name: 'Abrir asistente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Asistente de bioseguridad' });
  await dialog.getByRole('switch', { name: 'Leer en voz alta' }).check();
  await dialog.getByLabel('Tu pregunta').fill('¿Cómo se amarra la bata?');
  await dialog.getByRole('button', { name: 'Enviar' }).click();

  const live = dialog.locator('[aria-live="polite"]');
  await expect(live).toHaveText('Ata la bata por detrás con ayuda.');
  await expect(dialog.getByRole('list', { name: 'Fuentes' })).toContainText(
    '[1] MinSalud — Manual de bioseguridad, Sección 4.2',
  );
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken))
    .toEqual(['Ata la bata por detrás con ayuda.']);
  await expect(live).toBeVisible();
});

test('@emu 401 tras reintentar muestra que la sesión expiró', async ({ page }) => {
  const counter = await mockChat(page, 401);
  await signIn(page);
  await ask(page, 'Hola');
  await expect(page.getByText('Tu sesión expiró, vuelve a iniciar sesión')).toBeVisible();
  expect(counter.calls).toBe(2);
});

test('@emu 429 muestra el límite de mensajes', async ({ page }) => {
  await mockChat(page, 429);
  await signIn(page);
  await ask(page, 'Hola');
  await expect(page.getByText('Alcanzaste el límite de mensajes; intenta más tarde')).toBeVisible();
});
