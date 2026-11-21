import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * AL · Centro de alertas por voz (src/lib/voice/commands/alerts.ts): leer, filtrar por estado y
 * prioridad, seleccionar, y completar, ignorar (con motivo), posponer, registrar llamada, nota,
 * mail, WhatsApp y abrir el paciente sobre una, varias o todas. Lo que cambia algo se confirma.
 * Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const log = () => sim.alerts()!.log;
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route: '/alerts' }); };

test.describe('AL-READ · Leer y filtrar', () => {
  test('«cuántas alertas hay»', async () => { await start(); await sim.say('cuántas alertas hay'); expect(sim.card().message).toBe('Hay 5 alertas: 2 Cumpleaños, 1 Cobranza, 1 Laboratorio, 1 Recordatorios.'); });
  test('«qué alertas críticas hay»', async () => { await start(); await sim.say('qué alertas críticas hay'); expect(sim.card().message).toBe('Hay 1 alerta: 1 Laboratorio.'); });
  test('la lectura va en filas', async () => { await start(); await sim.say('leé las alertas'); expect(sim.card().rows).toHaveLength(5); });
  for (const [said, want] of [
    ['mostrame las completadas', 'status:COMPLETED'], ['las ignoradas', 'status:IGNORED'], ['solo las pendientes', 'status:PENDING'], ['ver todas', 'status:all'],
    ['solo las críticas', 'priority:CRITICAL'], ['mostrame las de prioridad alta', 'priority:HIGH'], ['ver todas las prioridades', 'priority:all'], ['actualizá las alertas', 'refresh'],
  ] as const) {
    test(`«${said}»`, async () => { await start(); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('en «how many alerts are there» y «show me the completed alerts»', async () => {
    await start('en');
    await sim.say('how many alerts are there');
    expect(sim.card().message).toMatch(/^There are 5 alerts/);
    await sim.say('show me the completed alerts');
    expect(log()).toEqual(['status:COMPLETED']);
  });
});

test.describe('AL-ACT · Actuar sobre alertas', () => {
  test('«completá la de Carlos» confirma y completa', async () => {
    await start();
    await sim.say('completá la de Carlos');
    expect(sim.card().message).toBe('¿Marco como completada Factura vencida (Carlos López)?');
    await sim.say('sí');
    expect(log()).toEqual(['complete:al2']);
  });
  test('«completá la primera» y «no»: no cambia nada', async () => { await start(); await sim.sayAll('completá la primera', 'no'); expect(log()).toEqual([]); });
  test('«ignorá la del laboratorio porque ya llegó» con el motivo', async () => {
    await start();
    await sim.sayAll('ignorá la del laboratorio porque ya llegó', 'sí');
    expect(log()).toEqual(['ignore:al4:ya llegó']);
  });
  test('«ignorá la de Sofía» pregunta el motivo', async () => {
    await start();
    await sim.say('ignorá la de Sofía');
    expect(sim.card().message).toBe('¿Por qué la ignoro?');
    await sim.sayAll('se atendió por teléfono', 'sí');
    expect(log()).toEqual(['ignore:al5:se atendió por teléfono']);
  });
  test('«posponé las de cumpleaños hasta mañana» (varias, sin preguntar cuál)', async () => {
    await start();
    await sim.say('posponé las de cumpleaños hasta mañana');
    expect(log()[0]).toMatch(/^snooze:al1,al3:\d{4}-\d{2}-\d{2}T09:00$/);
  });
  test('«posponé la de Carlos una semana»', async () => { await start(); await sim.say('posponé la de Carlos una semana'); expect(log()[0]).toMatch(/^snooze:al2:/); });
  test('«posponé la de Juan» pregunta hasta cuándo', async () => {
    await start();
    await sim.say('posponé la de Juan');
    expect(sim.card().message).toBe('¿Hasta cuándo la pospongo?');
    await sim.say('hasta el lunes');
    expect(log()[0]).toMatch(/^snooze:al1:/);
  });
  test('«registrá una llamada a Carlos para mañana a las 10»', async () => { await start(); await sim.say('registrá una llamada a Carlos para mañana a las 10'); expect(log()[0]).toMatch(/^call:al2:\d{4}-\d{2}-\d{2}$/); });
  test('«agregá una nota a la de Carlos: pagará el viernes»', async () => { await start(); await sim.say('agregá una nota a la de Carlos: pagará el viernes'); expect(log()).toEqual(['note:al2:pagará el viernes']); });
  test('«mandale un whatsapp a Juan» confirma y manda', async () => { await start(); await sim.sayAll('mandale un whatsapp a Juan', 'sí'); expect(log()).toEqual(['whatsapp:al1']); });
  test('sin teléfono ni plantilla: lo dice', async () => { await start(); await sim.say('mandale un whatsapp a la del laboratorio'); expect(sim.card().message).toMatch(/^No se puede mandar WhatsApp/); });
  test('«mandale un mail a Carlos» abre el mail', async () => { await start(); await sim.say('mandale un mail a Carlos'); expect(log()).toEqual(['email:al2']); });
  test('«abrí el paciente de la segunda»', async () => { await start(); await sim.say('abrí el paciente de la segunda'); expect(log()).toEqual(['patient:al2']); });
  test('«las de cumpleaños» con una sola acción por persona: pregunta cuál', async () => {
    await start();
    await sim.say('mandale un mail a la de cumpleaños');
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('la segunda');
    expect(log()).toEqual(['email:al3']);
  });
  test('seleccionar y completar las seleccionadas', async () => {
    await start();
    await sim.sayAll('seleccioná la de Juan', 'seleccioná la de Carlos', 'completá las seleccionadas', 'sí');
    expect(log()).toEqual(['selected:al1', 'selected:al1,al2', 'complete:al1,al2']);
  });
  test('«completá todas las críticas»', async () => { await start(); await sim.sayAll('completá las críticas', 'sí'); expect(log()).toEqual(['complete:al4']); });
  test('sin permiso: lo dice', async () => {
    await start();
    sim.alerts()!.bridge.permissions.complete = false;
    await sim.say('completá la de Carlos');
    expect(log()).toEqual([]);
  });
  test('es-ES «pospón la de Carlos hasta mañana»', async () => { await start('es-ES'); await sim.say('pospón la de Carlos hasta mañana'); expect(log()[0]).toMatch(/^snooze:al2:/); });
  test('en «complete the alert for Carlos», «yes», «snooze the alert for Juan until tomorrow»', async () => {
    await start('en');
    await sim.sayAll('complete the alert for Carlos', 'yes', 'snooze the alert for Juan until tomorrow');
    expect(log()[0]).toBe('complete:al2');
    expect(log()[1]).toMatch(/^snooze:al1:/);
  });
  test('en «send a whatsapp to Juan» and «yes»', async () => { await start('en'); await sim.sayAll('send a whatsapp to Juan', 'yes'); expect(log()).toEqual(['whatsapp:al1']); });
});

test.describe('AL-NAV · Llegar y actuar', () => {
  test('«andá al centro de alertas y decime cuántas alertas hay»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá al centro de alertas y decime cuántas alertas hay');
    expect(sim.navigations).toEqual(['/alerts']);
    expect(sim.card().message).toMatch(/^Hay 5 alertas/);
  });
});
