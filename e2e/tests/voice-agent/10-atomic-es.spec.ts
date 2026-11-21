import { expect, test } from '@playwright/test';
import { addDays, format, startOfToday } from 'date-fns';

import { configureVoiceTiming } from '@/lib/voice/session';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N1 · Casos atómicos en español (docs/voz-agenda-pruebas.md §N1). Una frase → una acción, sin
 * IA (todo lo entiende el intérprete local). Cada prueba empieza con «Invoke …» como en la
 * clínica, con el botón Voz prendido.
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

const day = (d: Date) => format(d, 'yyyy-MM-dd');
const lastGoTo = () => {
  const calls = sim.cal.calls('goToDate');
  return calls.length ? day(calls[calls.length - 1][0] as Date) : null;
};

test.describe('N1.1 · Escucha', () => {
  test('VZ-ES-001 con Voz prendido escucha todo, sin palabra de activación', async () => {
    expect(sim.store().alwaysOn).toBe(true);
    await sim.say('andá a mañana');
    expect(lastGoTo()).toBe(day(addDays(startOfToday(), 1)));
  });
  test('VZ-ES-002 «Invoke» solo (opcional) dice que escucha', async () => {
    await sim.say('Invoke');
    expect(sim.card().message).toContain('Te escucho');
  });
  test('VZ-ES-003 «Inbox IA …» (como lo transcribe el reconocedor) se saca y se hace el pedido', async () => {
    await sim.say('Inbox IA volvé a hoy');
    expect(lastGoTo()).toBe(day(startOfToday()));
  });
  test('VZ-ES-004 frases seguidas, cada una se hace', async () => {
    await sim.say('vista día');
    await sim.say('mañana');
    expect(sim.cal.state.view).toBe('day');
    expect(lastGoTo()).toBe(day(addDays(startOfToday(), 1)));
  });
  test('VZ-ES-005 una charla de la sala no hace nada ni se dice en voz alta', async () => {
    await sim.say('vista semana');
    const before = sim.cal.log.length;
    await sim.say('qué lindo día hace hoy afuera');
    expect(sim.cal.log.length).toBe(before);
    expect(sim.card().tone).not.toBe('error');
  });
  test('VZ-ES-006 tocar Voz lo apaga y no escucha más', async () => {
    await sim.toggle();
    expect(sim.store().alwaysOn).toBe(false);
  });
  test('VZ-ES-007 un rato sin hablarle se duerme (apaga el micrófono)', async () => {
    configureVoiceTiming({ awakeIdleMs: 60 });
    await sim.say('vista día');
    await sim.wait(150);
    expect(sim.store().alwaysOn).toBe(false);
    configureVoiceTiming({ awakeIdleMs: 60_000 });
  });
  test('VZ-ES-008 se duerme con una pregunta abierta y al prenderlo la retoma', async () => {
    configureVoiceTiming({ awakePendingMs: 60 });
    await sim.say('la cita de Ana');
    expect(sim.card().choices).toHaveLength(2);
    await sim.wait(150);
    expect(sim.store()).toMatchObject({ alwaysOn: false, suspended: true });
    configureVoiceTiming({ awakePendingMs: 60_000 });
    await sim.toggle();
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('la segunda');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
});

test.describe('N1.2 · Navegación', () => {
  test('VZ-ES-010 hoy', async () => {
    await sim.say('Invoke hoy');
    expect(lastGoTo()).toBe(day(startOfToday()));
  });
  test('VZ-ES-011 mañana', async () => {
    await sim.say('Invoke andá a mañana');
    expect(lastGoTo()).toBe(day(addDays(startOfToday(), 1)));
  });
  test('VZ-ES-012 siguiente en vista semana avanza una semana', async () => {
    const before = sim.cal.state.range!.start;
    await sim.say('Invoke siguiente');
    expect(lastGoTo()).toBe(day(addDays(before, 7)));
  });
  test('VZ-ES-013 anterior en vista día retrocede un día', async () => {
    await sim.say('Invoke vista día');
    const before = sim.cal.state.range!.start;
    await sim.say('anterior');
    expect(lastGoTo()).toBe(day(addDays(before, -1)));
  });
  test('VZ-ES-014 la semana que viene', async () => {
    await sim.say('Invoke la semana que viene');
    expect(lastGoTo()).toBe(day(addDays(startOfToday(), 7)));
  });
  test('VZ-ES-015 ir a una fecha con el mes', async () => {
    await sim.say('Invoke andá al 3 de diciembre');
    expect(lastGoTo()).toMatch(/-12-03$/);
  });
});

test.describe('N1.3 · Vista', () => {
  for (const [said, view] of [['vista día', 'day'], ['ver semana', 'week'], ['vista de 3 días', '3-day'], ['vista mes', 'month'], ['vista lista', 'schedule']] as const) {
    test(`VZ-ES-02x «${said}» → ${view}`, async () => {
      await sim.say(`Invoke ${said}`);
      expect(sim.cal.state.view).toBe(view);
    });
  }
  test('VZ-ES-026 «¿cómo puedo ver?» lista las vistas y elige «la última»', async () => {
    await sim.say('Invoke cómo puedo ver');
    expect(sim.card().choices.length).toBeGreaterThan(5);
    await sim.say('la última');
    expect(sim.cal.state.view).toBe('schedule');
  });
  test('VZ-ES-027 «cambiá la vista» sin decir cuál pregunta, y se elige por nombre', async () => {
    await sim.say('Invoke cambiá la vista');
    await sim.say('la de mes');
    expect(sim.cal.state.view).toBe('month');
  });
});

test.describe('N1.4 · Zoom', () => {
  test('VZ-ES-030 más zoom', async () => {
    await sim.say('Invoke más zoom');
    expect(sim.cal.state.zoom).toBe(1.1);
  });
  test('VZ-ES-031 alejá (menos zoom)', async () => {
    await sim.say('Invoke alejá');
    expect(sim.cal.state.zoom).toBe(0.9);
  });
  test('VZ-ES-032 zoom al máximo', async () => {
    await sim.say('Invoke zoom al máximo');
    expect(sim.cal.state.zoom).toBe(2.5);
  });
  test('VZ-ES-033 lo más chico posible', async () => {
    await sim.say('Invoke lo más chico posible');
    expect(sim.cal.state.zoom).toBe(0.3);
  });
  test('VZ-ES-034 zoom al 150', async () => {
    await sim.say('Invoke zoom al 150');
    expect(sim.cal.state.zoom).toBe(1.5);
  });
  test('VZ-ES-035 zoom normal', async () => {
    await sim.say('Invoke zoom al máximo');
    await sim.say('zoom normal');
    expect(sim.cal.state.zoom).toBe(1);
  });
  test('VZ-ES-036 agrandá mucho (3 pasos)', async () => {
    await sim.say('Invoke agrandá mucho');
    expect(sim.cal.state.zoom).toBe(1.3);
  });
});
