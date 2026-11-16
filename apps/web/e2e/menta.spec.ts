import { expect, test } from '@playwright/test';
import lessons from '../../../content/lecciones/lecciones.json' with { type: 'json' };
import { createUserWithProfile, loginViaUi } from './helpers.ts';

const mascotName = 'Dra. Menta, asistente virtual: mostrar un mensaje';

test.beforeEach(async ({ page }) => {
  const { email } = await createUserWithProfile('Menta estudiante');
  await loginViaUi(page, email);
});

test('@emu Menta saluda y permite cerrar el mensaje', async ({ page }) => {
  await expect(page.getByTestId('menta-status')).toContainText(
    'Aprueba una misión hoy y empiezas tu racha.',
    { timeout: 5000 },
  );
  const bubble = page.getByTestId('menta-bubble');
  await expect(bubble.getByRole('button', { name: 'Silenciar', exact: true })).toBeVisible();
  await bubble.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(bubble).toHaveAttribute('data-open', 'false');
  await expect(page.getByRole('button', { name: mascotName })).toBeFocused();
  await expect(page.getByTestId('menta-status')).toBeEmpty();
});

test('@emu Menta muestra un dato literal con fuente al pulsarla', async ({ page }) => {
  await page.getByRole('button', { name: mascotName }).click();
  const bubble = page.getByTestId('menta-bubble');
  await expect(bubble).toContainText('¿Sabías que…?');
  await expect(bubble).toContainText('Fuente:');
  const text = await bubble.innerText();
  expect(
    lessons.lessons
      .flatMap((lesson) => lesson.keyPoints)
      .some((point) => text.includes(point.text)),
  ).toBe(true);
});

test('@emu silenciar persiste y el perfil permite reactivar', async ({ page }) => {
  await page.getByRole('button', { name: mascotName }).click();
  await page
    .getByTestId('menta-bubble')
    .getByRole('button', { name: 'Silenciar', exact: true })
    .click();
  await expect(page.getByRole('button', { name: mascotName })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: mascotName })).toBeVisible();
  await page.waitForTimeout(6000);
  await expect(page.getByTestId('menta-status')).toBeEmpty();
  await page.getByRole('button', { name: mascotName }).click();
  await expect(page.getByTestId('menta-bubble')).toContainText('¿Sabías que…?');
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Perfil' })
    .click();
  const toggle = page.getByRole('switch', { name: 'Mensajes de la Dra. Menta' });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText('Silenciados', { exact: true })).toBeVisible();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(page.getByText('Activados', { exact: true })).toBeVisible();
});

test('@emu la mascota no aparece durante una misión', async ({ page }) => {
  await page.goto(`/mision/${lessons.lessons[0]?.missionId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: mascotName })).toHaveCount(0);
});

test('@emu la mascota cabe en móvil y queda encima de la navegación', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const mascot = page.getByRole('button', { name: mascotName });
  await expect(mascot).toBeVisible();
  const box = await mascot.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Principal' }).boundingBox();
  expect(box).not.toBeNull();
  expect(nav).not.toBeNull();
  if (!box || !nav) throw new Error('Faltan los límites de mascota o navegación');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y + box.height).toBeLessThanOrEqual(Math.min(740, nav.y));
});

test('@emu conserva eventos mientras la burbuja está abierta', async ({ page }) => {
  const status = page.getByTestId('menta-status');
  await expect(status).toContainText('Aprueba una misión hoy', { timeout: 5000 });
  const original = await status.textContent();
  const bubble = page.getByTestId('menta-bubble');
  await bubble.hover();
  await page.clock.install();
  const pendingKey = await page.evaluate(() => {
    const stateKey = Object.keys(sessionStorage).find((key) => key.startsWith('bata.menta.state.'));
    if (!stateKey) throw new Error('Falta estado por usuario');
    const key = stateKey.replace('bata.menta.state.', 'bata.menta.pending.');
    sessionStorage.setItem(key, JSON.stringify([{ type: 'level', level: 2 }]));
    window.dispatchEvent(new Event('menta:event'));
    document.dispatchEvent(new Event('visibilitychange'));
    return key;
  });
  await page.clock.fastForward(30_000);
  await expect(status).toHaveText(original ?? '');
  expect(
    await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '[]'), pendingKey),
  ).toEqual([{ type: 'level', level: 2 }]);
  await bubble.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(status).toContainText('¡Subiste al nivel 2!');
  await expect(page.getByRole('button', { name: mascotName })).toBeFocused();
});
