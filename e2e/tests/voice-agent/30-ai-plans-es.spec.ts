import { expect, test } from '@playwright/test';
import { addDays, format, startOfToday } from 'date-fns';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N3 · Con IA, en español (docs/voz-agenda-pruebas.md §N3): frases con sinónimos o formas que el
 * intérprete local no conoce, planes de varios pasos, relación con la tarea en curso (respuesta,
 * herramienta, ignorar, cancelar), ambigüedad y confianza baja. El modelo está simulado (lo que
 * contestaría); el prompt y la validación son los del flujo de n8n y la revalidación, la del
 * navegador.
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;
const tomorrow = format(addDays(startOfToday(), 1), 'yyyy-MM-dd');

test.describe('N3.0 · Solo se llama a la IA cuando hace falta', () => {
  test('VZ-ES-300 lo que entiende el intérprete local no llama a la IA', async () => {
    await sim.sayAll('vista día', 'más zoom', 'qué agendas hay', 'la primera', 'Juan Pérez llegó', 'no');
    expect(sim.aiCalls).toEqual([]);
  });
  test('VZ-ES-301 la IA recibe la pantalla, el foco y la conversación (sin datos del paciente)', async () => {
    await sim.say('la cita de Ana');
    await sim.say('me gustaría la que viene más tarde de las dos');
    const call = sim.aiCalls[0];
    expect(call.prompt).toContain('CONVERSACIÓN: tarea en curso');
    expect(call.prompt).toContain('pregunta abierta');
    expect(call.prompt).toContain('AGENDAS (id · nombre · sede)');
    expect(JSON.stringify(call.context)).not.toContain('099');
  });
});

test.describe('N3.1 · Sinónimos y formas que lo local no conoce', () => {
  test('VZ-ES-310 «agrandame un montón la grilla» → zoom', async () => {
    sim.ai.reply(/montón/, { relation: 'new', confidence: 0.9, steps: [{ intent: 'calendar.zoom', zoom_op: 'in', amount: 3 }] });
    await sim.say('agrandame un montón la grilla que no veo nada');
    expect(sim.cal.state.zoom).toBe(1.3);
  });
  test('VZ-ES-311 «que la columna de agendas no desaparezca» → fijar el panel', async () => {
    sim.ai.reply(/desaparezca/, { relation: 'new', confidence: 0.85, steps: [{ intent: 'calendar.panel', panel_op: 'pin' }] });
    await sim.say('que la columna de agendas no desaparezca');
    expect(sim.cal.state.agendasPanel.pinned).toBe(true);
  });
  test('VZ-ES-312 «quiero ver menos horas en la pantalla, de 9 a 5» → franja personalizada', async () => {
    sim.ai.reply(/menos horas/, { relation: 'new', confidence: 0.8, steps: [{ intent: 'calendar.settings', setting: 'visible_hours', setting_value: 'custom', time: '09:00', end_time: '17:00' }] });
    await sim.say('quiero ver menos horas en la pantalla, de 9 a 5');
    expect(sim.cal.state.settings).toMatchObject({ visible_hours_mode: 'custom', visible_hours_start: '09:00', visible_hours_end: '17:00' });
  });
  test('VZ-ES-313 «el sabadito y el domingo que no aparezcan» → ocultar días', async () => {
    sim.ai.reply(/sabadito/, { relation: 'new', confidence: 0.85, steps: [{ intent: 'calendar.settings', setting: 'hidden_weekdays', weekday_op: 'hide', weekdays: [6, 0] }] });
    await sim.say('el sabadito y el domingo que no aparezcan');
    expect([...sim.cal.state.settings!.hidden_weekdays!].sort()).toEqual([0, 6]);
  });
  test('VZ-ES-314 «Carlitos López ya está en la sala» → estado llegó (confirma)', async () => {
    sim.ai.reply(/sala/, { relation: 'new', confidence: 0.9, steps: [{ intent: 'calendar.status', status: 'arrived', patient: 'Carlos López' }] });
    await sim.say('Carlitos López ya está en la sala');
    await sim.say('sí');
    expect(status('a4')).toBe('arrived');
  });
  test('VZ-ES-315 la IA no puede inventar ids: un doctor que no está se descarta', async () => {
    sim.ai.reply(/doctor house/, { relation: 'new', confidence: 0.9, steps: [{ intent: 'calendar.filter', filter_op: 'only', doctor_ids: ['d99'] }] });
    await sim.say('quiero ver nada más lo que atiende el doctor house');
    expect(sim.cal.calls('setSelectedDoctorIds')).toEqual([]);
  });
  test('VZ-ES-315b un doctor que no está, dicho como filtro: lo dice y no filtra', async () => {
    await sim.say('mostrame solo lo del doctor house');
    expect(sim.cal.calls('setSelectedDoctorIds')).toEqual([]);
    expect(sim.card().message).toMatch(/No encontré/);
  });
  test('VZ-ES-316 confianza baja: no adivina', async () => {
    sim.ai.reply(/cosa esa/, { relation: 'new', confidence: 0.3, steps: [{ intent: 'calendar.zoom', zoom_op: 'max' }] });
    await sim.say('hacé la cosa esa de antes');
    expect(sim.cal.state.zoom).toBe(1);
  });
});

