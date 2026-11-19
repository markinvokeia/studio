import { type Page, type Route } from '@playwright/test';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { test, expect } from '../../fixtures/test.fixture';

/**
 * Calendario por voz en el navegador (Ctrl+Espacio → frase → tarjeta de voz).
 *
 *   pnpm exec playwright test e2e/tests/appointments/calendar-voice.spec.ts --project=chromium
 *
 * El reconocimiento de voz se reemplaza por uno falso que "escucha" window.__voiceQueue y la voz
 * del asistente va silenciada. Las lecturas (citas, doctores, pacientes) van contra DEV; todo lo
 * que escribe (estado, alta, reprogramar, borrar, color, cierres, recordatorios) se intercepta: no se modifica ningún dato.
 */

function fakeSpeechRecognition() {
  const w = window as unknown as { __voiceQueue: string[]; webkitSpeechRecognition: unknown; SpeechRecognition?: unknown };
  w.__voiceQueue = [];
  class FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: ((e: unknown) => void) | null = null;
    onspeechstart: ((e: unknown) => void) | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private ended = false;
    start() {
      this.timer = setInterval(() => {
        const text = w.__voiceQueue.shift();
        if (text == null) return;
        this.onspeechstart?.({});
        this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: text } } } });
        if (!this.continuous) this.end();
      }, 100);
    }
    stop() { setTimeout(() => this.end(), 30); }
    abort() { this.end(); }
    private end() {
      if (this.ended) return;
      this.ended = true;
      if (this.timer) clearInterval(this.timer);
      this.onend?.({});
    }
  }
  w.SpeechRecognition = undefined;
  w.webkitSpeechRecognition = FakeRecognition;
  try { localStorage.setItem('invoke-help-voice-muted', '1'); } catch { /* sin storage */ }
}

async function say(page: Page, text: string) {
  await page.evaluate((t) => { (window as unknown as { __voiceQueue: string[] }).__voiceQueue.push(t); }, text);
}

async function pushToTalk(page: Page, text: string) {
  await page.keyboard.down('Control');
  await page.keyboard.down('Space');
  await say(page, text);
  await page.waitForTimeout(600);
  await page.keyboard.up('Space');
  await page.keyboard.up('Control');
}

interface RawAppointment {
  id: string;
  patientName: string;
  status: string;
  start: Date;
}

interface Captured {
  appointments: RawAppointment[];
  statusChanges: Record<string, unknown>[];
  /** Escrituras que la prueba no esperaba (se cortan antes de llegar a DEV). */
  blockedWrites: string[];
}

async function interceptCalendar(page: Page): Promise<Captured> {
  const captured: Captured = { appointments: [], statusChanges: [], blockedWrites: [] };
  await page.route(/\/users_appointments(\?|$)/, async (route: Route) => {
    const response = await route.fetch();
    const json = await response.json();
    const rows = (Array.isArray(json) ? json : []).map((r: any) => r?.json ?? r);
    for (const r of rows) {
      const start = typeof r?.start_time === 'string' ? r.start_time : typeof r?.start === 'string' ? r.start : r?.start?.dateTime;
      const id = String(r?.appointment_id ?? r?.id ?? '');
      if (!start || !id || captured.appointments.some((a) => a.id === id)) continue;
      captured.appointments.push({ id, patientName: String(r.patient_name ?? r.user_name ?? ''), status: String(r.status ?? ''), start: parseISO(String(start).replace(/Z$/, '')) });
    }
    await route.fulfill({ response, json });
  });
  await page.route(/\/appointments\/update_status(\?|$)/, async (route: Route) => {
    captured.statusChanges.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: [{ success: true }] });
  });
  await page.route(/\/appointments\/(upsert|reschedule|delete|bulk-reassign-doctor|update_color)(\?|$)/, async (route: Route) => {
    captured.blockedWrites.push(route.request().url());
    await route.fulfill({ status: 500, json: { error: true, message: 'bloqueado por la prueba' } });
  });
  return captured;
}

const card = (page: Page) => page.locator('[data-voice-card]');

/** Responde "el uno" a cada pregunta con opciones hasta que la tarjeta muestra `ready`. */
async function answerChoicesUntil(page: Page, ready: RegExp) {
  const firstChoice = card(page).locator('button').filter({ hasText: /^1/ });
  for (let i = 0; i < 4; i++) {
    await expect(card(page).filter({ hasText: ready }).or(firstChoice)).toBeVisible({ timeout: 25_000 });
    if (await card(page).filter({ hasText: ready }).isVisible()) return;
    await say(page, 'el uno');
    await expect(firstChoice).toBeHidden({ timeout: 10_000 }).catch(() => {});
  }
  await expect(card(page)).toContainText(ready);
}

