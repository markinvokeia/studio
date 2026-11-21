import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N1 · Atómicos en español sobre una cita (docs/voz-agenda-pruebas.md §N1.10–N1.13): encontrarla,
 * cambiarle el estado, cancelarla con motivo, borrarla, color, doctor, consultorio, duración,
 * moverla y abrir lo del paciente. Datos de hoy: 09:00 Ana Gómez · 10:00 Juan Pérez ·
 * 10:30 Ana Martínez · 15:00 Carlos López. Mañana: 11:00 María Rodríguez · 16:00 Lucía Fernández.
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

const status = (id: string) => (sim.cal.appointments.find((a) => a.id === id) as unknown as { status: string }).status;

test.describe('N1.10 · Encontrar y seleccionar', () => {
  test('VZ-ES-110 «la cita de Juan Pérez» la selecciona y queda en foco', async () => {
    await sim.say('Invoke la cita de Juan Pérez');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a2']]);
    expect(sim.store().focusLabel).toBe('Juan Pérez');
  });
  test('VZ-ES-111 «mostrame la cita de las 15» por hora', async () => {
    await sim.say('Invoke mostrame la cita de las 15');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a4']]);
  });
  test('VZ-ES-112 «la cita de María de mañana» por día', async () => {
    await sim.say('Invoke la cita de María de mañana');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a5']]);
  });
  test('VZ-ES-113 dos «Ana» hoy: pregunta cuál y «la segunda» elige 10:30', async () => {
    await sim.say('Invoke la cita de Ana');
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('la segunda');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
  test('VZ-ES-114 dos «Ana»: «la de las 9» elige por hora', async () => {
    await sim.say('Invoke la cita de Ana');
    await sim.say('la de las 9');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a1']]);
  });
  test('VZ-ES-115 dos «Ana»: «Martínez» elige por nombre', async () => {
    await sim.say('Invoke la cita de Ana');
    await sim.say('Martínez');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
  test('VZ-ES-116 dos «Ana»: «la última» elige la de abajo', async () => {
    await sim.say('Invoke la cita de Ana');
    await sim.say('la última');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
  test('VZ-ES-117 una que no existe lo dice', async () => {
    await sim.say('Invoke la cita de Ricardo Montes');
    expect(sim.card().tone).toBe('error');
  });
  test('VZ-ES-118 «olvidá esa cita» limpia el foco', async () => {
    await sim.say('Invoke la cita de Juan Pérez');
    await sim.say('olvidá esa cita');
    expect(sim.store().focusLabel).toBeNull();
  });
});

test.describe('N1.11 · Estados (menú de la cita)', () => {
  const cases = [
    ['Juan Pérez llegó', 'a2', 'arrived'],
    ['Carlos López confirmó', 'a4', 'confirmed'],
    ['Juan Pérez llegó tarde', 'a2', 'arrived_late'],
    ['Juan Pérez pasó a consulta', 'a2', 'in_progress'],
    ['marcá como completada la de Carlos López', 'a4', 'completed'],
    ['Carlos López no vino', 'a4', 'no_show'],
  ] as const;
  for (const [said, id, next] of cases) {
    test(`VZ-ES-12x «${said}» → ${next} (confirma y «sí» lo aplica)`, async () => {
      await sim.say(`Invoke ${said}`);
      expect(sim.card().awaiting).toBe('confirm');
      await sim.say('sí');
      expect(status(id)).toBe(next);
    });
  }
  test('VZ-ES-127 «no» deja el estado como estaba', async () => {
    await sim.say('Invoke Juan Pérez llegó');
    await sim.say('no');
    expect(status('a2')).toBe('confirmed');
    expect(sim.cal.calls('changeStatus')).toEqual([]);
  });
  test('VZ-ES-128 cancelar con motivo dicho: «Carlos López canceló con tiempo»', async () => {
    await sim.say('Invoke Carlos López canceló con tiempo');
    await sim.say('sí');
    expect(sim.cal.calls('changeStatus')[0]).toEqual(['a4', 'cancelled', { cancellation_reason: 'in_time' }]);
  });
  test('VZ-ES-129 cancelar sin motivo lo pregunta', async () => {
    await sim.say('Invoke cancelá la cita de Carlos López');
    expect(sim.card().choices.length + (sim.card().awaiting ? 1 : 0)).toBeGreaterThan(0);
    await sim.say('canceló tarde');
    if (sim.card().awaiting === 'confirm') await sim.say('sí');
    expect(sim.cal.calls('changeStatus')[0]?.[1]).toBe('cancelled');
  });
});

test.describe('N1.12 · Menú: borrar, color, doctor, consultorio, duración, mover', () => {
  test('VZ-ES-130 borrá la cita de Carlos López (confirmación de peligro)', async () => {
    await sim.say('Invoke borrá la cita de Carlos López');
    expect(sim.card().tone).toBe('danger');
    await sim.say('sí');
    expect(sim.cal.calls('deleteAppointment')).toEqual([['a4']]);
  });
  test('VZ-ES-131 «poné la cita de Juan en rojo»', async () => {
    await sim.say('Invoke poné la cita de Juan en rojo');
    await sim.say('sí');
    expect(sim.cal.calls('changeColor')).toEqual([['a2', '11']]);
  });
  test('VZ-ES-132 «pasá la cita de Juan Pérez al doctor Gómez»', async () => {
    await sim.say('Invoke pasá la cita de Juan Pérez al doctor Gómez');
    await sim.say('sí');
    expect(sim.cal.calls('reassign')).toEqual([['a2', 'd3', null]]);
  });
  test('VZ-ES-133 «pasá la cita de Carlos López al sillón 2»', async () => {
    await sim.say('Invoke pasá la cita de Carlos López al sillón 2');
    await sim.say('sí');
    expect(sim.cal.calls('reassign')).toEqual([['a4', null, 'c2']]);
  });
  test('VZ-ES-134 «que la cita de Juan Pérez dure 45 minutos»', async () => {
    await sim.say('Invoke que la cita de Juan Pérez dure 45 minutos');
    await sim.say('sí');
    expect(sim.cal.calls('retime')[0]?.[0]).toBe('a2');
    expect(sim.cal.calls('retime')[0]?.[2]).toBe('10:45');
  });
  test('VZ-ES-135 «pasá la cita de Juan Pérez al viernes a las 11» abre Reprogramar completo', async () => {
    await sim.say('Invoke pasá la cita de Juan Pérez al viernes a las 11');
    expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['reschedule', 'a2']);
    await sim.say('sí');
    expect(sim.cal.savedForms).toHaveLength(1);
  });
});

test.describe('N1.13 · Abrir lo del paciente', () => {
  for (const [said, target] of [
    ['abrí la cuenta de Juan Pérez', 'accounts'],
    ['abrí la historia clínica de Juan Pérez', 'history'],
    ['mostrame las imágenes de Juan Pérez', 'documents'],
    ['abrí el historial de citas de Juan Pérez', 'appointments'],
    ['mostrame los datos del paciente Juan Pérez', 'patient'],
  ] as const) {
    test(`VZ-ES-14x «${said}» → ${target}`, async () => {
      await sim.say(`Invoke ${said}`);
      expect(sim.cal.calls('openAppointmentTool')).toEqual([['a2', target]]);
    });
  }
  test('VZ-ES-146 «cobrale a Juan Pérez» abre el cobro rápido con su cita', async () => {
    await sim.say('Invoke cobrale a Juan Pérez');
    expect(sim.cal.calls('openPatientAction')).toEqual([['p2', 'bill', 'a2']]);
  });
  test('VZ-ES-147 sin permiso de cuentas lo dice', async () => {
    sim.cal.state.canViewAccounts = false;
    await sim.say('Invoke abrí la cuenta de Juan Pérez');
    expect(sim.card().tone).toBe('error');
  });
});
