/**
 * Verificación visual del overlay. No graba video: saca capturas de los tres
 * estados (cartel, subtítulo + cursor + halo, y desenfoque) para poder mirarlas
 * a ojo después de tocar estilos.
 *
 *   npx playwright test --config=playwright.help.config.ts --project=overlay-visual
 *
 * Las capturas quedan en help_invokeia/.artifacts/overlay/.
 */
import path from 'node:path';

import { test, expect } from '@playwright/test';

import { BRAND, BRAND_CONTACT } from '../../lib/brand';
import { INVOKEIA_LOGO_DATA_URI } from '../../lib/brand-logo';
import { installOverlay } from '../../lib/overlay';

const OUT = path.resolve(__dirname, '../../.artifacts/overlay');

test('el overlay se instala y se ve', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '../../.auth/demo-user.json'),
    viewport: { width: 1280, height: 720 },
    locale: 'es',
  });
  await context.addInitScript(installOverlay, {
    id: 'q014',
    title: '¿Cómo cambio el idioma?',
    kicker: 'Parte 0 · PARA TODOS',
    hideNextBadge: true,
    logo: INVOKEIA_LOGO_DATA_URI,
    contact: BRAND_CONTACT,
    copyright: BRAND.copyright,
    introMs: 2500,
  });

  const page = await context.newPage();
  await page.goto('/preferences', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // 1) el API quedó instalada (la falla anterior era que nunca llegaba a instalarse)
  expect(await page.evaluate(() => typeof window.__demo)).toBe('object');

  // 2) el overlay de dev de Next está oculto y ya no intercepta clics
  const blocked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="sidebar-avatar-trigger"]');
    if (!el) return 'avatar ausente';
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.tagName ?? 'nada';
  });
  expect(blocked, 'nextjs-portal no debe tapar el avatar').not.toBe('NEXTJS-PORTAL');

  // 3) cartel de título
  await page.evaluate(() =>
    window.__demo?.card('Parte 0 · PARA TODOS', '¿Cómo cambio el idioma?', 'Avatar → Idioma'),
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '1-card.png') });

  // 4) subtítulo + cursor + halo sobre el avatar
  const avatar = page.getByTestId('sidebar-avatar-trigger');
  const box = await avatar.boundingBox();
  expect(box).not.toBeNull();
  await page.evaluate(
    (b) => {
      window.__demo?.off();
      window.__demo?.lower('Pulsá tu avatar, abajo en la barra lateral', '1');
      window.__demo?.halo(b);
      window.__demo?.cursorTo(b.x + b.width / 2, b.y + b.height / 2, 300);
    },
    box!,
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '2-lower-cursor-halo.png') });

  // 5) el overlay NO debe ser visible para los selectores de la app
  await expect(
    page.getByText('Pulsá tu avatar, abajo en la barra lateral'),
    'el shadow root closed debe ocultar el overlay del selector engine',
  ).toHaveCount(0);

  await context.close();
  console.log(`\nCapturas en ${OUT}`);
});
