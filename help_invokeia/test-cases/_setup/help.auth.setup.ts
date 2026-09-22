/**
 * Login de la suite de videos. Escribe su propio storageState para no pisar el
 * de la suite de QA (`e2e/.auth/user.json`).
 *
 * A diferencia de `e2e/fixtures/auth.setup.ts`, acá NO se espera al <video> de
 * fondo del login: es decoración, el formulario nunca dependió de él, y ese
 * `waitForSelector('video')` revienta cuando el video no monta (viewport
 * angosto o códec no disponible).
 */
import { test as setup, expect } from '@playwright/test';

import { AUTH_FILE } from '../../lib/demo.fixture';

/** SedeSelectionModal.title en src/messages/es.json */
const T_SEDE_MODAL_TITLE = 'Selecciona una sede';

setup('autenticar usuario de demo', async ({ page }) => {
  const email = process.env.DEMO_USER ?? process.env.E2E_USER;
  const password = process.env.DEMO_PASS ?? process.env.E2E_PASS;

  if (!email || !password) {
    throw new Error('Definí DEMO_USER/DEMO_PASS (o E2E_USER/E2E_PASS) en .env.local');
  }

  await page.goto('/login');

  await page.locator('#email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /iniciar sesión|entrar|ingresar|sign in/i }).click();

  await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 25_000 });

  // Si el usuario no tiene sede de trabajo, la app muestra un modal que tapa
  // toda la pantalla y que NO se puede cerrar con Escape (`onEscapeKeyDown` está
  // prevenido en sede-selection-modal.tsx). Sin resolverlo acá, ese modal
  // bloquearía cualquier clic en todas las demos.
  const sedeModal = page.getByRole('alertdialog').filter({ hasText: T_SEDE_MODAL_TITLE });
  if (await sedeModal.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const firstSede = sedeModal.getByRole('button').first();
    const name = await firstSede.innerText().catch(() => '?');
    await firstSede.click();
    await expect(sedeModal).toBeHidden({ timeout: 15_000 });
    console.log(`  Sede de trabajo seleccionada para la grabación: ${name.trim()}`);
  }

  await page.context().storageState({ path: AUTH_FILE });

  // Aviso, no error: grabar contra `next dev` funciona (el overlay tapa el badge
  // por CSS), pero mete pausas de compilación on-demand en los videos.
  const isDevServer = await page
    .locator('nextjs-portal, [data-nextjs-dev-overlay]')
    .count()
    .then((n) => n > 0)
    .catch(() => false);
  if (isDevServer) {
    console.warn(
      '\n⚠  Estás grabando contra el servidor de desarrollo.\n' +
        '   Para videos fluidos: pnpm help:serve  (pnpm build && pnpm start) en otra terminal.\n',
    );
  }
});
