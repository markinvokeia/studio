import { expect, test } from '@playwright/test';
import { addDays, addMonths, format, startOfToday, startOfWeek } from 'date-fns';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * V · Variantes en español (docs/voz-agenda-pruebas.md §V): la misma acción pedida de muchas
 * formas, como lo diría alguien de recepción o un doctor. Cada fila: frase → resultado. Sin IA
 * (todo lo tiene que entender el intérprete local).
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

const day = (d: Date) => format(d, 'yyyy-MM-dd');
const week = (d: Date) => day(startOfWeek(d, { weekStartsOn: 1 }));
const lastGoTo = () => { const c = sim.cal.calls('goToDate'); return c.length ? (c[c.length - 1][0] as Date) : null; };
const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;
const noAi = () => expect(sim.aiCalls.map((c) => c.text), 'no debería llamar a la IA').toEqual([]);
const today = startOfToday();

const table = <T>(name: string, rows: Array<[string, T]>, check: (expected: T, said: string) => Promise<void> | void, before?: () => Promise<void>) => {
  test.describe(name, () => {
    for (const [said, expected] of rows) {
      test(`«${said}»`, async () => {
        if (before) await before();
        await sim.say(said);
        await check(expected, said);
        noAi();
      });
    }
  });
};

// ── Navegación ────────────────────────────────────────────────────────────────

table('V-ES-NAV · hoy', [['hoy', 0], ['volvé a hoy', 0], ['andá a hoy', 0], ['el día de hoy', 0], ['mostrame hoy', 0], ['llevame a hoy', 0], ['volvamos a hoy', 0]],
  (offset) => { expect(day(lastGoTo()!)).toBe(day(addDays(today, offset))); });
table('V-ES-NAV · mañana y ayer', [['mañana', 1], ['andá a mañana', 1], ['mostrame mañana', 1], ['pasá a mañana', 1], ['ayer', -1], ['andá a ayer', -1], ['mostrame ayer', -1]],
  (offset) => { expect(day(lastGoTo()!)).toBe(day(addDays(today, offset))); });
table('V-ES-NAV · siguiente (vista semana)', [['siguiente', 7], ['adelante', 7], ['avanzá', 7], ['para adelante', 7], ['el próximo', 7]],
  (offset) => { expect(week(lastGoTo()!)).toBe(week(addDays(today, offset))); });
table('V-ES-NAV · anterior (vista semana)', [['anterior', -7], ['atrás', -7], ['para atrás', -7], ['retrocedé', -7], ['volvé para atrás', -7]],
  (offset) => { expect(week(lastGoTo()!)).toBe(week(addDays(today, offset))); });
table('V-ES-NAV · semanas', [['la semana que viene', 7], ['la próxima semana', 7], ['semana siguiente', 7], ['mostrame la semana que viene', 7], ['la semana pasada', -7], ['semana anterior', -7]],
  (offset) => { expect(week(lastGoTo()!)).toBe(week(addDays(today, offset))); });
table('V-ES-NAV · meses', [['el mes que viene', 1], ['el próximo mes', 1], ['el mes pasado', -1], ['mes anterior', -1]],
  (offset) => { expect(format(lastGoTo()!, 'yyyy-MM')).toBe(format(addMonths(today, offset), 'yyyy-MM')); });
table('V-ES-NAV · día de la semana', [['andá al jueves', 4], ['el lunes', 1], ['mostrame el viernes', 5], ['el martes', 2], ['el sábado', 6], ['el miércoles', 3]],
  (weekday) => { expect(lastGoTo()!.getDay()).toBe(weekday); });
table('V-ES-NAV · fechas', [['el 15', '-15'], ['andá al 3 de diciembre', '-12-03'], ['el 20 de enero', '-01-20'], ['mostrame el 1 de marzo', '-03-01']],
  (suffix) => { expect(day(lastGoTo()!)).toMatch(new RegExp(`${suffix}$`)); });

// ── Vistas ────────────────────────────────────────────────────────────────────

