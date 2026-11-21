import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N1 · Atómicos en español: agendas, doctores, sedes, agrupar, panel de agendas, buscar, huecos,
 * actualizar y TODO el engranaje (docs/voz-agenda-pruebas.md §N1.5–N1.9). Sin IA.
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

const noAi = () => expect(sim.aiCalls.map((c) => c.text)).toEqual([]);

test.describe('N1.5 · Agendas, doctores y sedes', () => {
  test('VZ-ES-040 «qué agendas hay» lista y «la segunda» la muestra (modo personalizado)', async () => {
    await sim.say('Invoke qué agendas hay');
    expect(sim.card().choices).toEqual(['Sillón 1', 'Sillón 2', 'Ortodoncia']);
    await sim.say('la segunda');
    expect(sim.cal.state.activeCalendarId).toBe('c2');
    noAi();
  });
  test('VZ-ES-041 «cambiá de agenda» y se elige por nombre', async () => {
    await sim.say('Invoke cambiá de agenda');
    await sim.say('ortodoncia');
    expect(sim.cal.state.activeCalendarId).toBe('c3');
  });
  test('VZ-ES-042 «mostrá la agenda ortodoncia» directo', async () => {
    await sim.say('Invoke solo la agenda ortodoncia');
    expect(sim.cal.state.activeCalendarId).toBe('c3');
  });
  test('VZ-ES-043 «solo el doctor Pérez» filtra doctores', async () => {
    await sim.say('Invoke solo el doctor Pérez');
    expect(sim.cal.state.selectedDoctorIds).toEqual(['d1']);
  });
  test('VZ-ES-044 «todos los doctores» saca el filtro', async () => {
    await sim.say('Invoke solo el doctor Pérez');
    await sim.say('todos los doctores');
    expect(sim.cal.state.selectedDoctorIds).toEqual(['d1', 'd2', 'd3']);
  });
  test('VZ-ES-045 «qué doctores hay» y «la de abajo»', async () => {
    await sim.say('Invoke qué doctores hay');
    await sim.say('la de abajo');
    expect(sim.cal.state.selectedDoctorIds).toEqual(['d3']);
  });
});

test.describe('N1.6 · Agrupar (modo Invoke)', () => {
  test.beforeEach(async () => { sim.dispose(); sim = await createVoiceSim({ locale: 'es', customMode: false }); });
  test('VZ-ES-050 agrupá por doctor', async () => {
    await sim.say('Invoke agrupá por doctor');
    expect(sim.cal.state.groupBy).toBe('doctor');
  });
  test('VZ-ES-051 sin agrupar', async () => {
    await sim.say('Invoke agrupá por agenda');
    await sim.say('sin agrupar');
    expect(sim.cal.state.groupBy).toBe('none');
  });
  test('VZ-ES-052 «sacá la sede Pocitos» saca sus agendas', async () => {
    await sim.say('Invoke sacá la sede Pocitos');
    expect(sim.cal.state.selectedCalendarIds).toEqual(['c1', 'c2']);
  });
});

test.describe('N1.7 · Panel de agendas', () => {
  test('VZ-ES-060 abrí el panel de agendas', async () => {
    await sim.say('Invoke abrí el panel de agendas');
    expect(sim.cal.state.agendasPanel.open).toBe(true);
  });
  test('VZ-ES-061 cerrá el panel', async () => {
    await sim.say('Invoke abrí el panel de agendas');
    await sim.say('cerrá el panel');
    expect(sim.cal.state.agendasPanel.open).toBe(false);
  });
  test('VZ-ES-062 «dejá fijo el panel» lo fija y lo abre', async () => {
    await sim.say('Invoke dejá fijo el panel');
    expect(sim.cal.state.agendasPanel).toEqual({ open: true, pinned: true });
  });
  test('VZ-ES-063 «que el panel se esconda solo» lo suelta', async () => {
    await sim.say('Invoke dejá fijo el panel');
    await sim.say('que el panel se esconda solo');
    expect(sim.cal.state.agendasPanel.pinned).toBe(false);
  });
  test('VZ-ES-064 en modo Invoke ofrece pasar a personalizado; «sí» cambia el modo y abre el panel', async () => {
    sim.dispose();
    sim = await createVoiceSim({ locale: 'es', customMode: false });
    await sim.say('Invoke abrí el panel de agendas');
    expect(sim.card().awaiting).toBe('confirm');
    await sim.say('sí');
    expect(sim.cal.state.settings?.mode).toBe('custom');
    expect(sim.cal.state.agendasPanel.open).toBe(true);
  });
  test('VZ-ES-065 en modo Invoke «no» no cambia nada', async () => {
    sim.dispose();
    sim = await createVoiceSim({ locale: 'es', customMode: false });
    await sim.say('Invoke abrí el panel de agendas');
    await sim.say('no');
    expect(sim.cal.calls('updateSettings')).toEqual([]);
  });
});

