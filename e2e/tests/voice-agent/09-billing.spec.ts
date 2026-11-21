import { expect, test } from '@playwright/test';

import { openSimBilling, type SimBilling } from './sim/billing';
import { openWindow } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';
import { screen } from './sim/page';

/**
 * CR · Cobro rápido por voz, paso por paso (src/lib/voice/commands/billing.ts): paciente,
 * servicios (agregar, cantidad, precio, descuentos, quitar, moneda, sede, total), pago (medios,
 * montos, el resto, moneda, notas) y el pie (facturar y cobrar, solo facturar, cobrar, cerrar).
 * Lo de la ventana del cobro tiene prioridad sobre la página de atrás. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
let bill: SimBilling;
test.afterEach(() => sim.dispose());

async function start(locale: 'es' | 'es-ES' | 'en' = 'es', options: Parameters<typeof openSimBilling>[0] = { patient: { id: 'p2', name: 'Juan Pérez' } }, route = '/purchases/providers') {
  sim = await createVoiceSim({ locale, route });
  // La ventana del cobro abierta (con su pie), encima de la página.
  openWindow(locale === 'en' ? 'Quick billing' : 'Cobro rápido', {
    tree: screen.group(screen.button(locale === 'en' ? 'Cancel' : 'Cancelar'), screen.button(locale === 'en' ? 'Invoice only' : 'Solo facturar'), screen.button(locale === 'en' ? 'Invoice and collect' : 'Facturar y cobrar')),
  });
  bill = openSimBilling(options);
}
const names = () => bill.state.lines.map((l) => `${l.name} x${l.quantity} @${l.unitPrice}${l.discount ? ` -${l.discount.value}${l.discount.mode === 'percent' ? '%' : ''}` : ''}`);

test.describe('CR-PAT · Paciente', () => {
  test('«para Juan Pérez» lo elige y pasa a los servicios', async () => {
    await start('es', {});
    await sim.say('para Juan Pérez');
    expect(bill.log).toEqual(['patient:p2', 'next']);
    expect(bill.state.step).toBe('items');
    expect(sim.card().message).toBe('Paciente: Juan Pérez. ¿Qué servicio agrego?');
  });
  test('el nombre solo en el paso del paciente', async () => {
    await start('es', {});
    await sim.say('Sofía Castro');
    expect(bill.log).toEqual(['patient:p9', 'next']);
  });
  test('varios: pregunta cuál', async () => {
    await start('es', {});
    await sim.say('el paciente es Ana');
    expect(sim.card().choices).toEqual(['Ana Gómez', 'Ana Martínez']);
    await sim.say('la segunda');
    expect(bill.state.patient?.id).toBe('p3');
  });
  test('en «the patient is Carlos López»', async () => {
    await start('en', {});
    await sim.say('the patient is Carlos López');
    expect(bill.state.patient?.id).toBe('p4');
  });
});

test.describe('CR-ADD · Agregar servicios', () => {
  for (const [said, want] of [
    ['agregá limpieza', ['Limpieza x1 @1500']],
    ['agregá una consulta', ['Consulta x1 @1000']],
    ['agregá 2 limpiezas', ['Limpieza x2 @1500']],
    ['agregá dos radiografías', ['Radiografía x2 @600']],
    ['sumá una consulta a 800', ['Consulta x1 @800']],
    ['agregá el servicio blanqueamiento', ['Blanqueamiento x1 @8000']],
    ['agregá extracción simple', ['Extracción simple x1 @2500']],
  ] as const) {
    test(`«${said}»`, async () => { await start(); await sim.say(said); expect(names()).toEqual(want); expect(sim.aiCalls).toHaveLength(0); });
  }
  test('«agregá un servicio» pregunta cuál y lo busca', async () => {
    await start();
    await sim.say('agregá un servicio');
    expect(sim.card().message).toBe('¿Qué servicio agrego?');
    await sim.say('consulta');
    expect(names()).toEqual(['Consulta x1 @1000']);
    expect(sim.card().message).toMatch(/^Agregué Consulta a .*1\.?000.*Total: .*1\.?000/);
  });
  test('«agregá extracción» con dos: pregunta cuál', async () => {
    await start();
    await sim.say('agregá extracción');
    expect(sim.card().choices).toEqual(['Extracción simple', 'Extracción compleja']);
    await sim.say('la compleja');
    expect(names()).toEqual(['Extracción compleja x1 @4000']);
  });
  test('no existe: lo dice', async () => {
    await start();
    await sim.say('agregá ortodoncia');
    expect(sim.card().message).toBe('No encontré el servicio «ortodoncia».');
    expect(names()).toEqual([]);
  });
  test('en «add a cleaning» y «add 2 consultations at 900»', async () => {
    await start('en');
    // En inglés el catálogo de la clínica sigue en su idioma: se nombra como está cargado.
    await sim.say('add limpieza');
    await sim.say('add 2 consulta at 900');
    expect(names()).toEqual(['Limpieza x1 @1500', 'Consulta x2 @900']);
  });
  test('es-ES «añade una limpieza»', async () => {
    await start('es-ES');
    await sim.say('añade una limpieza');
    expect(names()).toEqual(['Limpieza x1 @1500']);
    expect(sim.card().message).toMatch(/^He añadido Limpieza/);
  });
});

test.describe('CR-LINE · Precio, cantidad, quitar', () => {
  test.beforeEach(async () => { await start(); await sim.sayAll('agregá limpieza', 'agregá consulta'); bill.log.length = 0; });
  test('«el precio de la limpieza a 1200»', async () => { await sim.say('el precio de la limpieza a 1200'); expect(names()[0]).toBe('Limpieza x1 @1200'); });
  test('«la consulta a 800»', async () => { await sim.say('la consulta a 800'); expect(names()[1]).toBe('Consulta x1 @800'); });
  test('«poné la limpieza en 1.300»', async () => { await sim.say('poné la limpieza en 1.300'); expect(names()[0]).toBe('Limpieza x1 @1300'); });
  test('«cantidad de la consulta 3»', async () => { await sim.say('la cantidad de la consulta en 3'); expect(names()[1]).toBe('Consulta x3 @1000'); });
  test('«que sean 2 limpiezas»', async () => { await sim.say('que sean 2 limpiezas'); expect(names()[0]).toBe('Limpieza x2 @1500'); });
  test('«quitá la consulta»', async () => { await sim.say('quitá la consulta'); expect(names()).toEqual(['Limpieza x1 @1500']); });
  test('«sacá la última»', async () => { await sim.say('sacá la última'); expect(names()).toEqual(['Limpieza x1 @1500']); });
  test('sin decir cuál con dos: pregunta', async () => {
    await sim.say('cantidad 2');
    expect(sim.card().choices).toEqual(['Limpieza', 'Consulta']);
    await sim.say('la primera');
    expect(names()[0]).toBe('Limpieza x2 @1500');
  });
  test('en «set the price of limpieza to 1100» y «remove consulta»', async () => {
    await sim.sayAll('set the price of limpieza to 1100', 'remove consulta');
    expect(names()).toEqual(['Limpieza x1 @1100']);
  });
});

test.describe('CR-DISC · Descuentos (si la clínica los tiene)', () => {
  test('por línea: «10% de descuento a la limpieza»', async () => {
    await start();
    await sim.sayAll('agregá limpieza', '10% de descuento a la limpieza');
    expect(names()).toEqual(['Limpieza x1 @1500 -10%']);
    expect(bill.total()).toBe(1350);
  });
  test('por línea con una sola: «aplicá un descuento de 200»', async () => {
    await start();
    await sim.sayAll('agregá limpieza', 'aplicá un descuento de 200');
    expect(names()).toEqual(['Limpieza x1 @1500 -200']);
  });
  test('«descuento del 15 por ciento» y «sacá el descuento»', async () => {
    await start();
    await sim.sayAll('agregá consulta', 'descuento del 15 por ciento');
    expect(names()).toEqual(['Consulta x1 @1000 -15%']);
    await sim.say('sacá el descuento');
    expect(names()).toEqual(['Consulta x1 @1000']);
  });
  test('sobre el total cuando la clínica lo usa así', async () => {
    await start('es', { patient: { id: 'p2', name: 'Juan Pérez' }, scope: 'total' });
    await sim.sayAll('agregá limpieza', 'agregá consulta', '10% de descuento');
    expect(bill.state.documentDiscount).toEqual({ mode: 'percent', value: 10 });
    expect(bill.total()).toBe(2250);
  });
  test('más del máximo: lo dice y no lo aplica', async () => {
    await start();
    await sim.sayAll('agregá limpieza', '30% de descuento');
    expect(sim.card().message).toBe('El descuento máximo es del 20%.');
    expect(names()).toEqual(['Limpieza x1 @1500']);
  });
  test('descuentos apagados: lo dice', async () => {
    await start('es', { patient: { id: 'p2', name: 'Juan Pérez' }, scope: null });
    await sim.sayAll('agregá limpieza', '10% de descuento');
    expect(sim.card().message).toBe('Los descuentos no están activados en la clínica.');
  });
  test('sin permiso: lo dice', async () => {
    await start('es', { patient: { id: 'p2', name: 'Juan Pérez' }, canApply: false });
    await sim.sayAll('agregá limpieza', '10% de descuento');
    expect(sim.card().message).toBe('No tenés permiso para aplicar descuentos.');
  });
  test('en «give 10 percent discount»', async () => {
    await start('en');
    await sim.sayAll('add limpieza', 'give a 10 percent discount');
    expect(names()).toEqual(['Limpieza x1 @1500 -10%']);
  });
});

test.describe('CR-INFO · Lo cargado, moneda y sede', () => {
  test('«¿cuánto da?» lee los servicios y el total', async () => {
    await start();
    await sim.sayAll('agregá 2 limpiezas', 'agregá consulta', 'cuánto da');
    expect(sim.card().message).toMatch(/^Hay 2 × Limpieza .*, Consulta .*\. Total: .*4\.?000/);
  });
  test('«en dólares»', async () => { await start(); await sim.say('en dólares'); expect(bill.state.currency).toBe('USD'); });
  test('«cambiá la moneda a pesos»', async () => { await start(); bill.state.currency = 'USD'; await sim.say('cambiá la moneda a pesos'); expect(bill.state.currency).toBe('UYU'); });
  test('«sede Pocitos»', async () => { await start(); await sim.say('sede Pocitos'); expect(bill.state.sedeId).toBe('s2'); });
  test('en «what is the total»', async () => {
    await start('en');
    await sim.sayAll('add limpieza', 'what is the total');
    expect(sim.card().message).toMatch(/^There is Limpieza .*Total:/);
  });
});

test.describe('CR-GO · El pie: seguir, facturar, cobrar', () => {
  test('sin servicios no sigue y dice por qué', async () => {
    await start();
    await sim.say('facturá y cobrá');
    expect(sim.card().message).toBe('Primero agregá al menos un servicio.');
    expect(bill.state.step).toBe('items');
  });
  test('«facturá y cobrá» pasa al pago', async () => {
    await start();
    await sim.sayAll('agregá limpieza', 'facturá y cobrá');
    expect(bill.state.step).toBe('payment');
  });
  test('«solo facturar» termina sin cobrar', async () => {
    await start();
    await sim.sayAll('agregá limpieza', 'solo facturar');
    expect(bill.log).toContain('invoice-only');
    expect(bill.state.step).toBe('confirmation');
  });
  test('«siguiente» en el paso del paciente sin paciente: lo pide', async () => {
    await start('es', {});
    await sim.say('siguiente');
    expect(sim.card().message).toBe('Primero decime para qué paciente es.');
  });
  test('en «invoice and collect»', async () => {
    await start('en');
    await sim.sayAll('add limpieza', 'invoice and collect');
    expect(bill.state.step).toBe('payment');
  });
});

test.describe('CR-PAY · Pago', () => {
  test.beforeEach(async () => { await start(); await sim.sayAll('agregá limpieza', 'agregá consulta', 'facturá y cobrá'); bill.log.length = 0; });
  const entries = () => bill.state.payment.entries.map((e) => `${e.method ?? '-'}:${e.amount}:${e.currency}`);
  test('«en efectivo» elige el medio y deja el total', async () => { await sim.say('en efectivo'); expect(entries()).toEqual(['m1:2500:UYU']); });
  test('«con tarjeta de débito»', async () => { await sim.say('con tarjeta de débito'); expect(entries()).toEqual(['m3:2500:UYU']); });
  test('«1000 en efectivo y el resto con tarjeta de crédito»', async () => {
    await sim.say('1000 en efectivo y el resto con tarjeta de crédito');
    expect(entries()).toEqual(['m1:1000:UYU', 'm2:1500:UYU']);
  });
  test('«pagá 500 con transferencia»', async () => { await sim.say('pagá 500 con transferencia'); expect(entries()).toEqual(['m4:500:UYU']); expect(sim.card().message).toMatch(/Quedan .*2\.?000.* sin cubrir/); });
  test('«todo en efectivo»', async () => { await sim.say('todo en efectivo'); expect(entries()).toEqual(['m1:2500:UYU']); });
  test('«agregá otro medio de pago»', async () => { await sim.say('agregá otro medio de pago'); expect(bill.state.payment.entries).toHaveLength(2); });
  test('«nota: paga el resto la semana que viene»', async () => { await sim.say('nota: paga el resto la semana que viene'); expect(bill.state.payment.notes).toBe('paga el resto la semana que viene'); });
  test('«cuánto falta»', async () => { await sim.say('cuánto falta'); expect(sim.card().message).toMatch(/^Falta cobrar /); });
  test('«cobrá» sin medio: lo pide', async () => { await sim.say('cobrá'); expect(sim.card().message).toBe('Falta elegir el medio de pago.'); expect(bill.log).not.toContain('submit'); });
  test('«en efectivo» y «cobrá» cobra', async () => { await sim.sayAll('en efectivo', 'cobrá'); expect(bill.log).toContain('submit'); expect(bill.state.step).toBe('confirmation'); });
  test('«cerrar» al final', async () => { await sim.sayAll('en efectivo', 'cobrá', 'cerrar'); expect(bill.log).toContain('close'); });
  test('en «pay 1000 in cash and the rest by card»', async () => {
    sim.dispose();
    await start('en');
    await sim.sayAll('add limpieza', 'add consulta', 'invoice and collect', 'pay 1000 in cash and the rest by credit card', 'charge it');
    expect(bill.state.payment.entries.map((e) => `${e.method}:${e.amount}`)).toEqual(['m1:1000', 'm2:1500']);
    expect(bill.log).toContain('submit');
  });
});

test.describe('CR-FLOW · De punta a punta, como en la recepción', () => {
  test('desde el panel derecho: «cobrale a Juan Pérez» → servicios → descuento → pago mixto → cobrar', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    await sim.say('cobrale a Juan Pérez');
    expect(sim.rail.log).toEqual(['bill:p2:Juan Pérez']);
    bill = openSimBilling({ patient: { id: 'p2', name: 'Juan Pérez' } });
    await sim.sayAll('agregá 2 limpiezas', 'agregá radiografía', '10% de descuento a la radiografía', 'cuánto da', 'facturá y cobrá', '2000 en efectivo y el resto con tarjeta de crédito', 'cobrá');
    expect(names()).toEqual(['Limpieza x2 @1500', 'Radiografía x1 @600 -10%']);
    expect(bill.state.payment.entries.map((e) => `${e.method}:${e.amount}`)).toEqual(['m1:2000', 'm2:1540']);
    expect(bill.log).toContain('submit');
  });
  test('sin paciente: paciente, «¿qué servicio?» se contesta con el nombre', async () => {
    await start('es', {});
    await sim.sayAll('para Carlos López', 'agregá un servicio', 'blanqueamiento', 'facturá y cobrá', 'con transferencia', 'cobrá');
    expect(bill.state.patient?.id).toBe('p4');
    expect(names()).toEqual(['Blanqueamiento x1 @8000']);
    expect(bill.log).toContain('submit');
  });
  test('lo de la página de atrás no se toca mientras el cobro está abierto', async () => {
    await start();
    screen.page(screen.button('Exportar'), screen.table(['Ana Gómez', 'Juan Pérez']));
    await sim.say('agregá limpieza');
    await sim.say('exportar');
    expect(names()).toEqual(['Limpieza x1 @1500']);
  });
  test('«cancelar» con el cobro a medias: aprieta Cancelar de la ventana', async () => {
    await start();
    await sim.say('cancelar');
    expect(sim.card().message).toMatch(/Cancelar/);
  });
});
