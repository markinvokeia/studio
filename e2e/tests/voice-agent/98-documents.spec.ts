import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * DO · Facturas, pagos y presupuestos por voz en las tablas compartidas (Ventas, Compras, ficha
 * del paciente): leer y sumar, abrir, imprimir, mail, editar, confirmar, rechazar, cobrar,
 * asignar, crear, exportar, actualizar y filtrar. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const log = () => sim.documents()!.log;
const start = async (route = '/sales/invoices', locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route }); };

test.describe('DO-READ · Leer y sumar', () => {
  test('«cuántas facturas hay»', async () => { await start(); await sim.say('cuántas facturas hay'); expect(sim.card().message).toMatch(/^Hay 4 documentos en facturas; suman .*8\.?200.*, .*800/); });
  test('«cuánto suman las pendientes»', async () => { await start(); await sim.say('cuánto suman las pendientes'); expect(sim.card().message).toMatch(/^Hay 3 pendientes en facturas; falta cobrar .*5\.?200/); });
  test('«cuántos presupuestos hay»', async () => { await start('/sales/quotes'); await sim.say('cuántos presupuestos hay'); expect(sim.card().message).toMatch(/^Hay 2 documentos en presupuestos/); });
  test('en «how many invoices are there»', async () => { await start('/sales/invoices', 'en'); await sim.say('how many invoices are there'); expect(sim.card().message).toMatch(/^There are 4 documents in invoices/); });
  for (const said of ['how much do the pending ones add up to', 'how much is pending', 'what is the total of the unpaid ones', 'how much is outstanding'] as const) {
    test(`en «${said}»`, async () => { await start('/sales/invoices', 'en'); await sim.say(said); expect(sim.card().message).toMatch(/^There are 3 pending in invoices/); });
  }
  test('es-ES «¿cuánto suman las pendientes?»', async () => { await start('/sales/invoices', 'es-ES'); await sim.say('¿cuánto suman las pendientes?'); expect(sim.card().message).toMatch(/^Hay 3 pendientes en facturas/); });
});

test.describe('DO-ROW · Una fila', () => {
  for (const [said, want] of [
    ['abrí la factura 120', 'invoice.select:120'], ['abrí la factura F-121', 'invoice.select:121'], ['imprimí la de Juan Pérez', 'invoice.print:120'],
    ['mandá por mail la factura 122', 'invoice.email:122'], ['editá la de Carlos', 'invoice.edit:122'], ['confirmá la factura 122', 'invoice.confirm:122'],
    ['cobrá la factura 120', 'invoice.pay:120'], ['cobrá la última', 'invoice.pay:123'], ['abrí la segunda', 'invoice.select:121'],
    ['imprimí el pago 45', 'payment.print:45'], ['asigná el pago 45', 'payment.allocate:45'],
  ] as const) {
    test(`«${said}»`, async () => { await start(); await sim.say(said); expect(log()).toEqual([want]); expect(sim.aiCalls).toHaveLength(0); });
  }
  test('«la de Ana» con dos: pregunta', async () => { await start(); await sim.say('imprimí la de Ana'); expect(sim.card().choices).toHaveLength(2); await sim.say('la segunda'); expect(log()).toEqual(['invoice.print:123']); });
  test('número que no está: lo dice', async () => { await start(); await sim.say('abrí la factura 999'); expect(sim.card().message).toBe('No encontré eso en la lista de facturas.'); });
  test('presupuestos: confirmar, rechazar, cobrar', async () => {
    await start('/sales/quotes');
    await sim.sayAll('confirmá el presupuesto P-10', 'rechazá el de Sofía Castro', 'cobrá el presupuesto 11');
    expect(log()).toEqual(['quote.confirm:10', 'quote.reject:11', 'quote.pay:11']);
  });
  test('compras: «imprimí la de Dental Sur»', async () => { await start('/purchases/invoices'); await sim.say('imprimí la de Dental Sur'); expect(log()).toEqual(['invoice.print:120']); });
  test('es-ES «imprime la factura 120»', async () => { await start('/sales/invoices', 'es-ES'); await sim.say('imprime la factura 120'); expect(log()).toEqual(['invoice.print:120']); });
  test('en «print invoice 120», «email the one for Juan Pérez», «collect invoice 123»', async () => {
    await start('/sales/invoices', 'en');
    await sim.sayAll('print invoice 120', 'email the one for Juan Pérez', 'collect invoice 123');
    expect(log()).toEqual(['invoice.print:120', 'invoice.email:120', 'invoice.pay:123']);
  });
});

test.describe('DO-LIST · Crear, exportar, actualizar, filtrar', () => {
  for (const [said, want] of [['nueva factura', 'invoice.create'], ['exportá las facturas', 'invoice.export'], ['actualizá las facturas', 'invoice.refresh'], ['solo las pagadas', 'invoice.filter:paid'], ['mostrame solo las pendientes', 'invoice.filter:unpaid']] as const) {
    test(`«${said}»`, async () => { await start(); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«nuevo presupuesto» en presupuestos', async () => { await start('/sales/quotes'); await sim.say('nuevo presupuesto'); expect(log()).toEqual(['quote.create']); });
  test('filtro que no existe: lo dice', async () => { await start(); await sim.say('solo las anuladas'); expect(sim.card().message).toBe('No hay un filtro «anuladas» en esta lista.'); });
  test('en «new invoice» y «export the invoices»', async () => { await start('/sales/invoices', 'en'); await sim.sayAll('new invoice', 'export the invoices'); expect(log()).toEqual(['invoice.create', 'invoice.export']); });
});

test.describe('DO-NAV · Llegar y actuar', () => {
  test('«andá a facturas y cobrá la factura 120»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a facturas y cobrá la factura 120');
    expect(sim.navigations).toEqual(['/sales/invoices']);
    expect(log()).toEqual(['invoice.pay:120']);
  });
});
