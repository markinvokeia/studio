import { defineConfig } from '@playwright/test';

/**
 * Pruebas del agente de voz de la agenda (docs/voz-agenda-pruebas.md). Corren en Node, sin
 * navegador, sin servidor y sin DEV: la sesión de voz, los comandos y los textos reales contra una
 * agenda simulada; la IA se simula con respuestas que pasan por la validación del flujo de n8n.
 *
 *   pnpm test:voice
 */
export default defineConfig({
  testDir: './e2e/tests/voice-agent',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
});
