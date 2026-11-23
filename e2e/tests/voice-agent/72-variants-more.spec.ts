import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * V · Más variantes (docs/voz-agenda-pruebas.md §V): menú de la cita (borrar, color, doctor,
 * consultorio, duración, mover, abrir), recordatorios, bloqueos, exportar y cada corrección del
 * editor, en español y en inglés. Cada fila: frase → resultado. Sin IA.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());

const noAi = () => expect(sim.aiCalls.map((c) => c.text), 'sin IA').toEqual([]);

function table<T>(locale: 'es' | 'en', name: string, rows: Array<[string, T]>, check: (expected: T) => Promise<void> | void, before?: () => Promise<void>) {
  test.describe(name, () => {
    test.beforeEach(async () => { sim = await createVoiceSim({ locale }); });
    for (const [said, expected] of rows) {
      test(`«${said}»`, async () => {
        if (before) await before();
        await sim.say(said);
        await check(expected);
        noAi();
      });
    }
  });
}

const yes = (locale: 'es' | 'en') => async () => { if (sim.card().awaiting === 'confirm') await sim.say(locale === 'es' ? 'sí' : 'yes'); };

// ── Menú de la cita ───────────────────────────────────────────────────────────

table('es', 'V-ES-MENU · borrar', [
  ['borrá la cita de Carlos López', 'a4'], ['eliminá la cita de Carlos López', 'a4'], ['borrá el turno de Carlos López', 'a4'], ['eliminá la de las 3', 'a4'],
], async (id) => { await yes('es')(); expect(sim.cal.calls('deleteAppointment')).toEqual([[id]]); });
table('en', 'V-EN-MENU · delete', [
  ["delete Carlos López's appointment", 'a4'], ['delete the appointment at 3', 'a4'], ["remove Carlos López's appointment", 'a4'],
], async (id) => { await yes('en')(); expect(sim.cal.calls('deleteAppointment')).toEqual([[id]]); });

table('es', 'V-ES-MENU · color', [
  ['poné la cita de Juan Pérez en rojo', '11'], ['pintá de verde la cita de Juan Pérez', '10'], ['la cita de Juan Pérez en azul', '9'], ['cambiá el color de la cita de Juan Pérez a amarillo', '5'],
], async (color) => { await yes('es')(); expect(sim.cal.calls('changeColor')[0]).toEqual(['a2', color]); });
table('en', 'V-EN-MENU · color', [
  ["make Juan Pérez's appointment red", '11'], ["paint Juan Pérez's appointment green", '10'], ["change the color of Juan Pérez's appointment to yellow", '5'],
], async (color) => { await yes('en')(); expect(sim.cal.calls('changeColor')[0]).toEqual(['a2', color]); });

table('es', 'V-ES-MENU · doctor', [
  ['pasá la cita de Juan Pérez al doctor Gómez', 'd3'], ['asigná la cita de Juan Pérez al doctor Gómez', 'd3'], ['cambiá el doctor de la cita de Juan Pérez al doctor Gómez', 'd3'], ['que a Juan Pérez lo atienda el doctor Gómez', 'd3'],
], async (doctor) => { await yes('es')(); expect(sim.cal.calls('reassign')[0]).toEqual(['a2', doctor, null]); });
table('en', 'V-EN-MENU · doctor', [
  ["assign Juan Pérez's appointment to doctor Gómez", 'd3'], ["move Juan Pérez's appointment to doctor Gómez", 'd3'],
], async (doctor) => { await yes('en')(); expect(sim.cal.calls('reassign')[0]).toEqual(['a2', doctor, null]); });

table('es', 'V-ES-MENU · duración', [
  ['que la cita de Juan Pérez dure 45 minutos', '10:45'], ['alargá la cita de Juan Pérez a una hora', '11:00'], ['acortá la cita de Juan Pérez a 15 minutos', '10:15'], ['la cita de Juan Pérez que dure una hora y media', '11:30'],
], async (end) => { await yes('es')(); expect(sim.cal.calls('retime')[0]?.[2]).toBe(end); });
table('en', 'V-EN-MENU · duration', [
  ["make Juan Pérez's appointment 45 minutes", '10:45'], ["extend Juan Pérez's appointment to one hour", '11:00'],
], async (end) => { await yes('en')(); expect(sim.cal.calls('retime')[0]?.[2]).toBe(end); });

