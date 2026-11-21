import { expect, test } from '@playwright/test';
import { addDays, format, startOfToday } from 'date-fns';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * R · Rutinas reales (docs/voz-agenda-pruebas.md §R): lo que hace en un día alguien de recepción o
 * un doctor, como una conversación seguida de varias frases que combinan lo atómico: mirar,
 * encontrar, preguntar, cambiar, abrir, corregir, cambiar de tema y volver. Español e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());

const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;
const rows = () => sim.card().rows.join(' | ');
const tomorrow = format(addDays(startOfToday(), 1), 'yyyy-MM-dd');

test.describe('R-ES · Rutinas en español', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });

  test('R-ES-01 arranque del día: qué tengo, quién sigue, llega el primero y pasa a consulta', async () => {
    await sim.say('vista día');
    await sim.say('qué tengo hoy');
    expect(sim.card().message).toMatch(/4 citas/);
    await sim.say('quién sigue');
    await sim.say('Ana Gómez llegó');
    await sim.say('sí');
    expect(status('a1')).toBe('arrived');
    await sim.say('pasó a consulta');
    await sim.say('sí');
    expect(status('a1')).toBe('in_progress');
  });

  test('R-ES-02 un paciente llama para cambiar el turno: encontrarlo, moverlo y confirmar', async () => {
    await sim.say('la cita de María de mañana');
    await sim.say('pasala al jueves a las 10');
    expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['reschedule', 'a5']);
    await sim.say('sí');
    expect(sim.cal.savedForms).toHaveLength(1);
  });

  test('R-ES-03 el doctor arma su vista: día, solo él, más zoom, horario de la clínica', async () => {
    await sim.sayAll('vista día', 'solo el doctor Pérez', 'más zoom', 'más zoom', 'mostrá solo el horario de la clínica');
    expect(sim.cal.state.view).toBe('day');
    expect(sim.cal.state.selectedDoctorIds).toEqual(['d1']);
    expect(sim.cal.state.zoom).toBe(1.2);
    expect(sim.cal.state.settings?.visible_hours_mode).toBe('clinic');
  });

  test('R-ES-04 paciente nuevo: cita completa, agregar control, nota y guardar', async () => {
    await sim.say('nueva cita para Sofía Castro mañana a las 10 con el doctor Pérez, limpieza');
    await sim.say('agregá control');
    await sim.say('nota: primera vez, viene derivada');
    await sim.say('guardar');
    const saved = sim.cal.savedForms[0];
    expect(saved.services.map((s) => s.id).sort()).toEqual(['sv1', 'sv2']);
    expect(saved.notes).toBe('Primera vez, viene derivada');
  });

  test('R-ES-05 antes de atender: ¿debe algo? → cobro rápido', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('tiene deudas');
    expect(rows()).toMatch(/Deuda/);
    await sim.say('cobrale');
    expect(sim.cal.calls('openPatientAction')[0]).toEqual(['p2', 'bill', 'a2']);
  });

  test('R-ES-06 ordenar la agenda a gusto: configuración en varias frases', async () => {
    await sim.sayAll('abrí la configuración', 'slots de 15', 'ocultá los domingos', 'franja de la clínica', 'vista predeterminada semana', 'cerrá la configuración');
    expect(sim.cal.state.settings).toMatchObject({ slot_duration: 15, hidden_weekdays: [0], visible_hours_mode: 'clinic', default_view: 'week' });
    expect(sim.cal.state.settingsOpen).toBe(false);
  });

  test('R-ES-07 exportar la semana que viene de Centro, corrigiendo en el camino', async () => {
    await sim.say('exportá la agenda');
    await sim.say('de la semana que viene');
    await sim.say('solo la sede Centro');
    expect(sim.cal.state.exportDialog).toMatchObject({ preset: 'week', calendarIds: ['c1', 'c2'] });
    await sim.say('sí');
    expect(sim.cal.state.exportDialog).toBeNull();
  });

  test('R-ES-08 cancelación tardía y después cuántas veces canceló', async () => {
    await sim.say('Juan Pérez canceló tarde');
    await sim.say('sí');
    expect(sim.cal.calls('changeStatus')[0]).toEqual(['a2', 'cancelled', { cancellation_reason: 'late' }]);
    await sim.say('cuántas citas canceló Juan Pérez');
    expect(rows()).toMatch(/Canceló: 1/);
  });

  test('R-ES-09 ambigüedad + herramienta en el medio + respuesta + acción', async () => {
    await sim.say('la cita de Ana');
    await sim.say('más zoom');
    await sim.say('la de las 10 y media');
    await sim.say('llegó');
    await sim.say('sí');
    expect(status('a3')).toBe('arrived');
    expect(sim.cal.state.zoom).toBe(1.1);
  });

  test('R-ES-10 empezar algo, cambiar de tema dos veces y terminar lo último', async () => {
    await sim.say('la cita de Ana');
    await sim.say('exportá la agenda de mañana');
    await sim.say('no');
    await sim.say('la segunda');
    await sim.say('editala');
    await sim.say('exportá la agenda de mañana');
    await sim.say('sí');
    expect(sim.cal.state.exportDialog).not.toBeNull();
    await sim.say('cancelar');
    expect(sim.cal.state.exportDialog).toBeNull();
  });

  test('R-ES-11 recorrer la semana buscando lugar: siguiente, huecos de la tarde, volver a hoy', async () => {
    await sim.sayAll('siguiente', 'huecos el jueves a la tarde', 'volvé a hoy');
    expect(sim.cal.calls('goToDate').length).toBeGreaterThanOrEqual(2);
  });

  test('R-ES-12 consultorio: ver el sillón 2, mover la cita de Carlos ahí y volver', async () => {
    await sim.say('pasá al sillón 2');
    expect(sim.cal.calls('setActiveCalendar').pop()?.[0]).toBe('c2');
    await sim.say('pasá la cita de Carlos López al sillón 2');
    await sim.say('sí');
    expect(sim.cal.calls('reassign')).toEqual([['a4', null, 'c2']]);
  });

  test('R-ES-13 estadísticas antes de dar otra cita y presupuesto', async () => {
    await sim.say('cuántas veces faltó Juan Pérez');
    expect(rows()).toMatch(/Faltó: 2/);
    await sim.say('y en qué estado están sus presupuestos');
    expect(rows()).toMatch(/Presupuestos: 2/);
    await sim.say('nuevo presupuesto');
    expect(sim.cal.calls('openPatientAction').pop()?.slice(0, 2)).toEqual(['p2', 'quote']);
  });

  test('R-ES-14 editar todo de una cita en varias frases y guardar', async () => {
    await sim.say('editá la cita de Carlos López');
    await sim.sayAll('con la doctora Ruiz', 'en el sillón 1', 'a las 4', 'que termine a las 5', 'agregá extracción', 'nota: trae radiografía');
    await sim.say('actualizá');
    const saved = sim.cal.savedForms[0];
    expect(saved).toMatchObject({ doctor: { id: 'd2' }, calendar: { id: 'c1' }, endTime: '17:00', notes: 'Trae radiografía' });
    expect(saved.start?.getHours()).toBe(16);
  });

  test('R-ES-15 dormirse a mitad de una pregunta y retomar al prender', async () => {
    const { configureVoiceTiming } = await import('@/lib/voice/session');
    configureVoiceTiming({ awakePendingMs: 60 });
    await sim.say('Carlos López no vino');
    await sim.wait(150);
    configureVoiceTiming({ awakePendingMs: 60_000 });
    expect(sim.store().suspended).toBe(true);
    await sim.toggle();
    await sim.say('sí');
    expect(status('a4')).toBe('no_show');
  });

  test('R-ES-16 paciente que no aparece por nombre: buscar por cédula y preguntar su deuda', async () => {
    await sim.say('buscá el paciente Ernesto Valverde');
    await sim.say('cédula 1 2 3 4 5 6 7 8');
    expect(sim.cal.calls('openPatient')).toEqual([['p8']]);
  });

  test('R-ES-17 con IA: frase larga con todo junto', async () => {
    sim.ai.reply(/doctora Ruiz/, {
      relation: 'new', confidence: 0.9,
      steps: [{ intent: 'calendar.view', view: 'day' }, { intent: 'calendar.navigate', date: tomorrow }, { intent: 'calendar.filter', filter_op: 'only', doctor_ids: ['d2'] }, { intent: 'calendar.zoom', zoom_op: 'in', amount: 2 }],
    });
    await sim.say('mostrame mañana en vista día, solo la doctora Ruiz y agrandá un poco');
    expect(sim.cal.state).toMatchObject({ view: 'day', selectedDoctorIds: ['d2'], zoom: 1.2 });
  });
});

