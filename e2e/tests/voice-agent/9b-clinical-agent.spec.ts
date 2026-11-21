import { expect, test } from '@playwright/test';

import { openWindow } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';
import { parseRichText, plainRichText } from '@/components/voice/voice-rich-text';
import { useVoiceCommand } from '@/stores/voice-command-store';

/**
 * CC · Caso clínico en Mi consultorio (src/lib/voice/commands/workspace-agent.ts): con una cita
 * elegida, lo que se pide es de ese paciente y va al agente clínico (el del chat «Agente clínico»,
 * ai/doctor/query): resúmenes, preguntas, dictar la sesión, guardar o revisar, el odontograma.
 * Lo de la pantalla (receta, laboratorio, otra cita) lo siguen haciendo los comandos de la página.
 * Lo que no es del caso pregunta antes de cerrarlo. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const ws = () => sim.workspace()!;
const agentLog = () => ws().agentLog;
const clinicalCase = () => useVoiceCommand.getState().clinicalCase;
/** Mi consultorio con la cita de Ana (09:00) elegida: el caso clínico abierto. */
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es') => {
  sim = await createVoiceSim({ locale, route: '/workspace' });
  await sim.say(locale === 'en' ? 'the 9 o clock' : 'el de las 9');
};

test.describe('CC-CASE · El caso es el paciente elegido', () => {
  test('al elegir la cita queda marcado el caso clínico', async () => {
    await start();
    expect(clinicalCase()).toEqual({ appointmentId: 'w1', patient: 'Ana Gómez', open: true });
  });
  test('sin cita elegida no hay caso: la pregunta no va al agente', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/workspace' });
    await sim.say('qué alergias tiene');
    expect(clinicalCase()).toBeNull();
    expect(sim.workspace()!.agentLog).toEqual([]);
  });
  test('otra cita: otro caso (y la pregunta va con esa cita)', async () => {
    await start();
    await sim.sayAll('el de las 10', 'qué alergias tiene');
    expect(clinicalCase()?.patient).toBe('Juan Pérez');
    expect(agentLog()).toEqual(['w2:qué alergias tiene']);
  });
});

test.describe('CC-ASK · Preguntas y resúmenes al agente clínico', () => {
  for (const [locale, said] of [
    ['es', 'dame un resumen del paciente'], ['es', 'qué alergias tiene'], ['es', '¿Qué le hice la última vez?'],
    ['es', 'resumime el caso'], ['es', 'qué le toca hoy'], ['es', 'tiene alguna deuda'],
    ['es-ES', 'dame un resumen de la paciente'], ['es-ES', '¿qué alergias tiene?'],
    ['en', 'give me a summary of the patient'], ['en', 'does she have any allergies'], ['en', 'what did we do last time'],
  ] as const) {
    test(`${locale} «${said}» va al agente con la cita elegida`, async () => {
      await start(locale);
      await sim.say(said);
      expect(agentLog()).toEqual([`w1:${said}`]);
      expect(sim.card().title).toBe(locale === 'en' ? 'Clinical case' : 'Caso clínico');
      expect(sim.store().card?.subtitle).toBe('Ana Gómez');
    });
  }
  test('la respuesta se muestra y se lee', async () => {
    await start();
    await sim.say('qué alergias tiene');
    expect(sim.card().message).toBe('Alérgica a la penicilina.');
  });
  test('el resumen', async () => {
    await start();
    await sim.say('dame un resumen');
    expect(sim.card().message).toBe('Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16.');
  });
  test('si el agente no contesta, lo dice', async () => {
    await start();
    ws().nextAgentReply(null);
    await sim.say('qué alergias tiene');
    expect(sim.card().message).toBe('El agente clínico no contestó. Probá de nuevo.');
  });
  test('lo que no se pudo hacer se muestra (el motivo de la pantalla)', async () => {
    await start();
    ws().nextAgentReply({ intent: 'session_structuring', acted: true, texts: ['Abro la sesión.'], problems: ['La sesión solo se puede completar el día de la cita.'] });
    await sim.say('le hice una limpieza');
    expect(sim.card().message).toContain('La sesión solo se puede completar el día de la cita.');
    expect(sim.card().tone).toBe('error');
  });
});

