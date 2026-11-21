import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N2 · Encadenados en español (docs/voz-agenda-pruebas.md §N2): el foco de la cita que se
 * mantiene entre pedidos, herramientas en el medio de una pregunta, cambio de tema con
 * confirmación, cancelar a mitad, elegir entre opciones de varias formas. Sin IA.
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;

test.describe('N2.1 · Foco: elegida una cita, todo actúa sobre ella', () => {
  test('VZ-ES-200 seleccionar → «marcala como llegó» → «sí»', async () => {
    await sim.say('la cita de Carlos López');
    await sim.say('marcala como llegó');
    await sim.say('sí');
    expect(status('a4')).toBe('arrived');
  });
  test('VZ-ES-201 seleccionar → «abrí su cuenta» → «ponela en verde» → «sí»', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('abrí su cuenta');
    await sim.say('ponela en verde');
    await sim.say('sí');
    expect(sim.cal.calls('openAppointmentTool')).toEqual([['a2', 'accounts']]);
    expect(sim.cal.calls('changeColor')[0]?.[0]).toBe('a2');
  });
  test('VZ-ES-202 elegida entre dos «Ana», el foco sigue en la elegida', async () => {
    await sim.say('la cita de Ana');
    await sim.say('la de las 10 y media');
    await sim.say('no vino');
    await sim.say('sí');
    expect(status('a3')).toBe('no_show');
    expect(status('a1')).toBe('scheduled');
  });
  test('VZ-ES-203 seleccionar → «editala» → cambiar doctor → «guardar»', async () => {
    await sim.say('la cita de Carlos López');
    await sim.say('editala');
    await sim.say('con la doctora Ruiz');
    await sim.say('guardar');
    expect(sim.cal.savedForms[0]?.doctor?.id).toBe('d2');
  });
  test('VZ-ES-204 seleccionar → «borrala» → «sí»', async () => {
    await sim.say('la cita de Carlos López');
    await sim.say('borrala');
    await sim.say('sí');
    expect(sim.cal.calls('deleteAppointment')).toEqual([['a4']]);
  });
  test('VZ-ES-205 nombrar otra cita cambia el foco', async () => {
    await sim.say('la cita de Carlos López');
    await sim.say('Juan Pérez llegó');
    await sim.say('sí');
    expect(status('a2')).toBe('arrived');
    expect(sim.store().focusLabel).toBe('Juan Pérez');
  });
});

test.describe('N2.2 · Herramientas en el medio de una pregunta (no cancelan)', () => {
  test('VZ-ES-210 eligiendo entre dos «Ana», «más zoom» se hace y la pregunta sigue', async () => {
    await sim.say('la cita de Ana');
    await sim.say('poné más zoom por favor');
    expect(sim.cal.state.zoom).toBe(1.1);
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('la primera');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a1']]);
  });
  test('VZ-ES-211 confirmando un estado, «andá a mañana» no lo cancela', async () => {
    await sim.say('Juan Pérez llegó');
    await sim.say('andá al día de mañana por favor');
    expect(sim.card().awaiting).toBe('confirm');
    await sim.say('sí');
    expect(status('a2')).toBe('arrived');
  });
  test('VZ-ES-212 en el editor, «más zoom» no es una corrección del formulario… pero el formulario sigue abierto', async () => {
    await sim.say('editá la cita de Juan Pérez');
    await sim.say('poné más zoom por favor');
    expect(sim.cal.state.form.kind).toBe('dialog');
    await sim.say('guardar');
    expect(sim.cal.savedForms).toHaveLength(1);
  });
});

test.describe('N2.3 · Cambio de tema y cancelar', () => {
  test('VZ-ES-220 con una pregunta abierta, un pedido nuevo pregunta si se deja; «sí» hace lo nuevo', async () => {
    await sim.say('la cita de Ana');
    await sim.say('exportá la agenda de la semana que viene');
    expect(sim.card().title).toMatch(/cambiamos/i);
    await sim.say('sí');
    expect(sim.cal.state.exportDialog?.preset).toBe('week');
  });
  test('VZ-ES-221 «no» vuelve a la pregunta que estaba', async () => {
    await sim.say('la cita de Ana');
    await sim.say('exportá la agenda de la semana que viene');
    await sim.say('no');
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('la segunda');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
    expect(sim.cal.state.exportDialog).toBeNull();
  });
  test('VZ-ES-222 en el editor, un pedido de otra cosa pregunta si se deja el formulario', async () => {
    await sim.say('editá la cita de Juan Pérez');
    await sim.say('exportá la agenda de mañana');
    expect(sim.card().title).toMatch(/cambiamos/i);
    await sim.say('sí');
    expect(sim.cal.state.exportDialog).not.toBeNull();
  });
  test('VZ-ES-223 «cancelá» corta la tarea en curso', async () => {
    await sim.say('la cita de Ana');
    await sim.say('cancelá');
    expect(sim.card().choices).toEqual([]);
    expect(sim.card().message).toMatch(/dejé/);
    expect(sim.cal.calls('focusAppointment')).toEqual([]);
  });
  test('VZ-ES-224 «olvidalo» en una confirmación no cambia nada', async () => {
    await sim.say('Carlos López no vino');
    await sim.say('olvidalo');
    expect(status('a4')).toBe('scheduled');
  });
  test('VZ-ES-225 «sigamos» repite la pregunta abierta', async () => {
    await sim.say('la cita de Ana');
    await sim.say('sigamos');
    expect(sim.card().choices).toHaveLength(2);
  });
});

test.describe('N2.4 · Elegir entre opciones de varias formas', () => {
  const pick = async (answer: string, expected: string) => {
    await sim.say('qué agendas hay');
    await sim.say(answer);
    expect(sim.cal.state.activeCalendarId).toBe(expected);
  };
  test('VZ-ES-230 «la uno»', () => pick('la uno', 'c1'));
  test('VZ-ES-231 «la tercera»', () => pick('la tercera', 'c3'));
  test('VZ-ES-232 «la última»', () => pick('la última', 'c3'));
  test('VZ-ES-233 «la penúltima»', () => pick('la penúltima', 'c2'));
  test('VZ-ES-234 «la de arriba»', () => pick('la de arriba', 'c1'));
  test('VZ-ES-235 «la del medio»', () => pick('la del medio', 'c2'));
  test('VZ-ES-236 por nombre «ortodoncia»', () => pick('ortodoncia', 'c3'));
  test('VZ-ES-237 empate «sillón» pregunta solo entre los dos sillones', async () => {
    await sim.say('qué agendas hay');
    await sim.say('el sillón');
    expect(sim.card().choices).toEqual(['Sillón 1', 'Sillón 2']);
    await sim.say('el 2');
    expect(sim.cal.state.activeCalendarId).toBe('c2');
  });
  test('VZ-ES-238 una respuesta que no es ninguna vuelve a preguntar y «no» deja todo igual', async () => {
    await sim.say('qué agendas hay');
    await sim.say('la azul');
    expect(sim.card().choices).toHaveLength(3);
    await sim.say('no');
    expect(sim.cal.calls('setActiveCalendar')).toEqual([]);
  });
});