table('es', 'V-ES-MENU · mover', [
  ['pasá la cita de Juan Pérez al viernes a las 11', 'a2'], ['reprogramá la cita de Juan Pérez para pasado mañana', 'a2'], ['mové la cita de Juan Pérez a las 4', 'a2'], ['corré la cita de Juan Pérez para mañana', 'a2'],
], (id) => { expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['reschedule', id]); });
table('en', 'V-EN-MENU · move', [
  ["move Juan Pérez's appointment to Friday at 11", 'a2'], ["reschedule Juan Pérez's appointment for the day after tomorrow", 'a2'], ["move Juan Pérez's appointment to 4", 'a2'],
], (id) => { expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['reschedule', id]); });

table('es', 'V-ES-MENU · abrir', [
  ['abrí la historia clínica de Juan Pérez', 'history'], ['mostrame la historia de Juan Pérez', 'history'], ['abrí los archivos de Juan Pérez', 'documents'], ['mostrame las radiografías de Juan Pérez', 'documents'],
  ['abrí el estado de cuenta de Juan Pérez', 'accounts'], ['mostrame la cuenta corriente de Juan Pérez', 'accounts'], ['abrí el historial de citas de Juan Pérez', 'appointments'], ['mostrame los datos de Juan Pérez', 'patient'],
], (target) => { expect(sim.cal.calls('openAppointmentTool')).toEqual([['a2', target]]); });
table('en', 'V-EN-MENU · open', [
  ["open Juan Pérez's medical history", 'history'], ["show Juan Pérez's files", 'documents'], ["open Juan Pérez's account statement", 'accounts'], ["show Juan Pérez's appointment history", 'appointments'], ["open Juan Pérez's patient details", 'patient'],
], (target) => { expect(sim.cal.calls('openAppointmentTool')).toEqual([['a2', target]]); });

// ── Recordatorios y bloqueos ──────────────────────────────────────────────────

table('es', 'V-ES-REMINDER', [
  ['recordame mañana a las 9 llamar al laboratorio', 'reminder'], ['nuevo recordatorio para el viernes a las 10 pedir materiales', 'reminder'], ['anotá una nota para mañana que falta material', 'note'],
], async (type) => {
  // Si falta la hora la pregunta: se contesta y sigue.
  if (!sim.cal.calls('openReminderForm').length && sim.card().awaiting) await sim.say('a las 9');
  expect(sim.cal.calls('openReminderForm')[0]?.[0]).toBe(type);
});
table('en', 'V-EN-REMINDER', [
  ['remind me tomorrow at 9 to call the lab', 'reminder'], ['new reminder for Friday at 10 order supplies', 'reminder'], ['new note for tomorrow missing material', 'note'],
], async (type) => {
  // Si falta la hora la pregunta: se contesta y sigue.
  if (!sim.cal.calls('openReminderForm').length && sim.card().awaiting) await sim.say('a las 9');
  expect(sim.cal.calls('openReminderForm')[0]?.[0]).toBe(type);
});

table('es', 'V-ES-BLOCK', [
  ['bloqueá el lunes de 14 a 16', 'block'], ['cerrá el horario del viernes de 9 a 12', 'block'], ['habilitá el sábado de 9 a 13', 'enable'],
], (kind) => { expect(sim.cal.calls('openSlotDialog')[0]?.[0]).toBe(kind); });
table('en', 'V-EN-BLOCK', [
  ['block Monday from 2 to 4', 'block'], ['enable Saturday from 9 to 1', 'enable'],
], (kind) => { expect(sim.cal.calls('openSlotDialog')[0]?.[0]).toBe(kind); });

// ── Exportar ──────────────────────────────────────────────────────────────────

table('es', 'V-ES-EXPORT', [
  ['exportá la agenda de hoy', 'day'], ['bajame la agenda de mañana a excel', 'day'], ['descargá la agenda de esta semana', 'week'], ['exportá la agenda de la semana que viene', 'week'],
  ['imprimí la agenda del mes', 'month'], ['exportá la agenda de diciembre', 'month'], ['exportá la agenda del 1 al 10 de diciembre', 'custom'],
], (preset) => { expect(sim.cal.state.exportDialog?.preset).toBe(preset); });
table('en', 'V-EN-EXPORT', [
  ["export today's schedule", 'day'], ['download the schedule for tomorrow', 'day'], ['export the schedule for this week', 'week'], ['export the schedule for next week', 'week'],
  ['print the schedule for this month', 'month'], ['export the schedule for December', 'month'],
], (preset) => { expect(sim.cal.state.exportDialog?.preset).toBe(preset); });

