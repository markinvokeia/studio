import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * PA · Pacientes por voz (src/lib/voice/commands/patients.ts): buscar y abrir, filtros, nuevo
 * paciente, pestañas y acciones de la ficha, y preguntas sobre el paciente (deuda, visitas, último
 * pago…). Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const log = () => sim.patients()!.log;
const rows = () => sim.card().rows.join(' | ');
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route: '/patients' }); };

test.describe('PA-LIST · Buscar, abrir, filtrar', () => {
  test('«buscá a Roberto Díaz» con uno solo: lo abre', async () => { await start(); await sim.say('buscá a Roberto Díaz'); expect(log()).toEqual(['search:Roberto Díaz', 'select:p8']); });
  test('«buscá a Ana» con varios: los lee', async () => { await start(); await sim.say('buscá a Ana'); expect(sim.card().message).toMatch(/^Encontré 2 pacientes/); expect(sim.card().rows).toHaveLength(2); });
  test('«abrí el segundo»', async () => { await start(); await sim.say('abrí el segundo'); expect(log()).toEqual(['select:p2']); });
  test('«abrí la ficha de Carlos López» (está en la lista)', async () => { await start(); await sim.say('abrí la ficha de Carlos López'); expect(log()).toEqual(['select:p4']); });
  test('«abrí la ficha de Sofía Castro» (no está a la vista): la busca', async () => { await start(); await sim.say('abrí la ficha de Sofía Castro'); expect(log()).toEqual(['search:Sofía Castro', 'select:p9']); });
  test('«abrí a Ana» con dos: pregunta', async () => { await start(); await sim.say('abrí a Ana'); await sim.say('Martínez'); expect(log()).toEqual(['select:p3']); });
  for (const [said, want] of [
    ['solo los deudores', 'debtors:true'], ['mostrame los que deben', 'debtors:true'], ['sacá el filtro de deudores', 'debtors:false'],
    ['incluí los inactivos', 'active:false'], ['solo los activos', 'active:true'], ['los registrados esta semana', 'date:week'],
    ['todos los pacientes', 'clear'], ['actualizá la lista', 'refresh'], ['nuevo paciente', 'create'], ['agregá un paciente', 'create'],
  ] as const) {
    test(`«${said}»`, async () => { await start(); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«cuántos pacientes hay»', async () => { await start(); await sim.say('cuántos pacientes hay'); expect(sim.card().message).toBe('Hay 9 pacientes con los filtros de ahora.'); });
  test('en «search for Roberto», «only debtors», «new patient»', async () => {
    await start('en');
    await sim.sayAll('search for Roberto', 'only debtors', 'new patient');
    expect(log()).toEqual(['search:Roberto', 'select:p8', 'debtors:true', 'create']);
  });
  test('es-ES «busca a Roberto»', async () => { await start('es-ES'); await sim.say('busca a Roberto'); expect(log()).toEqual(['search:Roberto', 'select:p8']); });
});

test.describe('PA-DETAIL · La ficha: pestañas y acciones', () => {
  test.beforeEach(async () => { await start(); await sim.say('abrí la ficha de Juan Pérez'); log().length = 0; });
  for (const [said, want] of [
    ['la historia clínica', 'tab:clinical'], ['mostrame las finanzas', 'tab:financial'], ['andá a los datos', 'tab:info'], ['la pestaña de facturas', 'tab:financial'],
    ['nueva sesión', 'session'], ['hacele un presupuesto', 'quote'], ['nueva factura', 'invoice'], ['un prepago', 'prepaid'], ['cobrale', 'bill'],
    ['dale una cita', 'appointment'], ['abrí el odontograma', 'odontogram'], ['nuevo periodontograma', 'perio'], ['una sesión estética', 'aesthetic'],
    ['nuevo documento', 'document'], ['hacé una receta', 'prescription'], ['nuevas indicaciones', 'instruction'], ['imprimí el estado de cuenta', 'printSummary'],
    ['editá los datos', 'edit'], ['dale el alta', 'discharge'], ['cerrá la ficha', 'close'],
  ] as const) {
    test(`«${said}»`, async () => { await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«andá a facturas» con la ficha abierta es la pestaña, no el menú', async () => { await sim.say('andá a facturas'); expect(sim.navigations).toEqual([]); expect(log()).toEqual(['tab:financial']); });
});

test.describe('PA-ACT · Acciones con el nombre en la frase', () => {
  test('«nueva sesión para Carlos López» abre y hace', async () => { await start(); await sim.say('nueva sesión para Carlos López'); expect(log()).toEqual(['select:p4', 'session']); });
  test('«hacele un presupuesto a Sofía Castro»', async () => { await start(); await sim.say('hacele un presupuesto a Sofía Castro'); expect(log()).toEqual(['search:Sofía Castro', 'select:p9', 'quote']); });
  test('sin ficha ni nombre: la pide', async () => { await start(); await sim.say('nueva sesión'); expect(sim.card().message).toMatch(/^Primero abrí la ficha/); });
  test('en «new session for Carlos López» y «make a quote»', async () => { await start('en'); await sim.sayAll('new session for Carlos López', 'make a quote'); expect(log()).toEqual(['select:p4', 'session', 'quote']); });
});

test.describe('PA-INFO · Preguntas sobre el paciente', () => {
  test('con la ficha abierta «¿cuánto debe?»', async () => { await start(); await sim.sayAll('abrí la ficha de Juan Pérez', 'cuánto debe'); expect(rows()).toMatch(/Deuda: .*1[.,]200/); });
  test('«¿cuántas veces vino Juan Pérez?»', async () => { await start(); await sim.say('cuántas veces vino Juan Pérez'); expect(rows()).toContain('Vino: 5'); });
  test('«resumen de Juan Pérez»', async () => { await start(); await sim.say('resumen de Juan Pérez'); expect(sim.card().rows.length).toBeGreaterThan(3); });
  test('sin paciente pregunta de quién', async () => { await start(); await sim.say('cuánto debe'); expect(sim.card().message).toBe('¿De qué paciente?'); await sim.say('Juan Pérez'); expect(rows()).toMatch(/Deuda/); });
  test('en «how much does he owe» con la ficha', async () => { await start('en'); await sim.sayAll('open Juan Pérez record', 'how much does he owe'); expect(rows()).toMatch(/1[.,]200/); });
});

test.describe('PA-NAV · Llegar y buscar', () => {
  test('«andá a pacientes y buscá a Roberto Díaz»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a pacientes y buscá a Roberto Díaz');
    expect(sim.navigations).toEqual(['/patients']);
    expect(log()).toEqual(['search:Roberto Díaz', 'select:p8']);
  });
});
