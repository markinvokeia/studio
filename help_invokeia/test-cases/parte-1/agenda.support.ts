/**
 * Selectores y ayudas compartidas por las demos de la agenda (PARTE 1).
 *
 * Los strings salen literales de `src/messages/es.json`, igual que en
 * `e2e/tests/appointments/appointments.spec.ts`, que es de donde viene la mayor
 * parte de este conocimiento ya probado contra la app.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** AppointmentsPage.* y los diálogos del calendario. */
export const T = {
  pageTitle: 'Citas',
  today: 'Hoy',
  agendas: 'Agendas',

  // Barra del calendario. A 1280 px los botones son SÓLO ícono: no tenían
  // nombre accesible y se les agregó `aria-label` en
  // src/app/[locale]/appointments/page.tsx (ver DRIFT.md).
  create: 'Crear',
  searchAppointment: 'Buscar cita',
  searchGaps: 'Buscar huecos',
  bulkMode: 'Operaciones en Lotes',
  toggleCalendars: 'Mostrar/Ocultar Calendarios',
  toggleDoctors: 'Mostrar/Ocultar Doctores',

  // Paneles que abren esos botones
  gapsPanelTitle: 'Huecos disponibles',
  gapsMaxBadge: 'Mayor',
  gapsEmpty: 'No hay huecos en el horario de atención.',
  searchPanelTitle: 'Buscar citas',
  searchPlaceholder: 'Paciente o título de la cita…',

  /**
   * El diálogo real de creación. OJO: los nombres NO coinciden con los que
   * describe el manual en q023 (ver DRIFT.md). Acá van los de la app.
   */
  createDialog: {
    title: 'Nueva cita',
    date: 'Fecha',
    from: 'Desde',
    to: 'Hasta',
    patient: '¿Quién se atiende?',
    service: '¿Qué se realiza?',
    note: 'Nota…',  // puntos suspensivos reales, no tres puntos
    doctor: 'Doctor',
    save: 'Guardar',
    cancel: 'Cancelar',
  },

  status: {
    pending: 'Pendiente',
    scheduled: 'Programada',
    confirmed: 'Confirmada',
    arrived: 'Llegó',
    inProgress: 'En curso',
    completed: 'Completada',
    noShow: 'No asistió',
    cancelled: 'Cancelada',
  },
} as const;

/**
 * Los `data-testid` que la app ya expone para el calendario. Es la única zona
 * de la interfaz con cobertura decente de testids, así que conviene usarlos.
 */
export const CALENDAR_EVENT_SELECTORS = [
  '[data-testid="calendar-event"]',
  '[data-testid="calendar-day-event"]',
  '[data-testid="calendar-month-agenda-event"]',
  '[data-testid="calendar-schedule-event"]',
] as const;

/** Cualquier cita visible en la rejilla, sea cual sea la vista. */
export function anyEvent(page: Page): Locator {
  return page.locator(CALENDAR_EVENT_SELECTORS.join(', '));
}

/**
 * Espera a que el calendario esté realmente interactivo.
 *
 * `networkidle` NO sirve acá: la pantalla dispara tres tandas de peticiones
 * encadenadas (datos iniciales → servicios por usuario → citas), así que la red
 * se queda quieta un instante en el medio y el calendario todavía no montó.
 * El botón «Hoy» es la señal fiable de que React ya hidrató.
 */
export async function waitForCalendar(page: Page, timeout = 30_000): Promise<void> {
  await page.getByRole('button', { name: T.today }).waitFor({ state: 'visible', timeout });
  await selectAgenda(page);
}

/** Agenda con la que se graban las demos del calendario. */
export const DEMO_AGENDA = 'Calendario de Prueba';

/**
 * Elige una agenda del panel izquierdo antes de empezar.
 *
 * Dos motivos, los dos visuales: deja una agenda concreta seleccionada (en vez
 * de depender de lo que estuviera elegido de antes) y **cierra el panel de
 * agendas**, que si queda abierto se come un tercio del ancho de la pantalla y
 * tapa el calendario que la demo quiere mostrar.
 */
export async function selectAgenda(page: Page, name = DEMO_AGENDA): Promise<void> {
  const agenda = page.getByRole('button', { name, exact: true }).first();
  if (!(await agenda.isVisible({ timeout: 4_000 }).catch(() => false))) return;

  await agenda.click().catch(() => undefined);
  await page.waitForTimeout(1_200);

  // Si el panel quedó fijado, no se cierra solo: se lo cierra por su botón.
  const closePanel = page.getByRole('button', { name: /^cerrar$/i }).first();
  if (await closePanel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closePanel.click().catch(() => undefined);
  }
  await page.waitForTimeout(800);
}

/** Igual, pero además exige que haya al menos una cita para poder operar sobre ella. */
export async function waitForSomeEvent(page: Page, timeout = 20_000): Promise<Locator> {
  await waitForCalendar(page);
  const event = anyEvent(page).first();
  await expect(
    event,
    'La demo necesita al menos una cita visible en el calendario del día',
  ).toBeVisible({ timeout });
  return event;
}