test.describe('N3.2 · Planes de varios pasos', () => {
  test('VZ-ES-320 «la cita de Juan, marcala como llegó y abrí su cuenta» → 3 pasos con el foco', async () => {
    sim.ai.reply(/marcala como lleg. y abr/, {
      relation: 'new', confidence: 0.92,
      steps: [{ intent: 'calendar.select', patient: 'Juan' }, { intent: 'calendar.status', status: 'arrived' }, { intent: 'calendar.open', target: 'accounts' }],
    });
    await sim.say('la cita de Juan, marcala como llegó y abrí su cuenta');
    await sim.say('sí');
    expect(status('a2')).toBe('arrived');
    expect(sim.cal.calls('openAppointmentTool')).toEqual([['a2', 'accounts']]);
  });
  test('VZ-ES-321 «editá la cita de Carlos, ponele la doctora Ruiz y limpieza, y guardá»', async () => {
    sim.ai.reply(/ponele la doctora/, {
      relation: 'new', confidence: 0.9,
      steps: [{ intent: 'calendar.edit', patient: 'Carlos', doctor_id: 'd2', service_ids: ['sv1'] }],
    });
    await sim.say('editá la cita de Carlos, ponele la doctora Ruiz y limpieza');
    expect(sim.cal.form?.doctor?.id).toBe('d2');
    await sim.say('guardá');
    expect(sim.cal.savedForms[0]?.services.map((s) => s.id)).toContain('sv1');
  });
  test('VZ-ES-322 configurar varias cosas de una: «vista semana por defecto, slots de 15, colores por estado y sin sábados»', async () => {
    sim.ai.reply(/sin s.bados por favor/, {
      relation: 'new', confidence: 0.9,
      steps: [
        { intent: 'calendar.settings', setting: 'default_view', setting_value: 'week' },
        { intent: 'calendar.settings', setting: 'slot_duration', setting_value: 15 },
        { intent: 'calendar.settings', setting: 'color_by_status', setting_value: true },
        { intent: 'calendar.settings', setting: 'hidden_weekdays', weekday_op: 'hide', weekdays: [6] },
      ],
    });
    await sim.say('dejame la agenda en semana por defecto con slots de 15, colorcitos por estado y sin sábados por favor');
    expect(sim.cal.state.settings).toMatchObject({ default_view: 'week', slot_duration: 15, color_by_status: true, hidden_weekdays: [6] });
  });
  test('VZ-ES-323 «andá a mañana, vista día y mostrame los huecos de la tarde»', async () => {
    sim.ai.reply(/huecos de la tarde y/, {
      relation: 'new', confidence: 0.9,
      steps: [{ intent: 'calendar.navigate', date: tomorrow }, { intent: 'calendar.view', view: 'day' }, { intent: 'calendar.gaps', date: tomorrow, period: 'afternoon' }],
    });
    await sim.say('andá a mañana, poneme día y mostrame los huecos de la tarde y listo');
    expect(sim.cal.state.view).toBe('day');
    expect(format(sim.cal.calls('goToDate')[0][0] as Date, 'yyyy-MM-dd')).toBe(tomorrow);
  });
  test('VZ-ES-324 un paso que falla frena el plan y avisa dónde', async () => {
    sim.ai.reply(/inventado/, {
      relation: 'new', confidence: 0.9,
      steps: [{ intent: 'calendar.select', patient: 'Paciente Inventado' }, { intent: 'calendar.status', status: 'arrived' }],
    });
    await sim.say('la cita del paciente inventado, marcala como llegó');
    expect(sim.cal.calls('changeStatus')).toEqual([]);
    expect(sim.card().tone).not.toBe('success');
  });
  test('VZ-ES-325 exportar con todo dicho: «bajame en excel la semana que viene de Pocitos»', async () => {
    sim.ai.reply(/excel/, { relation: 'new', confidence: 0.9, steps: [{ intent: 'calendar.export', export_range: 'week', date: format(addDays(startOfToday(), 7), 'yyyy-MM-dd'), sede_ids: ['s2'] }] });
    await sim.say('bajame en excel lo de la semana que viene de pocitos');
    expect(sim.cal.state.exportDialog).toMatchObject({ preset: 'week', calendarIds: ['c3'] });
    await sim.say('sí');
    expect(sim.cal.state.exportDialog).toBeNull();
  });
});