/** Un nombre que se pueda dictar: dos palabras de letras. */
const speakable = (name: string) => /^[\p{L}]{2,}(?: [\p{L}]{2,})+$/u.test(name.trim());

async function openCalendar(page: Page, captured: Captured) {
  await page.goto('/appointments');
  await expect(page.locator('[data-help-id="appointments.btn.voice"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => captured.appointments.length, { timeout: 30_000 }).toBeGreaterThan(0).catch(() => {});
}

test.describe('Comandos de voz — calendario', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(fakeSpeechRecognition);
  });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('navegar y preguntar la agenda', async ({ page }) => {
    const captured = await interceptCalendar(page);
    await openCalendar(page, captured);

    await pushToTalk(page, 'andá a mañana');
    const tomorrow = new Date(Date.now() + 86_400_000);
    await expect(card(page)).toContainText(`Calendario en ${format(tomorrow, 'EEE', { locale: es }).slice(0, 3)}`, { timeout: 20_000 });
    await expect(card(page)).toContainText(format(tomorrow, 'd/MM'));

    await pushToTalk(page, 'qué tengo hoy');
    await expect(card(page)).toContainText(/Agenda/, { timeout: 25_000 });
    await expect(card(page)).toContainText(/(no hay citas|hay una cita|hay \d+ citas)/);
    expect(captured.blockedWrites).toEqual([]);
  });

  test('cambiar el estado: «no» no toca nada y «sí» lo aplica', async ({ page }) => {
    const captured = await interceptCalendar(page);
    await openCalendar(page, captured);
    const appt = captured.appointments.find((a) => a.status === 'scheduled' && speakable(a.patientName));
    test.skip(!appt, 'DEV no tiene una cita agendada visible esta semana');
    const when = format(appt!.start, "d 'de' MMMM", { locale: es });
    const phrase = `confirmá la cita de ${appt!.patientName} del ${when}`;

    await pushToTalk(page, phrase);
    await answerChoicesUntil(page, /«sí» para cambiarla/);
    await expect(card(page)).toContainText(appt!.patientName);
    await say(page, 'no');
    await expect(card(page)).toContainText(/no (hice|he hecho) ningún cambio/i, { timeout: 15_000 });
    expect(captured.statusChanges).toHaveLength(0);

    await pushToTalk(page, phrase);
    await answerChoicesUntil(page, /«sí» para cambiarla/);
    await say(page, 'sí');
    await expect(card(page)).toContainText(/quedó en|ha quedado en/, { timeout: 20_000 });
    expect(captured.statusChanges).toHaveLength(1);
    expect(captured.statusChanges[0]).toMatchObject({ status: 'confirmed' });
    expect(captured.blockedWrites).toEqual([]);
  });

  test('nueva cita: pregunta doctor y tratamiento, acepta correcciones y «no» lo deja abierto sin guardar', async ({ page }) => {
    const captured = await interceptCalendar(page);
    // Doctores y tratamientos reales: los que la pantalla le pasa a la IA (simulada, no entiende nada).
    let lists: { doctors: { name: string }[]; services: { name: string }[] } | null = null;
    await page.route(/\/voice\/interpret(\?|$)/, async (route) => {
      lists = (route.request().postDataJSON() as { context: typeof lists }).context;
      await route.fulfill({ json: { domain: 'calendar', confidence: 0.9, result: { intent: 'unknown', confidence: 0.9 } } });
    });
    await openCalendar(page, captured);
    await pushToTalk(page, 'xyzzy plugh quux');
    await expect.poll(() => lists !== null, { timeout: 25_000 }).toBeTruthy();
    const unique = (names: string[]) => names.filter((name, i) => speakable(name.replace(/[^\p{L} ]/gu, '').replace(/\s+/g, ' ')) && names.indexOf(name) === i);
    const doctors = unique(lists!.doctors.map((d) => d.name.replace(/^(dr|dra|doctor|doctora)\.?\s+/i, '')));
    const services = unique(lists!.services.map((s) => s.name));
    const patient = captured.appointments.find((a) => speakable(a.patientName))?.patientName;
    test.skip(!patient || doctors.length < 2 || services.length < 2, 'DEV no tiene paciente, 2 doctores y 2 tratamientos dictables');

    await pushToTalk(page, `nueva cita para ${patient} mañana a las 10`);
    // Con el paciente elegido, pregunta lo que falta: el doctor (salvo que tenga uno de cabecera) y el tratamiento.
    await answerChoicesUntil(page, /¿Con qué doctor|¿Qué tratamiento/);
    if (await card(page).filter({ hasText: /¿Con qué doctor/ }).isVisible()) {
      await say(page, doctors[0]);
      await answerChoicesUntil(page, /¿Qué tratamiento/);
    }
    await say(page, services[0]);
    await answerChoicesUntil(page, /«Sí» la guarda/);
    await expect(card(page)).toContainText(services[0]);
    await expect(page.locator('[data-help-id="appointments.btn.save"]').first()).toBeVisible({ timeout: 10_000 });

    // Correcciones mientras confirma: se aplican al formulario y vuelve a preguntar.
    await say(page, `con el doctor ${doctors[1]}`);
    await answerChoicesUntil(page, /Listo: con /);
    await expect(card(page)).toContainText(doctors[1]);
    await say(page, `agregá ${services[1]}`);
    await expect(card(page)).toContainText(/Listo: tratamientos:/, { timeout: 20_000 });
    await expect(card(page)).toContainText(services[1]);
    await expect(page.getByText(doctors[1]).first()).toBeVisible();

    await say(page, 'no');
    await expect(card(page)).toContainText(/abierto/, { timeout: 15_000 });
    await expect(page.locator('[data-help-id="appointments.btn.save"]').first()).toBeVisible();
    expect(captured.blockedWrites).toEqual([]);
  });

  test('editar una cita existente: abre su formulario, acepta cambios y «no» lo deja abierto sin guardar', async ({ page }) => {
    const captured = await interceptCalendar(page);
    let lists: { doctors: { name: string }[] } | null = null;
    await page.route(/\/voice\/interpret(\?|$)/, async (route) => {
      lists = (route.request().postDataJSON() as { context: typeof lists }).context;
      await route.fulfill({ json: { domain: 'calendar', confidence: 0.9, result: { intent: 'unknown', confidence: 0.9 } } });
    });
    await openCalendar(page, captured);
    await pushToTalk(page, 'xyzzy plugh quux');
    await expect.poll(() => lists !== null, { timeout: 25_000 }).toBeTruthy();
    const doctors = lists!.doctors.map((d) => d.name.replace(/^(dr|dra|doctor|doctora)\.?\s+/i, '')).filter((name) => speakable(name.replace(/[^\p{L} ]/gu, '')));
    const appt = captured.appointments.find((a) => ['scheduled', 'confirmed'].includes(a.status) && speakable(a.patientName));
    test.skip(!appt || !doctors.length, 'DEV no tiene una cita editable visible esta semana');
    const when = format(appt!.start, "d 'de' MMMM", { locale: es });

    await pushToTalk(page, `editá la cita de ${appt!.patientName} del ${when}`);
    await answerChoicesUntil(page, /«Sí» la guarda/);
    await expect(card(page)).toContainText(appt!.patientName);
    await expect(page.locator('[data-help-id="appointments.btn.save"]').first()).toBeVisible({ timeout: 10_000 });

    await say(page, `con el doctor ${doctors[0]}`);
    await answerChoicesUntil(page, /Listo: con /);
    await expect(card(page)).toContainText(doctors[0]);

    await say(page, 'no');
    await expect(card(page)).toContainText(/abierto/, { timeout: 15_000 });
    expect(captured.blockedWrites).toEqual([]);
    expect(captured.statusChanges).toEqual([]);
  });

  test('color de una cita: confirma y lo aplica con el mismo endpoint del menú', async ({ page }) => {
    const captured = await interceptCalendar(page);
    const colors: Record<string, unknown>[] = [];
    await page.route(/\/appointments\/update_color(\?|$)/, async (route) => {
      colors.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { success: true } });
    });
    await openCalendar(page, captured);
    const appt = captured.appointments.find((a) => ['scheduled', 'confirmed'].includes(a.status) && speakable(a.patientName));
    test.skip(!appt, 'DEV no tiene una cita visible esta semana');
    const when = format(appt!.start, "d 'de' MMMM", { locale: es });

    await pushToTalk(page, `poné la cita de ${appt!.patientName} del ${when} en rojo`);
    await answerChoicesUntil(page, /«sí» para hacerlo|ya está en rojo/);
    test.skip(await card(page).filter({ hasText: /ya está en rojo/ }).isVisible(), 'La cita ya es roja');
    await expect(card(page)).toContainText(appt!.patientName);
    await say(page, 'sí');
    await expect(card(page)).toContainText(/quedó en rojo|ha quedado en rojo/, { timeout: 20_000 });
    expect(colors).toHaveLength(1);
    expect(colors[0]).toMatchObject({ color: '11' });
    expect(captured.blockedWrites).toEqual([]);
  });

  test('borrar una cita: pide confirmación de peligro y «no» no toca nada', async ({ page }) => {
    const captured = await interceptCalendar(page);
    await openCalendar(page, captured);
    const appt = captured.appointments.find((a) => ['scheduled', 'confirmed'].includes(a.status) && speakable(a.patientName));
    test.skip(!appt, 'DEV no tiene una cita visible esta semana');
    const when = format(appt!.start, "d 'de' MMMM", { locale: es });

    await pushToTalk(page, `borrá la cita de ${appt!.patientName} del ${when}`);
    await answerChoicesUntil(page, /revisa que sea la cita correcta|revisá que sea la cita correcta/);
    await say(page, 'no');
    await expect(card(page)).toContainText(/no (hice|he hecho) ningún cambio/i, { timeout: 15_000 });
    expect(captured.statusChanges).toEqual([]);
    expect(captured.blockedWrites).toEqual([]);
  });

  test('bloquear horario: abre el diálogo de siempre, corrige las horas y «sí» guarda el cierre', async ({ page }) => {
    const captured = await interceptCalendar(page);
    const exceptions: Record<string, unknown>[] = [];
    await page.route(/\/feriados\/(upsert|delete)(\?|$)/, async (route) => {
      exceptions.push({ url: route.request().url(), ...(route.request().postDataJSON() as Record<string, unknown>) });
      await route.fulfill({ json: { success: true } });
    });
    await openCalendar(page, captured);

    await pushToTalk(page, 'bloqueá el próximo miércoles de 14 a 15 por prueba de voz');
    const ready = /«sí» para guardarlo|horarios de la clínica|ya está cerrada|no se pueden cambiar|No se puede guardar/;
    await expect(card(page)).toContainText(ready, { timeout: 30_000 });
    test.skip(!(await card(page).filter({ hasText: /«sí» para guardarlo/ }).isVisible()), 'DEV no deja bloquear esa franja (sin horarios o ya cerrada)');
    const dialog = page.getByRole('dialog').filter({ has: page.locator('input[name="start_time"]') });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="start_time"]')).toHaveValue('14:00');
    await expect(dialog.locator('textarea[name="notes"]')).toHaveValue('prueba de voz');

    await say(page, 'de 15 a 16');
    await expect(dialog.locator('input[name="start_time"]')).toHaveValue('15:00', { timeout: 10_000 });
    await expect(dialog.locator('input[name="end_time"]')).toHaveValue('16:00');
    await expect(card(page)).toContainText('15:00–16:00', { timeout: 10_000 });

    await say(page, 'sí');
    await expect(card(page)).toContainText(/bloqueado|bloqueé/, { timeout: 30_000 });
    await expect(dialog).toBeHidden();
    expect(exceptions.length).toBeGreaterThan(0);
    expect(exceptions.some((e) => e.is_open === false && e.start_time === '15:00')).toBeTruthy();
    expect(captured.blockedWrites).toEqual([]);
  });

  test('recordatorio: abre el formulario con lo dictado, acepta otra hora y «sí» lo guarda', async ({ page }) => {
    const captured = await interceptCalendar(page);
    const saved: Record<string, unknown>[] = [];
    await page.route(/\/reminders\/upsert(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saved.push(body);
      await route.fulfill({ json: [{ success: true, reminder: { ...body, id: 'e2e-reminder', status: 'pending', created_at: body.start_datetime } }] });
    });
    await openCalendar(page, captured);

    await pushToTalk(page, 'recordame mañana a las 9 llamar al laboratorio Dentalab');
    await expect(card(page)).toContainText(/«sí» para guardarlo/, { timeout: 20_000 });
    await expect(page.locator('#reminder-title')).toHaveValue('Llamar al laboratorio Dentalab');

    await say(page, 'a las 10');
    await expect(card(page)).toContainText('10:00', { timeout: 10_000 });
    await say(page, 'sí');
    await expect(card(page)).toContainText(/guardé el recordatorio|he guardado el recordatorio/, { timeout: 20_000 });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ type: 'reminder', title: 'Llamar al laboratorio Dentalab' });
    expect(String(saved[0].start_datetime)).toContain('T10:00');
    expect(captured.blockedWrites).toEqual([]);
  });

  test('una frase que el intérprete local no entiende la resuelve la IA, sin datos de pacientes', async ({ page }) => {
    const captured = await interceptCalendar(page);
    const aiRequests: Record<string, unknown>[] = [];
    await page.route(/\/voice\/interpret(\?|$)/, async (route) => {
      aiRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { domain: 'calendar', confidence: 0.9, result: { intent: 'calendar.view', view: 'month', confidence: 0.9 } } });
    });
    await openCalendar(page, captured);

    await pushToTalk(page, 'xyzzy plugh quux');
    await expect(card(page)).toContainText(/vista de mes/, { timeout: 25_000 });

    expect(aiRequests).toHaveLength(1);
    expect(aiRequests[0].domain).toBe('calendar');
    const context = aiRequests[0].context as Record<string, unknown>;
    expect(Object.keys(context).sort()).toEqual(['calendars', 'custom_mode', 'doctors', 'sedes', 'services', 'view', 'visible_from', 'visible_to']);
    expect(JSON.stringify(context)).not.toMatch(/patient/i);
  });
});
