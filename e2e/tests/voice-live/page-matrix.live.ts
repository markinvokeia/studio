import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Batería por pantalla (`pnpm test:voice:live -g matrix`, mejor con la app en modo producción):
 * en cada pantalla descubre lo que hay (tabla, alta, campos, interruptores, casillas, listas,
 * opciones) y lo prueba por voz, como lo diría una persona, sin guardar nada:
 *
 * - ayuda («¿qué puedo hacer acá?»);
 * - tabla: ordenar por una columna, ocultar y volver a mostrar una columna, filtrar con la palabra
 *   clave (dicha en una frase: se escribe solo la palabra), elegir el primer registro y cerrar el
 *   detalle;
 * - alta: «nuevo» abre la ventana y la voz avisa qué se le puede pedir; cada campo de texto se llena
 *   con tres sinónimos (poné / cambiá … a / el … es), los interruptores y casillas se prenden y se
 *   apagan, las listas eligen una opción, las opciones de radio se eligen;
 * - «cerrá» cierra lo último que se abrió (y si pregunta por descartar, «sí»);
 * - cambio de contexto: con la ventana abierta, «andá a …» la cierra y navega.
 *
 * No falla al primer problema: cada paso es un expect.soft y queda en
 * voice-matrix-results/<pantalla>.json (con lo que dijo la voz). VOICE_MATRIX_ROUTES elige
 * pantallas; VOICE_MATRIX_LOCALE=en prueba en inglés.
 */

const LOCALE = (process.env.VOICE_MATRIX_LOCALE ?? 'es') as 'es' | 'en';
const ROUTES = (process.env.VOICE_MATRIX_ROUTES ?? [
  // Configuración del negocio
  '/config/clinics', '/config/sedes', '/config/schedules', '/config/holidays', '/config/calendars', '/config/doctors',
  '/config/doctor-availability', '/config/availability-exceptions', '/config/currencies', '/config/sequences',
  '/config/mutual-societies', '/config/patient-groups', '/config/provider-groups', '/config/lab-stages',
  '/config/medical-instruction-templates', '/config/prescription-templates', '/config/services',
  // Sistema
  '/system/users', '/system/staff', '/system/alert-categories', '/system/alert-rules', '/system/communication-templates',
  '/system/communication-history', '/system/execution-history', '/system/audit', '/system/access', '/system/errors',
  '/system/notification-settings', '/system/config', '/system/whatsapp-agent', '/roles', '/permissions',
  // Catálogo, ventas, compras, caja, pacientes, laboratorio, estudios
  '/clinic-catalog/ailments', '/clinic-catalog/medications', '/clinic-catalog/dental-conditions', '/clinic-catalog/dental-surfaces',
  '/clinic-catalog/measurement-units', '/sales/quotes', '/sales/invoices', '/sales/payments', '/sales/services', '/sales/payment-methods',
  '/purchases/quotes', '/purchases/invoices', '/purchases/payments', '/purchases/providers', '/purchases/services',
  '/cashier/cash-points', '/cashier/sessions', '/cashier/miscellaneous-categories', '/cashier/miscellaneous-transactions',
  '/patients', '/lab-orders', '/studies', '/alerts',
  // Configuración que no es una lista
  '/config/clinic-prefs', '/config/patients-portal', '/config/calendar-colors', '/config/templates',
].join(',')).split(',').filter(Boolean);

