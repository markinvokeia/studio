import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * AI · Comprensión con IA (docs/voz-agenda-pruebas.md §AI): frases con adjetivos, metáforas y formas
 * indirectas que el intérprete local no conoce. El modelo está simulado (lo que contestaría según
 * el prompt de «Voz - Interpretar»); se prueba que el plan pase por la validación de n8n y del
 * navegador y que la pantalla haga lo pedido. Con confianza media pregunta antes; con baja, no
 * adivina. Español e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());

type Plan = Record<string, unknown>;
const sure = (...steps: Plan[]) => ({ relation: 'new', confidence: 0.9, steps });

function aiTable(locale: 'es' | 'en', name: string, rows: Array<[string, Plan, (s: VoiceSim) => void]>) {
  test.describe(name, () => {
    test.beforeEach(async () => { sim = await createVoiceSim({ locale }); });
    for (const [said, plan, check] of rows) {
      test(`«${said}»`, async () => {
        sim.ai.reply(/.*/, plan);
        await sim.say(said);
        // Lo que cambia algo se confirma: «sí» (hasta dos preguntas: confirmación y peligro).
        for (let i = 0; i < 2 && sim.card().awaiting === 'confirm'; i++) await sim.say(locale === 'es' ? 'sí' : 'yes');
        // Lo que entienda bien el intérprete local no necesita IA; lo que importa es el resultado.
        check(sim);
      });
    }
  });
}

aiTable('es', 'AI-ES · tamaño, panel y configuración dicho con adjetivos', [
  ['está todo apretadito, no veo nada', sure({ intent: 'calendar.zoom', zoom_op: 'in', amount: 3 }), (s) => expect(s.cal.state.zoom).toBe(1.3)],
  ['ponelo enorme', sure({ intent: 'calendar.zoom', zoom_op: 'max' }), (s) => expect(s.cal.state.zoom).toBe(2.5)],
  ['quedó gigante, bajale un poquito', sure({ intent: 'calendar.zoom', zoom_op: 'out', amount: 1 }), (s) => expect(s.cal.state.zoom).toBe(0.9)],
  ['quiero más espacio entre las horas', sure({ intent: 'calendar.settings', setting: 'hour_height', setting_value: 'up' }), (s) => expect(s.cal.state.settings?.hour_height).toBe(100)],
  ['la listita de la izquierda que se quede ahí', sure({ intent: 'calendar.panel', panel_op: 'pin' }), (s) => expect(s.cal.state.agendasPanel.pinned).toBe(true)],
  ['sacame de encima la columna de agendas', sure({ intent: 'calendar.panel', panel_op: 'close' }), (s) => expect(s.cal.state.agendasPanel.open).toBe(false)],
  ['mostrame solo cuando atendemos', sure({ intent: 'calendar.settings', setting: 'visible_hours', setting_value: 'clinic' }), (s) => expect(s.cal.state.settings?.visible_hours_mode).toBe('clinic')],
  ['hacelo más finito, de a diez', sure({ intent: 'calendar.settings', setting: 'slot_duration', setting_value: 10 }), (s) => expect(s.cal.state.settings?.slot_duration).toBe(10)],
  ['el finde no lo quiero ver', sure({ intent: 'calendar.settings', setting: 'hidden_weekdays', weekday_op: 'hide', weekdays: [6, 0] }), (s) => expect([...(s.cal.state.settings?.hidden_weekdays ?? [])].sort()).toEqual([0, 6])],
  ['que siempre me abra mirando la semana entera', sure({ intent: 'calendar.settings', setting: 'default_view', setting_value: 'week' }), (s) => expect(s.cal.state.settings?.default_view).toBe('week')],
]);

