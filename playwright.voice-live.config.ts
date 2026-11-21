import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

/**
 * La voz en la app real (pnpm test:voice:live): Chrome con la app corriendo (pnpm dev) y la
 * sesión del e2e, con un reconocimiento de voz falso que "dice" las frases. Solo acciones que no
 * guardan nada (navegar, abrir, leer, filtrar). Complementa al simulador (pnpm test:voice), que
 * prueba la interpretación caso por caso sin navegador.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL: `${BASE_URL}/es`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es',
  },
  projects: [
    { name: 'setup', testMatch: /fixtures\/auth\.setup\.ts/ },
    {
      name: 'voice-live',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
      testMatch: /tests\/voice-live\/.*\.live\.ts/,
    },
  ],
});
