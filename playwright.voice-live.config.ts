import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

// La sesión guardada del e2e se reusa si es reciente (6 h): no se inicia sesión en cada corrida.
// VOICE_LIVE_LOGIN=1 fuerza el inicio de sesión.
const AUTH = path.resolve(__dirname, 'e2e/.auth/user.json');
const freshAuth = !process.env.VOICE_LIVE_LOGIN && fs.existsSync(AUTH) && Date.now() - fs.statSync(AUTH).mtimeMs < 6 * 3600 * 1000;

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
      dependencies: freshAuth ? [] : ['setup'],
      testMatch: /tests\/voice-live\/.*\.live\.ts/,
    },
  ],
});
