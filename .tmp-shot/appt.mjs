import { chromium } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: 'e2e/.auth/user.json' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300)); });
await page.goto('http://localhost:3000/es/appointments', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(15000);
const closeAll = page.getByRole('button', { name: 'Cerrar todas' });
if (await closeAll.isVisible().catch(() => false)) { await closeAll.click(); await page.waitForTimeout(800); }
await page.screenshot({ path: `${out}/a-01.png` });
// what's on top at a few points
const probes = await page.evaluate(() => [[700, 400], [400, 300], [1000, 600], [1250, 820]].map(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  return `${x},${y} -> ${el?.tagName}.${(el?.className?.toString?.() || '').slice(0, 80)} [${el?.closest('[data-help-panel],.ivm-stage,.ivm-peekzone,[data-help-ignore]')?.className?.toString?.().slice(0, 40) ?? ''}]`;
}));
console.log(probes.join('\n'));
console.log('main', await page.evaluate(() => { const m = document.querySelector('main'); const z = document.querySelector('.help-content-zone'); const c = z?.querySelector(':scope > .ivm-peekzone-content'); const r = (e) => e && JSON.stringify(e.getBoundingClientRect().toJSON()); return { main: r(m), zone: r(z), content: r(c), inner: r(c?.firstElementChild) }; }));
console.log('mascot', await page.locator('.ivm-actor').count(), await page.locator('.ivm-actor').first().boundingBox().catch(() => null));
console.log(errors.slice(0, 15).join('\n'));
await browser.close();
