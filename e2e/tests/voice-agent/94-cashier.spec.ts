import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * CJ · Caja por voz (src/lib/voice/commands/cashier.ts): cajas (ver, abrir una), la sesión abierta
 * (efectivo, entradas, salidas, tarjeta, movimientos), el cierre, y el conteo del efectivo en la
 * apertura o el cierre. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const c = () => sim.cashier()!;
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route: '/cashier' }); };

test.describe('CJ-POINTS · Cajas', () => {
  test('«qué cajas hay»', async () => { await start(); await sim.say('qué cajas hay'); expect(sim.card().message).toBe('Hay 2 cajas; abiertas: Caja Recepción.'); expect(sim.card().rows).toHaveLength(2); });
  test('«abrí la caja principal»', async () => { await start(); await sim.say('abrí la caja principal'); expect(c().log).toEqual(['open:cp1']); expect(sim.card().message).toBe('Empiezo la apertura de Caja Principal.'); });
  test('«abrí la caja» con dos: pregunta cuál', async () => { await start(); await sim.say('abrí la caja'); await sim.say('la segunda'); expect(c().log).toEqual(['open:cp2']); });
  test('«entrá a la caja recepción» (abierta): muestra la sesión', async () => { await start(); await sim.say('entrá a la caja recepción'); expect(sim.card().message).toBe('Abrí la sesión de Caja Recepción.'); });
  test('con una propia abierta no deja abrir otra', async () => {
    await start();
    c().bridge.cashPoints[1].mine = true;
    await sim.say('abrí la caja principal');
    expect(c().log).toEqual([]);
    expect(sim.card().message).toMatch(/Ya tenés abierta Caja Recepción/);
  });
  test('«cerrá la caja» sin sesión: lo dice (no navega)', async () => { await start(); await sim.say('cerrá la caja'); expect(sim.navigations).toEqual([]); expect(sim.card().message).toBe('No hay una sesión de caja abierta a la vista.'); });
  test('en «open the register Caja Principal»', async () => { await start('en'); await sim.say('open the register caja principal'); expect(c().log).toEqual(['open:cp1']); });
});

test.describe('CJ-SESSION · La sesión abierta', () => {
  test.beforeEach(async () => { await start(); c().showSession(); });
  for (const [said, want] of [
    ['cuánto hay en efectivo', /^En efectivo hay .*12\.?500.* en Caja Principal\.$/],
    ['cuánto hay en caja', /^En efectivo hay/],
    ['cuánto entró', /^Entró .*18\.?000/],
    ['las salidas', /^Salió .*2\.?500/],
    ['cuánto con tarjeta', /^Con tarjeta: .*6\.?000/],
    ['el último movimiento', /^El último movimiento: \+.*1\.?500.* Efectivo · Juan Pérez\.$/],
    ['cuántos movimientos hay', /^Hay 2 movimientos\.$/],
  ] as const) {
    test(`«${said}»`, async () => { await sim.say(said); expect(sim.card().message).toMatch(want); });
  }
  test('«hacé el cierre»', async () => { await sim.say('hacé el cierre'); expect(c().log).toEqual(['start-closing']); });
  test('«volvé a las cajas»', async () => { await sim.say('volvé a las cajas'); expect(c().log).toEqual(['view-all']); });
  test('en «how much cash is there» y «start the closing»', async () => {
    sim.dispose();
    await start('en');
    c().showSession();
    await sim.say('how much cash is there');
    expect(sim.card().message).toMatch(/^There is .* in cash at Caja Principal\.$/);
    await sim.say('start the closing');
    expect(c().log).toEqual(['start-closing']);
  });
});

test.describe('CJ-COUNT · Contar el efectivo', () => {
  test('«5 billetes de 1000, 3 de 500 y 2 monedas de 10»', async () => {
    await start();
    c().showCounter();
    await sim.say('5 billetes de 1000, 3 de 500 y 2 monedas de 10');
    expect(c().log).toEqual(['count:1000=5', 'count:500=3', 'count:10=2']);
    expect(sim.card().message).toMatch(/Total: .*6\.?520/);
  });
  test('«cinco de mil» (en palabras)', async () => { await start(); c().showCounter(); await sim.say('cinco de mil'); expect(c().log).toEqual(['count:1000=5']); });
  test('«de 200 pongo 4»', async () => { await start(); c().showCounter(); await sim.say('de 200 pongo 4'); expect(c().log).toEqual(['count:200=4']); });
  test('«todo en cero»', async () => { await start(); c().showCounter(); await sim.say('todo en cero'); expect(c().log).toEqual(['all:0']); });
  test('«lo mismo que el último cierre»', async () => { await start(); c().showCounter(); await sim.say('lo mismo que el último cierre'); expect(c().log).toEqual(['last']); expect(sim.card().message).toMatch(/12\.?000/); });
  test('«cuánto da»', async () => { await start(); c().showCounter(); await sim.sayAll('2 de 2000', 'cuánto da'); expect(sim.card().message).toMatch(/^Contado: .*4\.?000.* \(2 × 2000\)\.$/); });
  test('un billete que no existe: lo dice', async () => { await start(); c().showCounter(); await sim.say('3 billetes de 300'); expect(c().log).toEqual([]); expect(sim.card().message).toBe('No hay billetes ni monedas de 300 en UYU.'); });
  test('moneda sin denominaciones: «el total es 1500»', async () => {
    await start();
    c().showCounter('USD', { denominations: [], coins: [], last: false });
    await sim.say('el total es 1500');
    expect(c().log).toEqual(['total:1500']);
  });
  test('dos contadores: «3 de 100 en dólares» va al de dólares', async () => {
    await start();
    c().showCounter('UYU');
    c().showCounter('USD', { denominations: [100, 50, 20], coins: [] });
    await sim.say('3 de 100 dólares');
    expect(c().log).toEqual(['count:100=3']);
  });
  test('es-ES «pon todo a cero» no confunde', async () => { await start('es-ES'); c().showCounter(); await sim.say('todo a cero'); expect(c().log).toEqual(['all:0']); });
  test('en «five notes of 1000 and two of 500»', async () => { await start('en'); c().showCounter(); await sim.say('5 notes of 1000 and 2 of 500'); expect(c().log).toEqual(['count:1000=5', 'count:500=2']); });
});

test.describe('CJ-NAV · Desde otra página', () => {
  test('«andá a la caja y decime qué cajas hay»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a la caja y decime qué cajas hay');
    expect(sim.navigations).toEqual(['/cashier']);
    expect(sim.card().message).toMatch(/^Hay 2 cajas/);
  });
});
