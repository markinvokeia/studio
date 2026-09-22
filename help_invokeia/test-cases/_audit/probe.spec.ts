/**
 * Inspector de pantallas. Herramienta de trabajo, no una verificación.
 *
 * Volcá la estructura real de cualquier pantalla antes de escribir sus demos,
 * en vez de adivinar selectores e iterar contra el runner:
 *
 *   PROBE_URL=/appointments \
 *     npx playwright test --config=playwright.help.config.ts --project=audit -g "inspector"
 *
 *   # abriendo algo antes de inspeccionar
 *   PROBE_URL=/appointments PROBE_CLICK='Crear|menuitem:0' ... -g "inspector"
 *
 * Variables:
 *   PROBE_URL     ruta a abrir (obligatoria)
 *   PROBE_CLICK   secuencia separada por `|`. Cada paso es el nombre accesible
 *                 de un botón, o `menuitem:N` / `testid:X` / `text:X`.
 *   PROBE_SCOPE   data-testid al que acotar el volcado (por defecto, la página)
 */
import path from 'node:path';

import { test, type Locator, type Page } from '@playwright/test';

const URL = process.env.PROBE_URL;
const CLICKS = (process.env.PROBE_CLICK ?? '').split('|').filter(Boolean);
const SCOPE = process.env.PROBE_SCOPE;

test.skip(!URL, 'Definí PROBE_URL para usar el inspector');

/** Resuelve un paso de PROBE_CLICK a un locator. */
function step(page: Page, raw: string): Locator {
  const [kind, ...rest] = raw.split(':');
  const value = rest.join(':');
  if (kind === 'menuitem') return page.getByRole('menuitem').nth(Number(value || 0));
  if (kind === 'testid') return page.getByTestId(value);
  if (kind === 'text') return page.getByText(value).first();
  return page.getByRole('button', { name: raw }).first();
}

test('inspector de pantalla', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '../../.auth/demo-user.json'),
    viewport: { width: 1280, height: 720 },
    locale: 'es',
  });
  const page = await context.newPage();

  await page.goto(URL!, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_500);

  // El modal de sede bloquea todo si la cuenta no tiene sede asignada.
  const sede = page.getByRole('alertdialog').filter({ hasText: 'Selecciona una sede' });
  if (await sede.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await sede.getByRole('button').first().click();
    await page.waitForTimeout(2_000);
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);

  for (const raw of CLICKS) {
    await step(page, raw).click();
    await page.waitForTimeout(1_500);
  }
  await page.waitForTimeout(1_000);

  const scope: Locator | Page = SCOPE ? page.getByTestId(SCOPE) : page;
  const out: string[] = ['', `━━━ ${URL}${CLICKS.length ? ` → ${CLICKS.join(' → ')}` : ''} ━━━`];

  const list = async (title: string, loc: Locator, describe: (l: Locator) => Promise<string>) => {
    const n = await loc.count();
    out.push(`\n${title} (${n})`);
    for (let i = 0; i < Math.min(n, 60); i += 1) {
      const el = loc.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const desc = await describe(el).catch(() => '?');
      if (desc.trim()) out.push(`  ${desc}`);
    }
  };

  await list('BOTONES', scope.getByRole('button'), async (el) => {
    const text = (await el.innerText().catch(() => '')).trim().replace(/\n+/g, ' · ');
    const aria = await el.getAttribute('aria-label');
    const tid = await el.getAttribute('data-testid');
    const title = await el.getAttribute('title');
    return [text && `"${text}"`, aria && `aria="${aria}"`, title && `title="${title}"`, tid && `testid=${tid}`]
      .filter(Boolean)
      .join('  ');
  });

  await list('CAMPOS', scope.locator('input, textarea, select'), async (el) => {
    const ph = await el.getAttribute('placeholder');
    const type = await el.getAttribute('type');
    const name = await el.getAttribute('name');
    const id = await el.getAttribute('id');
    return [ph && `ph="${ph}"`, type && `type=${type}`, name && `name=${name}`, id && `id=${id}`]
      .filter(Boolean)
      .join('  ');
  });

  await list('PESTAÑAS', scope.getByRole('tab'), async (el) =>
    `"${(await el.innerText()).trim().replace(/\n+/g, ' · ')}"`,
  );

  const tids = await page.locator('[data-testid]').evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute('data-testid')))].filter(Boolean),
  );
  out.push(`\nDATA-TESTID en la página (${tids.length})`);
  out.push(`  ${tids.join(', ')}`);

  const dialogs = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  const dn = await dialogs.count();
  out.push(`\nDIÁLOGOS ABIERTOS (${dn})`);
  for (let i = 0; i < dn; i += 1) {
    const box = await dialogs.nth(i).boundingBox().catch(() => null);
    const txt = (await dialogs.nth(i).innerText().catch(() => '')).slice(0, 90).replace(/\n+/g, ' | ');
    // Un diálogo con x >= 1280 está fuera de pantalla: es el panel de notificaciones.
    out.push(`  [${i}] x=${box?.x ?? '?'} "${txt}"`);
  }

  console.log(out.join('\n'));
  await page.screenshot({ path: path.resolve(__dirname, '../../.artifacts/probe.png'), fullPage: false });
  await context.close();
});
