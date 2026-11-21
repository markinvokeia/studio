import { expect, test, type Page } from '@playwright/test';

/**
 * La voz en la app real (Chrome + pnpm dev + la sesión del e2e). El reconocimiento de voz es
 * falso: `say()` entrega la frase al micrófono permanente como lo haría Chrome. Solo acciones que
 * no guardan nada: navegar, abrir y cerrar, leer, filtrar, poner un período.
 * Correr con `pnpm test:voice:live` (la app tiene que estar corriendo).
 */

declare global {
  interface Window {
    __voiceSay?: (text: string) => boolean;
    __voiceListening?: () => boolean;
  }
}

/** Reconocedor falso + micrófono prendido y voz del asistente muda, antes de que cargue la app. */
async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Listener = ((e: unknown) => void) | null;
    const instances: FakeRecognition[] = [];
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: Listener = null;
      onerror: Listener = null;
      onend: Listener = null;
      onspeechstart: Listener = null;
      started = false;
      ended = false;
      start() { this.started = true; instances.push(this); }
      stop() { this.end(); }
      abort() { this.end(); }
      end() {
        if (this.ended) return;
        this.ended = true;
        setTimeout(() => this.onend?.({}), 0);
      }
    }
    const active = () => {
      for (let i = instances.length - 1; i >= 0; i--) {
        const r = instances[i];
        if (r.continuous && r.started && !r.ended) return r;
      }
      return null;
    };
    const w = window as unknown as Record<string, unknown>;
    w.webkitSpeechRecognition = FakeRecognition;
    w.SpeechRecognition = FakeRecognition;
    w.__voiceListening = () => !!active();
    w.__voiceSay = (text: string) => {
      const r = active();
      if (!r) return false;
      r.onspeechstart?.({});
      r.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: text } } } });
      return true;
    };
    try {
      localStorage.setItem('voice-always-on', 'true');
      localStorage.setItem('invoke-help-voice-muted', '1');
    } catch { /* sin almacenamiento */ }
  });
}

async function say(page: Page, text: string) {
  await expect.poll(() => page.evaluate(() => window.__voiceListening?.() ?? false), { timeout: 15_000 }).toBe(true);
  const delivered = await page.evaluate((t) => window.__voiceSay?.(t) ?? false, text);
  expect(delivered, `el micrófono no estaba escuchando para «${text}»`).toBe(true);
}

const card = (page: Page) => page.locator('[data-voice-card]');

/** Lo que responde la tarjeta, sin el eco de lo dicho («…») ni la línea de estado. */
async function answer(page: Page): Promise<string> {
  const raw = await card(page).first().innerText({ timeout: 1000 }).catch(() => '');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  // Primera línea: el estado («Te escucho»); «…»: lo dicho; la última: la ayuda del micrófono.
  return lines.slice(1).filter((l) => !/^«.*»$/.test(l) && !/Esc (?:cancela|cancels)/.test(l)).join(' ');
}
const BUSY = /Le pregunto al agente|Asking the clinical agent|Un momento…|One moment…|Esperando que cargue|Waiting for the/;
const NOT_UNDERSTOOD = /No entendí|No reconocí|I didn.t (?:understand|get)|I couldn.t understand|Se produjo un error|Something went wrong/;

interface Step {
  say: string;
  /** La ruta a la que tiene que llegar. */
  url?: RegExp;
  /** Lo que tiene que decir la tarjeta. */
  shows?: RegExp;
  /** Una ventana que se abre (y se cierra sin guardar al final). */
  dialog?: boolean;
  /** El primer campo de la ventana, con lo escrito. */
  field?: RegExp;
  /** Un control de la ventana (por selector) con ese valor. */
  value?: { selector: string; re: RegExp };
  /** La ventana queda abierta para los pasos que siguen (se cierra en el último). */
  keepOpen?: boolean;
}
interface Scenario { name: string; path: string; steps: Step[] }

