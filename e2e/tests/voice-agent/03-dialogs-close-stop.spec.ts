import { expect, test } from '@playwright/test';

import { pickDialogButton, type DialogButton } from '@/lib/voice/dom-dialog';
import { normalizeSpeech } from '@/lib/voice/parse';
import { isStopListeningPhrase } from '@/lib/voice/wake';

import { openToast } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * AV · Avisos, cerrar y dejar de escuchar (docs/voz-agenda-pruebas.md §AV):
 * - el botón de un aviso se elige por su texto, su posición o sí/no;
 * - «cerrá», «close the panel», «cerrá todo» cierran lo que esté abierto (de arriba hacia abajo);
 * - «dejá de escuchar», «pausá el dictado», «stop listening» apagan el micrófono;
 * - «buscar huecos» / «find slots» muestran los huecos (no el buscador de citas).
 */

const buttons = (...specs: Array<[string, DialogButton['kind']]>): DialogButton[] =>
  specs.map(([label, kind]) => ({ label, kind, element: {} as HTMLButtonElement }));

test.describe('AV-DLG · Elegir el botón de un aviso', () => {
  const future = buttons(['Cancelar', 'cancel'], ['Agendar igual', 'confirm']);
  const del = buttons(['No, volver', 'cancel'], ['Sí, eliminar', 'confirm']);
  const three = buttons(['Solo esta', 'other'], ['Esta y las siguientes', 'other'], ['Todas', 'confirm']);
  const cases: Array<[string, DialogButton[], string]> = [
    ['agendar igual', future, 'Agendar igual'], ['cancelar', future, 'Cancelar'], ['sí', future, 'Agendar igual'], ['no', future, 'Cancelar'],
    ['dale', future, 'Agendar igual'], ['continuar', future, 'Agendar igual'], ['volver', future, 'Cancelar'], ['el segundo', future, 'Agendar igual'], ['el primero', future, 'Cancelar'],
    ['sí, eliminar', del, 'Sí, eliminar'], ['eliminar', del, 'Sí, eliminar'], ['no volver', del, 'No, volver'], ['confirmar', del, 'Sí, eliminar'],
    ['solo esta', three, 'Solo esta'], ['esta y las siguientes', three, 'Esta y las siguientes'], ['todas', three, 'Todas'], ['la última', three, 'Todas'], ['la del medio', three, 'Esta y las siguientes'],
    ['yes', future, 'Agendar igual'], ['cancel', future, 'Cancelar'], ['go ahead', future, 'Agendar igual'], ['the second one', future, 'Agendar igual'],
  ];
  for (const [said, list, expected] of cases) {
    test(`«${said}» → ${expected}`, () => {
      expect(pickDialogButton(normalizeSpeech(said), list)?.label).toBe(expected);
    });
  }
  test('algo que no es ningún botón: null (vuelve a preguntar)', () => {
    expect(pickDialogButton(normalizeSpeech('qué lindo día'), future)).toBeNull();
  });
});

test.describe('AV-STOP · Dejar de escuchar', () => {
  const yes = [
    'dejá de escuchar', 'deja de escuchar', 'pará de escuchar', 'pausá el dictado', 'pausar dictado', 'dejá de dictar', 'apagá el micrófono', 'apagar micrófono',
    'desactivá la voz', 'no me escuches más', 'cortá el micrófono', 'detené el dictado', 'listo, dejá de escuchar', 'eso es todo', 'ya pará de escuchar por favor',
    'stop listening', 'stop dictation', 'pause listening', 'turn off the mic', 'mute the microphone', 'mic off', "that's all", 'you can stop listening',
  ];
  for (const said of yes) test(`apaga: «${said}»`, () => { expect(isStopListeningPhrase(normalizeSpeech(said))).toBe(true); });
  const no = ['pará', 'cancelá la cita de Juan', 'dejá fijo el panel', 'pausá', 'stop', 'escuchá esto'];
  for (const said of no) test(`no apaga: «${said}»`, () => { expect(isStopListeningPhrase(normalizeSpeech(said))).toBe(false); });

  test('AV-STOP-01 dicho con el micrófono prendido: se apaga y avisa', async () => {
    const sim = await createVoiceSim({ locale: 'es' });
    await sim.say('dejá de escuchar');
    expect(sim.store().alwaysOn).toBe(false);
    expect(sim.card().message).toMatch(/dejé de escuchar/);
    sim.dispose();
  });
  test('AV-STOP-02 con una pregunta abierta: se apaga y la deja guardada', async () => {
    const sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Ana');
    await sim.say('pausá el dictado');
    expect(sim.store()).toMatchObject({ alwaysOn: false, suspended: true });
    sim.dispose();
  });
  test('AV-STOP-03 en inglés', async () => {
    const sim = await createVoiceSim({ locale: 'en' });
    await sim.say('stop listening please');
    expect(sim.store().alwaysOn).toBe(false);
    sim.dispose();
  });
});

