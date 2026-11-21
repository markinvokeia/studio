import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N5 · Información y acciones del paciente (docs/voz-agenda-pruebas.md §N5), en español y en
 * inglés. Se contesta con los registros del paciente (lo que muestra su perfil), SIN pedir que se
 * elija una cita. Juan Pérez: vino 5 veces, faltó 2 (la última el 10/9/2026), canceló 1 tarde,
 * debe 1.200 UYU, último pago 500 UYU el 5/10/2026 con tarjeta, 2 presupuestos (1 sin facturar),
 * 2 facturas (1 sin pagar del todo), ortodoncia en curso 3 de 10. Sofía Castro: sin registros.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());

const rows = () => sim.card().rows.join(' | ');

test.describe('N5.ES · Información del paciente (español)', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });

  test('VZ-ES-500 ¿cuántas veces vino Juan Pérez? (no pregunta qué cita)', async () => {
    await sim.say('cuántas veces vino Juan Pérez');
    expect(sim.card().choices).toEqual([]);
    expect(rows()).toContain('Vino: 5');
    expect(sim.cal.calls('getPatientFacts')[0]).toEqual(['p2', ['appointments']]);
  });
  test('VZ-ES-501 ¿cuántas citas canceló Juan Pérez?', async () => {
    await sim.say('cuántas citas canceló Juan Pérez');
    expect(rows()).toContain('Canceló: 1');
  });
  test('VZ-ES-502 ¿cuántas veces faltó Juan Pérez?', async () => {
    await sim.say('cuántas veces faltó Juan Pérez');
    expect(rows()).toMatch(/Faltó: 2 · 10 de septiembre de 2026/);
  });
  test('VZ-ES-503 ¿cuándo fue la última vez que no vino? (paciente en foco)', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('cuándo fue la última vez que no vino');
    expect(rows()).toContain('10 de septiembre de 2026');
  });
  test('VZ-ES-504 ¿cuándo fue su última visita?', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('cuál fue su última visita');
    expect(rows()).toContain('Última visita: 1 de octubre de 2026');
  });
  test('VZ-ES-505 ¿tiene deudas?', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('tiene deudas');
    expect(rows()).toMatch(/Deuda: .*1[.,]200/);
  });
  test('VZ-ES-506 ¿cuál fue el último pago que hizo Juan Pérez?', async () => {
    await sim.say('cuál fue el último pago que hizo Juan Pérez');
    expect(rows()).toMatch(/Último pago: .*500.* · 5 de octubre de 2026/);
  });
  test('VZ-ES-507 ¿cuánto pagó en total?', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('cuánto ha pagado');
    expect(rows()).toMatch(/Pagado: .*4[.,]500/);
  });
  test('VZ-ES-508 ¿en qué estado están sus presupuestos?', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('en qué estado están sus presupuestos');
    expect(rows()).toContain('Presupuestos: 2 · 1 sin facturar');
  });
  test('VZ-ES-509 ¿tiene facturas sin pagar?', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('qué facturas tiene');
    expect(rows()).toContain('Facturas: 2 · 1 sin pagar');
  });
  test('VZ-ES-510 ¿qué tratamientos tiene en curso?', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('qué tratamientos tiene en curso');
    expect(rows()).toContain('Ortodoncia, 3 de 10 sesiones');
  });
  test('VZ-ES-511 varias preguntas juntas: «cuántas veces faltó y si tiene deudas»', async () => {
    await sim.say('Juan Pérez cuántas veces faltó y si tiene deudas');
    expect(rows()).toMatch(/Faltó: 2/);
    expect(rows()).toMatch(/Deuda/);
  });
  test('VZ-ES-512 estadísticas del paciente (resumen completo)', async () => {
    await sim.say('dame las estadísticas de Juan Pérez');
    for (const label of ['Vino', 'Faltó', 'Canceló', 'Deuda', 'Último pago', 'Presupuestos', 'Tratamientos']) expect(rows()).toContain(label);
  });
  test('VZ-ES-513 paciente sin citas: lo busca en el buscador de pacientes y contesta', async () => {
    await sim.say('cuántas veces vino Sofía Castro');
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p9');
    expect(rows()).toContain('Vino: 0');
  });
  test('VZ-ES-514 sin decir de quién ni foco: pregunta el paciente', async () => {
    await sim.say('tiene deudas');
    expect(sim.card().message).toMatch(/paciente/i);
    await sim.say('Juan Pérez');
    expect(rows()).toMatch(/Deuda/);
  });
  test('VZ-ES-515 sin permiso de cuentas: no dice lo financiero (y lo aclara)', async () => {
    sim.cal.state.canViewAccounts = false;
    await sim.say('cuánto debe Juan Pérez');
    expect(rows()).not.toMatch(/Deuda/);
    expect(sim.card().tone).toBe('error');
  });
  test('VZ-ES-516 la información no cancela una pregunta abierta (herramienta)', async () => {
    await sim.say('la cita de Ana');
    await sim.say('y cuántas veces vino Juan Pérez');
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p2');
    // Se mostró la respuesta y se volvió a la pregunta que estaba abierta.
    expect(sim.card().choices).toHaveLength(2);
  });
});

