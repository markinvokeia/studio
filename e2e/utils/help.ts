import { expect, type Locator, type Page } from '@playwright/test';

import catalog from '../../src/generated/help-catalog.json';

/**
 * Las guías del catálogo (knowledge/use-cases) como tests E2E: mismos help ids
 * que usa el asistente, así un cambio de pantalla rompe la guía y el test a la vez.
 * Fase 3 del plan: con `demo` la ejecución es lenta y resaltada para grabar el video.
 */

type Step = {
  id: string;
  action: 'navigate' | 'click' | 'highlight' | 'fill' | 'confirm' | 'wait';
  title: string;
  target?: string;
  route?: string;
  value?: string | number | boolean;
  optional?: boolean;
};

type UseCase = { id: string; title: string; steps: Step[] };

export const HELP_USE_CASES = (catalog as { useCases: UseCase[] }).useCases;

export function getUseCase(id: string): UseCase {
  const useCase = HELP_USE_CASES.find((u) => u.id === id);
  if (!useCase) throw new Error(`Caso de uso ${id} no está en el catálogo`);
  return useCase;
}

/** Elemento visible por help id (control o contenedor del campo). */
export function byHelpId(page: Page, id: string): Locator {
  return page.locator(`[data-help-id="${id}"]:visible, [data-help-item="${id}"]:visible`).last();
}

function resolveValue(value: Step['value'], values: Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;
  const match = value.match(/^\{\{\s*values\.([\w.-]+)\s*\}\}$/);
  return match ? values[match[1]] : value;
}

export interface RunUseCaseOptions {
  values?: Record<string, unknown>;
  locale?: string;
  /** Pulsa los pasos `confirm` (crea datos). Por defecto se detiene antes del OK. */
  confirm?: boolean;
  /** Modo video: pausas para leer y el elemento resaltado. */
  demo?: boolean;
}

export async function runUseCase(page: Page, id: string, options: RunUseCaseOptions = {}) {
  const { values = {}, locale = 'es', confirm = false, demo = false } = options;
  const pause = (ms: number) => (demo ? page.waitForTimeout(ms) : Promise.resolve());

  for (const step of getUseCase(id).steps) {
    if (step.action === 'navigate') {
      await page.goto(`/${locale}${step.route === '/' ? '' : step.route}`);
      continue;
    }
    const target = byHelpId(page, step.target!);
    await expect(target, `${id} · ${step.id}: ${step.target}`).toBeVisible({ timeout: 15_000 });
    if (demo) {
      await target.evaluate((el) => { (el as HTMLElement).style.outline = '3px solid #8b5cf6'; });
      await pause(900);
    }

    if (step.action === 'click') {
      await target.click();
    } else if (step.action === 'fill') {
      const value = resolveValue(step.value, values);
      if (value !== undefined && value !== null && value !== '') {
        const input = target.locator('input:not([type=hidden]), textarea').first();
        const fillable = (await target.evaluate((el) => el.matches('input, textarea'))) ? target : input;
        if (typeof value === 'string' || typeof value === 'number') await fillable.fill(String(value));
      }
    } else if (step.action === 'confirm') {
      if (confirm) await target.click();
      else return;
    }
    if (demo) await target.evaluate((el) => { (el as HTMLElement).style.outline = ''; });
    await pause(400);
  }
}