test.describe('CC-SESSION · Dictar la sesión, guardar o revisar', () => {
  test('el dictado va entero (aunque tenga varias partes) y el agente pregunta: «guardala»', async () => {
    await start();
    await sim.say('hice una limpieza y una restauración en el 16, próxima cita control en 6 meses');
    expect(agentLog()).toEqual(['w1:hice una limpieza y una restauración en el 16, próxima cita control en 6 meses']);
    expect(sim.card().message).toMatch(/¿La guardo o preferís revisarla\?$/);
    expect(sim.store().awaiting).toBe('answer');
    await sim.say('guardala');
    expect(agentLog()[1]).toBe('w1:guardala');
    expect(ws().log).toContain('agent:save');
    expect(sim.card().message).toBe('Guardé la sesión.');
  });
  test('«revisala» abre la sesión para revisar', async () => {
    await start();
    await sim.sayAll('le hice una limpieza', 'revisala');
    expect(ws().log).toContain('agent:review');
  });
  test('«sí» como respuesta va al agente', async () => {
    await start();
    await sim.sayAll('le hice una limpieza', 'sí');
    expect(agentLog()[1]).toBe('w1:sí');
    expect(ws().log).toContain('agent:save');
  });
  test('«completá la sesión: hice una limpieza…» con lo dictado va al agente (no abre la sesión vacía)', async () => {
    await start();
    await sim.say('completá la sesión hice una limpieza en el 16');
    expect(agentLog()).toEqual(['w1:completá la sesión hice una limpieza en el 16']);
    expect(ws().log).not.toContain('session');
  });
  test('«abrí el odontograma y marcá caries en el 16» lo arma el agente', async () => {
    await start();
    await sim.say('abrí el odontograma y marcá caries en el 16');
    expect(ws().log).toContain('agent:odontogram');
  });
  test('es-ES «le he hecho una limpieza» y «guárdala»', async () => {
    await start('es-ES');
    await sim.sayAll('le he hecho una limpieza', 'guárdala');
    expect(ws().log).toContain('agent:save');
  });
  test('en «I did a cleaning on 16» then «save it»', async () => {
    await start('en');
    await sim.say('I did a cleaning on 16');
    ws().nextAgentReply({ intent: 'session_structuring', acted: true, texts: ['Saved the session.'], speech: 'Saved the session.' });
    await sim.say('save it');
    expect(agentLog()).toEqual(['w1:I did a cleaning on 16', 'w1:save it']);
    expect(sim.card().message).toBe('Saved the session.');
  });
});

test.describe('CC-SCREEN · Lo de la pantalla sigue siendo de la página', () => {
  for (const [said, want] of [
    ['hacele una receta', 'prescribe'], ['nueva orden de laboratorio', 'labOrder'], ['abrí el periodontograma', 'perio'],
    ['una sesión estética', 'aesthetic'], ['abrí la ficha', 'file:-'], ['completá la sesión clínica', 'session'],
  ] as const) {
    test(`«${said}» lo hace la pantalla con el paciente del caso`, async () => {
      await start();
      await sim.say(said);
      expect(ws().log).toEqual(['select:w1', want]);
      expect(agentLog()).toEqual([]);
    });
  }
  test('«el de las 10» cambia de paciente (y de caso)', async () => {
    await start();
    await sim.say('el de las 10');
    expect(clinicalCase()?.appointmentId).toBe('w2');
    expect(agentLog()).toEqual([]);
  });
});

test.describe('CC-CLOSE · Cerrar el caso', () => {
  test('lo que no es del caso pregunta antes de cerrarlo; «no» se queda', async () => {
    await start();
    await sim.say('decime el clima de mañana');
    expect(sim.card().message).toMatch(/¿Cierro el caso clínico y lo hago aparte\?$/);
    await sim.say('no');
    expect(clinicalCase()?.open).toBe(true);
  });
  test('«sí» lo cierra (y ya no se pregunta al agente)', async () => {
    await start();
    await sim.sayAll('decime el clima de mañana', 'sí');
    expect(clinicalCase()?.open).toBe(false);
    await sim.say('qué alergias tiene');
    expect(agentLog()).toEqual(['w1:decime el clima de mañana']);
  });
  test('«cerrá el caso» y «volvé al caso»', async () => {
    await start();
    await sim.say('cerrá el caso');
    expect(clinicalCase()?.open).toBe(false);
    expect(sim.card().message).toMatch(/^Cerré el caso de Ana Gómez/);
    await sim.say('volvé al caso');
    expect(clinicalCase()?.open).toBe(true);
    await sim.say('qué alergias tiene');
    expect(agentLog()).toEqual(['w1:qué alergias tiene']);
  });
  test('cerrado, elegir otra cita abre ese caso', async () => {
    await start();
    await sim.sayAll('cerrá el caso', 'el de las 10');
    expect(clinicalCase()).toEqual({ appointmentId: 'w2', patient: 'Juan Pérez', open: true });
  });
  test('es-ES «cierra el caso» / «vuelve al caso»', async () => {
    await start('es-ES');
    await sim.sayAll('cierra el caso', 'vuelve al caso');
    expect(clinicalCase()?.open).toBe(true);
    expect(sim.card().message).toBe('He vuelto al caso de Ana Gómez.');
  });
  test('en «close the case» / «back to the case»', async () => {
    await start('en');
    await sim.say('close the case');
    expect(clinicalCase()?.open).toBe(false);
    await sim.say('back to the case');
    expect(clinicalCase()?.open).toBe(true);
  });
});

