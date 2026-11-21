import { expect, test } from '@playwright/test';

import { FakeRecognition } from './sim/globals';
import { configureVoiceTiming } from '@/lib/voice/session';
import { startContinuousListening } from '@/lib/voice/speech-recognition';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * MIC · El micrófono permanente (docs/voz-agenda-pruebas.md §MIC): una pausa a mitad de frase no
 * parte el pedido en dos, lo que se sigue diciendo no se procesa antes de tiempo, la voz del
 * asistente no se toma como un pedido y no se reinicia el reconocimiento (no se pierden las
 * primeras palabras).
 */

test.describe('MIC · Reconocimiento continuo con pausa blanda', () => {
  const start = (softPause: boolean) => {
    const heard: string[] = [];
    const listening = startContinuousListening('es', { onPhrase: (t) => heard.push(t), softPause, echoGraceMs: 0 })!;
    const rec = () => FakeRecognition.active()!;
    return { heard, listening, rec };
  };
  test.afterEach(() => { FakeRecognition.instances.length = 0; });

  test('MIC-001 pausa blanda: mientras habla el asistente no toma nada y NO reinicia el reconocimiento', () => {
    const { heard, listening, rec } = start(true);
    const before = rec();
    listening.pause();
    rec().deliver('esto lo dijo el asistente');
    listening.resume();
    expect(rec()).toBe(before);
    rec().deliver('vista día');
    expect(heard).toEqual(['vista día']);
    listening.abort();
  });
  test('MIC-002 si el navegador corta la sesión, se reinicia enseguida', async () => {
    const { listening, rec } = start(true);
    const first = rec();
    first.stop();
    await new Promise((r) => setTimeout(r, 5));
    expect(rec()).not.toBe(first);
    listening.abort();
  });
});

test.describe('MIC · Juntar los pedazos hasta la pausa', () => {
  let sim: VoiceSim;
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
  test.afterEach(() => { configureVoiceTiming({ phraseGapMs: 0 }); sim.dispose(); });

  test('MIC-010 una frase cortada en dos por el navegador es un solo pedido', async () => {
    configureVoiceTiming({ phraseGapMs: 40 });
    const rec = FakeRecognition.active()!;
    rec.deliver('nueva cita para Sofía');
    rec.deliver('Castro mañana a las 10 con el doctor Pérez, limpieza');
    await sim.wait(120);
    expect(sim.cal.calls('openAppointmentForm')[0]?.[0]).toBe('create');
    expect(sim.cal.form?.patient?.name).toBe('Sofía Castro');
  });
  test('MIC-011 mientras se sigue hablando (resultados parciales) no se procesa', async () => {
    configureVoiceTiming({ phraseGapMs: 40 });
    const rec = FakeRecognition.active()!;
    rec.deliver('cuántas veces faltó');
    // El navegador sigue mandando lo que se está diciendo.
    rec.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: false, 0: { transcript: 'Juan' } } } });
    await new Promise((r) => setTimeout(r, 80));
    expect(sim.cal.calls('getPatientFacts')).toEqual([]);
    rec.deliver('Juan Pérez');
    await sim.wait(120);
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p2');
  });
  test('MIC-012 dos pedidos con una pausa larga en el medio son dos pedidos', async () => {
    configureVoiceTiming({ phraseGapMs: 30 });
    const rec = FakeRecognition.active()!;
    rec.deliver('vista día');
    await sim.wait(80);
    rec.deliver('más zoom');
    await sim.wait(80);
    expect(sim.cal.state.view).toBe('day');
    expect(sim.cal.state.zoom).toBe(1.1);
  });
  test('MIC-013 lo que se está diciendo se ve en la tarjeta mientras se habla', async () => {
    configureVoiceTiming({ phraseGapMs: 200 });
    const rec = FakeRecognition.active()!;
    rec.deliver('andá a');
    expect(sim.store().interim).toBe('andá a');
    await sim.wait(260);
  });
});