// ── Editor: cada corrección ───────────────────────────────────────────────────

const editJuan = (locale: 'es' | 'en') => async () => { await sim.say(locale === 'es' ? 'editá la cita de Juan Pérez' : "edit Juan Pérez's appointment"); };

table('es', 'V-ES-FORM', [
  ['con el doctor Gómez', (f: any) => f.doctor?.id === 'd3'], ['ponele la doctora Ruiz', (f: any) => f.doctor?.id === 'd2'], ['sin doctor', (f: any) => f.doctor === null],
  ['a las 11', (f: any) => f.start.getHours() === 11], ['mejor a las 4 de la tarde', (f: any) => f.start.getHours() === 16], ['cambiá la hora a las 9 y media', (f: any) => f.start.getHours() === 9 && f.start.getMinutes() === 30],
  ['el viernes', (f: any) => f.start.getDay() === 5], ['pasala para el lunes', (f: any) => f.start.getDay() === 1],
  ['que termine a las 11', (f: any) => f.endTime === '11:00'], ['hasta las 12', (f: any) => f.endTime === '12:00'],
  ['en el sillón 1', (f: any) => f.calendar?.id === 'c1'], ['en el consultorio ortodoncia', (f: any) => f.calendar?.id === 'c3'],
  ['agregá limpieza', (f: any) => f.services.some((s: any) => s.id === 'sv1')], ['agregale blanqueamiento y control', (f: any) => f.services.length === 2],
  ['nota: alérgico a la penicilina', (f: any) => f.notes === 'Alérgico a la penicilina'], ['agregá en notas que trae estudios', (f: any) => f.notes === 'Trae estudios'],
  ['el paciente es Sofía Castro', (f: any) => f.patient?.name === 'Sofía Castro'], ['cambiá el paciente a Sofía Castro', (f: any) => f.patient?.name === 'Sofía Castro'],
], (ok) => { expect(ok(sim.cal.form)).toBe(true); }, editJuan('es'));
table('en', 'V-EN-FORM', [
  ['with doctor Gómez', (f: any) => f.doctor?.id === 'd3'], ['without doctor', (f: any) => f.doctor === null],
  ['at 11', (f: any) => f.start.getHours() === 11], ['at 4 pm', (f: any) => f.start.getHours() === 16], ['on Friday', (f: any) => f.start.getDay() === 5],
  ['ends at 11', (f: any) => f.endTime === '11:00'], ['until 12', (f: any) => f.endTime === '12:00'],
  ['in chair 1', (f: any) => f.calendar?.id === 'c1'], ['add limpieza', (f: any) => f.services.some((s: any) => s.id === 'sv1')],
  ['note: allergic to penicillin', (f: any) => f.notes === 'Allergic to penicillin'], ['add a note that he brings X-rays', (f: any) => /brings x-rays/i.test(f.notes)],
  ['patient is Sofía Castro', (f: any) => f.patient?.name === 'Sofía Castro'], ['change the patient to Sofía Castro', (f: any) => f.patient?.name === 'Sofía Castro'],
], (ok) => { expect(ok(sim.cal.form)).toBe(true); }, editJuan('en'));

table('es', 'V-ES-FORM · guardar / cancelar', [
  ['guardar', 'saved'], ['guardá', 'saved'], ['actualizá', 'saved'], ['listo', 'saved'], ['sí', 'saved'], ['dale guardalo', 'saved'],
  ['cancelar', 'closed'], ['cerrá sin guardar', 'closed'], ['descartá', 'closed'], ['no guardes', 'closed'],
], (outcome) => {
  if (outcome === 'saved') expect(sim.cal.savedForms).toHaveLength(1);
  else { expect(sim.cal.savedForms).toHaveLength(0); expect(sim.cal.calls('closeAppointmentForm')).toHaveLength(1); }
}, editJuan('es'));
table('en', 'V-EN-FORM · save / cancel', [
  ['save', 'saved'], ['update', 'saved'], ['done', 'saved'], ['yes', 'saved'], ['save it', 'saved'],
  ['cancel', 'closed'], ['discard', 'closed'], ['close without saving', 'closed'],
], (outcome) => {
  if (outcome === 'saved') expect(sim.cal.savedForms).toHaveLength(1);
  else { expect(sim.cal.savedForms).toHaveLength(0); expect(sim.cal.calls('closeAppointmentForm')).toHaveLength(1); }
}, editJuan('en'));
