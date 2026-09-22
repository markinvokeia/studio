/**
 * Limpieza de los datos que dejan las demos en la base de DEV.
 *
 *   npx playwright test --config=playwright.help.config.ts --project=audit -g "limpieza"
 *
 * Sólo borra registros con el marcador « · demo » que ponen los specs. Nunca
 * toca nada que no haya creado una demo: la base es compartida.
 *
 * Hace falta porque un spec que falla a mitad de camino deja su rastro, y ese
 * rastro después aparece en cámara en todos los videos siguientes.
 */
import path from 'node:path';

import { test } from '@playwright/test';

/** Marcador que los specs agregan a todo lo que crean. */
const DEMO_MARK = /· demo/i;

test('limpieza de datos de demo', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '../../.auth/demo-user.json'),
    viewport: { width: 1280, height: 720 },
    locale: 'es',
  });
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);

  // ── Notas adhesivas ───────────────────────────────────────────────────────
  await page.getByTestId('rail-notas').click();
  await page.waitForTimeout(2_000);

  const found = await page.getByText(DEMO_MARK).count();
  let deleted = 0;

  for (let guard = 0; guard < 25; guard += 1) {
    const card = page.getByText(DEMO_MARK).first();
    if (!(await card.isVisible().catch(() => false))) break;

    const holder = card.locator('xpath=ancestor::*[.//button[@title="Eliminar nota"]][1]');
    const del = holder.locator('button[title="Eliminar nota"]').first();
    if (!(await del.isVisible().catch(() => false))) break;

    await del.click();
    await page.waitForTimeout(1_500);
    deleted += 1;
  }

  const left = await page.getByText(DEMO_MARK).count();
  console.log(`\nNotas adhesivas: ${found} encontradas · ${deleted} borradas · ${left} quedan`);
  if (left > 0) console.log('  ⚠ Quedaron notas sin borrar: revisalas a mano.');

  await context.close();
});

test('limpieza de citas de demo', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '../../.auth/demo-user.json'),
    viewport: { width: 1280, height: 720 },
    locale: 'es',
  });
  const page = await context.newPage();
  await page.goto('/appointments', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Hoy' }).waitFor({ timeout: 30_000 });

  const sede = page.getByRole('alertdialog').filter({ hasText: 'Selecciona una sede' });
  if (await sede.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await sede.getByRole('button').first().click();
    await page.waitForTimeout(2_000);
  }
  await page.waitForTimeout(3_000);

  const demoEvents = () =>
    page
      .locator(
        '[data-testid="calendar-event"], [data-testid="calendar-day-event"], [data-testid="calendar-month-agenda-event"], [data-testid="calendar-schedule-event"]',
      )
      .filter({ hasText: DEMO_MARK });

  const found = await demoEvents().count();
  let deleted = 0;

  for (let guard = 0; guard < 25; guard += 1) {
    const card = demoEvents().first();
    if (!(await card.isVisible().catch(() => false))) break;

    await card.click({ button: 'right' });
    const del = page.getByRole('menuitem', { name: /^eliminar/i }).first();
    if (!(await del.isVisible({ timeout: 4_000 }).catch(() => false))) {
      await page.keyboard.press('Escape');
      break;
    }
    await del.click();
    const confirm = page.getByRole('button', { name: /eliminar|confirmar|sí/i }).last();
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) await confirm.click();
    await page.waitForTimeout(2_000);
    deleted += 1;
  }

  const left = await demoEvents().count();
  console.log(`\nCitas de demo: ${found} encontradas · ${deleted} borradas · ${left} quedan`);
  if (left > 0) console.log('  ⚠ Quedaron citas sin borrar: revisalas a mano en el calendario.');

  await context.close();
});
