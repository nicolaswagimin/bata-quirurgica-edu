import { expect, test } from '@playwright/test';
import { LANDING_COPY as copy, DIALOGUE_LINES } from '../src/components/landing-copy.ts';

test('portada anónima y enlaces de acceso', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.title);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByText(copy.virtual)).toBeVisible();
  for (const [name, path] of [
    [copy.create, '/registro'],
    [copy.login, '/ingresar'],
  ] as const) {
    const links = page.getByRole('main').getByRole('link', { name, exact: true });
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute('href', path);
    await links.first().click();
    await expect(page).toHaveURL((url) => url.pathname === path);
    await page.goto('/');
  }
});

test('diálogo: completar, avanzar con controles y burbuja, saltar y reiniciar', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/');
  const dialogue = page.getByRole('region', { name: copy.dialogueLabel });
  const live = dialogue.locator('[aria-live="polite"]');
  await expect(live).toHaveText(DIALOGUE_LINES[0]);
  await page.clock.pauseAt(new Date());
  const next = page.getByRole('button', { name: copy.next, exact: true });
  await next.click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(DIALOGUE_LINES[0]);
  await expect(live).toHaveText(DIALOGUE_LINES[0]);
  await next.click();
  await expect(live).toHaveText(DIALOGUE_LINES[1]);
  await dialogue.locator('figure').click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(DIALOGUE_LINES[1]);
  await dialogue.locator('figure').click();
  await expect(live).toHaveText(DIALOGUE_LINES[2]);
  await page.getByRole('button', { name: copy.skip, exact: true }).click();
  await expect(dialogue.getByText('5 de 5')).toBeVisible();
  await expect(page.getByTestId('dialogue-text')).toHaveText(DIALOGUE_LINES[4]);
  await page.getByRole('button', { name: copy.restart }).click();
  await expect(live).toHaveText(DIALOGUE_LINES[0]);
});

test('transcripción estática y regreso', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: copy.transcript }).click();
  const transcript = page.getByRole('region', { name: copy.dialogueLabel }).locator('ol');
  await expect(transcript.locator('li')).toHaveText([...DIALOGUE_LINES]);
  await expect(page.getByRole('button', { name: copy.back })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: copy.back }).click();
  await expect(transcript).toHaveCount(0);
  await expect(page.getByTestId('dialogue-text')).toHaveText(DIALOGUE_LINES[0]);
});

test('movimiento reducido muestra líneas completas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('dialogue-text')).toHaveText(DIALOGUE_LINES[0]);
  await page.getByRole('button', { name: copy.next, exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(DIALOGUE_LINES[1]);
});

test('360px: sin desbordamiento y CTA en el primer viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const cta = page.getByRole('link', { name: copy.create, exact: true }).first();
  await expect(cta).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('portada no descarga motores 3D, cámara ni videos', async ({ page }) => {
  const forbidden: string[] = [];
  page.on('request', (request) => {
    if (/three|mediapipe|model-viewer|\.glb|\.mp4|\.webm|vision_wasm/i.test(request.url()))
      forbidden.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('heading', { name: copy.finalTitle }).scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  expect(forbidden).toEqual([]);
});

test('FAQ y política de privacidad', async ({ page }) => {
  await page.goto('/');
  await page.getByText('¿La cámara envía imágenes?', { exact: true }).click();
  await expect(
    page.getByText(
      'No. El espejo procesa la cámara en tu navegador; ninguna imagen ni video sale de tu equipo ni se guarda.',
    ),
  ).toBeVisible();
  await page.getByText('¿Qué datos se guardan?', { exact: true }).click();
  await page.getByRole('link', { name: copy.privacy }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/privacidad');
});