aiTable('es', 'AI-ES · citas dichas de otra forma', [
  ['Carlitos ya está sentado afuera', sure({ intent: 'calendar.status', status: 'arrived', patient: 'Carlos López' }), (s) => expect(s.cal.calls('changeStatus')[0]?.[1]).toBe('arrived')],
  ['a Juan ya lo hicimos pasar al sillón', sure({ intent: 'calendar.status', status: 'in_progress', patient: 'Juan Pérez' }), (s) => expect(s.cal.calls('changeStatus')[0]?.[1]).toBe('in_progress')],
  ['el de las tres nos dejó plantados', sure({ intent: 'calendar.status', status: 'no_show', from_time: '15:00' }), (s) => expect(s.cal.calls('changeStatus')[0]?.[0]).toBe('a4')],
  ['la de Juan ponela coloradita', sure({ intent: 'calendar.color', color: '11', patient: 'Juan Pérez' }), (s) => expect(s.cal.calls('changeColor')[0]).toEqual(['a2', '11'])],
  ['al de las tres dale una hora y media larga', sure({ intent: 'calendar.duration', minutes: 90, from_time: '15:00' }), (s) => expect(s.cal.calls('retime')[0]?.[2]).toBe('16:30')],
  ['el de las tres ya dura una hora, dejalo así', sure({ intent: 'calendar.duration', minutes: 60, from_time: '15:00' }), (s) => expect(s.cal.calls('retime')).toEqual([])],
  ['que a Carlos lo vea la Ruiz', sure({ intent: 'calendar.assign_doctor', doctor_id: 'd2', patient: 'Carlos López' }), (s) => expect(s.cal.calls('reassign')[0]).toEqual(['a4', 'd2', null])],
  ['sacá del medio lo de Carlos de hoy', sure({ intent: 'calendar.delete', patient: 'Carlos López' }), (s) => expect(s.cal.calls('deleteAppointment')).toEqual([['a4']])],
]);

