import { expect, test } from '@playwright/test';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * RP · Reportes por voz (src/lib/voice/commands/reports.ts), con las piezas comunes de los 23
 * reportes: generar, período (lo pone y genera), desde siempre, leer los totales, cuántas filas,
 * exportar e imprimir. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const log = () => sim.report()!.log;
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route: '/reports/deudores' }); };
const lastMonth = () => { const d = subMonths(new Date(), 1); return `range:${format(startOfMonth(d), 'yyyy-MM-dd')}..${format(endOfMonth(d), 'yyyy-MM-dd')}`; };

test.describe('RP · Generar y período', () => {
  for (const said of ['generá el reporte', 'generar', 'corré el reporte', 'consultá el informe']) {
    test(`«${said}»`, async () => { await start(); await sim.say(said); expect(log()).toEqual(['generate']); });
  }
  test('«el mes pasado» pone el período y genera', async () => { await start(); await sim.say('el mes pasado'); expect(log()).toEqual([lastMonth(), 'generate']); });
  test('«mostrame marzo»', async () => { await start(); await sim.say('mostrame marzo'); expect(log()[0]).toMatch(/^range:\d{4}-03-01\.\.\d{4}-03-31$/); expect(log()[1]).toBe('generate'); });
  test('«del 1 al 15»', async () => { await start(); await sim.say('del 1 al 15'); expect(log()[0]).toMatch(/-01\.\.\d{4}-\d{2}-15$/); });
  test('«desde siempre»', async () => { await start(); await sim.say('desde siempre'); expect(log()).toEqual(['all-time', 'generate']); });
  test('en «run the report» y «last month»', async () => { await start('en'); await sim.sayAll('run the report', 'last month'); expect(log()).toEqual(['generate', lastMonth(), 'generate']); });
  test('es-ES «genera el informe»', async () => { await start('es-ES'); await sim.say('genera el informe'); expect(log()).toEqual(['generate']); expect(sim.card().message).toBe('Genero el informe.'); });
});

test.describe('RP · Leer, exportar, imprimir', () => {
  test('sin generar: lo pide', async () => { await start(); await sim.say('cuánto da'); expect(sim.card().message).toMatch(/^Primero generá el reporte/); });
  test('«¿cuánto da?» lee las tarjetas', async () => { await start(); await sim.sayAll('generá el reporte', 'cuánto da'); expect(sim.card().message).toBe('Total adeudado: $ 45.300. Deudores: 12.'); expect(sim.card().rows).toHaveLength(2); });
  test('«cuántas filas hay»', async () => { await start(); await sim.sayAll('generá el reporte', 'cuántas filas hay'); expect(sim.card().message).toBe('Hay 12 filas.'); });
  test('«exportá a Excel», «bajalo en PDF», «imprimilo»', async () => { await start(); await sim.sayAll('generá el reporte', 'exportá a excel', 'bajalo en pdf', 'imprimilo'); expect(log()).toEqual(['generate', 'excel', 'pdf', 'print']); });
  test('formato que no tiene: lo dice', async () => { await start(); await sim.sayAll('generá el reporte', 'exportá a csv'); expect(sim.card().message).toBe('Este reporte no se exporta a CSV.'); });
  test('en «what is the total» y «export to excel»', async () => { await start('en'); await sim.sayAll('run the report', 'what is the total', 'export to excel'); expect(log()).toEqual(['generate', 'excel']); });
});

test.describe('RP-NAV · Llegar y pedir', () => {
  test('«llevame a reportes de deudores y mostrame el mes pasado»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('llevame a reportes de deudores y mostrame el mes pasado');
    expect(sim.navigations).toEqual(['/reports/deudores']);
    expect(log()).toEqual([lastMonth(), 'generate']);
  });
});
