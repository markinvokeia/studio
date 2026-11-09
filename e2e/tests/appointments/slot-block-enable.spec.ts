import fs from 'fs';
import path from 'path';

import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

/**
 * "Bloquear horario" y "Habilitar horario" desde el menú contextual del calendario,
 * con guardado REAL contra n8n y `clinic_exceptions` de DEV (entorno compartido).
 *
 * - Todo se escribe en 2031, con notas `E2E-bloqueo-…`, en fechas que se comprueba que
 *   estén vacías antes de escribir. El afterEach borra por `/feriados/delete` lo que
 *   lleve ese prefijo en esas fechas, también si el test falló.
 * - Los ajustes del calendario se cambian solo en el navegador (`page.route`): el
 *   upsert de ajustes se intercepta para no tocar la preferencia guardada del usuario.
 * - Las filas se leen por `/exceptions`. Lo que solo Postgres puede responder
 *   (`get_available_users()`) va por `dbCheckpoint`: con E2E_DB_CHECKPOINT_DIR el test
 *   escribe `<nombre>.json` y espera `<nombre>.ok` = {"pass": boolean, "detail": string},
 *   para que alguien corra el SELECT mientras los datos existen. Sin esa variable el
 *   paso se salta y queda anotado.
 *
 * Correr (las credenciales están en .env y el config solo lee .env.local):
 *   DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/@playwright/test/cli.js \
 *     test --project=chromium e2e/tests/appointments/slot-block-enable.spec.ts
 */

/** Sede Malvín: lunes a viernes 9–18, una sola agenda y sin excepciones recurrentes. */
const SEDE_ID = 6;
const CALENDAR_ID = '51';
/** Sede con una apertura semanal real (fila 19, lunes 8–21): no hace falta crear datos. */
const RECURRING_SEDE_ID = 1;
const RECURRING_CALENDAR_ID = '47';

const NOTE_PREFIX = 'E2E-bloqueo-';
const RUN_ID = Date.now().toString(36);
const note = (suffix: string) => `${NOTE_PREFIX}${RUN_ID}-${suffix}`;

/**
 * Miércoles de 2031 (el 10/3 es lunes). Días entre 8 y 22: en el selector de fecha
 * nunca se repiten como días del mes vecino.
 */
const DATES = {
  cycle: '2031-03-12',
  afterEnable: '2031-03-19',
  trim: '2031-04-09',
  split: '2031-04-16',
  appointments: '2031-05-14',
  otherScope: '2031-05-21',
  permissions: '2031-06-11',
  recurringMonday: '2031-03-10',
} as const;
/** Las únicas fechas en las que este spec escribe. */
const WRITE_DATES: string[] = [DATES.cycle, DATES.afterEnable, DATES.trim, DATES.split, DATES.appointments, DATES.otherScope];

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const HELP = {
  menuBlock: '[data-help-id="appointments.btn.slot-block"]',
  menuEnable: '[data-help-id="appointments.btn.slot-enable"]',
  menuNewAppointment: '[data-help-id="appointments.btn.slot-new-appointment"]',
  menuNewReminder: '[data-help-id="appointments.btn.slot-new-reminder"]',
  affected: '[data-help-id="appointments.block-slot.section.affected-appointments"]',
};
const dialogField = (scope: 'block-slot' | 'enable-slot', name: 'start_time' | 'end_time' | 'notes') =>
  `[data-help-id="appointments.${scope}.field.${name}"]`;
const dialogSubmit = (scope: 'block-slot' | 'enable-slot') => `[data-help-id="appointments.${scope}.btn.submit"]`;

interface ExceptionRow {
  id: number;
  date: string;
  dates: string[] | null;
  recurrence: string;
  is_open: boolean;
  start_time: string | null;
  end_time: string | null;
  sede_id: number | null;
  notes: string | null;
}

interface WriteRecord {
  method: string;
  path: string;
  status: number;
  body: unknown;
}

// ── API ───────────────────────────────────────────────────────────────────────

/** `…/webhook`, tomado de la propia app: no hay que duplicar la URL del backend. */
let apiBase: string | null = null;

function authHeaders(): Record<string, string> {
  const authFile = path.join(__dirname, '../../.auth/user.json');
  const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  const token = state.origins
    ?.flatMap((o: { localStorage: { name: string; value: string }[] }) => o.localStorage)
    .find((entry: { name: string }) => entry.name === 'token')?.value;
  if (!token) throw new Error('No hay token en e2e/.auth/user.json');
  return { Authorization: `Bearer ${token}` };
}

