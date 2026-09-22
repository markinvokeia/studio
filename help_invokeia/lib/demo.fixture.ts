/* eslint-disable react-hooks/rules-of-hooks --
 * El `use()` de los fixtures de Playwright no tiene nada que ver con los hooks
 * de React, pero el plugin lo detecta por el nombre. Falso positivo.
 */
/**
 * Fixtures de la suite de videos.
 *
 * El punto delicado es el nombrado del `.webm`. Playwright escribe el video en
 * un directorio con hash y `Video.saveAs()` documenta que *espera a que la
 * página se cierre*; llamarlo desde un `afterEach` (donde la página sigue
 * abierta) se cuelga hasta el timeout. Por eso sobreescribimos el fixture
 * `context`: así controlamos el ciclo de vida y podemos cerrar el contexto
 * ANTES de guardar, con lo que `saveAs()` resuelve de inmediato.
 *
 * Tener contexto propio además habilita dos cosas que necesitamos igual:
 * `addInitScript` a nivel de contexto (el overlay existe desde el primer frame)
 * y `storageState` por test (q001 login y q005 logout necesitan sesión limpia).
 */
import fs from 'node:fs';
import path from 'node:path';

import { test as base, expect, type Page } from '@playwright/test';

import { BRAND, BRAND_CONTACT } from './brand';
import { INVOKEIA_LOGO_DATA_URI } from './brand-logo';
import { Demo } from './demo';
import { installOverlay } from './overlay';
import { requireGroup, videoNameFor } from './registry';
import { DEMO_DRY, T } from './timing';

const ROOT = path.resolve(__dirname, '..');
const VIDEOS = path.join(ROOT, 'videos');
const REJECTED = path.join(VIDEOS, '_rejected');
const RAW = path.join(ROOT, '.raw-video');
export const AUTH_FILE = path.join(ROOT, '.auth/demo-user.json');

type DemoOptions = {
  /** Ids del manual que documenta este video: uno, o dos de la misma subsección. */
  qids: string[];
  /** `anonymous` arranca sin sesión: para login, logout y el portal del paciente. */
  demoAuth: 'session' | 'anonymous';
};

type DemoFixtures = {
  demo: Demo;
};

export const test = base.extend<DemoOptions & DemoFixtures>({
  qids: [['q000'], { option: true }],
  demoAuth: ['session', { option: true }],

  // ── el corazón del mecanismo de grabación ───────────────────────────────
  context: async (
    { browser, qids, demoAuth, viewport, locale, timezoneId, colorScheme, baseURL },
    use,
    testInfo,
  ) => {
    const questions = requireGroup(qids);
    const q = questions[0];
    const videoName = videoNameFor(qids);
    const size = viewport ?? { width: 1280, height: 720 };
    const rawDir = path.join(RAW, `w${testInfo.workerIndex}-${qids.join('-')}`);
    fs.rmSync(rawDir, { recursive: true, force: true });

    const context = await browser.newContext({
      baseURL,
      locale,
      timezoneId,
      colorScheme,
      viewport: size,
      deviceScaleFactor: 1,
      storageState: demoAuth === 'session' ? AUTH_FILE : undefined,
      // 1:1 con el viewport: sin reescalado, texto nítido.
      recordVideo: DEMO_DRY ? undefined : { dir: rawDir, size },
    });

    // El fixture `page` crea su página DESPUÉS de este bloque; la capturamos al vuelo
    // porque necesitamos su `Video` antes de cerrar el contexto.
    let firstPage: Page | undefined;
    context.once('page', (p) => {
      firstPage = p;
    });

    // Se re-ejecuta en cada documento, incluido el about:blank inicial, así que
    // el primer frame del video ya tiene el cartel de título y no un blanco.
    await context.addInitScript(installOverlay, {
      id: q.id,
      title: q.title,
      kicker: '',
      hideNextBadge: true,
      logo: INVOKEIA_LOGO_DATA_URI,
      contact: BRAND_CONTACT,
      copyright: BRAND.copyright,
      introMs: T.introCard,
    });

    await use(context);

    // 1) referencia al Video ANTES de cerrar
    const video = firstPage?.video() ?? context.pages()[0]?.video() ?? null;
    // 2) cerrar el contexto: acá termina la grabación y el webm se finaliza
    await context.close();

    if (!video) {
      fs.rmSync(rawDir, { recursive: true, force: true });
      return;
    }

    const ok = testInfo.status === testInfo.expectedStatus && testInfo.status !== 'skipped';
    const dest = path.join(ok ? VIDEOS : REJECTED, videoName);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    // 3) ahora sí: la página está cerrada, saveAs() resuelve sin esperar
    await video.saveAs(dest);
    await video.delete(); // borra el archivo con nombre-hash
    fs.rmSync(rawDir, { recursive: true, force: true });

    testInfo.annotations.push({ type: 'demo-video', description: dest });
    if (!ok) {
      await testInfo.attach('toma-fallida', { path: dest, contentType: 'video/webm' });
    }
  },

  demo: async ({ page, qids }, use, testInfo) => {
    // El modal de selección de sede no aparece al cargar, sino cuando termina de
    // resolverse la sesión — puede irrumpir en cualquier momento. Descartarlo una
    // sola vez al arrancar no alcanza: su backdrop bloquea cualquier clic
    // posterior. `addLocatorHandler` lo resuelve cada vez que asoma.
    const sedeModal = page.getByRole('alertdialog').filter({ hasText: 'Selecciona una sede' });
    await page.addLocatorHandler(
      sedeModal,
      async (modal) => {
        await modal.getByRole('button').first().click();
      },
      { noWaitAfter: true },
    );

    const demo = new Demo(page, requireGroup(qids), testInfo);
    await use(demo);
    await demo.finish();
    await page.removeLocatorHandler(sedeModal).catch(() => undefined);
  },
});

/**
 * Único punto de entrada para escribir un spec de demo. Ata el test al registro:
 * si el id no existe, el archivo falla al colectarse, no después de grabar.
 */
export function demoTest(
  ids: string | string[],
  body: (args: { demo: Demo; page: Page }) => Promise<void>,
  opts: { auth?: 'session' | 'anonymous' } = {},
): void {
  const list = Array.isArray(ids) ? ids : [ids];
  // Valida al cargar el módulo: un id inexistente, tres preguntas juntas, o dos
  // de subsecciones distintas hacen fallar la colección de tests, no la grabación.
  const questions = requireGroup(list);

  test.describe(() => {
    test.use({ qids: list, demoAuth: opts.auth ?? 'session' });
    const title =
      questions.length === 1
        ? `${questions[0].id} — ${questions[0].title}`
        : `${list.join('+')} — ${questions.map((q) => q.title).join('  ·  ')}`;
    test(title, async ({ demo, page }) => {
      await body({ demo, page });
    });
  });
}

export { expect };