table('V-ES-VIEW', [
  ['vista día', 'day'], ['vista diaria', 'day'], ['ver por día', 'day'], ['poné vista de día', 'day'], ['cambiá a vista día', 'day'], ['modo día', 'day'],
  ['vista semana', 'week'], ['vista semanal', 'week'], ['ver la semana', 'week'], ['cambiá a semana', 'week'],
  ['vista mes', 'month'], ['vista mensual', 'month'], ['ver el mes', 'month'],
  ['vista lista', 'schedule'], ['vista agenda', 'schedule'], ['ver como lista', 'schedule'],
  ['vista de 2 días', '2-day'], ['vista de 4 días', '4-day'], ['ver 5 días', '5-day'], ['vista de 6 días', '6-day'], ['vista de tres días', '3-day'],
], (view) => { expect(sim.cal.state.view).toBe(view); });

// ── Zoom ──────────────────────────────────────────────────────────────────────

table('V-ES-ZOOM', [
  ['más zoom', 1.1], ['zoom', 1.1], ['hacé zoom', 1.1], ['acercá', 1.1], ['agrandá', 1.1], ['más grande', 1.1], ['aumentá el zoom', 1.1], ['subí el zoom', 1.1], ['ampliá', 1.1],
  ['menos zoom', 0.9], ['alejá', 0.9], ['achicá', 0.9], ['más chico', 0.9], ['bajá el zoom', 0.9], ['reducí el zoom', 0.9], ['disminuí el zoom', 0.9],
  ['zoom al máximo', 2.5], ['lo más grande posible', 2.5], ['zoom máximo', 2.5], ['agrandá al máximo', 2.5],
  ['zoom mínimo', 0.3], ['lo más chico posible', 0.3], ['alejá al mínimo', 0.3], ['achicá al mínimo', 0.3],
  ['zoom al 80', 0.8], ['zoom 120 por ciento', 1.2], ['zoom al 200', 2], ['zoom normal', 1], ['reiniciá el zoom', 1], ['zoom por defecto', 1],
  ['agrandá mucho', 1.3], ['achicá bastante', 0.7],
], (zoom) => { expect(sim.cal.state.zoom).toBe(zoom); });

// ── Panel de agendas ──────────────────────────────────────────────────────────

table('V-ES-PANEL', [
  ['abrí el panel de agendas', { open: true, pinned: false }], ['mostrá el panel', { open: true, pinned: false }], ['abrí el panel lateral', { open: true, pinned: false }],
  ['fijá el panel', { open: true, pinned: true }], ['dejá fijo el panel', { open: true, pinned: true }], ['que el panel no se cierre', { open: true, pinned: true }], ['anclá el panel', { open: true, pinned: true }], ['que quede fijo el panel', { open: true, pinned: true }],
], (expected) => { expect(sim.cal.state.agendasPanel).toEqual(expected); });
table('V-ES-PANEL · cerrar y soltar', [
  ['cerrá el panel', { open: false, pinned: true }], ['escondé el panel', { open: false, pinned: true }], ['ocultá el panel de agendas', { open: false, pinned: true }],
  ['soltá el panel', { open: true, pinned: false }], ['desfijá el panel', { open: true, pinned: false }], ['que el panel se esconda solo', { open: true, pinned: false }], ['no dejes fijo el panel', { open: true, pinned: false }],
], (expected) => { expect(sim.cal.state.agendasPanel).toEqual(expected); }, async () => { await sim.say('dejá fijo el panel'); });

// ── Agendas y filtros ─────────────────────────────────────────────────────────

table('V-ES-AGENDA', [
  ['solo la agenda ortodoncia', 'c3'], ['mostrame la agenda ortodoncia', 'c3'], ['cambiá a la agenda sillón 2', 'c2'], ['pasá al sillón 2', 'c2'], ['ver el sillón 2', 'c2'], ['solo el sillón 1', 'c1'],
], (id) => { const calls = sim.cal.calls('setActiveCalendar'); expect(calls[calls.length - 1]?.[0]).toBe(id); });

// ── Estados ───────────────────────────────────────────────────────────────────

