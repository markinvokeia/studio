import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';
import { publishSimWorkspace } from './sim/workspace';
import { useVoiceCommand } from '@/stores/voice-command-store';

/**
 * MC · Mi consultorio por voz (src/lib/voice/commands/workspace.ts): elegir la cita, preguntar la
 * agenda, las acciones sobre la cita elegida (sesión, receta, laboratorio, estética, perio, ficha,
 * anamnesis, odontograma) y los filtros. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const log = () => sim.workspace()!.log;
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route: '/workspace' }); };

test.describe('MC-SELECT · Elegir la cita', () => {
  for (const [locale, said, want] of [
    ['es', 'el de las 10', 'select:w2'], ['es', 'abrí la cita de las 10 y media', 'select:w3'], ['es', 'el paciente de las 3 y media', 'select:w4'],
    ['es', 'el siguiente', 'select:w1'], ['es', 'el próximo paciente', 'select:w1'], ['es', 'abrí la cita de Carlos', 'select:w3'],
    ['es', 'pasá al de Sofía Castro', 'select:w4'], ['es', 'el último', 'select:w4'], ['es', 'atendé a Juan', 'select:w2'],
    ['es-ES', 'abre la cita de las 9', 'select:w1'], ['en', 'the 10 o clock', 'select:w2'], ['en', 'open the appointment at 3 30 pm', 'select:w4'],
    ['en', 'next patient', 'select:w1'], ['en', "open Carlos's appointment", 'select:w3'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«el siguiente» después del elegido sigue al que viene', async () => {
    await start();
    await sim.sayAll('el de las 10', 'el siguiente');
    expect(log()).toEqual(['select:w2', 'select:w3']);
  });
  test('«el anterior»', async () => { await start(); await sim.sayAll('el de las 10', 'el anterior'); expect(log()).toEqual(['select:w2', 'select:w1']); });
  test('hora que no está: lo dice', async () => { await start(); await sim.say('el de las 8'); expect(sim.card().message).toBe('No encontré esa cita en la agenda que se está viendo.'); });
});

test.describe('MC-READ · Preguntar la agenda', () => {
  test('«¿quién sigue?»', async () => { await start(); await sim.say('quién sigue'); expect(sim.card().message).toBe('Sigue Ana Gómez a las 09:00 (Limpieza).'); expect(log()).toEqual([]); });
  test('«qué pacientes tengo»', async () => { await start(); await sim.say('qué pacientes tengo'); expect(sim.card().message).toBe('Tenés 4 citas; la primera: 09:00 Ana Gómez.'); expect(sim.card().rows).toHaveLength(4); });
  test('«qué pacientes tengo mañana» cambia el día y lee', async () => {
    await start();
    await sim.say('qué pacientes tengo mañana');
    expect(log()).toEqual(['preset:tomorrow']);
    expect(sim.card().message).toBe('Tenés 1 cita; la primera: 11:00 María Rodríguez.');
  });
  test('es-ES «qué pacientes tengo»', async () => { await start('es-ES'); await sim.say('qué pacientes tengo'); expect(sim.card().message).toMatch(/^Tienes 4 citas/); });
  test('en «who is next» y «what is on my schedule»', async () => {
    await start('en');
    await sim.say('who is next');
    expect(sim.card().message).toBe('Next is Ana Gómez at 09:00 (Limpieza).');
    await sim.say('what is on my schedule');
    expect(sim.card().message).toMatch(/^You have 4 appointments/);
  });
});

test.describe('MC-ACTION · Acciones sobre la cita', () => {
  for (const [said, want] of [
    ['nueva sesión', 'session'], ['registrá la sesión', 'session'], ['recetale', 'prescribe'], ['hacé una receta', 'prescribe'],
    ['orden de laboratorio', 'labOrder'], ['abrí una sesión estética', 'aesthetic'], ['abrí el periodontograma', 'perio'],
    ['abrí la ficha', 'file:-'], ['mostrame la anamnesis', 'file:anamnesis'], ['abrí la línea de tiempo', 'file:timeline'],
    ['mostrame el odontograma', 'panel:odontogram'], ['volvé a las sesiones', 'panel:sessions'],
  ] as const) {
    test(`con la cita elegida «${said}»`, async () => { await start(); await sim.say('el de las 10'); log().length = 0; await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('con el paciente en la frase: elige y hace', async () => {
    await start();
    await sim.say('nueva sesión para Carlos');
    expect(log()).toEqual(['select:w3', 'session']);
  });
  test('«recetale a Sofía»', async () => { await start(); await sim.say('recetale a Sofía'); expect(log()).toEqual(['select:w4', 'prescribe']); });
  test('«orden de laboratorio para el de las 10»', async () => { await start(); await sim.say('hacé una orden de laboratorio para el de las 10'); expect(log()).toEqual(['select:w2', 'labOrder']); });
  test('sin cita elegida: la pide', async () => { await start(); await sim.say('nueva sesión'); expect(sim.card().message).toBe('Primero elegí la cita: por ejemplo «el de las 10».'); });
  test('cita futura: dice por qué no', async () => {
    await start();
    sim.workspace()!.log.length = 0;
    const blocked = publishSimWorkspace({ blocked: 'futureDate' });
    await sim.sayAll('el de las 10', 'nueva sesión');
    expect(blocked.log).toEqual(['select:w2']);
    expect(sim.card().message).toMatch(/todavía no pasó/);
  });
  test('«abrí la ficha de alguien que no está en la agenda» va al buscador del panel derecho', async () => {
    await start();
    await sim.say('abrí la ficha de Roberto Díaz');
    expect(log()).toEqual([]);
    expect(sim.card().message).toBe('Abrí la ficha de Roberto Díaz.');
  });
  test('en «new session» y «prescribe»', async () => {
    await start('en');
    await sim.sayAll('the 10 o clock', 'new session', 'prescribe', 'open the periodontal chart');
    expect(log()).toEqual(['select:w2', 'session', 'prescribe', 'perio']);
  });
});

test.describe('MC-FILTER · Lo que muestra la agenda', () => {
  for (const [said, want] of [
    ['mostrame mañana', 'preset:tomorrow'], ['esta semana', 'preset:week'], ['los próximos 7 días', 'preset:next7'], ['ver este mes', 'preset:month'],
    ['el mes que viene', 'preset:nextMonth'], ['mostrame el mes pasado', 'preset:prevMonth'], ['mis citas', 'view:mine'],
    ['ver la agenda Sillón 2', 'calendar:c2'], ['actualizá la agenda', 'refresh'],
  ] as const) {
    test(`«${said}»`, async () => { await start(); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«las agendas» pregunta cuál', async () => { await start(); await sim.say('ver las agendas'); await sim.say('la primera'); expect(log()).toEqual(['calendar:c1']); });
  test('«mostrame del 1 al 15»', async () => { await start(); await sim.say('mostrame del 1 al 15'); expect(log()[0]).toMatch(/^range:\d{4}-\d{2}-01\.\.\d{4}-\d{2}-15$/); });
  test('en «show me tomorrow» y «my appointments»', async () => { await start('en'); await sim.sayAll('show me tomorrow', 'my appointments'); expect(log()).toEqual(['preset:tomorrow', 'view:mine']); });
});

test.describe('MC-FILTER2 · Pestañas, calendario y fecha (también juntos)', () => {
  const day = (rx: RegExp) => (l: string[]) => expect(l.some((x) => rx.test(x))).toBe(true);
  for (const [locale, said, want] of [
    ['es', 'asignadas a mí', ['view:mine']], ['es', 'mostrame las asignadas a mí', ['view:mine']], ['es', 'mis citas', ['view:mine']],
    ['es', 'pasá a mis calendarios', ['calendar:c1']], ['es', 'mis calendarios', ['calendar:c1']], ['es', 'el calendario sillón 2', ['calendar:c2']],
    ['es', 'mostrame el sillón 2', ['calendar:c2']], ['es', 'mis citas de mañana', ['view:mine', 'preset:tomorrow']],
    ['es', 'el sillón 2 mañana', ['calendar:c2', 'preset:tomorrow']], ['es', 'las citas de mañana', ['preset:tomorrow']],
    ['es', 'la semana que viene', ['preset:next7']], ['es', 'mostrame el mes', ['preset:month']], ['es', 'hoy', ['preset:today']], ['es', 'volvé a hoy', ['preset:today']],
    ['es-ES', 'enséñame mis calendarios', ['calendar:c1']], ['es-ES', 'las asignadas a mí', ['view:mine']],
    ['en', 'assigned to me', ['view:mine']], ['en', 'my calendars', ['calendar:c1']], ['en', 'appointments for tomorrow', ['preset:tomorrow']], ['en', 'the calendar Sillón 2', ['calendar:c2']],
  ] as const) {
    test(`${locale} «${said}»`, async () => {
      sim = await createVoiceSim({ locale, route: '/workspace' });
      // «mis calendarios» sin decir cuál: con varios pregunta; se elige el primero.
      await sim.say(said);
      if (sim.store().awaiting === 'choice') await sim.say(locale === 'en' ? 'the first one' : 'el primero');
      expect(log()).toEqual([...want]);
      expect(sim.navigations).toEqual([]);
    });
  }
  for (const [said, rx] of [
    ['el martes', /^range:(\d{4}-\d{2}-\d{2})\.\.\1$/], ['la agenda del martes', /^range:(\d{4}-\d{2}-\d{2})\.\.\1$/], ['el 15 de diciembre', /^range:\d{4}-12-15\.\.\d{4}-12-15$/],
    ['la semana pasada', /^range:/], ['desde el 1 hasta el 10', /^range:\d{4}-\d{2}-01\.\.\d{4}-\d{2}-10$/], ['del 1 al 10 de diciembre', /^range:\d{4}-12-01\.\.\d{4}-12-10$/],
    ['las citas del mes pasado', /^range:\d{4}-\d{2}-01\.\./], ['show last week', /^range:/],
  ] as const) {
    test(`«${said}»`, async () => { sim = await createVoiceSim({ locale: /^show/.test(said) ? 'en' : 'es', route: '/workspace' }); await sim.say(said); day(rx)(log()); expect(sim.navigations).toEqual([]); });
  }
  test('«¿qué tengo el viernes?» pone el día y lee la agenda', async () => {
    await start();
    await sim.say('qué tengo el viernes');
    expect(log()[0]).toMatch(/^range:(\d{4}-\d{2}-\d{2})\.\.\1$/);
    expect(sim.card().message).toMatch(/^(?:Tenés \d+ citas|No hay citas)/);
  });
  test('con el caso clínico abierto, las fechas siguen siendo de la agenda (no van al agente)', async () => {
    await start();
    await sim.sayAll('el de las 9', 'mis citas de mañana');
    expect(log()).toEqual(['select:w1', 'view:mine', 'preset:tomorrow']);
    expect(sim.workspace()!.agentLog).toEqual([]);
  });
  test('«le hice una limpieza hoy» no es un filtro', async () => {
    await start();
    await sim.sayAll('el de las 9', 'le hice una limpieza hoy');
    expect(log()).toEqual(['select:w1', 'agent:prepare']);
    expect(sim.workspace()!.agentLog).toEqual(['w1:le hice una limpieza hoy']);
  });
});

test.describe('MC-SWITCH · Cambiar de caso clínico (de paciente)', () => {
  for (const [locale, said, want] of [
    ['es', 'cambiá de Ana a Juan', 'select:w2'], ['es', 'cambia de Ana Gómez a Juan Pérez', 'select:w2'], ['es', 'seleccioná a Juan', 'select:w2'],
    ['es', 'pasá a Juan', 'select:w2'], ['es', 'cambiá a Carlos', 'select:w3'], ['es', 'ahora Sofía', 'select:w4'], ['es', 'quiero ver a Juan', 'select:w2'],
    ['es', 'cambiá al paciente Carlos López', 'select:w3'], ['es', 'abrí el caso de Sofía', 'select:w4'],
    ['es-ES', 'cambia de Ana a Juan', 'select:w2'], ['es-ES', 'selecciona a Carlos', 'select:w3'],
    ['en', 'switch from Ana to Juan', 'select:w2'], ['en', 'select Carlos', 'select:w3'], ['en', 'switch to Sofía', 'select:w4'],
    ['es', 'cerrá este caso clínico y abrí el de Juan', 'select:w2'], ['es', 'cerrá el caso y ahora el de Carlos', 'select:w3'],
    ['es', 'quiero ver ahora el de Sofía', 'select:w4'], ['es', 'ahora el de Juan Pérez', 'select:w2'], ['es', 'mostrame el caso de Carlos', 'select:w3'],
    ['es', 'abrí el caso de Juan', 'select:w2'], ['es-ES', 'cierra este caso y abre el de Juan', 'select:w2'], ['en', 'close this case and open Carlos', 'select:w3'],
    ['en', 'now the one of Juan', 'select:w2'],
    ['es', 'ahora el de las 15:30', 'select:w4'], ['es', 'y ahora el de las 10', 'select:w2'], ['es-ES', 'ahora el de las 10:30', 'select:w3'], ['en', 'now the one at 10:30', 'select:w3'],
    ['es', 'el paciente Juan', 'select:w2'], ['es', 'paciente Carlos', 'select:w3'], ['es', 'el siguiente paciente', 'select:w2'], ['es', 'el paciente siguiente', 'select:w2'],
    ['es', 'el último paciente', 'select:w4'], ['es', 'el primer paciente', 'select:w1'], ['en', 'the next patient', 'select:w2'], ['en', 'the patient Carlos', 'select:w3'],
  ] as const) {
    test(`${locale} «${said}»`, async () => {
      sim = await createVoiceSim({ locale, route: '/workspace' });
      await sim.say(locale === 'en' ? 'the 9 o clock' : 'el de las 9');
      await sim.say(said);
      expect(log()).toEqual(['select:w1', want]);
      expect(sim.workspace()!.agentLog).toEqual([]);
      expect(useVoiceCommand.getState().clinicalCase?.appointmentId).toBe(want.slice(7));
    });
  }
  test('un nombre que no está en la lista no cambia de caso', async () => {
    await start();
    await sim.sayAll('el de las 9', 'cambiá a Roberto');
    expect(log()).toEqual(['select:w1']);
  });
});

test.describe('MC-DATE · Cambiar la fecha', () => {
  for (const [locale, said, rx] of [
    ['es', 'cambiá la fecha al martes', /^range:(\d{4}-\d{2}-\d{2})\.\.\1$/], ['es', 'cambiá la fecha a mañana', /^preset:tomorrow$/],
    ['es', 'poné la fecha de mañana', /^preset:tomorrow$/], ['es-ES', 'cambia la fecha a mañana', /^preset:tomorrow$/],
    ['en', 'change the date to tomorrow', /^preset:tomorrow$/], ['es', 'mis citas asignadas a mí', /^view:mine$/],
  ] as const) {
    test(`${locale} «${said}»`, async () => { sim = await createVoiceSim({ locale, route: '/workspace' }); await sim.say(said); expect(log()[0]).toMatch(rx); });
  }
  test('«cambialo de fecha» pregunta cuál', async () => {
    await start();
    await sim.say('cambialo de fecha');
    expect(sim.card().message).toMatch(/^¿Qué fecha querés ver\?/);
    await sim.say('el 15 de diciembre');
    expect(log()).toEqual([expect.stringMatching(/^range:\d{4}-12-15\.\.\d{4}-12-15$/)]);
  });
  test('en «change the date» asks which', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/workspace' });
    await sim.sayAll('change the date', 'tomorrow');
    expect(log()).toEqual(['preset:tomorrow']);
  });
});

test.describe('MC-NAV · Llegar y seguir', () => {
  test('«andá a mi consultorio y abrí el de las 10»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a mi consultorio y abrí el de las 10');
    expect(sim.navigations).toEqual(['/workspace']);
    expect(log()).toEqual(['select:w2']);
  });
});
