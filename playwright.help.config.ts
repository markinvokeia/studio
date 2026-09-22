/**
 * Config de la suite de videos demostrativos (`help_invokeia/`).
 *
 * Separada a propósito de `playwright.config.ts`: la suite de QA optimiza para
 * detectar regresiones rápido, y ésta para producir metraje legible. No
 * comparten testDir, outputDir, storageState ni reporter.
 *
 *   pnpm help:record                 # graba todo
 *   pnpm help:record -- -g "q014"    # regraba una sola pregunta
 *   pnpm help:dry                    # sin video ni pausas: para clavar selectores
 */
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * Puerto 3100 y no 3000 a propósito: la grabación corre contra un build de
 * producción y el 3000 suele estar ocupado por el `pnpm dev` de quien trabaja.
 * Así se puede grabar y desarrollar al mismo tiempo sin pisarse.
 */
const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3100';
const VIEWPORT = { width: 1280, height: 720 };

export default defineConfig({
  testDir: './help_invokeia/test-cases',
  outputDir: './help_invokeia/.artifacts',
  // Un solo worker, medido y no supuesto: con 3 workers los procesos no terminan
  // al acabar los tests y Playwright los mata recién a los 5 minutos, así que la
  // misma tanda tardó 5,6 min en paralelo contra 1,5 min en serie.
  fullyParallel: false,
  workers: 1,
  // Un reintento grabaría el metraje del fallo. Una toma fallida se regraba a mano.
  retries: 0,
  forbidOnly: false,
  // El pacing consume minuto y pico por demo.
  timeout: 180_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'help_invokeia/.report', open: 'never' }],
  ],

  use: {
    baseURL: `${BASE_URL}/es`,
    locale: 'es',
    timezoneId: 'America/Montevideo',
    // Tema claro: es el que mejor se lee al escalar el video en Drive.
    colorScheme: 'light',
    viewport: VIEWPORT,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'off',
    screenshot: 'off',
    // La grabación la maneja el fixture `context`, no `use.video`.
    video: 'off',
    launchOptions: {
      slowMo: 0,
      args: ['--force-color-profile=srgb', '--disable-blink-features=AutomationControlled'],
    },
  },

  projects: [
    {
      name: 'setup',
      testMatch: /_setup\/help\.auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: VIEWPORT },
    },
    {
      name: 'demo',
      dependencies: ['setup'],
      testMatch: /\.demo\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        // Chrome real, no el Chromium empaquetado: éste no trae H.264 y el video
        // promocional del login no se reproduce (cae al degradado).
        channel: 'chrome',
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
      },
    },
    {
      // Valida el registro contra los specs y verifica el overlay a ojo.
      // Los tests de registro no piden el fixture `browser`, así que no lanzan nada;
      // el visual sí, y necesita Chrome real como el proyecto `demo`.
      name: 'audit',
      testMatch: /_audit\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: VIEWPORT },
    },
  ],

  webServer: {
    // Producción, no `next dev`. Tres razones, en orden de importancia:
    //  1. En dev, Next compila cada ruta la primera vez que se visita: son 3-8 s
    //     de pantalla congelada que quedan grabados en el video.
    //  2. En dev existe `<nextjs-portal>`, que ensucia los frames y además
    //     intercepta los clics sobre el avatar de la barra lateral. El overlay
    //     lo tapa por CSS, pero en producción el problema no existe.
    //  3. La navegación es más rápida, que es lo que hace fluido al video.
    //
    // `reuseExistingServer` está en true a propósito: lo normal es dejar el
    // servidor levantado con `pnpm help:serve` en otra terminal y grabar varias
    // tandas contra él, porque Playwright mata el servidor que arranca él mismo
    // al terminar cada corrida (y rebuildear en cada tanda sería absurdo).
    command: 'pnpm start -- -p 3100',
    url: `${BASE_URL}/es/login`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
