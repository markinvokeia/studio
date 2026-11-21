import { expect, test } from '@playwright/test';

import { parseLabOrderPick } from '@/lib/voice/commands/lab-orders-pick';
import { normalizeSpeech } from '@/lib/voice/parse';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * LB · Órdenes de laboratorio por lo que se ve (src/lib/voice/commands/lab-orders-pick.ts): «la de
 * Ana Gómez», «la primera», la orden abierta, y después los comandos de siempre con el número
 * (etapa, estado, edición). Con el backend de laboratorio simulado. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim?.dispose());
const lab = () => sim.lab()!;
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route: '/lab-orders' }); };

test.describe('LB-PARSE · Qué orden se nombró', () => {
  for (const [said, want] of [
    ['abrí la de Ana Gómez', { name: 'ana gomez', position: null, open: true }],
    ['pasá la de Juan a recibida', { name: 'juan', position: null, open: false }],
    ['dónde está la de Juan Pérez', { name: 'juan perez', position: null, open: false }],
    ['la primera llegó', { name: null, position: 'primera', open: false }],
    ['mandá la orden de Dental Sur', { name: 'dental sur', position: null, open: false }],
    ['marcala como urgente', { name: null, position: null, open: false }],
  ] as const) {
    test(`«${said}»`, () => {
      const p = parseLabOrderPick(normalizeSpeech(said));
      expect(p && { name: p.name, position: p.position, open: p.open }).toEqual(want);
    });
  }
  for (const said of ['la orden 45 llegó', 'mostrame las de Ana', 'creá una orden para Ana Gómez', 'abrí la caja', 'hola']) {
    test(`no: «${said}»`, () => { expect(parseLabOrderPick(normalizeSpeech(said))).toBeNull(); });
  }
});

test.describe('LB · Por lo que se ve', () => {
  test('«abrí la de Juan Pérez» abre su orden', async () => { await start(); await sim.say('abrí la de Juan Pérez'); expect(lab().bridge.selectedId).toBe(46); });
  test('«abrí la tercera»', async () => { await start(); await sim.say('abrí la tercera'); expect(lab().bridge.selectedId).toBe(47); });
  test('«pasá la de Juan a recibida» la mueve', async () => {
    await start();
    await sim.say('pasá la de Juan a recibida en clínica');
    expect(sim.card().rows).toContain('Etapa: En laboratorio → Recibida en clínica');
    await sim.say('sí');
    expect(lab().moves).toEqual([{ id: 46, to: 3 }]);
  });
  test('«llegó la de Juan»', async () => { await start(); await sim.say('llegó la de Juan'); await sim.say('sí'); expect(lab().moves).toEqual([{ id: 46, to: 3 }]); });
  test('«¿dónde está la de Juan?» dice la etapa', async () => { await start(); await sim.say('dónde está la de Juan'); await sim.wait(50); expect(sim.card().message + sim.card().rows.join(' ')).toMatch(/En laboratorio/); });
  test('«la de Ana» con dos: pregunta cuál', async () => {
    await start();
    await sim.say('dónde está la de Ana');
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('la segunda');
    await sim.wait(50);
    expect(sim.card().message + sim.card().rows.join(' ')).toMatch(/En laboratorio/);
  });
  test('con la orden abierta: «llegó» sin nombrar', async () => {
    await start();
    await sim.say('abrí la de Juan');
    await sim.say('ya llegó');
    await sim.say('sí');
    expect(lab().moves).toEqual([{ id: 46, to: 3 }]);
  });
  test('«no» deja la orden como está', async () => { await start(); await sim.sayAll('llegó la de Juan', 'no'); expect(lab().moves).toEqual([]); });
  test('sin orden abierta ni nombre: no la inventa', async () => { await start(); await sim.say('ya llegó'); expect(lab().moves).toEqual([]); });
  test('nombre que no está: lo dice', async () => { await start(); await sim.say('abrí la de Roberto'); expect(sim.card().message).toBe('No encontré esa orden en la lista que se ve.'); });
  test('con número sigue igual: «la orden 46 llegó»', async () => { await start(); await sim.say('la orden 46 llegó'); await sim.say('sí'); expect(lab().moves).toEqual([{ id: 46, to: 3 }]); });
  test('es-ES «abre la de Juan Pérez»', async () => { await start('es-ES'); await sim.say('abre la de Juan Pérez'); expect(lab().bridge.selectedId).toBe(46); expect(sim.card().message).toBe('He abierto la orden 46 de Juan Pérez.'); });
  test('en «open the one for Juan» y «it arrived»', async () => {
    await start('en');
    await sim.say('open the one for Juan');
    expect(lab().bridge.selectedId).toBe(46);
    await sim.say('it arrived');
    await sim.say('yes');
    expect(lab().moves).toEqual([{ id: 46, to: 3 }]);
  });
});

test.describe('LB-NAV · Llegar y seguir', () => {
  test('«andá a laboratorio y abrí la de Juan Pérez»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a laboratorio y abrí la de Juan Pérez');
    expect(sim.navigations).toEqual(['/lab-orders']);
    expect(lab().bridge.selectedId).toBe(46);
  });
});
