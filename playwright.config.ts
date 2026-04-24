import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL: `${BASE_URL}/es`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    locale: 'es',
  },

  projects: [
    // Auth setup — corre primero, guarda el token en e2e/.auth/user.json
    {
      name: 'setup',
      testMatch: /fixtures\/auth\.setup\.ts/,
    },

    // Desktop Chrome — suite principal
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /tests\/.*\.spec\.ts/,
    },

    // Mobile — tests responsive
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /tests\/.*\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: `${BASE_URL}/es/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