test.describe('N1.8 · Buscar, huecos, consultas y actualizar', () => {
  test('VZ-ES-070 buscá a Ana Gómez abre el buscador', async () => {
    await sim.say('Invoke buscá a Ana Gómez');
    expect(sim.cal.calls('openSearch')[0]).toEqual(['ana gomez']);
  });
  test('VZ-ES-071 cerrá la búsqueda', async () => {
    await sim.say('Invoke buscá a Ana Gómez');
    await sim.say('cerrá la búsqueda');
    expect(sim.cal.state.searchActive).toBe(false);
  });
  test('VZ-ES-072 ¿qué tengo hoy? lee la agenda del día', async () => {
    await sim.say('Invoke qué tengo hoy');
    expect(sim.card().message).toMatch(/4 citas|cuatro citas/i);
  });
  test('VZ-ES-073 ¿cuándo viene Pedro Sánchez?', async () => {
    await sim.say('Invoke cuándo viene Pedro Sánchez');
    expect(`${sim.card().message} ${sim.card().rows.join(' ')}`).toContain('Pedro Sánchez');
  });
  test('VZ-ES-074 actualizá', async () => {
    await sim.say('Invoke actualizá');
    expect(sim.cal.calls('refresh').length).toBe(1);
  });
  test('VZ-ES-075 ocultá los huecos', async () => {
    await sim.say('Invoke ocultá los huecos');
    expect(sim.cal.calls('setGapsActive')).toContainEqual([false]);
  });
});