const statusTable = (name: string, rows: Array<[string, [string, string]]>) => table(name, rows, async ([id, next]) => {
  expect(sim.card().awaiting).toBe('confirm');
  await sim.say('sí');
  expect(status(id)).toBe(next);
});
statusTable('V-ES-STATUS · llegó', [
  ['Juan Pérez llegó', ['a2', 'arrived']], ['llegó Juan Pérez', ['a2', 'arrived']], ['Juan Pérez ya llegó', ['a2', 'arrived']], ['Juan Pérez está en la sala', ['a2', 'arrived']],
  ['marcá a Juan Pérez como llegó', ['a2', 'arrived']], ['Juan Pérez ya está acá', ['a2', 'arrived']], ['la de las 10 llegó', ['a2', 'arrived']],
]);
statusTable('V-ES-STATUS · confirmó', [
  ['Carlos López confirmó', ['a4', 'confirmed']], ['confirmá la cita de Carlos López', ['a4', 'confirmed']], ['Carlos López confirmó la cita', ['a4', 'confirmed']], ['marcá como confirmada la de Carlos López', ['a4', 'confirmed']],
]);
statusTable('V-ES-STATUS · no vino', [
  ['Carlos López no vino', ['a4', 'no_show']], ['Carlos López faltó', ['a4', 'no_show']], ['Carlos López no se presentó', ['a4', 'no_show']], ['la de las 3 no vino', ['a4', 'no_show']],
]);
statusTable('V-ES-STATUS · en consulta y terminó', [
  ['Juan Pérez pasó a consulta', ['a2', 'in_progress']], ['Juan Pérez está en consulta', ['a2', 'in_progress']], ['Juan Pérez entró', ['a2', 'in_progress']],
  ['terminó Juan Pérez', ['a2', 'completed']], ['Juan Pérez ya se atendió', ['a2', 'completed']], ['completá la cita de Juan Pérez', ['a2', 'completed']], ['Juan Pérez terminó', ['a2', 'completed']],
  ['Juan Pérez llegó tarde', ['a2', 'arrived_late']],
]);

// ── Información del paciente ──────────────────────────────────────────────────

const infoTable = (name: string, rows: Array<[string, RegExp]>) => table(name, rows, (pattern) => {
  expect(sim.card().choices).toEqual([]);
  expect(sim.card().rows.join(' | ')).toMatch(pattern);
});
infoTable('V-ES-INFO · visitas', [
  ['cuántas veces vino Juan Pérez', /Vino: 5/], ['cuántas visitas tiene Juan Pérez', /Vino: 5/], ['cuántas consultas tuvo Juan Pérez', /Vino: 5/], ['Juan Pérez cuántas veces vino', /Vino: 5/], ['cuántas veces lo atendimos a Juan Pérez', /Vino: 5/],
]);
infoTable('V-ES-INFO · faltas', [
  ['cuántas veces faltó Juan Pérez', /Faltó: 2/], ['cuántas faltas tiene Juan Pérez', /Faltó: 2/], ['cuántas veces no vino Juan Pérez', /Faltó: 2/], ['cuántas inasistencias tiene Juan Pérez', /Faltó: 2/],
  ['cuándo fue la última vez que faltó Juan Pérez', /10 de septiembre/], ['última falta de Juan Pérez', /10 de septiembre/],
]);
infoTable('V-ES-INFO · cancelaciones', [
  ['cuántas citas canceló Juan Pérez', /Canceló: 1/], ['cuántas cancelaciones tiene Juan Pérez', /Canceló: 1/], ['cuántas veces canceló Juan Pérez', /Canceló: 1/],
]);
infoTable('V-ES-INFO · deuda', [
  ['cuánto debe Juan Pérez', /Deuda/], ['Juan Pérez tiene deuda', /Deuda/], ['Juan Pérez debe algo', /Deuda/], ['cuál es el saldo de Juan Pérez', /Deuda/], ['Juan Pérez está al día', /Deuda/], ['tiene algo pendiente de pagar Juan Pérez', /Deuda/],
]);
infoTable('V-ES-INFO · pagos', [
  ['cuál fue el último pago de Juan Pérez', /Último pago/], ['cuándo pagó Juan Pérez por última vez', /Último pago/], ['último pago de Juan Pérez', /Último pago/], ['cuánto ha pagado Juan Pérez', /Pagado/],
]);
infoTable('V-ES-INFO · presupuestos, facturas y tratamientos', [
  ['qué presupuestos tiene Juan Pérez', /Presupuestos: 2/], ['cómo están los presupuestos de Juan Pérez', /Presupuestos: 2/], ['en qué estado están los presupuestos de Juan Pérez', /Presupuestos: 2/],
  ['qué facturas tiene Juan Pérez', /Facturas: 2/], ['cuántas facturas tiene Juan Pérez', /Facturas: 2/],
  ['qué tratamientos tiene en curso Juan Pérez', /Ortodoncia/], ['cómo va el tratamiento de Juan Pérez', /Ortodoncia/], ['tratamientos activos de Juan Pérez', /Ortodoncia/],
]);
infoTable('V-ES-INFO · resumen', [
  ['resumen de Juan Pérez', /Vino.*Faltó.*Deuda/], ['dame un resumen de Juan Pérez', /Vino.*Faltó.*Deuda/], ['estadísticas de Juan Pérez', /Vino.*Faltó.*Deuda/],
  ['qué sabemos de Juan Pérez', /Vino.*Faltó.*Deuda/], ['resumime a Juan Pérez', /Vino.*Faltó.*Deuda/],
]);

