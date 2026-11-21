import { test, type Page } from '@playwright/test';

/**
 * Auditoría de controles (`pnpm test:voice:live -g audit`): en cada pantalla de Configuración y
 * Sistema —y en su alta y su detalle— lista los controles visibles que la voz NO reconoce (sin
 * nombre o de un tipo que no maneja). No falla: es un informe para ir cerrando huecos.
 */

const ROUTES = (process.env.AUDIT_ROUTES ?? [
  '/config/clinics', '/config/clinic-prefs', '/config/patients-portal', '/config/sedes', '/config/schedules', '/config/holidays',
  '/config/calendars', '/config/calendar-colors', '/config/doctors', '/config/doctor-availability', '/config/availability-exceptions',
  '/config/currencies', '/config/sequences', '/config/mutual-societies', '/config/patient-groups', '/config/provider-groups',
  '/config/lab-stages', '/config/templates', '/config/medical-instruction-templates', '/config/prescription-templates',
  '/system/users', '/system/staff', '/system/alerts-config', '/system/alert-categories', '/system/alert-rules', '/system/communication-templates',
  '/system/communication-history', '/system/execution-history', '/system/whatsapp-agent', '/system/help-insights', '/system/config',
  '/system/notification-settings', '/system/audit', '/system/access', '/system/errors', '/system/import', '/system/licenses',
].join(',')).split(',');

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

/** Los controles visibles de la superficie de arriba que la voz no ve. */
async function missing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __voiceSurface?: () => Array<{ kind: string; label: string }>; __voiceSurfaceEls?: () => HTMLElement[] };
    const seen = (w.__voiceSurface?.() ?? []).length;
    const known = new Set(w.__voiceSurfaceEls?.() ?? []);
    const labels = new Map((w.__voiceSurfaceEls?.() ?? []).map((el, i) => [el, w.__voiceSurface?.()[i]?.label ?? '']));
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')).filter((d) => !d.closest('[data-voice-card]') && d.offsetWidth > 0);
    const root = dialogs[dialogs.length - 1] ?? document.querySelector('main');
    if (!root) return [];
    const sel = 'button, a[href], input:not([type="hidden"]), textarea, select, [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="tab"], [role="slider"], [contenteditable="true"]';
    // Sin los deshabilitados y los ocultos para la accesibilidad (el <select> que acompaña a cada selector de Radix).
    const els = Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.closest('[data-voice-card]') && !(el as HTMLButtonElement).disabled && !el.closest('[aria-hidden="true"]'));
    const name = (el: HTMLElement) => {
      const labels = (el as HTMLInputElement).labels;
      const viaLabel = labels && labels.length ? labels[0].textContent : '';
      const by = el.getAttribute('aria-labelledby');
      const viaBy = by ? document.getElementById(by)?.textContent : '';
      return (viaLabel || el.getAttribute('aria-label') || viaBy || el.getAttribute('placeholder') || el.getAttribute('title') || (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? '' : el.textContent) || '').replace(/\s+/g, ' ').trim();
    };
    const out: string[] = [];
    for (const el of els) {
      const role = el.getAttribute('role') ?? '';
      const type = (el as HTMLInputElement).type ?? '';
      const n = name(el);
      // Lo que la voz ya reconoce no es un hueco.
      if (known.has(el)) continue;
      void labels;
      if (type === 'file') continue;
      const near = (el.closest('label, [class*="space-y"], div')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 50);
      out.push(`${el.tagName.toLowerCase()}${role ? `[role=${role}]` : ''}${type && el.tagName === 'INPUT' ? `[type=${type}]` : ''} «${n.slice(0, 40)}» cerca de «${near}»`);
    }
    return [`(la voz ve ${seen})`, ...Array.from(new Set(out))];
  });
}

async function say(page: Page, text: string) {
  await page.evaluate((t) => (window as unknown as { __voiceSay: (t: string) => boolean }).__voiceSay(t), text);
  await page.waitForTimeout(3000);
}

for (const route of ROUTES) {
  test(`audit ${route}`, async ({ page }) => {
    test.setTimeout(120_000);
    await install(page);
    await page.goto(`/es${route}`);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
    await page.waitForFunction(() => (window as unknown as { __voiceListening: () => boolean }).__voiceListening(), null, { timeout: 15000 });
    // Hasta que termine de cargar (esqueletos, indicadores) y un momento más.
    await page.waitForFunction(() => !document.querySelector('main .animate-pulse, main .animate-spin'), null, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const report: string[] = [`[audit] ${route}`, `  pantalla: ${(await missing(page)).join(' | ')}`];
    if (await page.evaluate(() => !!document.querySelector('main [data-voice-table] [data-row-id]'))) {
      await say(page, 'seleccioná el 1');
      report.push(`  detalle: ${(await missing(page)).join(' | ')}`);
      await say(page, 'cerrá el detalle');
    }
    await say(page, 'nuevo');
    const dialog = page.locator('[role="dialog"][data-state="open"]').last();
    if (await dialog.isVisible().catch(() => false)) {
      report.push(`  alta: ${(await missing(page)).join(' | ')}`);
      for (let i = 0; i < 3 && await dialog.isVisible().catch(() => false); i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const discard = page.locator('[role="alertdialog"] button').filter({ hasText: /Descartar|Discard/ });
        if (await discard.count()) await discard.first().click();
      }
    }
    console.log(report.join('\n'));
  });
}