test.describe('N1.9 · Engranaje (preferencias)', () => {
  const settings = () => sim.cal.state.settings!;
  test('VZ-ES-080 abrí la configuración', async () => {
    await sim.say('Invoke abrí la configuración');
    expect(sim.cal.state.settingsOpen).toBe(true);
  });
  test('VZ-ES-081 cerrá la configuración', async () => {
    await sim.say('Invoke abrí la configuración');
    await sim.say('cerrá la configuración');
    expect(sim.cal.state.settingsOpen).toBe(false);
  });
  test('VZ-ES-082 modo Invoke', async () => {
    await sim.say('Invoke poné el modo invoke');
    expect(settings().mode).toBe('invoke');
  });
  test('VZ-ES-083 modo personalizado', async () => {
    await sim.say('Invoke poné el modo invoke');
    await sim.say('modo personalizado');
    expect(settings().mode).toBe('custom');
  });
  for (const [said, value] of [['vista predeterminada día', 'day'], ['que arranque en semana', 'week'], ['por defecto 2 días', '2_days'], ['vista por defecto mes', 'month'], ['vista predeterminada agenda', 'agenda']] as const) {
    test(`VZ-ES-084 «${said}» → default_view ${value}`, async () => {
      await sim.say(`Invoke ${said}`);
      expect(settings().default_view).toBe(value);
    });
  }
  test('VZ-ES-085 altura de la hora 120', async () => {
    await sim.say('Invoke altura de la hora 120');
    expect(settings().hour_height).toBe(120);
  });
  test('VZ-ES-086 hora más alta (un paso)', async () => {
    await sim.say('Invoke horas más altas');
    expect(settings().hour_height).toBe(100);
  });
  test('VZ-ES-087 la altura de la hora la más grande', async () => {
    await sim.say('Invoke la altura de la hora la más grande');
    expect(settings().hour_height).toBe(200);
  });
  test('VZ-ES-088 la altura de la hora la más chica', async () => {
    await sim.say('Invoke la altura de la hora la más chica');
    expect(settings().hour_height).toBe(60);
  });
  for (const [said, minutes] of [['slots de 10 minutos', 10], ['slots de 15', 15], ['intervalos de 30 minutos', 30], ['slots de una hora', 60], ['slots de 5 minutos', 5]] as const) {
    test(`VZ-ES-089 «${said}» → ${minutes}`, async () => {
      await sim.say(`Invoke ${said}`);
      expect(settings().slot_duration).toBe(minutes);
    });
  }
  test('VZ-ES-090 sede por defecto Pocitos', async () => {
    await sim.say('Invoke sede por defecto Pocitos');
    expect(settings().default_sede).toBe('s2');
  });
  test('VZ-ES-091 sede por defecto todas', async () => {
    await sim.say('Invoke sede por defecto Pocitos');
    await sim.say('sede por defecto todas');
    expect(settings().default_sede).toBe('');
  });
  test('VZ-ES-092 sede por defecto desconocida pregunta cuál', async () => {
    await sim.say('Invoke sede por defecto Carrasco');
    expect(sim.card().choices).toEqual(['Centro', 'Pocitos']);
    await sim.say('la primera');
    expect(settings().default_sede).toBe('s1');
  });
  for (const [said, format] of [
    ['título de la cita hora paciente y notas', 'time_patient_notes'],
    ['formato del título paciente tratamiento y hora', 'patient_treatment_time'],
    ['título hora paciente notas y tratamiento', 'time_patient_notes_treatment'],
    ['título hora tratamiento paciente y notas', 'time_treatment_patient_notes'],
  ] as const) {
    test(`VZ-ES-093 «${said}»`, async () => {
      await sim.say(`Invoke ${said}`);
      expect(settings().event_label_format).toBe(format);
    });
  }
  test('VZ-ES-094 ocultá los sábados y domingos', async () => {
    await sim.say('Invoke ocultá los sábados y domingos');
    expect([...settings().hidden_weekdays!].sort()).toEqual([0, 6]);
  });
  test('VZ-ES-095 ocultá el fin de semana y después mostrá los sábados', async () => {
    await sim.say('Invoke ocultá el fin de semana');
    await sim.say('mostrá los sábados');
    expect(settings().hidden_weekdays).toEqual([0]);
  });
  test('VZ-ES-096 mostrá todos los días', async () => {
    await sim.say('Invoke ocultá los lunes');
    await sim.say('mostrá todos los días');
    expect(settings().hidden_weekdays).toEqual([]);
  });
  test('VZ-ES-097 franja horaria completa', async () => {
    await sim.say('Invoke franja horaria completa');
    expect(settings().visible_hours_mode).toBe('full');
  });
  test('VZ-ES-098 horario de la clínica', async () => {
    await sim.say('Invoke mostrá el horario de la clínica');
    expect(settings().visible_hours_mode).toBe('clinic');
  });
  test('VZ-ES-099 rango personalizado de 8 a 6 (hasta las 18)', async () => {
    await sim.say('Invoke rango personalizado de 8 a 6');
    expect(settings()).toMatchObject({ visible_hours_mode: 'custom', visible_hours_start: '08:00', visible_hours_end: '18:00' });
  });
  const flags = [
    ['activá colores por estado', 'color_by_status', true], ['sin colores por estado', 'color_by_status', false],
    ['activá verificar disponibilidad', 'check_availability', true], ['desactivá verificar disponibilidad', 'check_availability', false],
    ['bloqueá fuera de horario', 'block_unavailable', true], ['permití agendar fuera de horario', 'block_unavailable', false],
    ['filtrá los doctores por servicio', 'filter_doctors_by_service', true], ['no filtres los doctores por servicio', 'filter_doctors_by_service', false],
    ['crear citas en el calendario', 'inline_appointment_creation', true], ['que abra el modal', 'inline_appointment_creation', false],
    ['activá la vista previa en vivo', 'inline_draft_live_preview', true], ['apagá la vista previa en vivo', 'inline_draft_live_preview', false],
  ] as const;
  for (const [said, key, value] of flags) {
    test(`VZ-ES-100 «${said}» → ${key} ${value}`, async () => {
      await sim.say(`Invoke ${said}`);
      expect(settings()[key]).toBe(value);
    });
  }
  test('VZ-ES-101 varias juntas: «slots de 15 y vista predeterminada semana»', async () => {
    await sim.say('Invoke slots de 15 y vista predeterminada semana');
    expect(settings()).toMatchObject({ slot_duration: 15, default_view: 'week' });
    expect(sim.cal.calls('updateSettings').length).toBe(1);
  });
  test('VZ-ES-102 si no se puede guardar lo dice', async () => {
    sim.cal.failNextSettingsSave = true;
    await sim.say('Invoke slots de 10 minutos');
    expect(sim.card().tone).toBe('error');
  });
  test('VZ-ES-103 no deja ocultar todos los días', async () => {
    await sim.say('Invoke ocultá los lunes martes miércoles jueves viernes sábados y domingos');
    expect(sim.card().tone).toBe('error');
    expect(settings().hidden_weekdays).toEqual([]);
  });
});
