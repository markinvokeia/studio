import { expect, test } from '@playwright/test';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

import { parsePeriod } from '@/lib/voice/period';
import { normalizeSpeech } from '@/lib/voice/parse';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * PC · Panel de control por voz (src/lib/voice/commands/dashboard.ts): leer los números de hoy y
 * del mes, el resumen, la sede y el servicio que más venden, la comparación con el mes pasado, y
 * cambiar período, sede y moneda o actualizar. Local, sin IA. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim | undefined;
test.afterEach(() => { sim?.dispose(); sim = undefined; });
const log = () => sim!.dashboard()!.log;

test.describe('PC-PERIOD · Períodos dichos', () => {
  const today = new Date(2026, 10, 20);
  const d = (x: Date) => format(x, 'yyyy-MM-dd');
  for (const [said, from, to] of [
    ['hoy', '2026-11-20', '2026-11-20'], ['ayer', '2026-11-19', '2026-11-19'], ['esta semana', '2026-11-16', '2026-11-22'],
    ['la semana pasada', '2026-11-09', '2026-11-15'], ['este mes', '2026-11-01', '2026-11-30'], ['el mes pasado', '2026-10-01', '2026-10-31'],
    ['este año', '2026-01-01', '2026-12-31'], ['el año pasado', '2025-01-01', '2025-12-31'], ['los últimos 30 días', '2026-10-22', '2026-11-20'],
    ['marzo', '2026-03-01', '2026-03-31'], ['diciembre', '2025-12-01', '2025-12-31'], ['marzo del año pasado', '2025-03-01', '2025-03-31'],
    ['del 1 al 15', '2026-11-01', '2026-11-15'], ['del 3 al 10 de octubre', '2026-10-03', '2026-10-10'],
    ['last month', '2026-10-01', '2026-10-31'], ['this week', '2026-11-16', '2026-11-22'], ['last 7 days', '2026-11-14', '2026-11-20'], ['march 2025', '2025-03-01', '2025-03-31'],
  ] as const) {
    test(`«${said}»`, () => {
      const p = parsePeriod(normalizeSpeech(said), today);
      expect(p && [d(p.from), d(p.to)]).toEqual([from, to]);
    });
  }
});

test.describe('PC-READ · Leer los números', () => {
  for (const [locale, said, want] of [
    ['es', 'cuánto producimos hoy', /^Producción: hoy .*45\.?000/],
    ['es', 'cuánto facturamos este mes', /^Producción: en el mes .*820\.?000.* \(\+12%\)\.$/],
    ['es', 'cuánto cobramos', /^Cobrado: hoy .*38\.?000.*, en el mes .*700\.?000.*\(-3%\)\.$/],
    ['es', 'cuánto gastamos este mes', /^Gastos: en el mes .*210\.?000/],
    ['es', 'cuál es el resultado del mes', /^Resultado: en el mes .*490\.?000/],
    ['es', 'cuántos pacientes atendimos hoy', /^Pacientes atendidos: hoy 18\.$/],
    ['es', 'cuántas atenciones hubo este mes', /^Atenciones: en el mes 345 \(\+6%\)\.$/],
    ['es', 'cuántos agendados hay para hoy', /^Agendados para hoy: hoy 24\.$/],
    ['es', 'cuántos pacientes nuevos tuvimos', /^Pacientes nuevos: en el mes 42 \(\+15%\)\.$/],
    ['es', 'dame un resumen del día', /^Hoy: producción .*, cobrado .*, 20 atenciones y 24 agendados\. En el mes/],
    ['es', 'cómo va el día', /^Hoy: producción/],
    ['es', 'qué sede produjo más', /^La sede que más produjo es Centro: .*500\.?000.*61%/],
    ['es', 'qué servicio se vendió más', /^El servicio más vendido es Blanqueamiento/],
    ['es', 'cómo venimos contra el mes pasado', /^La producción del mes va \+12% contra el mes pasado/],
    ['es-ES', 'cuánto hemos cobrado hoy', /^Cobrado: hoy/],
    ['en', 'how much did we produce today', /^Production: today/],
    ['en', 'how much did we collect this month', /^Collected: this month/],
    ['en', 'how many patients did we see today', /^Patients seen: today 18\.$/],
    ['en', 'give me a summary', /^Today: production/],
    ['en', 'which branch sold the most', /^The top location is Centro/],
    ['en', 'what are the best selling services', /^The best-selling service is Blanqueamiento/],
  ] as const) {
    test(`${locale} «${said}»`, async () => {
      sim = await createVoiceSim({ locale, route: '/' });
      await sim.say(said);
      expect(sim.card().message).toMatch(want);
      expect(sim.aiCalls).toHaveLength(0);
    });
  }
  test('el ranking de sedes va en filas', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('producción por sede, cuál vende más');
    expect(sim.card().rows.map((r) => r.split(':')[0])).toEqual(['Centro', 'Pocitos']);
  });
});

test.describe('PC-FILTER · Período, sede, moneda, actualizar', () => {
  const month = (offset: number) => { const d = subMonths(new Date(), offset); return `range:${format(startOfMonth(d), 'yyyy-MM-dd')}`; };
  test('«mostrame el mes pasado»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('mostrame el mes pasado');
    expect(log()[0]).toMatch(new RegExp(`^${month(1).replace('range:', 'range:')}`));
    expect(log()[0]).toContain(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  });
  test('«este mes» solo', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('este mes'); expect(log()[0]).toMatch(new RegExp(`^${month(0)}`)); });
  test('«solo la sede Pocitos» y «todas las sedes»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.sayAll('solo la sede Pocitos', 'todas las sedes');
    expect(log()).toEqual(['sede:s2', 'sede:all']);
  });
  test('«filtrá por la sede centro»', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('filtrá por la sede centro'); expect(log()).toEqual(['sede:s1']); });
  test('«en dólares»', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('en dólares'); expect(log()).toEqual(['currency:USD']); });
  test('«actualizá el panel»', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('actualizá el panel'); expect(log()).toEqual(['reload']); });
  test('sin permiso de filtrar: lo dice', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.dashboard()!.bridge.canFilter = false;
    await sim.say('mostrame el mes pasado');
    expect(log()).toEqual([]);
  });
  test('en «show me last month», «only the Pocitos location», «refresh»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    await sim.sayAll('show me last month', 'only the location Pocitos', 'refresh');
    expect(log()[0]).toMatch(/^range:/);
    expect(log().slice(1)).toEqual(['sede:s2', 'reload']);
  });
  test('«cambiá a la sede Pocitos» es la sede de trabajo (panel derecho), no el filtro', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('cambiá a la sede Pocitos');
    expect(sim.rail.log).toEqual(['sede:s2']);
    expect(log()).toEqual([]);
  });
});

test.describe('PC-NAV · Llegar al panel y preguntar', () => {
  test('desde la agenda: «volvé al inicio y decime cuánto producimos hoy»', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('volvé al inicio y decime cuánto producimos hoy');
    expect(sim.navigations).toEqual(['/']);
    expect(sim.card().message).toMatch(/^Producción: hoy/);
  });
  test('en otra página no se lee el panel', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    await sim.say('cuánto producimos hoy');
    expect(sim.card().message).not.toMatch(/^Producción/);
  });
});
