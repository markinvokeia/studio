import { chromium } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: 'e2e/.auth/user.json' });
await ctx.addInitScript(() => { try { localStorage.setItem('invoke-help:automation', '1'); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e).slice(0, 300)));
await page.goto('http://localhost:3000/es/appointments', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__invokeHelp?.ready, null, { timeout: 90000 });
await page.waitForTimeout(6000);
const closeAll = page.getByRole('button', { name: 'Cerrar todas' });
if (await closeAll.isVisible().catch(() => false)) { await closeAll.click(); await page.waitForTimeout(800); }
const st = () => page.evaluate(() => { const s = window.__invokeHelp.state(); return JSON.stringify({ cur: s.guide?.current, st: s.guide?.statuses, err: s.guide?.error, spot: s.spotlight?.targetId, mode: s.spotlight?.mode }); });
console.log('ids on page:', await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-help-id]')].map(e => e.getAttribute('data-help-id')))].join(' ')));
await page.evaluate(() => window.__invokeHelp.startUseCase('onboarding.first-appointment'));
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(5000);
  console.log(i, await st());
  await page.screenshot({ path: `${out}/b-${i}.png` });
  const s = JSON.parse(await st());
  if (s.st && s.st[s.cur] === 'failed') break;
  if (s.mode && s.mode !== 'action') await page.evaluate(() => window.__invokeHelp.next());
}
console.log(errors.join('\n'));
await browser.close();
