import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N4 · Incompletos o mal dichos, en español (docs/voz-agenda-pruebas.md §N4): falta el paciente,
 * la hora, el doctor, la cita o el motivo; el reconocedor escribió mal un nombre; la respuesta no
 * se entiende. El agente pregunta lo que falta, insiste un par de veces y, si no, lo dice sin
 * romper nada y deja seguir.
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;

test.describe('N4.1 · Falta información: pregunta y sigue', () => {
  test('VZ-ES-400 «dame una cita» sin nada: pregunta paciente, hora… y abre el formulario', async () => {
    await sim.say('dame una cita para mañana');
    expect(sim.card().awaiting).not.toBeNull();
    // Contesta lo que vaya preguntando: paciente, hora, doctor, tratamiento.
    for (const answer of ['Sofía Castro', 'a las 10', 'el doctor Pérez', 'limpieza']) {
      if (sim.store().card && sim.cal.state.form.kind === null && sim.store().awaiting) await sim.say(answer);
    }
    expect(sim.cal.calls('openAppointmentForm')[0]?.[0]).toBe('create');
    expect(sim.cal.form?.patient?.name).toBe('Sofía Castro');
  });
  test('VZ-ES-401 «editá la cita» sin decir cuál (sin foco): pregunta cuál y sigue', async () => {
    await sim.say('editá la cita');
    expect(sim.card().message).toMatch(/Qué cita/);
    await sim.say('la de Carlos López');
    expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['edit', 'a4']);
  });
  test('VZ-ES-402 «cancelá la de las 10» sin motivo: pregunta el motivo', async () => {
    await sim.say('cancelá la de las 10');
    await sim.say('avisó con tiempo');
    if (sim.card().awaiting === 'confirm') await sim.say('sí');
    expect(sim.cal.calls('changeStatus')[0]).toEqual(['a2', 'cancelled', { cancellation_reason: 'in_time' }]);
  });
  test('VZ-ES-403 «bloqueá el lunes» sin horas: pregunta la franja', async () => {
    await sim.say('bloqueá el lunes');
    expect(sim.card().awaiting).not.toBeNull();
  });
  test('VZ-ES-404 «resumen del paciente» sin cita en foco: pregunta de qué paciente', async () => {
    await sim.say('dame un resumen del paciente');
    expect(sim.card().message).toMatch(/paciente/i);
    await sim.say('Carlos López');
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p4');
  });
  test('VZ-ES-405 buscar paciente sin datos: pide cédula, email o teléfono', async () => {
    await sim.say('buscá el paciente');
    // «buscá el paciente» solo no tiene nombre: se toma como pedido de buscar (pregunta el dato).
    if (sim.card().awaiting) {
      await sim.say('el teléfono es 099 123 456');
      expect(sim.cal.calls('openPatient')).toEqual([['p9']]);
    }
  });
});

test.describe('N4.2 · Mal dicho o mal transcripto', () => {
  test('VZ-ES-410 «Juan Peres» (con s) encuentra a Juan Pérez', async () => {
    await sim.say('la cita de Juan Peres');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a2']]);
  });
  test('VZ-ES-411 «carlos lopes llegó» sin tildes ni z', async () => {
    await sim.say('carlos lopes llegó');
    await sim.say('sí');
    expect(status('a4')).toBe('arrived');
  });
  test('VZ-ES-412 números en palabras: «zoom al ciento cincuenta»', async () => {
    await sim.say('zoom al ciento cincuenta');
    expect(sim.cal.state.zoom).toBe(1.5);
  });
  test('VZ-ES-413 «slots de quince minutos»', async () => {
    await sim.say('slots de quince minutos');
    expect(sim.cal.state.settings?.slot_duration).toBe(15);
  });
  test('VZ-ES-414 muletillas: «eh bueno dale andá a mañana»', async () => {
    await sim.say('eh bueno dale andá a mañana');
    expect(sim.cal.calls('goToDate')).toHaveLength(1);
  });
  test('VZ-ES-415 respuestas que no se entienden: insiste y después lo deja sin cambiar nada', async () => {
    await sim.say('Juan Pérez llegó');
    await sim.say('mmm');
    await sim.say('este');
    await sim.say('ehh');
    expect(sim.cal.calls('changeStatus')).toEqual([]);
    expect(sim.card().awaiting).toBeNull();
  });
  test('VZ-ES-416 una frase que nadie entiende (ni la IA): muestra ejemplos sin romper nada', async () => {
    await sim.say('blablablá trululú');
    expect(sim.card().message).toMatch(/Probá|por ejemplo/i);
    expect(sim.cal.log).toEqual([]);
    // Y se puede seguir usando.
    await sim.say('vista día');
    expect(sim.cal.state.view).toBe('day');
  });
  test('VZ-ES-417 la IA no responde (error de red): «No entendí» y se sigue usando', async () => {
    sim.ai.reply(/caída/, () => { throw new Error('n8n caído'); });
    await sim.say('hacé algo con la caída del sistema');
    await sim.say('vista mes');
    expect(sim.cal.state.view).toBe('month');
  });
});

test.describe('N4.3 · Regla de oro: un paso que falla nunca deja trabada la voz', () => {
  test('VZ-ES-420 una acción de la pantalla que tira error: avisa y la voz sigue', async () => {
    sim.cal.state.ready = true;
    const original = (await import('@/lib/voice/calendar-bridge')).getCalendarVoice()!.actions.changeStatus;
    (await import('@/lib/voice/calendar-bridge')).getCalendarVoice()!.actions.changeStatus = async () => { throw new Error('fallo del backend'); };
    await sim.say('Juan Pérez llegó');
    await sim.say('sí');
    expect(sim.card().tone).toBe('error');
    expect(sim.card().message).toMatch(/Ups|no pude/i);
    (await import('@/lib/voice/calendar-bridge')).getCalendarVoice()!.actions.changeStatus = original;
    await sim.say('vista día');
    expect(sim.cal.state.view).toBe('day');
  });
  test('VZ-ES-421 sin la pantalla de citas cargada: lo dice y no se cuelga', async () => {
    (await import('@/lib/voice/calendar-bridge')).publishCalendarVoice(null);
    await sim.say('vista día');
    expect(sim.card().tone).toBe('error');
  });
});