test.describe('N5.ES · Acciones del paciente (español)', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
  for (const [said, action] of [
    ['creá un presupuesto para Juan Pérez', 'quote'],
    ['hacé una factura para Juan Pérez', 'invoice'],
    ['vamos a crear un tratamiento para Juan Pérez', 'treatment'],
    ['abrí el cobro rápido de Juan Pérez', 'bill'],
  ] as const) {
    test(`VZ-ES-52x «${said}» → ${action}`, async () => {
      await sim.say(said);
      expect(sim.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p2', action]);
    });
  }
  test('VZ-ES-525 registrar la sesión clínica usa la cita del paciente', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('registrá la sesión clínica');
    expect(sim.cal.calls('openPatientAction')[0]).toEqual(['p2', 'session', 'a2']);
  });
  test('VZ-ES-526 sesión clínica de un paciente sin cita: lo dice', async () => {
    await sim.say('registrá la sesión clínica de Sofía Castro');
    expect(sim.card().tone).toBe('error');
  });
  test('VZ-ES-527 presupuesto para el paciente en foco', async () => {
    await sim.say('la cita de Carlos López');
    await sim.say('nuevo presupuesto');
    expect(sim.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p4', 'quote']);
  });
});

test.describe('N5.EN · Patient information and actions (English)', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'en' }); });
  test('VZ-EN-500 how many times has Juan Pérez come', async () => {
    await sim.say('how many times has Juan Pérez come');
    expect(rows()).toContain('Visits: 5');
  });
  test('VZ-EN-501 how many no shows does Juan Pérez have', async () => {
    await sim.say('how many no shows does Juan Pérez have');
    expect(rows()).toMatch(/No-shows: 2 · September 10, 2026/);
  });
  test('VZ-EN-502 how many cancellations', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('how many cancellations');
    expect(rows()).toContain('Cancelled: 1');
  });
  test('VZ-EN-503 does he owe anything', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('does he owe anything');
    expect(rows()).toMatch(/Owes: .*1,200/);
  });
  test('VZ-EN-504 last payment', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('what was the last payment');
    expect(rows()).toMatch(/Last payment: .*500.* · October 5, 2026/);
  });
  test('VZ-EN-505 quotes status', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('what is the status of his quotes');
    expect(rows()).toContain('Quotes: 2 · 1 not invoiced');
  });
  test('VZ-EN-506 treatments in progress', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('which treatments are in progress');
    expect(rows()).toContain('Orthodontics'.replace('Orthodontics', 'Ortodoncia'));
  });
  test('VZ-EN-507 stats for Juan Pérez', async () => {
    await sim.say('give me the stats for Juan Pérez');
    for (const label of ['Visits', 'No-shows', 'Cancelled', 'Owes', 'Last payment', 'Quotes', 'Treatments']) expect(rows()).toContain(label);
  });
  for (const [said, action] of [['create a quote for Juan Pérez', 'quote'], ['new invoice for Juan Pérez', 'invoice'], ['new treatment for Juan Pérez', 'treatment'], ['quick charge for Juan Pérez', 'bill']] as const) {
    test(`VZ-EN-51x «${said}» → ${action}`, async () => {
      await sim.say(said);
      expect(sim.cal.calls('openPatientAction')[0]?.slice(0, 2)).toEqual(['p2', action]);
    });
  }
  test('VZ-EN-515 record the clinical session (focus)', async () => {
    await sim.say("Juan Pérez's appointment");
    await sim.say('record the clinical session');
    expect(sim.cal.calls('openPatientAction')[0]).toEqual(['p2', 'session', 'a2']);
  });
});
