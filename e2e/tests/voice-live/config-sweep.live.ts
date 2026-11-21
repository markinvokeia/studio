import { expect, test, type Page } from '@playwright/test';

/**
 * Recorrido por voz de Configuración del negocio y Sistema en la app real: en cada pantalla
 * «¿qué puedo hacer acá?», y si tiene la tabla común: «¿qué columnas hay?», «seleccioná el 1»,
 * «cerrá el detalle»; y el alta («nuevo») se abre y se cierra sin guardar. Nada se guarda.
 * Se corre con `pnpm test:voice:live -g sweep`; el detalle de cada respuesta va a la consola.
 */

const ROUTES = [
  '/config/clinics', '/config/clinic-prefs', '/config/patients-portal', '/config/sedes', '/config/schedules', '/config/holidays',
  '/config/calendars', '/config/calendar-colors', '/config/doctors', '/config/doctor-availability', '/config/availability-exceptions',
  '/config/currencies', '/config/sequences', '/config/mutual-societies', '/config/patient-groups', '/config/provider-groups',
  '/config/lab-stages', '/config/templates', '/config/medical-instruction-templates', '/config/prescription-templates',
  '/system/users', '/system/staff', '/system/alerts-config', '/system/alert-categories', '/system/alert-rules', '/system/communication-templates',
  '/system/communication-history', '/system/execution-history', '/system/whatsapp-agent', '/system/help-insights', '/system/config',
  '/system/notification-settings', '/system/audit', '/system/access', '/system/errors', '/system/import', '/system/licenses',
];

async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Listener = ((e: unknown) => void) | null;
    const instances: Array<{ continuous: boolean; started: boolean; ended: boolean; onresult: Listener; onspeechstart: Listener }> = [];
    class FakeRecognition {
      continuous = false; interimResults = false; lang = '';
      onresult: Listener = null; onerror: Listener = null; onend: Listener = null; onspeechstart: Listener = null;
      started = false; ended = false;
      start() { this.started = true; instances.push(this); }
      stop() { this.end(); }
      abort() { this.end(); }
      end() { if (this.ended) return; this.ended = true; setTimeout(() => this.onend?.({}), 0); }
    }
    const w = window as unknown as Record<string, unknown>;
    w.webkitSpeechRecognition = FakeRecognition;
    w.SpeechRecognition = FakeRecognition;
    w.__voiceListening = () => instances.some((r) => r.continuous && r.started && !r.ended);
    w.__voiceSay = (text: string) => {
      for (let i = instances.length - 1; i >= 0; i--) {
        const r = instances[i];
        if (r.continuous && r.started && !r.ended) { r.onspeechstart?.({}); r.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: text } } } }); return true; }
      }
      return false;
    };
    try { localStorage.setItem('voice-always-on', 'true'); localStorage.setItem('invoke-help-voice-muted', '1'); } catch { /* */ }
  });
}

const BUSY = /Le pregunto al agente|Un momento…|Esperando que cargue/;
const BAD = /No entendí|No reconocí|Se produjo un error|Something went wrong/;

async function answer(page: Page): Promise<string> {
  const raw = await page.evaluate(() => (document.querySelector('[data-voice-card]') as HTMLElement | null)?.innerText ?? '');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(1).filter((l) => !/^«.*»$/.test(l) && !/Esc (?:cancela|cancels)/.test(l)).join(' ');
}

async function say(page: Page, text: string): Promise<string> {
  const before = await answer(page);
  await page.evaluate((t) => (window as unknown as { __voiceSay: (t: string) => boolean }).__voiceSay(t), text);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) {
    const now = await answer(page);
    if (now !== before && !BUSY.test(now)) return now;
    await page.waitForTimeout(250);
  }
  return await answer(page);
}

for (const route of ROUTES) {
  test(`sweep ${route}`, async ({ page }) => {
    test.setTimeout(150_000);
    await installFakeSpeech(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/es${route}`);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __voiceListening: () => boolean }).__voiceListening()), { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(800);
    const results: string[] = [];
    const run = async (text: string) => { const a = await say(page, text); results.push(`  «${text}» → ${a.slice(0, 260)}`); return a; };
    await run('qué puedo hacer acá');
    const hasTable = await page.evaluate(() => !!document.querySelector('main [data-voice-table]'));
    if (hasTable) {
      await run('qué columnas hay');
      const opened = await run('seleccioná el 1');
      if (/^Tabla Abrí/.test(opened)) await run('cerrá el detalle');
    }
    const created = await run('nuevo');
    const dialog = page.locator('[role="dialog"][data-state="open"]').last();
    if (await dialog.isVisible().catch(() => false)) {
      results.push(`  (se abrió: ${(await dialog.locator('h2').first().innerText().catch(() => '?')).slice(0, 60)})`);
      for (let i = 0; i < 3 && await dialog.isVisible().catch(() => false); i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const discard = page.locator('[role="alertdialog"] button').filter({ hasText: /Descartar|Discard/ });
        if (await discard.count()) await discard.first().click();
      }
    }
    console.log(`\n[sweep] ${route} · tabla: ${hasTable ? 'sí' : 'no'} · errores JS: ${errors.length}\n${results.join('\n')}${errors.length ? `\n  JS: ${errors.join(' | ').slice(0, 300)}` : ''}`);
    void created;
    expect(errors, `errores de la página en ${route}`).toEqual([]);
    // «nuevo» en una pantalla sin alta puede no entenderse; lo demás no.
    for (const r of results) if (!r.startsWith('  «nuevo»') || hasTable) expect(r, route).not.toMatch(BAD);
  });
}