/**
 * El formulario de cita. Es la tarjeta flotante `calendar-inline-draft-overlay`,
 * no un modal: `getByRole('dialog')` a secas matchea además el panel de
 * notificaciones, que queda montado fuera de pantalla.
 */
export function appointmentForm(page: Page): Locator {
  return page.getByTestId('calendar-inline-draft-overlay');
}

// ── Cita de demostración ─────────────────────────────────────────────────────
//
// Varias preguntas (mover, redimensionar, cambiar de consultorio, cambiar de
// estado) sólo se pueden mostrar operando sobre una cita. Operar sobre una cita
// real de la base compartida de DEV sería invasivo, así que cada demo crea la
// suya, la manipula y la borra.

/** Nota que marca las citas creadas por las demos, para poder limpiarlas. */
export const DEMO_APPOINTMENT_NOTE = 'Cita de ejemplo · demo';

/**
 * Crea una cita en el calendario visible y devuelve su tarjeta.
 * El paciente se elige del combobox real, así que necesita que exista alguno.
 */
export async function createDemoAppointment(page: Page, patient = 'Testing'): Promise<Locator> {
  // El calendario sigue acomodándose después de que aparece el botón «Hoy»:
  // sin esto, el clic en «Crear» se pierde contra un elemento todavía inestable.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_500);

  await page.getByRole('button', { name: T.create }).first().click();
  await page.getByRole('menuitem').first().click();

  const form = appointmentForm(page);
  await expect(form).toBeVisible({ timeout: 15_000 });

  // El selector de paciente es un `role=combobox`; se lo identifica por su texto
  // de ayuda para no confundirlo con los de calendario, doctor y servicio.
  const picker = form.getByRole('combobox').filter({ hasText: T.createDialog.patient }).first();
  await expect(picker).toBeVisible({ timeout: 10_000 });
  // La tarjeta entra con animación: si se pulsa el combobox apenas aparece, el
  // clic se pierde y el desplegable no abre (sin error, simplemente no pasa nada).
  await page.waitForTimeout(2_500);
  await picker.click();

  // El combobox abre con la lista completa; esperarla antes de filtrar evita
  // escribir en un buscador que todavía no montó.
  const option = page.getByRole('option');
  await expect(option.first()).toBeVisible({ timeout: 15_000 });

  const search = page.getByPlaceholder(/buscar|search/i).last();
  if (await search.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await search.fill(patient);
    await page.waitForTimeout(1_500); // debounce del buscador
  }
  await expect(option.first()).toBeVisible({ timeout: 15_000 });
  await option.first().click();
  await page.waitForTimeout(800); // el combobox cierra y el form se re-renderiza

  // La nota es lo que después permite reconocer y limpiar la cita, así que se
  // verifica que quedó escrita antes de guardar.
  const note = form.getByPlaceholder(T.createDialog.note);
  await note.fill(DEMO_APPOINTMENT_NOTE);
  await expect(note).toHaveValue(DEMO_APPOINTMENT_NOTE);

  await form.getByRole('button', { name: T.createDialog.save }).click();
  await expect(form).toBeHidden({ timeout: 20_000 });

  const created = anyEvent(page).filter({ hasText: /demo/i }).first();
  await expect(created, 'La cita de demo debería aparecer en el calendario').toBeVisible({
    timeout: 20_000,
  });
  return created;
}

/** Borra la cita de demo por el menú contextual. Obligatorio: la base es compartida. */
export async function deleteDemoAppointment(page: Page): Promise<void> {
  const card = anyEvent(page).filter({ hasText: /demo/i }).first();
  if (!(await card.isVisible().catch(() => false))) return;

  await card.click({ button: 'right' });
  const del = page.getByRole('menuitem', { name: /^eliminar/i }).first();
  await del.click({ timeout: 10_000 });

  const confirm = page.getByRole('button', { name: /eliminar|confirmar|sí/i }).last();
  if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) await confirm.click();

  await expect(anyEvent(page).filter({ hasText: /demo/i })).toHaveCount(0, { timeout: 15_000 });
}

/** Arrastra una tarjeta un desplazamiento dado, con pasos intermedios visibles. */
export async function dragBy(page: Page, card: Locator, dx: number, dy: number): Promise<void> {
  const box = await card.boundingBox();
  if (!box) throw new Error('La cita no tiene boundingBox: no se puede arrastrar');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  // Pasos intermedios: el calendario usa arrastre propio y necesita el recorrido,
  // y además así el movimiento se ve en el video en vez de teletransportarse.
  await page.mouse.move(x + dx * 0.3, y + dy * 0.3, { steps: 10 });
  await page.mouse.move(x + dx * 0.7, y + dy * 0.7, { steps: 10 });
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}