test.describe('AV-CLOSE · Cerrar lo que esté abierto', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());

  for (const [locale, said] of [['es', 'cerrá'], ['es', 'cerralo'], ['es', 'cerrá el panel'], ['es', 'escondé eso'], ['es', 'que no se vea'], ['es', 'no quiero ver eso'], ['es', 'sacalo de ahí'], ['en', 'close'], ['en', 'close the panel'], ['en', 'hide it'], ['en', 'hide the panel'], ['en', "I don't want to see that"]] as const) {
    test(`«${said}» cierra la búsqueda abierta`, async () => {
      sim = await createVoiceSim({ locale });
      await sim.say(locale === 'es' ? 'buscá a Ana Gómez' : 'search Ana Gómez');
      expect(sim.cal.state.searchActive).toBe(true);
      await sim.say(said);
      expect(sim.cal.state.searchActive).toBe(false);
    });
  }
  test('AV-CLOSE-01 cierra lo de arriba primero: configuración antes que el panel de agendas', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.sayAll('abrí el panel de agendas', 'abrí la configuración', 'cerrá');
    expect(sim.cal.state.settingsOpen).toBe(false);
    expect(sim.cal.state.agendasPanel.open).toBe(true);
    await sim.say('cerrá');
    expect(sim.cal.state.agendasPanel.open).toBe(false);
  });
  test('AV-CLOSE-02 «cerrá todo» cierra todo de una', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.sayAll('abrí el panel de agendas', 'buscá a Ana Gómez', 'abrí la configuración', 'cerrá todo');
    expect(sim.cal.state).toMatchObject({ settingsOpen: false, searchActive: false, agendasPanel: { open: false } });
  });
  test('AV-CLOSE-03 «close everything» en inglés', async () => {
    sim = await createVoiceSim({ locale: 'en' });
    await sim.sayAll('open the calendars panel', 'open the settings', 'close everything');
    expect(sim.cal.state).toMatchObject({ settingsOpen: false, agendasPanel: { open: false } });
  });
  test('AV-CLOSE-04 cierra exportar y operaciones en lotes', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    sim.cal.state.bulkMode = true;
    await sim.say('exportá la agenda');
    await sim.say('no');
    await sim.say('cerrá todo');
    expect(sim.cal.state.bulkMode).toBe(false);
  });
  test('AV-CLOSE-05 sin nada abierto lo dice', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('cerrá');
    expect(sim.card().message).toMatch(/No hay nada abierto/);
  });
  test('AV-CLOSE-06 «atrás» con algo abierto lo cierra; sin nada, va para atrás en la agenda', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('buscá a Ana Gómez');
    await sim.say('volvé atrás');
    expect(sim.cal.state.searchActive).toBe(false);
    expect(sim.cal.calls('goToDate')).toEqual([]);
    await sim.say('para atrás');
    expect(sim.cal.calls('goToDate')).toHaveLength(1);
  });
});

test.describe('AV-GAPS · Buscar huecos no es buscar citas', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  for (const [locale, said] of [
    ['es', 'buscar huecos'], ['es', 'buscá huecos'], ['es', 'buscame los huecos libres'], ['es', 'buscá horarios disponibles'], ['es', 'encontrá un turno libre'],
    ['en', 'find slots'], ['en', 'find free slots'], ['en', 'search for open slots'], ['en', 'find available times'], ['en', 'look for openings'], ['en', 'show me the gaps'],
  ] as const) {
    test(`«${said}» muestra los huecos`, async () => {
      sim = await createVoiceSim({ locale });
      await sim.say(said);
      expect(sim.cal.calls('openSearch')).toEqual([]);
      expect(sim.cal.calls('setGapsActive')).toContainEqual([true]);
    });
  }
});

test.describe('AV-TOAST · Notificaciones con botones', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  test('una notificación con botones se lee y ofrece sus botones; «deshacer» lo aprieta', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/appointments' });
    const toast = openToast('Marcas aplicadas', ['Deshacer', 'Ver'], { description: 'Se marcaron 3 piezas.' });
    await sim.wait(40);
    expect(sim.card().title).toBe('Marcas aplicadas');
    expect(sim.card().choices).toEqual(['Deshacer', 'Ver']);
    await sim.say('deshacer');
    expect(toast.pressed).toEqual(['Deshacer']);
  });
  test('por posición: «el segundo»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/appointments' });
    const toast = openToast('Guardado', ['Deshacer', 'Ver']);
    await sim.wait(40);
    await sim.say('el segundo');
    expect(toast.pressed).toEqual(['Ver']);
  });
  test('en «undo»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/appointments' });
    const toast = openToast('Saved', ['Undo', 'View']);
    await sim.wait(40);
    await sim.say('undo');
    expect(toast.pressed).toEqual(['Undo']);
  });
  test('si la notificación se va sola, la pregunta se saca', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/appointments' });
    const toast = openToast('Guardado', ['Deshacer']);
    await sim.wait(40);
    toast.close();
    await sim.wait(40);
    expect(sim.store().awaiting).toBeNull();
  });
});
