import { test, type Page } from '@playwright/test';

/**
 * Auditoría de las ventanas de Mi consultorio (`pnpm test:voice:live -g workspace-audit`): con la
 * cita de las 9 elegida, abre por voz cada acción (receta, laboratorio, sesión estética, sesión
 * clínica, ficha con sus pestañas) y lista lo que la voz no reconoce. Cierra sin guardar.
 */

const ACTIONS = ['hacele una receta', 'nueva orden de laboratorio', 'una sesión estética', 'completá la sesión clínica', 'abrí la ficha'];

async function install(page: Page) {
  await page.addInitScript(() => {
    type L = ((e: unknown) => void) | null;
    const instances: Array<{ continuous: boolean; started: boolean; ended: boolean; onresult: L; onspeechstart: L }> = [];
    class R { continuous = false; interimResults = false; lang = ''; onresult: L = null; onerror: L = null; onend: L = null; onspeechstart: L = null; started = false; ended = false;
      start() { this.started = true; instances.push(this); } stop() { this.end(); } abort() { this.end(); } end() { if (this.ended) return; this.ended = true; setTimeout(() => this.onend?.({}), 0); } }
    const w = window as unknown as Record<string, unknown>;
    w.webkitSpeechRecognition = R; w.SpeechRecognition = R;
    w.__voiceListening = () => instances.some((r) => r.continuous && r.started && !r.ended);
    w.__voiceSay = (t: string) => { for (let i = instances.length - 1; i >= 0; i--) { const r = instances[i]; if (r.continuous && r.started && !r.ended) { r.onspeechstart?.({}); r.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: t } } } }); return true; } } return false; };
    try { localStorage.setItem('voice-always-on', 'true'); localStorage.setItem('invoke-help-voice-muted', '1'); } catch { /* */ }
  });
}

/** Lo visible de la ventana de arriba que la voz no reconoce. */
async function missing(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = window as unknown as { __voiceSurface?: () => Array<{ kind: string; label: string }>; __voiceSurfaceEls?: () => HTMLElement[] };
    const known = new Set(w.__voiceSurfaceEls?.() ?? []);
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]')).filter((d) => !d.closest('[data-voice-card]') && d.offsetWidth > 0);
    const root = dialogs[dialogs.length - 1];
    if (!root) return '(no se abrió)';
    const title = (root.querySelector('h2')?.textContent ?? '').trim();
    const sel = 'button, a[href], input:not([type="hidden"]), textarea, select, [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="tab"], [role="slider"], [contenteditable="true"]';
    const out: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(sel))) {
      if (!(el.offsetWidth > 0 && el.offsetHeight > 0) || (el as HTMLButtonElement).disabled || el.closest('[aria-hidden="true"]') || known.has(el) || (el as HTMLInputElement).type === 'file') continue;
      const icon = (el.querySelector('svg')?.getAttribute('class') ?? '').match(/lucide-([a-z0-9-]+)/)?.[1] ?? '';
      const near = (el.closest('label, div')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      out.push(`${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}${(el as HTMLInputElement).type && el.tagName === 'INPUT' ? `[${(el as HTMLInputElement).type}]` : ''}${icon ? `{${icon}}` : ''} «${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}» cerca de «${near}»`);
    }
    return `«${title}» (la voz ve ${(w.__voiceSurface?.() ?? []).length}) ${Array.from(new Set(out)).join(' | ')}`;
  });
}

async function say(page: Page, text: string) {
  await page.evaluate((t) => (window as unknown as { __voiceSay: (t: string) => boolean }).__voiceSay(t), text);
  await page.waitForTimeout(3500);
}

async function closeAll(page: Page) {
  for (let i = 0; i < 4; i++) {
    const open = page.locator('[role="dialog"][data-state="open"]');
    if (!(await open.count())) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const discard = page.locator('[role="alertdialog"] button').filter({ hasText: /Descartar|Discard|Salir sin guardar|Sí, cerrar/ });
    if (await discard.count()) await discard.first().click();
  }
}

test('workspace-audit', async ({ page }) => {
  test.setTimeout(400_000);
  await install(page);
  await page.goto('/es/workspace');
  await page.waitForFunction(() => (window as unknown as { __voiceListening: () => boolean }).__voiceListening(), null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await say(page, 'el de las 9');
  const report: string[] = ['[workspace-audit]'];
  for (const action of ACTIONS) {
    await say(page, action);
    report.push(`  «${action}»: ${await missing(page)}`);
    // La ficha: cada pestaña.
    if (action === 'abrí la ficha') {
      const tabs = page.locator('[role="dialog"][data-state="open"] [role="tab"]');
      const count = Math.min(await tabs.count(), 10);
      for (let i = 0; i < count; i++) {
        const name = ((await tabs.nth(i).innerText().catch(() => '')) || `#${i + 1}`).replace(/\s+/g, ' ').trim();
        await tabs.nth(i).click().catch(() => undefined);
        await page.waitForTimeout(2500);
        report.push(`    pestaña ${name}: ${await missing(page)}`);
      }
    }
    await closeAll(page);
  }
  console.log(report.join('\n'));
});