async function run(page: Page, { path, steps }: Scenario) {
  await page.goto(path);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  // En desarrollo React monta dos veces: el micrófono arranca, se apaga y vuelve a arrancar.
  await expect.poll(() => page.evaluate(() => window.__voiceListening?.() ?? false), { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(800);
  for (const step of steps) {
    const before = await answer(page);
    await say(page, step.say);
    // La frase termina con la pausa (1,2 s) y después se contesta.
    await page.waitForTimeout(1400);
    await expect.poll(() => answer(page), { timeout: 20_000, message: `«${step.say}» sin respuesta` }).not.toBe(before);
    // Lo que tarda (el agente clínico, una página que carga): hasta que conteste de verdad.
    await expect.poll(async () => BUSY.test(await answer(page)), { timeout: 90_000, message: `«${step.say}» sigue pensando` }).toBe(false);
    if (step.url) await expect(page, `«${step.say}»`).toHaveURL(step.url, { timeout: 25_000 });
    if (step.shows) await expect.poll(() => answer(page), { timeout: 20_000, message: `«${step.say}»` }).toMatch(step.shows);
    const dialog = page.locator('[role="dialog"][data-state="open"]').last();
    if (step.dialog) await expect(dialog, `«${step.say}»`).toBeVisible({ timeout: 15_000 });
    if (step.field) await expect(dialog.locator('input:visible').first(), `«${step.say}»`).toHaveValue(step.field, { timeout: 10_000 });
    if (step.value) await expect(page.locator('[role="dialog"][data-state="open"]').last().locator(step.value.selector).first(), `«${step.say}»`).toHaveValue(step.value.re, { timeout: 10_000 });
    if (!step.url && !step.shows && !step.dialog) await page.waitForTimeout(1500);
    const text = await answer(page);
    console.log(`  «${step.say}» → ${text}`);
    expect(text, `«${step.say}» → ${text}`).not.toMatch(NOT_UNDERSTOOD);
    if (step.dialog && !step.keepOpen) {
      // Se cierra sin guardar (Escape; si pregunta por los cambios, se descarta).
      for (let i = 0; i < 3 && await dialog.isVisible().catch(() => false); i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const discard = page.locator('[role="alertdialog"] button').filter({ hasText: /Descartar|Discard/ });
        if (await discard.count()) await discard.first().click();
      }
      await page.waitForTimeout(400);
    }
  }
}

const ES: Scenario[] = [
  { name: 'menú: navega y vuelve', path: '/es', steps: [
    { say: 'andá a pacientes', url: /\/es\/patients/ },
    { say: 'centro de alertas', url: /\/es\/alerts/ },
    { say: 'volvé al inicio', url: /\/es\/?$/ },
  ] },
  { name: 'menú: navega y sigue en la página nueva', path: '/es', steps: [
    { say: 'andá a la agenda y poné vista semana', url: /\/es\/appointments/, shows: /semana/i },
  ] },
  { name: 'agenda: vistas y días', path: '/es/appointments', steps: [
    { say: 'poné vista mes', shows: /mes/i },
    { say: 'andá a mañana' },
    { say: 'volvé a hoy' },
    { say: 'qué tengo hoy' },
  ] },
  { name: 'panel de control: período', path: '/es', steps: [
    { say: 'mostrame el mes pasado' },
    { say: 'este mes' },
    { say: 'actualizá el panel' },
  ] },
  { name: 'riel: sede de trabajo y tipo de cambio', path: '/es/purchases/providers', steps: [
    { say: 'en qué sede estoy', shows: /trabajando en/i },
    { say: 'cuál es el tipo de cambio' },
  ] },
  { name: 'Mi consultorio: agenda del día', path: '/es/workspace', steps: [
    { say: 'qué pacientes tengo' },
    { say: 'quién sigue' },
  ] },
  { name: 'Mi consultorio: caso clínico con el agente', path: '/es/workspace', steps: [
    { say: 'el de las 9', shows: /09:00/ },
    { say: 'dame un resumen del paciente', shows: /Caso clínico/ },
    { say: 'qué alergias tiene', shows: /Caso clínico/ },
    { say: 'cerrá el caso', shows: /Cerré el caso/ },
    { say: 'volvé al caso', shows: /Volví al caso/ },
  ] },
  { name: 'Mi consultorio: cambiar de caso, pestañas y fechas', path: '/es/workspace', steps: [
    { say: 'el de las 9', shows: /Carolina/ },
    { say: 'cambiá de Carolina a Leonardo', shows: /Leonardo/ },
    { say: 'seleccioná a Martín', shows: /Mart[ií]n/ },
    { say: 'mis calendarios', shows: /agenda|calendario/i },
    { say: 'asignadas a mí', shows: /tus citas/i },
    { say: 'cambiá la fecha a mañana', shows: /mañana/i },
    { say: 'la semana pasada', shows: /\d{2}\/\d{2}/ },
    { say: 'volvé a hoy', shows: /hoy/i },
  ] },
  { name: 'tablas: páginas, orden, columnas, buscar, elegir', path: '/es/clinic-catalog/medications', steps: [
    { say: 'poné 10 por página', shows: /10 por página/ },
    { say: 'siguiente página', shows: /Página 2 de/ },
    { say: 'primera página', shows: /Página 1 de/ },
    { say: 'qué columnas hay', shows: /Columnas:/ },
    { say: 'ordená por nombre genérico descendente', shows: /Ordené por/ },
    { say: 'sacá el orden', shows: /Saqué el orden/ },
    { say: 'buscá ibu', shows: /Busqué «ibu»/ },
    { say: 'borrá la búsqueda', shows: /Borré la búsqueda/ },
    { say: 'seleccioná el 2', shows: /Abrí/ },
    { say: 'cerrá el detalle', shows: /Cerré el detalle/ },
  ] },
  { name: 'tablas: facturas (filtro, vista, páginas)', path: '/es/sales/invoices', steps: [
    { say: 'poné 10 por página', shows: /10 por página/ },
    { say: 'última página', shows: /Página \d+ de/ },
    { say: 'vista de lista', shows: /Vista de lista/ },
    { say: 'vista de tabla', shows: /Vista de tabla/ },
  ] },
  { name: 'configuración: «nuevo» con el botón de la pantalla', path: '/es/config/holidays', steps: [
    { say: 'nuevo', dialog: true },
    { say: 'qué columnas hay', shows: /Columnas: Fecha/ },
  ] },
  { name: 'configuración: datos de la clínica', path: '/es/config/clinics', steps: [
    { say: 'nuevo', dialog: true },
  ] },
  { name: 'configuración: horario (hora dicha)', path: '/es/config/schedules', steps: [
    { say: 'nuevo', dialog: true, keepOpen: true },
    { say: 'la hora de inicio es las 9 y media', value: { selector: 'input[type="time"]', re: /^09:30$/ } },
    { say: 'cancelar', dialog: false },
  ] },
  { name: 'configuración: calendario (color dicho)', path: '/es/config/calendars', steps: [
    { say: 'nuevo', dialog: true, keepOpen: true },
    { say: 'el color es rojo', value: { selector: 'input[type="color"]', re: /^#ef4444$/ } },
    { say: 'cancelar', dialog: false },
  ] },
  { name: 'configuración: feriado (día en el calendario)', path: '/es/config/holidays', steps: [
    { say: 'nuevo', dialog: true, keepOpen: true },
    { say: 'el 15 de diciembre', shows: /Elegí el 15\/12/ },
    { say: 'cancelar', dialog: false },
  ] },
  { name: 'alertas: leer', path: '/es/alerts', steps: [
    { say: 'cuántas alertas hay', shows: /alerta/i },
    { say: 'qué alertas críticas hay' },
  ] },
  { name: 'caja: puntos', path: '/es/cashier', steps: [
    { say: 'qué cajas hay' },
  ] },
  { name: 'pacientes: buscar y contar', path: '/es/patients', steps: [
    { say: 'cuántos pacientes hay', shows: /paciente/i },
    { say: 'buscá a Ana' },
    { say: 'todos los pacientes' },
  ] },
  { name: 'laboratorio: qué se puede', path: '/es/lab-orders', steps: [
    { say: 'qué puedo hacer acá' },
  ] },
  { name: 'ventas: facturas', path: '/es/sales/invoices', steps: [
    { say: 'cuántas facturas hay', shows: /factura/i },
    { say: 'cuánto suman las pendientes' },
  ] },
  { name: 'compras: presupuestos', path: '/es/purchases/quotes', steps: [
    { say: 'cuántos presupuestos hay', shows: /presupuesto/i },
  ] },
  { name: 'reportes: llegar, período y leer', path: '/es', steps: [
    { say: 'llevame a reportes de cobros del día y mostrame el mes pasado', url: /\/es\/reports\//, shows: /\d{2}\/\d{2}\/\d{4}/ },
    { say: 'cuánto da' },
  ] },
  { name: 'reportes: filtros de la barra', path: '/es/reports/cierre-caja', steps: [
    { say: 'qué cajas hay', shows: /Cajas: Todas las cajas, / },
    { say: 'filtrá por la caja sede carrasco', shows: /Filtré por Caja Sede Carrasco/ },
    { say: 'solo egresos', shows: /Filtré por Solo egresos/ },
    { say: 'sacá los filtros', shows: /Saqué los filtros/ },
  ] },
  { name: 'reportes: sin período lo genera igual', path: '/es', steps: [
    { say: 'llevame a reportes de deudores y mostrame el mes pasado', url: /\/es\/reports\/deudores/, shows: /lo genero igual/ },
  ] },
  { name: 'catálogo: alta con nombre, sin guardar', path: '/es/clinic-catalog/medications', steps: [
    { say: 'nuevo medicamento Prueba Voz', dialog: true, field: /Prueba Voz/ },
    { say: 'cuántos hay', shows: /registro/i },
  ] },
  { name: 'configuración: sedes', path: '/es/config/sedes', steps: [
    { say: 'cuántas hay', shows: /registro/i },
    { say: 'actualizá la lista' },
  ] },
  { name: 'pantalla genérica: ayuda', path: '/es/patients', steps: [
    { say: 'qué puedo hacer acá' },
  ] },
];

const EN: Scenario[] = [
  { name: 'menu: navigates and returns', path: '/en', steps: [
    { say: 'go to patients', url: /\/en\/patients/ },
    { say: 'take me to the alerts center', url: /\/en\/alerts/ },
    { say: 'go home', url: /\/en\/?$/ },
  ] },
  { name: 'menu: navigates and continues', path: '/en', steps: [
    { say: 'go to the calendar and switch to month view', url: /\/en\/appointments/, shows: /month/i },
  ] },
  { name: 'calendar: views and days', path: '/en/appointments', steps: [
    { say: 'week view', shows: /week/i },
    { say: 'go to tomorrow' },
    { say: 'today' },
  ] },
  { name: 'dashboard: period', path: '/en', steps: [
    { say: 'show me last month' },
    { say: 'this month' },
  ] },
  { name: 'rail: working location', path: '/en/purchases/providers', steps: [
    { say: 'which location am I in', shows: /working (?:at|in)|location/i },
    { say: 'what is the exchange rate' },
  ] },
  { name: 'workspace: day schedule', path: '/en/workspace', steps: [
    { say: 'what is on my schedule' },
    { say: 'who is next' },
  ] },
  { name: 'workspace: clinical case with the agent', path: '/en/workspace', steps: [
    { say: 'the 9 o clock', shows: /09:00/ },
    { say: 'give me a summary of the patient', shows: /Clinical case/ },
    { say: 'close the case', shows: /closed/ },
  ] },
  { name: 'tables: pages, columns, search', path: '/en/clinic-catalog/medications', steps: [
    { say: 'show 10 per page', shows: /10 per page/ },
    { say: 'next page', shows: /Page 2 of/ },
    { say: 'which columns are there', shows: /Columns:/ },
    { say: 'search for ibu', shows: /Searched/ },
    { say: 'clear the search', shows: /Cleared the search/ },
  ] },
  { name: 'alerts: read', path: '/en/alerts', steps: [
    { say: 'how many alerts are there', shows: /alert/i },
  ] },
  { name: 'cashier: registers', path: '/en/cashier', steps: [
    { say: 'which registers are there' },
  ] },
  { name: 'patients: count and search', path: '/en/patients', steps: [
    { say: 'how many patients are there', shows: /patient/i },
    { say: 'search for Ana' },
  ] },
  { name: 'sales: invoices', path: '/en/sales/invoices', steps: [
    { say: 'how many invoices are there', shows: /invoice/i },
    { say: 'how much do the pending ones add up to' },
  ] },
  { name: 'reports: go, period and read', path: '/en', steps: [
    { say: 'take me to the daily collections report and show last month', url: /\/en\/reports\//, shows: /\d{2}\/\d{2}\/\d{4}/ },
    { say: 'read the totals' },
  ] },
  { name: 'catalog: new with a name, not saved', path: '/en/clinic-catalog/medications', steps: [
    { say: 'new medication Voice Test', dialog: true, field: /Voice Test/ },
    { say: 'how many are there', shows: /record/i },
  ] },
  { name: 'generic screen: help', path: '/en/patients', steps: [
    { say: 'what can I do here' },
  ] },
];

test.describe('voz en la app real · español', () => {
  test.beforeEach(async ({ page }) => { await installFakeSpeech(page); });
  for (const sc of ES) test(sc.name, async ({ page }) => { await run(page, sc); });
});

test.describe('voice in the real app · English', () => {
  test.beforeEach(async ({ page }) => { await installFakeSpeech(page); });
  for (const sc of EN) test(sc.name, async ({ page }) => { await run(page, sc); });
});