aiTable('es', 'AI-ES · información y acciones dichas de otra forma', [
  ['cómo viene Juan con la guita', sure({ intent: 'calendar.patient_info', info_topics: ['debt'], patient: 'Juan Pérez' }), (s) => expect(s.card().rows.join(' ')).toMatch(/Deuda/)],
  ['Juan es de faltar mucho?', sure({ intent: 'calendar.patient_info', info_topics: ['no_shows'], patient: 'Juan Pérez' }), (s) => expect(s.card().rows.join(' ')).toMatch(/Faltó: 2/)],
  ['contame todo de Juan', sure({ intent: 'calendar.patient_info', info_topics: ['summary'], patient: 'Juan Pérez' }), (s) => expect(s.card().rows.join(' ')).toMatch(/Vino.*Deuda/)],
  ['armale los números a Juan para lo que le falta', sure({ intent: 'calendar.patient_action', patient_action: 'quote', patient: 'Juan Pérez' }), (s) => expect(s.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p2', 'quote'])],
  ['cobrale lo de hoy a Juan', sure({ intent: 'calendar.patient_action', patient_action: 'bill', patient: 'Juan Pérez' }), (s) => expect(s.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p2', 'bill'])],
]);

aiTable('en', 'AI-EN · adjectives and indirect phrasing', [
  ['everything is tiny I can barely see', sure({ intent: 'calendar.zoom', zoom_op: 'in', amount: 3 }), (s) => expect(s.cal.state.zoom).toBe(1.3)],
  ['make it huge', sure({ intent: 'calendar.zoom', zoom_op: 'max' }), (s) => expect(s.cal.state.zoom).toBe(2.5)],
  ['keep that left list from disappearing', sure({ intent: 'calendar.panel', panel_op: 'pin' }), (s) => expect(s.cal.state.agendasPanel.pinned).toBe(true)],
  ['only when we are open', sure({ intent: 'calendar.settings', setting: 'visible_hours', setting_value: 'clinic' }), (s) => expect(s.cal.state.settings?.visible_hours_mode).toBe('clinic')],
  ["I don't want to see the weekend", sure({ intent: 'calendar.settings', setting: 'hidden_weekdays', weekday_op: 'hide', weekdays: [6, 0] }), (s) => expect([...(s.cal.state.settings?.hidden_weekdays ?? [])].sort()).toEqual([0, 6])],
  ['Carlos is sitting outside', sure({ intent: 'calendar.status', status: 'arrived', patient: 'Carlos López' }), (s) => expect(s.cal.calls('changeStatus')[0]?.[1]).toBe('arrived')],
  ['the three o clock stood us up', sure({ intent: 'calendar.status', status: 'no_show', from_time: '15:00' }), (s) => expect(s.cal.calls('changeStatus')[0]?.[0]).toBe('a4')],
  ["paint Juan's slot a reddish color", sure({ intent: 'calendar.color', color: '11', patient: 'Juan Pérez' }), (s) => expect(s.cal.calls('changeColor')[0]).toEqual(['a2', '11'])],
  ["how's Juan doing money wise", sure({ intent: 'calendar.patient_info', info_topics: ['debt'], patient: 'Juan Pérez' }), (s) => expect(s.card().rows.join(' ')).toMatch(/Owes/)],
  ['tell me everything you have on Juan', sure({ intent: 'calendar.patient_info', info_topics: ['summary'], patient: 'Juan Pérez' }), (s) => expect(s.card().rows.join(' ')).toMatch(/Visits.*Owes/)],
  ['put together an estimate for Juan', sure({ intent: 'calendar.patient_action', patient_action: 'quote', patient: 'Juan Pérez' }), (s) => expect(s.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p2', 'quote'])],
]);

test.describe('AI · Ambigüedad y confianza', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });

  test('AI-001 confianza media: pregunta «¿querés cambiar el zoom?» y «sí» lo hace', async () => {
    sim.ai.reply(/.*/, { relation: 'new', confidence: 0.6, steps: [{ intent: 'calendar.zoom', zoom_op: 'in' }] });
    await sim.say('ponelo más grandote');
    expect(sim.card().message).toMatch(/No estoy seguro: ¿querés cambiar el zoom\?/);
    await sim.say('sí');
    expect(sim.cal.state.zoom).toBe(1.1);
  });
  test('AI-002 confianza media: «no» no hace nada', async () => {
    sim.ai.reply(/.*/, { relation: 'new', confidence: 0.6, steps: [{ intent: 'calendar.zoom', zoom_op: 'in' }] });
    await sim.say('ponelo más grandote');
    await sim.say('no');
    expect(sim.cal.state.zoom).toBe(1);
  });
  test('AI-003 confianza alta: lo hace sin preguntar', async () => {
    sim.ai.reply(/.*/, { relation: 'new', confidence: 0.92, steps: [{ intent: 'calendar.zoom', zoom_op: 'in' }] });
    await sim.say('ponelo más grandote');
    expect(sim.cal.state.zoom).toBe(1.1);
  });
  test('AI-004 confianza baja: no adivina y lo dice', async () => {
    sim.ai.reply(/.*/, { relation: 'new', confidence: 0.3, steps: [{ intent: 'calendar.zoom', zoom_op: 'in' }] });
    await sim.say('ponelo más grandote');
    expect(sim.cal.state.zoom).toBe(1);
  });
  test('AI-005 un plan de varios pasos dudoso nombra lo que va a hacer', async () => {
    sim.ai.reply(/.*/, { relation: 'new', confidence: 0.65, steps: [{ intent: 'calendar.view', view: 'day' }, { intent: 'calendar.zoom', zoom_op: 'in' }] });
    await sim.say('quiero verlo distinto y más cerquita');
    expect(sim.card().message).toMatch(/cambiar la vista y cambiar el zoom/);
  });
  test('AI-006 ids inventados por el modelo se descartan en n8n y en el navegador', async () => {
    sim.ai.reply(/.*/, sure({ intent: 'calendar.assign_doctor', doctor_id: 'd-inventado', patient: 'Juan Pérez' }));
    await sim.say('que lo vea el doctor que vino nuevo');
    expect(sim.cal.calls('reassign')).toEqual([]);
  });
  test('AI-007 la IA no puede confirmar ni guardar por su cuenta: un «form_save» sin formulario no hace nada', async () => {
    sim.ai.reply(/.*/, sure({ intent: 'calendar.form_save' }));
    await sim.say('mandale nomás');
    expect(sim.cal.savedForms).toEqual([]);
  });
});

test.describe('AI-EN · Ambiguity', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'en' }); });
  test('AI-EN-001 medium confidence asks first', async () => {
    sim.ai.reply(/.*/, { relation: 'new', confidence: 0.6, steps: [{ intent: 'calendar.zoom', zoom_op: 'in' }] });
    await sim.say('make it chunkier');
    expect(sim.card().message).toMatch(/I'm not sure: do you want to change the zoom\?/);
    await sim.say('yes');
    expect(sim.cal.state.zoom).toBe(1.1);
  });
});
