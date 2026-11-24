import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { test } from '@playwright/test';

import { HELP_USE_CASES, driveGuide, openForGuide, useCaseRoute } from '../utils/help';
import { DEMO_VALUES } from './demo-values';

/**
 * Temporal: qué exige cada formulario de alta y qué opciones tienen sus campos.
 * Lleva la guía hasta el OK con TODAS las escrituras al backend bloqueadas, lista
 * las opciones de los campos de la guía (selects, combos) y pulsa el OK para ver
 * qué queda en rojo.
 */
const OUT = process.env.HELP_DISCOVER_OUT ?? 'required-fields.json';
const IDS = (process.env.HELP_DISCOVER_IDS ?? '').split(',').filter(Boolean);
/** Se guarda al terminar cada guía: un fallo reinicia el proceso y se perdería lo anterior. */
const save = (id: string, value: unknown) => {
  const all = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  writeFileSync(OUT, JSON.stringify({ ...all, [id]: value }, null, 2));
};

test.describe.configure({ mode: 'default' });

for (const id of IDS) {
  test(`discover · ${id}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.route('**/webhook/**', (route) => (['PUT', 'PATCH', 'DELETE'].includes(route.request().method()) || (route.request().method() === 'POST' && !/search|list|query|get/i.test(route.request().url())) ? route.abort() : route.continue()));
    const useCase = HELP_USE_CASES.find((u) => u.id === id)!;
    await openForGuide(page, useCaseRoute(useCase));
    try {
      await driveGuide(page, id, { values: DEMO_VALUES[id] ?? {}, confirm: false });
    } catch (error) {
      save(id, { error: String(error).slice(0, 200) });
      return;
    }
    const fields: Record<string, unknown> = {};
    for (const step of process.env.HELP_DISCOVER_OPTIONS === '1' ? useCase.steps.filter((s) => s.target?.includes('.field.')) : []) {
      const el = page.locator(`[data-help-id="${step.target}"]:visible`).last();
      if (!(await el.count())) continue;
      const info = await el.evaluate((node) => ({
        tag: node.tagName.toLowerCase(),
        role: node.getAttribute('role'),
        type: node.getAttribute('type'),
        options: node.tagName === 'SELECT' ? [...(node as HTMLSelectElement).options].map((o) => o.text.trim()) : undefined,
        text: (node.textContent ?? '').trim().slice(0, 80),
      }));
      if (info.role === 'combobox' || info.tag === 'button') {
        await el.click().catch(() => {});
        await page.waitForTimeout(700);
        (info as { options?: string[] }).options = (await page.locator('[role="option"]:visible, [cmdk-item]:visible').allInnerTexts()).map((t) => t.trim()).slice(0, 40);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
      fields[step.target!] = info;
    }
    const guide = await page.evaluate(() => window.__invokeHelp!.state().guide);
    const target = guide?.steps[guide.current]?.target;
    if (target) {
      await page.locator(`[data-help-id="${target}"]:visible`).last().click();
      await page.waitForTimeout(1200);
    }
    const invalid = await page.evaluate(() => [...document.querySelectorAll('[aria-invalid="true"]')].map((el) => el.closest('[data-help-id]')?.getAttribute('data-help-id') ?? el.getAttribute('data-help-id') ?? el.closest('[data-help-item]')?.getAttribute('data-help-item') ?? el.getAttribute('name')));
    save(id, { fields, invalid });
  });
}