test.describe('CC-ROOM · La charla de la sala no va al agente', () => {
  for (const said of ['bueno bueno', 'muy bien así', 'aguantá un poquito'] as const) {
    test(`«${said}»`, async () => {
      await start();
      await sim.say(said);
      expect(agentLog()).toEqual([]);
    });
  }
});

test.describe('CC-CARD · La respuesta se lee con calma y con formato', () => {
  test('la respuesta del agente no se esconde sola y viene con formato', async () => {
    await start();
    await sim.say('dame un resumen');
    expect(sim.store().card?.sticky).toBe(true);
    expect(sim.store().card?.rich).toBe(true);
    await sim.wait(150);
    expect(sim.store().card?.message).toMatch(/^Ana Gómez/);
  });
  for (const said of ['gracias', 'cerrá', 'listo', 'ok gracias', 'thanks'] as const) {
    test(`«${said}» cierra la respuesta fija (y el caso sigue abierto)`, async () => {
      await start();
      await sim.say('dame un resumen');
      expect(sim.store().card?.sticky).toBe(true);
      await sim.say(said);
      expect(sim.store().card).toBeNull();
      expect(clinicalCase()?.open).toBe(true);
      expect(agentLog()).toEqual(['w1:dame un resumen']);
    });
  }
  test('markdown: negritas, listas y títulos sin los símbolos', () => {
    const blocks = parseRichText('## Resumen\n**Ana Gómez**, 42 años.\n- Alergia: *penicilina*\n- Pieza 16: caries\n1. Limpieza\n2. Control');
    expect(blocks).toEqual([
      { kind: 'heading', text: 'Resumen' },
      { kind: 'paragraph', text: '**Ana Gómez**, 42 años.' },
      { kind: 'list', ordered: false, items: ['Alergia: *penicilina*', 'Pieza 16: caries'] },
      { kind: 'list', ordered: true, items: ['Limpieza', 'Control'] },
    ]);
  });
  test('para leer en voz alta, sin asteriscos ni numerales', () => {
    expect(plainRichText('**Ana**: alergia a la *penicilina*.\n* Pieza 16')).toBe('Ana: alergia a la penicilina.. Pieza 16'.replace('..', '.'));
  });
});

test.describe('CC-OVERLAY · Con una ventana abierta, lo suyo no va al agente', () => {
  test('«cancelar» con la receta abierta aprieta Cancelar (no le pregunta al agente)', async () => {
    await start();
    const win = openWindow('Nueva Receta Médica', { buttons: ['Cancelar', 'Guardar'], fields: ['Dosis'] });
    await sim.say('cancelar');
    expect(agentLog()).toEqual([]);
    expect(win.pressed).toEqual(['Cancelar']);
  });
  test('«la dosis es 400 mg» con la receta abierta va al campo', async () => {
    await start();
    const win = openWindow('Nueva Receta Médica', { buttons: ['Guardar'], fields: ['Dosis'] });
    await sim.say('la dosis es 400 mg');
    expect(agentLog()).toEqual([]);
    expect(win.values.Dosis).toBe('400 mg');
  });
  test('una pregunta del paciente con la receta abierta sí va al agente', async () => {
    await start();
    openWindow('Nueva Receta Médica', { buttons: ['Guardar'], fields: ['Dosis'] });
    await sim.say('qué alergias tiene');
    expect(agentLog()).toEqual(['w1:qué alergias tiene']);
  });
});