const dayKey = (value: string) => value.slice(0, 10);
const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);
const rowDates = (row: ExceptionRow) => (row.dates?.length ? row.dates : [row.date]).map(dayKey);

async function listRowsOn(request: APIRequestContext, date: string): Promise<ExceptionRow[]> {
  const all = await listAllRows(request);
  return all.filter((row) => row.recurrence === 'once' && rowDates(row).includes(date));
}

async function listAllRows(request: APIRequestContext): Promise<ExceptionRow[]> {
  if (!apiBase) throw new Error('apiBase sin resolver: la página no llegó a cargar /exceptions');
  const res = await request.get(`${apiBase}/exceptions`, { headers: authHeaders() });
  expect(res.ok(), `GET /exceptions → ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return (Array.isArray(body) ? body : body?.data ?? []) as ExceptionRow[];
}

const isErrorBody = (body: unknown) => {
  const first = Array.isArray(body) ? body[0] : body;
  const data = first as { error?: unknown; code?: unknown } | null;
  return !!data && typeof data === 'object' && (data.error === true || Number(data.code) >= 400);
};

/** Resumen sin ids, para comparar el estado del día sin depender de lo que asigne Postgres. */
const summarize = (rows: ExceptionRow[]) =>
  rows
    .map((r) => `${r.is_open ? 'open' : 'closed'} ${hhmm(r.start_time)}-${hhmm(r.end_time)}`)
    .sort();

// ── Calendario ────────────────────────────────────────────────────────────────

const column = (page: Page, calendarId: string) => page.locator(`.day-column-content[data-group-col="${calendarId}"]`);
const closedBands = (page: Page, calendarId: string) => column(page, calendarId).locator('.calendar-blocked--exception');
/** El diálogo abierto: `getByRole('dialog')` también encuentra el panel oculto de Notificaciones. */
const openDialog = (page: Page) => page.locator('[role="dialog"][data-state="open"]');

function dbCheckpointDir() {
  return process.env.E2E_DB_CHECKPOINT_DIR || null;
}

/** Espera a que alguien compruebe `data` en Postgres. Ver el comentario de arriba. */
async function dbCheckpoint(name: string, data: unknown) {
  const dir = dbCheckpointDir();
  if (!dir) {
    test.info().annotations.push({ type: 'db-checkpoint-skipped', description: name });
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const okFile = path.join(dir, `${name}.ok`);
  fs.rmSync(okFile, { force: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
  await expect
    .poll(() => fs.existsSync(okFile), { message: `Checkpoint ${name} sin respuesta`, timeout: 300_000, intervals: [1_000] })
    .toBe(true);
  const verdict = JSON.parse(fs.readFileSync(okFile, 'utf8')) as { pass: boolean; detail: string };
  test.info().annotations.push({ type: `db-${name}`, description: verdict.detail });
  expect(verdict.pass, `Postgres (${name}): ${verdict.detail}`).toBe(true);
}

async function goToDate(page: Page, date: string) {
  const [year, month, day] = date.split('-').map(Number);
  await page.locator('[data-testid="calendar-header-date-picker"]').click();
  const popover = page.locator('[data-radix-popper-content-wrapper]').last();
  await popover.getByRole('button', { name: /^\S+ \d{4}$/ }).click(); // días → meses
  const yearCaption = popover.getByRole('button', { name: /^\d{4}$/ });
  const nextYear = popover.locator('button.h-7.w-7').last();
  for (let i = 0; i < 20 && (await yearCaption.innerText()).trim() !== String(year); i += 1) {
    await nextYear.click();
  }
  await expect(yearCaption).toHaveText(String(year));
  await popover.getByRole('button', { name: new RegExp(`^${MONTHS_ES[month - 1]}$`, 'i') }).click();
  await popover.getByRole('gridcell', { name: String(day), exact: true }).click();
  await expect(page.locator('[data-testid="calendar-header-date-picker"]')).toContainText(String(year));
}

/** Abre `/appointments` en vista de día, agrupado por consultorio, para esa sede y fecha. */
async function openCalendar(page: Page, date: string, opts: { sedeId?: number; calendarId?: string } = {}) {
  const { sedeId = SEDE_ID, calendarId = CALENDAR_ID } = opts;

  await page.route('**/calendar_settings/upsert*', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/calendar_settings/search*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const row = (Array.isArray(body) ? body[0] : body) ?? {};
    await route.fulfill({
      response,
      json: [{
        ...(row.json ?? row),
        default_view: 'day',
        grouped_by: 'calendar',
        mode: 'default',
        block_unavailable: true,
        default_sede: String(sedeId),
        visible_hours_mode: 'full',
        hidden_weekdays: [],
        slot_duration: 30,
      }],
    });
  });

  const exceptions = page.waitForResponse((r) => /\/exceptions(\?|$)/.test(r.url()) && r.request().method() === 'GET');
  await page.goto('/appointments');
  apiBase = (await exceptions).url().replace(/\/exceptions.*$/, '');

  await expect(column(page, calendarId)).toBeVisible({ timeout: 45_000 });
  await goToDate(page, date);
  await expect(column(page, calendarId)).toBeVisible();
  // Las bandas de horario son la señal de que horarios y excepciones ya cargaron.
  await expect(column(page, calendarId).locator('.calendar-blocked').first()).toBeAttached({ timeout: 30_000 });
}

/** Clic derecho en el minuto `min` de la columna; deja el menú abierto. */
async function openSlotMenu(page: Page, calendarId: string, min: number) {
  const col = column(page, calendarId);
  // Reintenta: un refresco de la grilla justo después del clic cierra el menú.
  await expect(async () => {
    await col.evaluate((el, minute) => {
      const scroller = el.closest('.day-view-container') as HTMLElement;
      const rect = el.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      scroller.scrollTop += rect.top + (rect.height * minute) / 1440 - scrollerRect.top - scrollerRect.height / 2;
    }, min);
    const box = await col.boundingBox();
    if (!box) throw new Error(`Columna ${calendarId} sin caja`);
    await page.mouse.click(box.x + box.width / 2, box.y + (box.height * min) / 1440 + 4, { button: 'right' });
    await expect(page.locator(HELP.menuNewReminder)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
}

async function closeMenu(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator(HELP.menuNewReminder)).toBeHidden();
}

/** Qué ofrece el menú en ese minuto: abierto = Bloquear; cerrado = Habilitar y sin "Crear cita". */
async function expectSlotState(page: Page, calendarId: string, min: number, state: 'open' | 'closed') {
  await openSlotMenu(page, calendarId, min);
  if (state === 'open') {
    await expect(page.locator(HELP.menuBlock), `Bloquear a los ${min} min`).toBeVisible();
    await expect(page.locator(HELP.menuEnable), `Habilitar a los ${min} min`).toBeHidden();
    await expect(page.locator(HELP.menuNewAppointment)).not.toHaveAttribute('data-disabled', /.*/);
  } else {
    await expect(page.locator(HELP.menuEnable), `Habilitar a los ${min} min`).toBeVisible();
    await expect(page.locator(HELP.menuBlock), `Bloquear a los ${min} min`).toBeHidden();
    await expect(page.locator(HELP.menuNewAppointment)).toHaveAttribute('data-disabled', /.*/);
  }
  await closeMenu(page);
}

async function fillWindow(dialog: Locator, scope: 'block-slot' | 'enable-slot', start: string, end: string, notes: string) {
  await dialog.locator(dialogField(scope, 'start_time')).fill(start);
  await dialog.locator(dialogField(scope, 'end_time')).fill(end);
  await dialog.locator(dialogField(scope, 'notes')).fill(notes);
}

async function openBlockDialog(page: Page, calendarId: string, min: number) {
  await openSlotMenu(page, calendarId, min);
  await page.locator(HELP.menuBlock).click();
  const dialog = openDialog(page);
  await expect(dialog.locator(dialogField('block-slot', 'start_time'))).toBeVisible();
  return dialog;
}

async function openEnableDialog(page: Page, calendarId: string, min: number) {
  await openSlotMenu(page, calendarId, min);
  await page.locator(HELP.menuEnable).click();
  const dialog = openDialog(page);
  await expect(dialog.locator(dialogField('enable-slot', 'start_time'))).toBeVisible();
  return dialog;
}

async function submitDialog(page: Page, dialog: Locator, scope: 'block-slot' | 'enable-slot', writes: WriteRecord[]) {
  const before = writes.length;
  await dialog.locator(dialogSubmit(scope)).click();
  await expect(dialog, 'El diálogo debe cerrarse al guardar').toBeHidden({ timeout: 45_000 });
  const made = writes.slice(before);
  expect(made.length, 'El guardado debe llegar al backend').toBeGreaterThan(0);
  for (const write of made) {
    expect(isErrorBody(write.body), `${write.method} ${write.path}: ${JSON.stringify(write.body)}`).toBe(false);
  }
  return made;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Calendario: bloquear y habilitar horario (guardado real)', () => {
  test.describe.configure({ retries: 0 });

  let writes: WriteRecord[] = [];
  let appointmentWrites: string[] = [];

  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'El menú contextual por clic derecho es de escritorio');
    test.setTimeout(480_000);
    writes = [];
    appointmentWrites = [];

    page.on('response', async (response) => {
      const url = new URL(response.url());
      const method = response.request().method();
      if (/\/appointments\/(upsert|delete)/.test(url.pathname)) appointmentWrites.push(`${method} ${url.pathname}`);
      if (!/\/feriados\/(upsert|delete)/.test(url.pathname)) return;
      const record: WriteRecord = { method, path: url.pathname, status: response.status(), body: null };
      writes.push(record);
      record.body = await response.json().catch(() => null);
    });
  });

  /** No escribir jamás sobre una fecha que ya tenga filas: no serían de este test. */
  async function assertDateIsEmpty(request: APIRequestContext, date: string) {
    const rows = await listRowsOn(request, date);
    expect(rows.map((r) => r.id), `La fecha ${date} ya tiene filas: se elige otra antes de escribir`).toEqual([]);
  }

  test.afterEach(async ({ request }) => {
    if (!apiBase) return;
    const all = await listAllRows(request);
    const onTestDates = all.filter((row) => rowDates(row).some((d) => WRITE_DATES.includes(d)));
    const mine = onTestDates.filter((row) => row.notes?.startsWith(NOTE_PREFIX));
    for (const row of mine) {
      const res = await request.delete(`${apiBase}/feriados/delete`, { headers: authHeaders(), data: { id: row.id } });
      expect(res.ok(), `Limpieza de la fila ${row.id}: HTTP ${res.status()}`).toBeTruthy();
    }
    const after = await listAllRows(request);
    const left = after.filter((row) => rowDates(row).some((d) => WRITE_DATES.includes(d)));
    expect(left.map((r) => `${r.id} (${r.notes})`), 'Filas que quedaron tras la limpieza').toEqual([]);
  });

  test('Casos 1–3: bloquear, menú excluyente y deshacer con Habilitar', async ({ page, request }) => {
    const date = DATES.cycle;
    const notes = note('simple');
    await openCalendar(page, date);
    await assertDateIsEmpty(request, date);

    await test.step('Caso 1: el bloqueo crea la banda roja y la fila esperada', async () => {
      const dialog = await openBlockDialog(page, CALENDAR_ID, 11 * 60);
      // La ventana sugerida es una hora desde el clic.
      await expect(dialog.locator(dialogField('block-slot', 'start_time'))).toHaveValue('11:00');
      await expect(dialog.locator(dialogField('block-slot', 'end_time'))).toHaveValue('12:00');
      await dialog.locator(dialogField('block-slot', 'notes')).fill(notes);
      await submitDialog(page, dialog, 'block-slot', writes);

      await expect(closedBands(page, CALENDAR_ID).filter({ hasText: notes })).toBeVisible({ timeout: 20_000 });

      const rows = await listRowsOn(request, date);
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row.is_open).toBe(false);
      expect(row.recurrence).toBe('once');
      expect(rowDates(row)).toEqual([date]);
      expect(hhmm(row.start_time)).toBe('11:00');
      expect(hhmm(row.end_time)).toBe('12:00');
      expect(row.sede_id).toBe(SEDE_ID);
      expect(row.notes).toBe(notes);
      await dbCheckpoint('case1', { date, row });
    });

    await test.step('Caso 2: sobre la banda hay Habilitar, no Bloquear, y Crear cita queda deshabilitado', async () => {
      await expectSlotState(page, CALENDAR_ID, 11 * 60 + 30, 'closed');
      await expectSlotState(page, CALENDAR_ID, 12 * 60 + 30, 'open');
    });

    await test.step('Caso 3: Habilitar sobre el bloqueo lo borra y el horario vuelve a abrir', async () => {
      const dialog = await openEnableDialog(page, CALENDAR_ID, 11 * 60 + 30);
      await expect(dialog.locator(dialogField('enable-slot', 'start_time'))).toHaveValue('11:00');
      await expect(dialog.locator(dialogField('enable-slot', 'end_time'))).toHaveValue('12:00');
      const made = await submitDialog(page, dialog, 'enable-slot', writes);
      expect(made.map((w) => w.method)).toEqual(['DELETE']);

      await expect(closedBands(page, CALENDAR_ID)).toHaveCount(0, { timeout: 20_000 });
      expect(await listRowsOn(request, date)).toEqual([]);
      await expectSlotState(page, CALENDAR_ID, 11 * 60 + 30, 'open');
    });
  });

  test('Caso 4: bloquear dentro de un horario habilitado recorta la apertura', async ({ page, request }) => {
    const date = DATES.afterEnable;
    await openCalendar(page, date);
    await assertDateIsEmpty(request, date);

    await test.step('Habilitar horario extendido hasta las 20:00', async () => {
      const dialog = await openEnableDialog(page, CALENDAR_ID, 18 * 60 + 30);
      await fillWindow(dialog, 'enable-slot', '18:00', '20:00', note('apertura'));
      await submitDialog(page, dialog, 'enable-slot', writes);
      await expect
        .poll(async () => summarize(await listRowsOn(request, date)))
        .toEqual(['open 09:00-20:00']);
      await expectSlotState(page, CALENDAR_ID, 19 * 60, 'open');
    });

    await test.step('Bloquear 14:00–15:00 parte la apertura', async () => {
      const dialog = await openBlockDialog(page, CALENDAR_ID, 14 * 60);
      await fillWindow(dialog, 'block-slot', '14:00', '15:00', note('cierre'));
      const made = await submitDialog(page, dialog, 'block-slot', writes);
      // Primero el cierre: si algo falla a mitad, el día nunca queda más abierto.
      expect(made[0].method).toBe('POST');

      const rows = await listRowsOn(request, date);
      expect(summarize(rows)).toEqual(['closed 14:00-15:00', 'open 09:00-14:00', 'open 15:00-20:00']);
      const covering = rows.filter((r) => r.is_open && hhmm(r.start_time)! < '15:00' && hhmm(r.end_time)! > '14:00');
      expect(covering.map((r) => r.id), 'Ninguna apertura puede seguir cubriendo el rango bloqueado').toEqual([]);

      await expectSlotState(page, CALENDAR_ID, 14 * 60 + 30, 'closed');
      // Con la apertura ya recortada el cierre no toca el horario base: igual tiene que
      // verse en rojo y con el motivo, no como una franja gris fuera de horario.
      await expect(closedBands(page, CALENDAR_ID).filter({ hasText: note('cierre') })).toHaveCount(1);
      await expectSlotState(page, CALENDAR_ID, 13 * 60 + 30, 'open');
      await expectSlotState(page, CALENDAR_ID, 19 * 60, 'open');

      // get_available_users() a las 14:30 tiene que dar vacío, con 11:00 y 16:00 como control.
      await dbCheckpoint('case4', { date, sedeId: SEDE_ID, blocked: '14:30', controls: ['11:00', '16:00'], rows });
    });
  });

  test('Caso 5a: Habilitar recorta un cierre parcial', async ({ page, request }) => {
    const date = DATES.trim;
    const notes = note('recorte');
    await openCalendar(page, date);
    await assertDateIsEmpty(request, date);

    const block = await openBlockDialog(page, CALENDAR_ID, 11 * 60);
    await fillWindow(block, 'block-slot', '11:00', '13:00', notes);
    await submitDialog(page, block, 'block-slot', writes);
    await expect(closedBands(page, CALENDAR_ID).filter({ hasText: notes })).toBeVisible({ timeout: 20_000 });
    const [original] = await listRowsOn(request, date);

    const enable = await openEnableDialog(page, CALENDAR_ID, 11 * 60);
    await fillWindow(enable, 'enable-slot', '11:00', '12:00', note('sin-uso'));
    const made = await submitDialog(page, enable, 'enable-slot', writes);
    expect(made.map((w) => w.method)).toEqual(['POST']);

    const rows = await listRowsOn(request, date);
    expect(summarize(rows)).toEqual(['closed 12:00-13:00']);
    expect(rows[0].id, 'Se edita la misma fila').toBe(original.id);
    expect(rows[0].notes).toBe(notes);
    expect(rows[0].sede_id).toBe(SEDE_ID);

    await expect(closedBands(page, CALENDAR_ID)).toHaveCount(1, { timeout: 20_000 });
    await expectSlotState(page, CALENDAR_ID, 11 * 60 + 30, 'open');
    await expectSlotState(page, CALENDAR_ID, 12 * 60 + 30, 'closed');
  });

  test('Caso 5b: Habilitar parte un cierre cuando queda en el medio', async ({ page, request }) => {
    const date = DATES.split;
    const notes = note('parte');
    await openCalendar(page, date);
    await assertDateIsEmpty(request, date);

    const block = await openBlockDialog(page, CALENDAR_ID, 10 * 60);
    await fillWindow(block, 'block-slot', '10:00', '14:00', notes);
    await submitDialog(page, block, 'block-slot', writes);
    await expect(closedBands(page, CALENDAR_ID).filter({ hasText: notes })).toBeVisible({ timeout: 20_000 });
    const [original] = await listRowsOn(request, date);

    const enable = await openEnableDialog(page, CALENDAR_ID, 11 * 60);
    await fillWindow(enable, 'enable-slot', '11:00', '12:00', note('sin-uso'));
    await submitDialog(page, enable, 'enable-slot', writes);

    const rows = await listRowsOn(request, date);
    expect(summarize(rows)).toEqual(['closed 10:00-11:00', 'closed 12:00-14:00']);
    expect(rows.map((r) => r.id), 'La fila original sigue').toContain(original.id);
    for (const row of rows) {
      expect(row.notes).toBe(notes);
      expect(row.sede_id).toBe(SEDE_ID);
      expect(row.recurrence).toBe('once');
    }

    await expect(closedBands(page, CALENDAR_ID)).toHaveCount(2, { timeout: 20_000 });
    await expectSlotState(page, CALENDAR_ID, 10 * 60 + 30, 'closed');
    await expectSlotState(page, CALENDAR_ID, 11 * 60 + 30, 'open');
    await expectSlotState(page, CALENDAR_ID, 13 * 60, 'closed');
    await dbCheckpoint('case5', { date, rows });
  });

  /**
   * La cita es SIMULADA: no hay citas reales desde 2030 y `/appointments/delete` solo
   * cancela (la fila quedaría para siempre en DEV). Se prueba la lista de aviso, y que
   * el bloqueo real no escribe en citas. Que una cita real siga igual NO queda probado.
   */
  test('Caso 6 (cita simulada): el aviso aparece y bloquear no escribe en citas', async ({ page, request }) => {
    const date = DATES.appointments;
    const notes = note('citas');
    const dayQueries: string[] = [];
    await page.route('**/users_appointments*', async (route) => {
      const url = route.request().url();
      if (!url.includes(date)) return route.continue();
      dayQueries.push(new URL(url).searchParams.get('calendar_source_ids') ?? '');
      return route.fulfill({
        status: 200,
        json: [{
          appointment_id: 'e2e-simulada',
          patient_name: 'Paciente Simulado E2E',
          calendar_source_id: Number(CALENDAR_ID),
          start_time: `${date}T11:15:00`,
          end_time: `${date}T11:45:00`,
          status: 'confirmed',
          summary: 'Cita simulada E2E',
        }],
      });
    });

    await openCalendar(page, date);
    await assertDateIsEmpty(request, date);

    const dialog = await openBlockDialog(page, CALENDAR_ID, 11 * 60);
    const warning = dialog.locator(HELP.affected);
    await expect(warning).toContainText('Paciente Simulado E2E');
    await expect(warning).toContainText('11:15');

    // Control negativo: fuera del rango de la cita no hay aviso.
    await fillWindow(dialog, 'block-slot', '15:00', '16:00', notes);
    await expect(warning).toBeHidden();

    await fillWindow(dialog, 'block-slot', '11:00', '12:00', notes);
    await expect(warning).toBeVisible();
    await submitDialog(page, dialog, 'block-slot', writes);

    expect(dayQueries.at(-1), 'El aviso consulta las agendas de la sede').toBe(CALENDAR_ID);
    expect(appointmentWrites, 'Bloquear no escribe en citas').toEqual([]);
    await expect(column(page, CALENDAR_ID).getByText('Paciente Simulado E2E').first()).toBeVisible();
    expect(summarize(await listRowsOn(request, date))).toEqual(['closed 11:00-12:00']);
  });

  test('Caso 7a: una apertura recurrente real deshabilita Bloquear y se avisa', async ({ page }) => {
    await openCalendar(page, DATES.recurringMonday, { sedeId: RECURRING_SEDE_ID, calendarId: RECURRING_CALENDAR_ID });

    const dialog = await openBlockDialog(page, RECURRING_CALENDAR_ID, 11 * 60);
    // Texto común a es y es-ES: la app redirige al idioma guardado del usuario.
    await expect(dialog.getByText('se repite en otras fechas')).toBeVisible();
    await expect(dialog.locator(dialogSubmit('block-slot'))).toBeDisabled();
    expect(writes).toEqual([]);
  });

  test('Caso 7b: una apertura de toda la clínica deshabilita Bloquear desde una sede', async ({ page, request }) => {
    const date = DATES.otherScope;
    const notes = note('toda-clinica');
    await openCalendar(page, date);
    await assertDateIsEmpty(request, date);

    // Una fila de un solo día, en 2031: se crea por API porque la UI no la haría desde una sede.
    const created = await request.post(`${apiBase}/feriados/upsert`, {
      headers: authHeaders(),
      data: {
        date, dates: [date], recurrence: 'once', is_open: true, start_time: '09:00', end_time: '18:00',
        sede_id: null, notes, days_of_week: null, days_of_month: null, biweekly_reference_date: null, end_date: null,
      },
    });
    expect(created.ok()).toBeTruthy();
    expect(isErrorBody(await created.json().catch(() => null))).toBe(false);

    await page.reload();
    await expect(column(page, CALENDAR_ID)).toBeVisible({ timeout: 45_000 });
    await goToDate(page, date);
    await expect(column(page, CALENDAR_ID).locator('.calendar-blocked').first()).toBeAttached({ timeout: 30_000 });

    const dialog = await openBlockDialog(page, CALENDAR_ID, 11 * 60);
    await expect(dialog.getByText('aplica también a otras sedes')).toBeVisible();
    await expect(dialog.locator(dialogSubmit('block-slot'))).toBeDisabled();
    expect(writes).toEqual([]);
  });

  test('Caso 8a: sin permisos HOLIDAYS_* el menú no ofrece Bloquear ni Habilitar', async ({ page }) => {
    // Solo la interfaz: se recortan en el navegador los permisos de /auth/me.
    let stripped = 0;
    await page.route('**/auth/me*', async (route) => {
      const response = await route.fetch();
      const strip = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(strip);
        if (!value || typeof value !== 'object') return value;
        const out: Record<string, unknown> = {};
        for (const [key, inner] of Object.entries(value)) {
          if (key === 'permissions' && Array.isArray(inner)) {
            const kept = inner.filter((p: { code?: string }) => !p.code?.startsWith('HOLIDAYS_'));
            stripped += inner.length - kept.length;
            out[key] = kept;
          } else {
            out[key] = strip(inner);
          }
        }
        return out;
      };
      await route.fulfill({ response, json: strip(await response.json()) as object });
    });

    await openCalendar(page, DATES.permissions);
    expect(stripped, 'La cuenta de prueba debe tener permisos HOLIDAYS_* que recortar').toBeGreaterThan(0);

    await openSlotMenu(page, CALENDAR_ID, 11 * 60);
    await expect(page.locator(HELP.menuBlock)).toBeHidden();
    await closeMenu(page);

    await openSlotMenu(page, CALENDAR_ID, 20 * 60);
    await expect(page.locator(HELP.menuEnable)).toBeHidden();
    await closeMenu(page);
  });

  test('Caso 8b: el backend rechaza /feriados/delete sin token', async ({ request, page }) => {
    await openCalendar(page, DATES.permissions);
    // id inexistente: aunque el webhook lo dejara pasar, no borraría nada.
    const res = await request.delete(`${apiBase}/feriados/delete`, { data: { id: -1 } });
    expect([401, 403], `HTTP ${res.status()}`).toContain(res.status());
  });

  test('Caso 8c: el backend rechaza a un usuario sin permiso', async ({ request, page }) => {
    const token = process.env.E2E_NO_HOLIDAYS_TOKEN;
    test.skip(!token, 'Requiere E2E_NO_HOLIDAYS_TOKEN: un token de una cuenta sin HOLIDAYS_*');
    await openCalendar(page, DATES.permissions);
    const res = await request.delete(`${apiBase}/feriados/delete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { id: -1 },
    });
    const body = await res.json();
    expect(Array.isArray(body) ? body[0]?.code : body?.code).toBe(403);
  });
});
