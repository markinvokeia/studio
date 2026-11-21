import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';
import { publishSimLedger, type SimLedger } from './sim/ledger';

/**
 * EC · Estado de cuenta del paciente (src/lib/voice/commands/ledger.ts): moneda (principal y
 * secundaria), orden, período, altas (presupuesto, tratamiento, pago), saldo y movimientos, y lo
 * que se hace con una fila (por número, fecha, posición o descripción) con confirmación. es, es-ES y en.
 */

let sim: VoiceSim;
let l: SimLedger;
test.afterEach(() => sim.dispose());
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es', opts: Parameters<typeof publishSimLedger>[0] = {}) => {
  sim = await createVoiceSim({ locale, route: '/patients' });
  l = publishSimLedger(opts);
};
const log = () => l.log;

test.describe('EC-VIEW · Moneda, orden y período', () => {
  for (const [locale, said, want] of [
    ['es', 'en dólares', 'currency:USD'], ['es', 'mostrame el estado de cuenta en dólares', 'currency:USD'], ['es', 'cambiá la moneda a pesos', 'currency:UYU'],
    ['es', 'en la moneda secundaria', 'currency:USD'], ['es', 'en la moneda principal', 'currency:UYU'], ['es-ES', 'enséñamelo en dólares', 'currency:USD'], ['en', 'show it in dollars', 'currency:USD'],
    ['es', 'ordená descendente', 'sort:newest-first'], ['es', 'los más recientes arriba', 'sort:newest-first'], ['es', 'ordená ascendente', 'sort:newest-last'],
    ['es', 'los más viejos primero', 'sort:newest-last'], ['en', 'newest first', 'sort:newest-first'], ['en', 'sort ascending', 'sort:newest-last'],
    ['es', 'todo el tiempo', 'all-time'], ['en', 'all time', 'all-time'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«el mes pasado» pone el período', async () => { await start(); await sim.say('mostrame el mes pasado'); expect(log()[0]).toMatch(/^range:\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/); });
  test('una sola moneda: «en dólares» lo dice', async () => { await start('es', { currencies: ['UYU'] }); await sim.say('en dólares'); expect(log()).toEqual([]); expect(sim.card().message).toBe('El estado de cuenta tiene una sola moneda: UYU.'); });
});

test.describe('EC-CREATE · Altas y saldo', () => {
  for (const [locale, said, want] of [
    ['es', 'nuevo presupuesto', 'create:quote'], ['es', 'agregá un presupuesto', 'create:quote'], ['es', 'nuevo tratamiento', 'create:treatment'], ['es', 'nueva factura', 'create:treatment'],
    ['es', 'registrá un pago', 'create:payment'], ['es', 'cobrale', 'create:payment'], ['es-ES', 'añade un presupuesto', 'create:quote'], ['en', 'new payment', 'create:payment'], ['en', 'add a quote', 'create:quote'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«¿cuánto debe?»', async () => { await start(); await sim.say('cuánto debe'); expect(sim.card().message).toMatch(/^Debe UYU 2\.?500/); });
  test('«leeme los movimientos»', async () => { await start(); await sim.say('leeme los movimientos'); expect(sim.card().message).toMatch(/^3 movimientos/); expect(sim.card().rows).toHaveLength(3); });
  test('en «what is the balance»', async () => { await start('en'); await sim.say('what is the balance'); expect(sim.card().message).toMatch(/^Owes UYU 2/); });
});

test.describe('EC-ROW · Una fila', () => {
  test('«facturá el presupuesto 1» confirma y factura', async () => {
    await start();
    await sim.say('facturá el presupuesto 1');
    expect(sim.card().message).toMatch(/^¿Seguro que querés facturar Limpieza y profilaxis/);
    await sim.say('sí');
    expect(log()).toEqual(['invoice:l1']);
  });
  test('«imprimí la factura 12» (sin confirmar)', async () => { await start(); await sim.say('imprimí la factura 12'); expect(log()).toEqual(['print:l2']); });
  test('«editá el pago»', async () => { await start(); await sim.say('editá el pago'); expect(log()).toEqual(['edit:l3']); });
  test('«hacé una nota de crédito de la restauración»', async () => { await start(); await sim.sayAll('hacé una nota de crédito de la restauración', 'sí'); expect(log()).toEqual(['creditNote:l2']); });
  test('«finalizá la factura 12»', async () => { await start(); await sim.sayAll('finalizá la factura 12', 'sí'); expect(log()).toEqual(['finalizado:l2']); });
  test('«volvé a presupuesto la factura 12»', async () => { await start(); await sim.sayAll('volvé a presupuesto la factura 12', 'sí'); expect(log()).toEqual(['toPresupuesto:l2']); });
  test('«eliminá el pago» pide confirmar; «no» no hace nada', async () => { await start(); await sim.sayAll('eliminá el pago', 'no'); expect(log()).toEqual([]); });
  test('«mandá por mail el presupuesto 1»', async () => { await start(); await sim.say('mandá por mail el presupuesto 1'); expect(log()).toEqual(['email:l1']); });
  test('«facturá el del 17 de marzo»', async () => { await start(); await sim.sayAll('facturá el del 17 de marzo', 'sí'); expect(log()).toEqual(['invoice:l1']); });
  test('«seleccioná el último» y «facturalo» no se puede (es un pago)', async () => {
    await start();
    await sim.sayAll('seleccioná el último', 'facturalo');
    expect(log()).toEqual(['select:l3']);
    expect(sim.card().message).toMatch(/^No se puede facturar Pago en efectivo/);
  });
  test('es-ES «factura el presupuesto 1» y «sí»', async () => { await start('es-ES'); await sim.sayAll('factura el presupuesto 1', 'sí'); expect(log()).toEqual(['invoice:l1']); });
  test('en «print invoice 12»', async () => { await start('en'); await sim.say('print invoice 12'); expect(log()).toEqual(['print:l2']); });
  test('lo que no está lo dice', async () => { await start(); await sim.say('imprimí la factura 99'); expect(sim.card().message).toBe('No encontré ese movimiento en el estado de cuenta.'); });
});
