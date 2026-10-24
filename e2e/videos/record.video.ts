import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { HELP_USE_CASES } from '../utils/help';
import { DEMO_VALUES } from './demo-values';

/**
 * Fase 3: graba cada guía del catálogo ejecutada por el asistente real (la
 * mascota señalando, la burbuja con el detalle) y guarda la línea de tiempo de
 * los pasos para narrarla y subtitularla (scripts/videos/build-videos.mjs).
 *
 *   HELP_VIDEO_DEMO_TENANT=1 E2E_BASE_URL=https://demo… pnpm videos:record
 *   HELP_VIDEO_USE_CASES=onboarding.sede,patients.create  (opcional: sólo esos)
 *   HELP_VIDEO_CONFIRM=1                                   (pulsa el OK: crea datos en el demo)
 */

const OUT_DIR = join(process.cwd(), 'videos', 'raw');
const SELECTED = (process.env.HELP_VIDEO_USE_CASES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const USE_CASES = HELP_USE_CASES.filter((u) => !SELECTED.length || SELECTED.includes(u.id));
const CONFIRM = process.env.HELP_VIDEO_CONFIRM === '1';

interface Segment { index: number; title: string; description?: string; details?: string; action: string; t: number }

type HelpBridge = {
  ready: boolean;
  startUseCase: (id: string, values?: Record<string, unknown>) => boolean;
  next: () => void;
  state: () => {
    guide: { current: number; statuses: string[]; finished: boolean; steps: { action: string; title: string; description?: string; details?: string; target?: string }[] } | null;
    spotlight: { targetId: string } | null;
  };
  catalogVersion: string;
};
declare global { interface Window { __invokeHelp?: HelpBridge } }

/** Tiempo de lectura de la burbuja: lo que tarda la narración, aproximadamente. */
const readingMs = (text: string) => Math.min(9000, Math.max(2600, 1400 + text.length * 55));

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  if (process.env.HELP_VIDEO_DEMO_TENANT !== '1') {
    throw new Error('Los videos se graban sólo contra el tenant demo (datos sintéticos). Definí HELP_VIDEO_DEMO_TENANT=1 apuntando E2E_BASE_URL al demo.');
  }
  mkdirSync(OUT_DIR, { recursive: true });
});

for (const useCase of USE_CASES) {
  test(`video · ${useCase.id}`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.addInitScript(() => {
      localStorage.setItem('invoke-help:automation', '1');
      // El asistente no se abre solo ni muestra el onboarding encima de la grabación.
      sessionStorage.setItem('invoke-help:onboarding-auto-opened', '1');
    });
    await page.goto(String(testInfo.project.use.baseURL));
    await page.waitForFunction(() => window.__invokeHelp?.ready === true, null, { timeout: 30_000 });

    const t0 = Date.now();
    const segments: Segment[] = [];
    const started = await page.evaluate(({ id, values }) => window.__invokeHelp!.startUseCase(id, values), { id: useCase.id, values: DEMO_VALUES[useCase.id] ?? {} });
    expect(started, `caso de uso ${useCase.id}`).toBe(true);

    let lastKey = '';
    for (let guard = 0; guard < 120; guard++) {
      const state = await page.evaluate(() => window.__invokeHelp!.state());
      const guide = state.guide;
      if (!guide || guide.finished) break;
      const status = guide.statuses[guide.current];
      const step = guide.steps[guide.current];
      if (status === 'running' || status === 'pending') { await page.waitForTimeout(250); continue; }
      if (status === 'failed') throw new Error(`${useCase.id}: falló el paso ${guide.current + 1} (${step.title})`);

      // Paso visible (waiting/done con la mascota señalando): se registra y se deja leer.
      const shownIndex = state.spotlight ? guide.steps.findIndex((s) => s.target === state.spotlight!.targetId) : guide.current;
      const shown = guide.steps[shownIndex] ?? step;
      const key = `${shownIndex}:${status}`;
      if (key !== lastKey) {
        lastKey = key;
        segments.push({ index: shownIndex, title: shown.title, description: shown.description, details: shown.details, action: shown.action, t: Date.now() - t0 });
        await page.waitForTimeout(readingMs(`${shown.title} ${shown.description ?? ''} ${shown.details ?? ''}`));
      }

      if (status === 'waiting' && step.action === 'confirm') {
        if (!CONFIRM) break;
        await page.locator(`[data-help-id="${step.target}"]:visible`).last().click();
        await page.waitForTimeout(2500);
        continue;
      }
      await page.evaluate(() => window.__invokeHelp!.next());
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1200);

    const catalogVersion = await page.evaluate(() => window.__invokeHelp!.catalogVersion);
    const video = page.video();
    await page.close();
    await video?.saveAs(join(OUT_DIR, `${useCase.id}.webm`));
    writeFileSync(join(OUT_DIR, `${useCase.id}.json`), JSON.stringify({
      useCaseId: useCase.id,
      title: useCase.title,
      locale: 'es',
      catalogVersion,
      recordedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      segments,
    }, null, 2));
  });
}