// ── Acciones del paciente ─────────────────────────────────────────────────────

table('V-ES-ACTION', [
  ['creá un presupuesto para Juan Pérez', 'quote'], ['hacé un presupuesto a Juan Pérez', 'quote'], ['nuevo presupuesto para Juan Pérez', 'quote'], ['armá un presupuesto para Juan Pérez', 'quote'],
  ['creá una factura para Juan Pérez', 'invoice'], ['facturale a Juan Pérez', 'invoice'], ['nueva factura para Juan Pérez', 'invoice'],
  ['creá un tratamiento para Juan Pérez', 'treatment'], ['nuevo tratamiento para Juan Pérez', 'treatment'], ['cargá un tratamiento para Juan Pérez', 'treatment'],
  ['hacé un cobro rápido a Juan Pérez', 'bill'], ['cobro rápido para Juan Pérez', 'bill'], ['cobrale a Juan Pérez', 'bill'],
  ['registrá la sesión clínica de Juan Pérez', 'session'], ['nueva sesión para Juan Pérez', 'session'], ['abrí la sesión clínica de Juan Pérez', 'session'],
], (action) => { expect(sim.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p2', action]); });

// ── Configuración ─────────────────────────────────────────────────────────────

table('V-ES-SETTINGS', [
  ['slots de 15 minutos', { slot_duration: 15 }], ['franjas de 10 minutos', { slot_duration: 10 }], ['intervalos de 20 minutos', { slot_duration: 20 }], ['slots de media hora', { slot_duration: 30 }],
  ['que arranque en vista día', { default_view: 'day' }], ['vista por defecto semana', { default_view: 'week' }], ['vista predeterminada mes', { default_view: 'month' }],
  ['ocultá los domingos', { hidden_weekdays: [0] }], ['no muestres los sábados', { hidden_weekdays: [6] }], ['escondé el fin de semana', { hidden_weekdays: [6, 0] }],
  ['mostrá solo el horario de la clínica', { visible_hours_mode: 'clinic' }], ['franja visible completa', { visible_hours_mode: 'full' }], ['horario visible de 9 a 18', { visible_hours_mode: 'custom', visible_hours_start: '09:00', visible_hours_end: '18:00' }],
  ['altura de la hora 140', { hour_height: 140 }], ['horas más bajas', { hour_height: 60 }],
  ['modo personalizado', { mode: 'custom' }], ['vista invoke', { mode: 'invoke' }],
  ['activá colores por estado', { color_by_status: true }], ['desactivá colores por estado', { color_by_status: false }],
], (patch) => { expect(sim.cal.state.settings).toMatchObject(patch); });
