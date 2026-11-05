// Temporal: cómo se ve la agenda con el panel de agendas cerrado y semanas atrás.
import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const browser = await chromium.launch();
for (const [name, opts] of [['d', { viewport: { width: 1280, height: 720 } }], ['m', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext({ ...opts, storageState: 'e2e/.auth/user.json' });
  await ctx.addInitScript(() => { try { localStorage.setItem('invoke-help:automation', '1'); } catch {} });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/es/appointments', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const closeAll = page.getByRole('button', { name: 'Cerrar todas' });
  if (await closeAll.isVisible().catch(() => false)) await closeAll.click();
  await page.screenshot({ path: `${OUT}/ag-${name}0.png` });
  const btns = await page.locator('button:visible').evaluateAll((els) => els.slice(0, 40).map((b) => `${b.getAttribute('data-help-id') ?? ''}|${b.getAttribute('aria-label') ?? ''}|${(b.textContent ?? '').trim().slice(0, 20)}`));
  console.log(name, btns.join(' ; '));
  const agendas = page.locator('[data-help-id="appointments.btn.agendas"]:visible').first();
  console.log(name, 'agendas', await agendas.count());
  if (name === 'd') await agendas.click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/ag-${name}1.png` });
  for (let w = 1; w <= 5; w++) {
    await page.locator('[data-help-id="appointments.btn.prev"]:visible').first().click();
    await page.waitForTimeout(2500);
    const n = await page.locator('[data-help-id="appointments.section.event"]:visible, .rbc-event:visible, [data-event-id]:visible').count();
    console.log(name, 'semana -' + w, 'eventos', n);
    await page.screenshot({ path: `${OUT}/ag-${name}w${w}.png` });
  }
  await ctx.close();
}
await browser.close();