test.describe('N3.3 · Relación con la tarea en curso', () => {
  test('VZ-ES-330 respuesta larga a «¿cuál?» la entiende la IA («la de la que viene más tarde»)', async () => {
    sim.ai.reply(/m.s tarde/, { relation: 'answer', answer: '2', confidence: 0.85, steps: [] });
    await sim.say('la cita de Ana');
    await sim.say('me gustaría la que viene más tarde de las dos');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
  test('VZ-ES-331 charla de la sala en medio de una pregunta se ignora y la pregunta sigue', async () => {
    sim.ai.reply(/caf/, { relation: 'ignore', confidence: 0.9, steps: [] });
    await sim.say('la cita de Ana');
    await sim.say('María traeme un café cuando puedas por favor');
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('la primera');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a1']]);
  });
  test('VZ-ES-332 herramienta dicha raro en medio: «dejame ver cómo viene el jueves» (aux)', async () => {
    sim.ai.reply(/c.mo viene/, { relation: 'aux', confidence: 0.85, steps: [{ intent: 'calendar.view', view: 'day' }] });
    await sim.say('Juan Pérez llegó');
    await sim.say('dejame ver primero cómo viene el día');
    expect(sim.cal.state.view).toBe('day');
    expect(sim.card().awaiting).toBe('confirm');
    await sim.say('sí');
    expect(status('a2')).toBe('arrived');
  });
  test('VZ-ES-333 «no, dejá, ya fue» (cancelar) lo dice la IA', async () => {
    sim.ai.reply(/ya fue/, { relation: 'cancel', confidence: 0.9, steps: [] });
    await sim.say('la cita de Ana');
    await sim.say('no no dejá eso ya fue');
    expect(sim.card().choices).toEqual([]);
  });
  test('VZ-ES-334 un pedido nuevo largo con una pregunta abierta pregunta si se deja', async () => {
    sim.ai.reply(/recordatorio/, { relation: 'new', confidence: 0.9, steps: [{ intent: 'calendar.reminder', reminder_type: 'reminder', date: tomorrow, time: '09:00', title: 'llamar al laboratorio' }] });
    await sim.say('la cita de Ana');
    await sim.say('poneme un recordatorio para mañana a las nueve de llamar al laboratorio');
    expect(sim.card().title).toMatch(/cambiamos/i);
  });
});

test.describe('N3.4 · Formulario con IA', () => {
  test('VZ-ES-340 «que dure lo mismo pero arranque media hora después» → form_set', async () => {
    sim.ai.reply(/media hora despu/, { relation: 'answer', confidence: 0.85, steps: [{ intent: 'calendar.form_set', time: '10:30', end_time: '11:00' }] });
    await sim.say('editá la cita de Juan Pérez');
    await sim.say('que dure lo mismo pero arranque media hora después');
    expect(sim.cal.form?.endTime).toBe('11:00');
    expect(sim.cal.form?.start?.getMinutes()).toBe(30);
  });
  test('VZ-ES-341 «sacale lo que tenga y dejá solo control» → form_set con servicios', async () => {
    sim.ai.reply(/solo control/, { relation: 'answer', confidence: 0.85, steps: [{ intent: 'calendar.form_set', service_ids: ['sv2'] }] });
    await sim.say('editá la cita de Juan Pérez');
    await sim.say('agregá limpieza');
    await sim.say('dejale solo control');
    expect(sim.cal.form?.services.map((s) => s.id)).toContain('sv2');
  });
  test('VZ-ES-342 «dale mandale nomás» → guardar (form_save)', async () => {
    sim.ai.reply(/mandale/, { relation: 'answer', confidence: 0.85, steps: [{ intent: 'calendar.form_save' }] });
    await sim.say('editá la cita de Juan Pérez');
    await sim.say('mandale nomás así como está');
    expect(sim.cal.savedForms).toHaveLength(1);
  });
});

test.describe('N3.5 · Pacientes con IA', () => {
  test('VZ-ES-350 «¿la de las 3 tiene algo pendiente de pagar?» → la deuda del paciente de esa cita', async () => {
    await sim.say('la cita de las 3');
    await sim.say('tiene algo pendiente de pagar');
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p4');
    expect(sim.card().rows.join(' ')).toMatch(/Deuda/);
  });
  test('VZ-ES-350b con IA: «¿cómo viene de plata el de las 3?» → patient_info debt', async () => {
    sim.ai.reply(/guita/, { relation: 'new', confidence: 0.85, steps: [{ intent: 'calendar.select', from_time: '15:00' }, { intent: 'calendar.patient_info', info_topics: ['debt'] }] });
    await sim.say('el de las 3 está complicado con la guita');
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p4');
  });
  test('VZ-ES-351 «traeme la ficha de la señora Castro» → buscar paciente', async () => {
    sim.ai.reply(/señora castro/i, { relation: 'new', confidence: 0.85, steps: [{ intent: 'calendar.patient_find', patient: 'Castro' }] });
    await sim.say('traeme la ficha de la señora Castro');
    expect(sim.cal.calls('openPatient')).toEqual([['p9']]);
  });
});
