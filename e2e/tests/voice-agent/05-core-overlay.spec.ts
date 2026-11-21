import { expect, test } from '@playwright/test';

import { parseScroll } from '@/lib/voice/commands/core';
import { normalizeSpeech } from '@/lib/voice/parse';
import { updateVoiceDomains } from '@/lib/voice/session';

import { openWindow, scrollLog } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * CO · Lo general de cualquier pantalla (docs/voz-agenda-pruebas.md §CO): desplazarse, lo de la
 * ventana abierta tiene prioridad (sus botones y sus campos), cerrar lo abierto al cambiar de
 * contexto, y el contexto de la página sin apagar el micrófono. Español e inglés.
 */

test.describe('CO-SCROLL · Qué es desplazarse', () => {
  const rows: Array<[string, string, string]> = [
    ['bajá', 'down', 'normal'], ['subí', 'up', 'normal'], ['más abajo', 'down', 'normal'], ['más arriba', 'up', 'normal'], ['para abajo', 'down', 'normal'], ['hacia arriba', 'up', 'normal'],
    ['bajá un poco', 'down', 'little'], ['subí un poquito', 'up', 'little'], ['bajá un poco más rápido', 'down', 'more'], ['bajá mucho', 'down', 'more'], ['subí bastante', 'up', 'more'],
    ['bajá hasta abajo', 'down', 'edge'], ['subí hasta arriba', 'up', 'edge'], ['andá al final', 'down', 'edge'], ['al principio', 'up', 'edge'], ['hasta el fondo', 'down', 'edge'],
    ['movete a la izquierda', 'left', 'normal'], ['movete a la derecha', 'right', 'normal'], ['desplazate a la derecha un poco', 'right', 'little'], ['scrolleá para abajo', 'down', 'normal'],
    ['scroll down', 'down', 'normal'], ['scroll up', 'up', 'normal'], ['scroll down a lot', 'down', 'more'], ['scroll up a little', 'up', 'little'], ['go to the bottom', 'down', 'edge'],
    ['scroll to the top', 'up', 'edge'], ['move left', 'left', 'normal'], ['move right a bit', 'right', 'little'], ['scroll all the way down', 'down', 'edge'], ['down', 'down', 'normal'],
  ];
  for (const [said, direction, amount] of rows) {
    test(`«${said}» → ${direction} ${amount}`, () => {
      expect(parseScroll(normalizeSpeech(said))).toEqual({ direction, amount });
    });
  }
  for (const said of ['bajá el zoom', 'subí el zoom', 'subí la altura de las horas', 'bajá la cita de Ana', 'pasá al sillón 2', 'andá a mañana', 'bajame la agenda a excel']) {
    test(`no es desplazarse: «${said}»`, () => { expect(parseScroll(normalizeSpeech(said))).toBeNull(); });
  }
});

test.describe('CO-SCROLL · Desplaza la pantalla', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  for (const [locale, said, check] of [
    ['es', 'bajá', (l: typeof scrollLog) => (l[0].by?.top ?? 0) > 0], ['es', 'subí un poco', (l: typeof scrollLog) => (l[0].by?.top ?? 0) < 0],
    ['es', 'hasta abajo', (l: typeof scrollLog) => (l[0].to?.top ?? 0) > 0], ['es', 'a la derecha', (l: typeof scrollLog) => (l[0].by?.left ?? 0) > 0],
    ['en', 'scroll down', (l: typeof scrollLog) => (l[0].by?.top ?? 0) > 0], ['en', 'scroll to the top', (l: typeof scrollLog) => l[0].to?.top === 0],
  ] as const) {
    test(`«${said}»`, async () => {
      sim = await createVoiceSim({ locale });
      await sim.say(said);
      expect(scrollLog).toHaveLength(1);
      expect(check(scrollLog)).toBe(true);
    });
  }
  test('desplazarse en medio de una pregunta no la cancela', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Ana');
    await sim.say('bajá un poco');
    expect(scrollLog).toHaveLength(1);
    await sim.say('la segunda');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
});

test.describe('CO-OVERLAY · Con una ventana abierta, lo dicho es primero para ella', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  const es = { title: 'Datos del paciente', buttons: ['Editar', 'Guardar', 'Más opciones'], fields: ['Teléfono', 'Email', 'Notas'] };
  const en = { title: 'Patient details', buttons: ['Edit', 'Save', 'More options'], fields: ['Phone', 'Email', 'Notes'] };
  for (const [locale, w, said, pressed] of [
    ['es', es, 'editar', 'Editar'], ['es', es, 'apretá guardar', 'Guardar'], ['es', es, 'dale a más opciones', 'Más opciones'], ['es', es, 'tocá editar', 'Editar'], ['es', es, 'hacé clic en guardar', 'Guardar'],
    ['en', en, 'edit', 'Edit'], ['en', en, 'click save', 'Save'], ['en', en, 'press more options', 'More options'], ['en', en, 'tap edit', 'Edit'],
  ] as const) {
    test(`«${said}» aprieta «${pressed}»`, async () => {
      sim = await createVoiceSim({ locale });
      const win = openWindow(w.title, w);
      await sim.say(said);
      expect(win.pressed).toEqual([pressed]);
    });
  }
  for (const [locale, w, said, field, value] of [
    ['es', es, 'poné en teléfono 099 123 456', 'Teléfono', '099 123 456'], ['es', es, 'el email es ana@gmail.com', 'Email', 'ana@gmail.com'], ['es', es, 'escribí en notas Trae estudios', 'Notas', 'Trae estudios'],
    ['es', es, 'cambiá el teléfono a 098 765 432', 'Teléfono', '098 765 432'], ['es', es, 'notas: alérgico a la penicilina', 'Notas', 'alérgico a la penicilina'],
    ['en', en, 'set phone to 099 123 456', 'Phone', '099 123 456'], ['en', en, 'the email is ana@gmail.com', 'Email', 'ana@gmail.com'], ['en', en, 'write in notes Bring X-rays', 'Notes', 'Bring X-rays'],
  ] as const) {
    test(`«${said}» completa «${field}»`, async () => {
      sim = await createVoiceSim({ locale });
      const win = openWindow(w.title, w);
      await sim.say(said);
      expect(win.values[field]).toBe(value);
    });
  }
  test('un pedido de otro contexto cierra la ventana y hace lo nuevo', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    const win = openWindow(es.title, es);
    await sim.say('vista día');
    expect(win.open).toBe(false);
    expect(sim.cal.state.view).toBe('day');
  });
  test('seguir con el paciente de la ventana no la cierra («cuánto debe» con su cita en foco)', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Juan Pérez');
    const win = openWindow('Estado de cuenta', { buttons: [], fields: [] });
    await sim.say('cuánto debe');
    expect(win.open).toBe(true);
  });
  test('desplazarse dentro de la ventana no la cierra', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    const win = openWindow('Historia clínica');
    await sim.say('bajá');
    expect(win.open).toBe(true);
  });
});

test.describe('CO-SCREEN · El contexto lo da la página, sin apagar el micrófono', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  test('al pasar a otra página cambian los comandos y el micrófono sigue prendido', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    updateVoiceDomains(['lab_orders', 'core']);
    await sim.say('vista día');
    expect(sim.cal.state.view).toBe('week');
    expect(sim.store().alwaysOn).toBe(true);
    updateVoiceDomains(['calendar', 'core']);
    await sim.say('vista día');
    expect(sim.cal.state.view).toBe('day');
  });
  test('lo general (desplazarse) funciona en cualquier página', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    updateVoiceDomains(['core']);
    await sim.say('bajá');
    expect(scrollLog).toHaveLength(1);
  });
});
