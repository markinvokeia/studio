import { expect, test } from '@playwright/test';

import { borrowMicrophone, onGlobalVoiceOn } from '@/lib/voice/mic-handoff';
import { publishVoiceBridge } from '@/lib/voice/screen-bridge';
import { updateVoiceDomains } from '@/lib/voice/session';
import { useVoiceCommand } from '@/stores/voice-command-store';

import { openWindow } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * PE · Periodontograma con el botón único (src/lib/voice/commands/perio-dictate.ts y
 * src/lib/voice/mic-handoff.ts): con el examen abierto lo dicho va a su dictado; navegar,
 * desplazarse y dejar de escuchar siguen siendo generales; un solo micrófono a la vez.
 */

let sim: VoiceSim;
const OWNER = {};
let dictated: string[] = [];
test.afterEach(() => { publishVoiceBridge('perio', null, OWNER); sim.dispose(); });

async function startExam(locale: 'es' | 'en' = 'es') {
  sim = await createVoiceSim({ locale, route: '/patients' });
  dictated = [];
  // El examen abierto en una ventana, encima de la ficha del paciente (como en la app).
  openWindow('Periodontograma', { buttons: ['Guardar', 'Cerrar examen'] });
  publishVoiceBridge('perio', { dictate: (p: string) => dictated.push(p) }, OWNER);
  updateVoiceDomains(['perio', ...sim.domains()]);
}

test.describe('PE-ROUTE · Lo dicho va al dictado del periodontograma', () => {
  for (const said of ['3 2 3', 'sangrado en la 16', 'siguiente diente', 'vestibular del 26 4 3 5', 'supuración', 'terminé', 'la 18 no está', 'copiá el examen anterior']) {
    test(`«${said}»`, async () => {
      await startExam();
      await sim.say(said);
      expect(dictated).toEqual([said]);
      expect(sim.aiCalls).toHaveLength(0);
    });
  }
  test('no cierra la ventana del examen ni aprieta sus botones', async () => {
    await startExam();
    await sim.say('guardar');
    expect(dictated).toEqual(['guardar']);
  });
  test('en «three two three» y «bleeding on 16»', async () => {
    await startExam('en');
    await sim.sayAll('three two three', 'bleeding on 16');
    expect(dictated).toHaveLength(2);
  });
});

test.describe('PE-GENERAL · Lo general sigue siendo general', () => {
  test('«andá a la agenda» navega', async () => { await startExam(); await sim.say('andá a la agenda'); expect(sim.navigations).toEqual(['/appointments']); expect(dictated).toEqual([]); });
  test('«bajá» desplaza', async () => { await startExam(); await sim.say('bajá un poco'); expect(dictated).toEqual([]); });
  test('«dejá de escuchar» apaga el micrófono', async () => { await startExam(); await sim.say('dejá de escuchar'); expect(dictated).toEqual([]); expect(sim.store().alwaysOn).toBe(false); });
  test('sin examen abierto no se dicta nada', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    dictated = [];
    await sim.say('3 2 3');
    expect(dictated).toEqual([]);
  });
});

test.describe('PE-MIC · Un solo micrófono a la vez', () => {
  test('el dictado propio pide prestado el micrófono y lo devuelve', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    expect(useVoiceCommand.getState().alwaysOn).toBe(true);
    const giveBack = borrowMicrophone();
    expect(useVoiceCommand.getState().alwaysOn).toBe(false);
    giveBack();
    expect(useVoiceCommand.getState().alwaysOn).toBe(true);
  });
  test('si el botón Voz estaba apagado, no lo prende al devolver', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    await sim.toggle();
    expect(useVoiceCommand.getState().alwaysOn).toBe(false);
    borrowMicrophone()();
    expect(useVoiceCommand.getState().alwaysOn).toBe(false);
  });
  test('prender el botón Voz avisa (para apagar el dictado propio)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    await sim.toggle();
    let told = 0;
    const stop = onGlobalVoiceOn(() => { told++; });
    await sim.toggle();
    stop();
    expect(told).toBe(1);
  });
});