const P = {
  es: {
    help: 'qué puedo hacer acá',
    sort: (c: string) => `ordená por ${c} descendente`,
    hide: (c: string) => `ocultá la columna ${c}`,
    show: (c: string) => `mostrá la columna ${c}`,
    filter: (w: string) => `filtrá los que tengan ${w}`,
    first: 'seleccioná el 1',
    close: 'cerrá',
    create: 'nuevo',
    fill: [(l: string, v: string) => `poné ${l} ${v}`, (l: string, v: string) => `cambiá ${l} a ${v}`, (l: string, v: string) => `el ${l} es ${v}`],
    on: (l: string) => `activá ${l}`,
    off: (l: string) => `desactivá ${l}`,
    check: (l: string) => `marcá ${l}`,
    uncheck: (l: string) => `desmarcá ${l}`,
    pick: (o: string, l: string) => `elegí ${o} en ${l}`,
    radio: (l: string) => `elegí ${l}`,
    yes: 'sí',
    go: 'andá a pacientes',
    values: ['Prueba Voz', 'Prueba Voz Dos', 'Prueba Voz Tres'],
    numbers: ['1500', '2300', '99'],
    dates: ['el 15 de diciembre', 'el 3 de enero', 'el 20 de marzo'],
    dateWant: ['15/12', '03/01', '20/03'],
    phones: ['099 123 456', '098 765 432', '091 222 333'],
    colors: ['rojo', 'azul', 'verde'],
  },
  en: {
    help: 'what can I do here',
    sort: (c: string) => `sort by ${c} descending`,
    hide: (c: string) => `hide the ${c} column`,
    show: (c: string) => `show the ${c} column`,
    filter: (w: string) => `filter the ones that have ${w}`,
    first: 'select row 1',
    close: 'close it',
    create: 'new',
    fill: [(l: string, v: string) => `set ${l} to ${v}`, (l: string, v: string) => `change ${l} to ${v}`, (l: string, v: string) => `the ${l} is ${v}`],
    on: (l: string) => `turn on ${l}`,
    off: (l: string) => `turn off ${l}`,
    check: (l: string) => `check ${l}`,
    uncheck: (l: string) => `uncheck ${l}`,
    pick: (o: string, l: string) => `choose ${o} in ${l}`,
    radio: (l: string) => `choose ${l}`,
    yes: 'yes',
    go: 'go to patients',
    values: ['Voice Test', 'Voice Test Two', 'Voice Test Three'],
    numbers: ['1500', '2300', '99'],
    dates: ['December 15', 'January 3', 'March 20'],
    dateWant: ['15/12', '03/01', '20/03'],
    phones: ['099 123 456', '098 765 432', '091 222 333'],
    colors: ['red', 'blue', 'green'],
  },
}[LOCALE];

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
    try { localStorage.setItem('voice-always-on', 'true'); localStorage.setItem('invoke-help-voice-muted', '1'); localStorage.setItem('invoke-help:automation', '1'); } catch { /* */ }
  });
}

type Control = { kind: string; label: string; index: number; checked?: boolean; value?: string; type?: string; placeholder?: string };

/** Lo que la voz ve arriba (los mismos datos que usa para entender), con su estado. */
async function surface(page: Page): Promise<Control[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __voiceSurface?: () => Array<{ kind: string; label: string }>; __voiceSurfaceEls?: () => HTMLElement[] };
    const list = w.__voiceSurface?.() ?? [];
    const els = w.__voiceSurfaceEls?.() ?? [];
    return list.map((c, i) => {
      const el = els[i] as HTMLInputElement | undefined;
      const aria = el?.getAttribute('aria-checked') ?? el?.getAttribute('data-state');
      return {
        kind: c.kind,
        label: c.label,
        index: i,
        checked: aria === 'true' || aria === 'checked' || aria === 'on' || el?.checked === true,
        value: el && el.tagName !== 'BUTTON' && 'value' in el ? String(el.value ?? '') : ((el as HTMLElement | undefined)?.textContent ?? '').trim(),
        type: el?.getAttribute('type') ?? el?.tagName.toLowerCase(),
        placeholder: el?.getAttribute('placeholder') ?? '',
      };
    });
  });
}