test.describe('R-EN · Routines in English', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'en' }); });

  test('R-EN-01 start of the day: agenda, who is next, check in and start', async () => {
    await sim.say('day view');
    await sim.say('what do I have today');
    expect(sim.card().message).toMatch(/4 appointments/);
    await sim.say('Ana Gómez arrived');
    await sim.say('yes');
    expect(status('a1')).toBe('arrived');
    await sim.say('mark it as in progress');
    await sim.say('yes');
    expect(status('a1')).toBe('in_progress');
  });

  test('R-EN-02 reschedule over the phone', async () => {
    await sim.say("María's appointment tomorrow");
    await sim.say('move it to Thursday at 10');
    expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['reschedule', 'a5']);
    await sim.say('yes');
    expect(sim.cal.savedForms).toHaveLength(1);
  });

  test('R-EN-03 doctor sets up the view', async () => {
    await sim.sayAll('day view', 'only doctor Pérez', 'zoom in', 'zoom in', 'only show clinic hours');
    expect(sim.cal.state).toMatchObject({ view: 'day', selectedDoctorIds: ['d1'], zoom: 1.2 });
    expect(sim.cal.state.settings?.visible_hours_mode).toBe('clinic');
  });

  test('R-EN-04 new patient booking with corrections', async () => {
    await sim.say('new appointment for Sofía Castro tomorrow at 10 with doctor Pérez, limpieza');
    await sim.say('note: first visit');
    await sim.say('save');
    expect(sim.cal.savedForms[0]).toMatchObject({ patient: { name: 'Sofía Castro' }, notes: 'First visit' });
  });

  test('R-EN-05 before seeing the patient: balance, then quick charge', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('does he owe anything');
    expect(rows()).toMatch(/Owes/);
    await sim.say('quick charge');
    expect(sim.cal.calls('openPatientAction')[0]).toEqual(['p2', 'bill', 'a2']);
  });

  test('R-EN-06 settings session', async () => {
    await sim.sayAll('open the settings', '15 minute slots', 'hide sundays', 'only show clinic hours', 'default view week', 'close the settings');
    expect(sim.cal.state.settings).toMatchObject({ slot_duration: 15, hidden_weekdays: [0], visible_hours_mode: 'clinic', default_view: 'week' });
  });

  test('R-EN-07 export next week, all calendars', async () => {
    await sim.say('export the schedule');
    await sim.say('next week');
    await sim.say('all calendars');
    expect(sim.cal.state.exportDialog).toMatchObject({ preset: 'week', calendarIds: ['c1', 'c2', 'c3'] });
    await sim.say('download it');
    expect(sim.cal.state.exportDialog).toBeNull();
  });

  test('R-EN-08 ambiguity, a tool in the middle, answer, action', async () => {
    await sim.say("Ana's appointment");
    await sim.say('zoom in');
    await sim.say('the one at 10 30');
    await sim.say('she arrived');
    await sim.say('yes');
    expect(status('a3')).toBe('arrived');
  });

  test('R-EN-09 stats then a quote', async () => {
    await sim.say('how many no shows does Juan Pérez have');
    expect(rows()).toMatch(/No-shows: 2/);
    await sim.say('new quote');
    expect(sim.cal.calls('openPatientAction').pop()?.slice(0, 2)).toEqual(['p2', 'quote']);
  });

  test('R-EN-10 edit everything in several phrases', async () => {
    await sim.say("edit Carlos López's appointment");
    await sim.sayAll('with doctor Ruiz', 'in chair 1', 'at 4', 'ends at 5', 'note: bring X-rays');
    await sim.say('update');
    expect(sim.cal.savedForms[0]).toMatchObject({ doctor: { id: 'd2' }, calendar: { id: 'c1' }, endTime: '17:00', notes: 'Bring X-rays' });
  });
});