async function cardText(page: Page): Promise<string> {
  return page.evaluate(() => ((document.querySelector('[data-voice-card]') as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim());
}

async function say(page: Page, text: string, wait = 2600) {
  await page.evaluate((t) => (window as unknown as { __voiceSay: (t: string) => boolean }).__voiceSay(t), text);
  await page.waitForTimeout(wait);
  // Hasta que deje de pensar (búsquedas en el servidor, listas con buscador).
  await page.waitForFunction(() => !/Un momento|One moment/.test((document.querySelector('[data-voice-card]') as HTMLElement | null)?.innerText ?? ''), null, { timeout: 8000 }).catch(() => undefined);
}

const dialogOpen = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')).some((d) => !d.closest('[data-voice-card]') && d.offsetWidth > 0));

for (const route of ROUTES) {
  test(`matrix ${route}`, async ({ page }) => {
    test.setTimeout(720_000);
    const steps: Array<{ step: string; said: string; ok: boolean; note: string }> = [];
    const record = async (step: string, said: string, ok: boolean, note = '') => {
      const card = await cardText(page).catch(() => '');
      steps.push({ step, said, ok, note: note || card.slice(0, 220) });
      expect.soft(ok, `${route} · ${step} · «${said}» → ${card.slice(0, 160)}`).toBeTruthy();
    };
    await install(page);
    await page.goto(`/${LOCALE}${route}`);
    await page.waitForFunction(() => (window as unknown as { __voiceListening: () => boolean }).__voiceListening(), null, { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('main .animate-pulse, main .animate-spin'), null, { timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(1500);

    // ── Ayuda ────────────────────────────────────────────────────────────────
    await say(page, P.help);
    await record('ayuda', P.help, (await cardText(page)).length > 40);

    // ── Tabla ────────────────────────────────────────────────────────────────
    await page.waitForFunction(() => !document.querySelector('main [data-voice-table]') || !!document.querySelector('main [data-voice-table] [data-row-id]'), null, { timeout: 15000 }).catch(() => undefined);
    const table = await page.evaluate(() => {
      const root = document.querySelector('main [data-voice-table]');
      if (!root) return null;
      const headers = Array.from(root.querySelectorAll<HTMLElement>('thead th')).map((h) => (h.innerText || '').trim()).filter((t) => t.length > 2 && t.length < 30);
      const firstRow = root.querySelector<HTMLElement>('[data-row-id]');
      const words = (firstRow?.innerText ?? '').split(/[\s·,()]+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}$/.test(w));
      return { headers, word: words[0] ?? null, rows: root.querySelectorAll('[data-row-id]').length };
    });
    if (table && table.rows > 0) {
      const col = table.headers[0];
      if (col) {
        await say(page, P.sort(col));
        await record('tabla · ordenar', P.sort(col), /orden|sort/i.test(await cardText(page)));
      }
      const hideCol = table.headers[1] ?? table.headers[0];
      if (hideCol) {
        const before = await page.locator('main [data-voice-table] thead th').count();
        await say(page, P.hide(hideCol));
        const hidden = await page.locator('main [data-voice-table] thead th').count();
        await record('tabla · ocultar columna', P.hide(hideCol), hidden < before || /ocult|hid|no se puede|can.t/i.test(await cardText(page)));
        if (hidden < before || /ocult|hid/i.test(await cardText(page))) {
          await say(page, P.show(hideCol));
          await record('tabla · mostrar columna', P.show(hideCol), (before > 0 && (await page.locator('main [data-voice-table] thead th').count()) === before) || /mostr|show/i.test(await cardText(page)));
        }
      }
      const hasSearch = await page.evaluate(() => !!document.querySelector('main input[type="search"], main [data-voice-table] input, main input[placeholder*="iltr"], main input[placeholder*="usca"], main input[placeholder*="earch"], main input[placeholder*="ilter"]'));
      if (table.word && hasSearch) {
        await say(page, P.filter(table.word), 3500);
        const value = await page.evaluate((w) => Array.from(document.querySelectorAll<HTMLInputElement>('main input')).map((i) => i.value).find((v) => v.trim().toLowerCase() === w.toLowerCase()) ?? '', table.word);
        const card = await cardText(page);
        await record('tabla · filtrar con la palabra clave', P.filter(table.word), value.trim().toLowerCase() === table.word.toLowerCase() || new RegExp(`(?:busc|search)\\w*[^«“]*[«“]${table.word}[»”]`, 'i').test(card), `escribió «${value}»`);
        await say(page, LOCALE === 'en' ? 'clear the search' : 'borrá la búsqueda', 2500);
      }
      await say(page, P.first);
      const detail = await page.evaluate(() => !!document.querySelector('[data-voice-panel="detail"]') || !!document.querySelector('[role="dialog"][data-state="open"]'));
      await record('tabla · elegir el primero', P.first, detail || /abr|open|eleg|select/i.test(await cardText(page)));
      if (detail) {
        await say(page, P.close);
        const still = await page.evaluate(() => !!document.querySelector('[data-voice-panel="detail"]') || !!document.querySelector('[role="dialog"][data-state="open"]'));
        await record('cerrar el detalle', P.close, !still || /cerr|clos/i.test(await cardText(page)));
      }
    }

    // ── Alta: la ventana, sus campos y sus controles ─────────────────────────
    await say(page, P.create, 3000);
    if (await dialogOpen(page)) {
      await record('alta · se abre y avisa', P.create, /abri|open|complet|fill|apret|press/i.test(await cardText(page)));
      const controls = await surface(page);
      // Cada campo con un valor de su tipo: texto, número (precio, monto…) o fecha («el 15 de diciembre» → 15/12/aaaa).
      const kindOf = (c: Control) => /^(?:dd\/mm\/(?:aaaa|yyyy)|mm\/dd\/yyyy)$/i.test(c.placeholder ?? '') || /^(?:fecha|vencimiento|date|due)/i.test(c.label) ? 'date'
        : /tel[eé]fono|celular|m[oó]vil|phone|whatsapp/i.test(c.label) ? 'phone'
          : /colou?r/i.test(c.label) || /^#[0-9a-f]{6}$/i.test(c.value ?? '') ? 'color'
            : c.type === 'number' || /^(?:precio|monto|importe|cantidad|total|valor|price|amount|quantity)/i.test(c.label) ? 'number' : 'text';
      const COLOR_HEX: Record<string, string> = { rojo: '#ef4444', azul: '#3b82f6', verde: '#22c55e', red: '#ef4444', blue: '#3b82f6', green: '#22c55e' };
      const texts = controls.filter((c) => c.kind === 'field' && !/time|file|search/.test(c.type ?? '') && c.label.length >= 3 && c.label.length <= 30 && !/[.…]{2,}|buscar|search/i.test(c.label)).slice(0, 3);
      for (const field of texts) {
        const kind = kindOf(field);
        const values = kind === 'date' ? P.dates : kind === 'number' ? P.numbers : kind === 'phone' ? P.phones : kind === 'color' ? P.colors : P.values;
        for (let i = 0; i < P.fill.length; i++) {
          const phrase = P.fill[i](field.label.toLowerCase(), values[i]);
          await say(page, phrase, 2200);
          const now = (await surface(page)).find((c) => c.label === field.label);
          // Un campo que cambia de nombre al escribir (editor enriquecido): lo escrito en la ventana.
          const got = now?.value ?? await page.evaluate(() => {
            const d = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]')).pop();
            return Array.from(d?.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]') ?? []).map((e) => (e as HTMLInputElement).value ?? e.innerText ?? '').join(' | ');
          });
          const digits = (x: string) => x.replace(/\D/g, '');
          const ok = kind === 'date' ? got.includes(P.dateWant[i]) || /\d{4}-\d{2}-\d{2}/.test(got)
            : kind === 'number' ? Number(got.replace(',', '.')) === Number(values[i])
              : kind === 'phone' ? digits(got).includes(digits(values[i]).replace(/^0/, ''))
                : kind === 'color' ? got.toLowerCase().includes(COLOR_HEX[values[i]])
                  : got.toLowerCase().includes(values[i].toLowerCase());
          await record(`campo «${field.label}» (${kind}, ${i + 1}/3)`, phrase, ok, `quedó «${got.slice(0, 80)}»`);
        }
      }
      for (const toggle of controls.filter((c) => c.kind === 'toggle' && c.label.length <= 40).slice(0, 2)) {
        const isCheckbox = /checkbox/.test(toggle.type ?? '');
        for (const turnOn of [!toggle.checked, !!toggle.checked]) {
          const phrase = isCheckbox ? (turnOn ? P.check(toggle.label) : P.uncheck(toggle.label)) : (turnOn ? P.on(toggle.label) : P.off(toggle.label));
          await say(page, phrase, 2000);
          const now = (await surface(page)).find((c) => c.label === toggle.label);
          await record(`interruptor «${toggle.label}» ${turnOn ? 'on' : 'off'}`, phrase, !!now?.checked === turnOn, `quedó ${now?.checked ? 'on' : 'off'}`);
        }
      }
      for (const select of controls.filter((c) => c.kind === 'select' && c.label.length <= 30).slice(0, 2)) {
        // Las opciones: se abre la lista a mano para leerlas, y se cierra.
        const el = page.locator('[role="dialog"][data-state="open"] [role="combobox"]').filter({ hasText: select.value?.slice(0, 20) || '' }).first();
        const options = await (async () => {
          if (!(await el.count())) return [] as string[];
          await el.click().catch(() => undefined);
          await page.waitForTimeout(500);
          const list = (await page.locator('[role="option"]').allInnerTexts().catch(() => [])).map((t) => t.split('\n')[0].trim()).filter((t) => t && t.length < 40);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          return list;
        })();
        const option = options.find((o) => o !== select.value) ?? options[0];
        if (!option) continue;
        const phrase = P.pick(option, select.label.toLowerCase());
        await say(page, phrase, 3000);
        const now = (await surface(page)).find((c) => c.label === select.label);
        await record(`lista «${select.label}»`, phrase, (now?.value ?? '').includes(option) || new RegExp(option.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(await cardText(page)), `quedó «${now?.value ?? ''}»`);
      }
      const radio = controls.find((c) => c.kind === 'radio' && !c.checked);
      if (radio) {
        const phrase = P.radio(radio.label);
        await say(page, phrase, 2000);
        const now = (await surface(page)).find((c) => c.label === radio.label);
        await record(`opción «${radio.label}»`, phrase, !!now?.checked, `quedó ${now?.checked ? 'elegida' : 'sin elegir'}`);
      }
      // Cerrar lo último que se abrió (sin guardar).
      await say(page, P.close, 2400);
      if (await dialogOpen(page)) await say(page, P.yes, 2000);
      if (await dialogOpen(page)) await say(page, LOCALE === 'en' ? 'discard' : 'descartar', 2000);
      await record('cerrar la ventana', P.close, !(await dialogOpen(page)));

      // Cambio de contexto: con la ventana abierta, otra pantalla.
      if (!route.startsWith('/patients')) {
        await say(page, P.create, 3000);
        if (await dialogOpen(page)) {
          await say(page, P.go, 4000);
          if (await dialogOpen(page)) await say(page, P.yes, 2500);
          await record('cambio de contexto (ventana abierta → otra pantalla)', P.go, /\/patients/.test(page.url()) && !(await dialogOpen(page)), page.url());
        }
      }
    } else {
      await record('alta', P.create, /no se|no hay|nothing|can.t|cannot|no tiene|consulta/i.test(await cardText(page)) || true, 'pantalla sin alta');
    }

    const dir = join('voice-matrix-results');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${LOCALE}${route.replace(/\//g, '_')}.json`), JSON.stringify({ route, locale: LOCALE, steps }, null, 2));
    console.log(`[matrix] ${route} ${steps.filter((s) => s.ok).length}/${steps.length}${steps.filter((s) => !s.ok).map((s) => `\n  ✘ ${s.step} «${s.said}» → ${s.note}`).join('')}`);
  });
}
