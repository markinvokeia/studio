import { expect, test } from '@playwright/test';

import { DASHBOARD_PERMISSIONS } from '@/constants/permissions';

import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * N1 · Atómicos en español: el editor de la cita (cada campo, guardar, cancelar), exportar
 * agenda, avisos de la pantalla, pacientes (buscar por citas → widget → documento/email/teléfono)
 * y el resumen del agente clínico (docs/voz-agenda-pruebas.md §N1.14–N1.18).
 */

let sim: VoiceSim;
test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es' }); });
test.afterEach(() => sim.dispose());

/** Abre el editor de la cita de Juan Pérez (hoy 10:00, Dra. Ruiz, Sillón 2). */
async function editJuan() {
  await sim.say('editá la cita de Juan Pérez');
  expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['edit', 'a2']);
  expect(sim.card().awaiting).toBe('confirm');
}

test.describe('N1.14 · Editor de la cita: cada campo', () => {
  test('VZ-ES-150 editar abre el formulario y queda parado ahí', async () => {
    await editJuan();
  });
  test('VZ-ES-151 cambiar el doctor', async () => {
    await editJuan();
    await sim.say('con el doctor Gómez');
    expect(sim.cal.form?.doctor?.id).toBe('d3');
  });
  test('VZ-ES-152 cambiar la hora de inicio', async () => {
    await editJuan();
    await sim.say('a las 11 y media');
    expect(sim.cal.form?.start?.getHours()).toBe(11);
    expect(sim.cal.form?.start?.getMinutes()).toBe(30);
  });
  test('VZ-ES-153 cambiar la hora de fin', async () => {
    await editJuan();
    await sim.say('que termine a las 11');
    expect(sim.cal.form?.endTime).toBe('11:00');
    expect(sim.cal.form?.start?.getHours()).toBe(10);
  });
  test('VZ-ES-154 cambiar la fecha', async () => {
    await editJuan();
    await sim.say('el viernes');
    expect(sim.cal.form?.start?.getDay()).toBe(5);
  });
  test('VZ-ES-155 cambiar el consultorio', async () => {
    await editJuan();
    await sim.say('en el sillón 1');
    expect(sim.cal.form?.calendar?.id).toBe('c1');
  });
  test('VZ-ES-156 agregar y sacar servicios', async () => {
    await editJuan();
    await sim.say('agregá limpieza');
    await sim.say('agregá blanqueamiento');
    await sim.say('sacale la limpieza');
    expect(sim.cal.form?.services.map((s) => s.id)).toEqual(['sv3']);
  });
  test('VZ-ES-157 agregar una nota (conserva tildes)', async () => {
    await editJuan();
    await sim.say('nota: viene con la mamá');
    expect(sim.cal.form?.notes).toBe('Viene con la mamá');
  });
  test('VZ-ES-158 una segunda nota se agrega abajo; «borrá las notas» las limpia', async () => {
    await editJuan();
    await sim.say('agregá en notas que trae estudios');
    await sim.say('nota: llamar antes');
    expect(sim.cal.form?.notes).toBe('Trae estudios\nLlamar antes');
    await sim.say('borrá las notas');
    expect(sim.cal.form?.notes).toBe('');
  });
  test('VZ-ES-159 cambiar el paciente', async () => {
    await editJuan();
    await sim.say('el paciente es Sofía Castro');
    expect(sim.cal.form?.patient?.name).toBe('Sofía Castro');
  });
  test('VZ-ES-160 «guardar» guarda con todo lo cambiado', async () => {
    await editJuan();
    await sim.say('con el doctor Gómez');
    await sim.say('guardar');
    expect(sim.cal.savedForms).toHaveLength(1);
    expect(sim.cal.savedForms[0].doctor?.id).toBe('d3');
    expect(sim.card().tone).toBe('success');
  });
  test('VZ-ES-161 «actualizá» también guarda', async () => {
    await editJuan();
    await sim.say('actualizá');
    expect(sim.cal.savedForms).toHaveLength(1);
  });
  test('VZ-ES-162 «cancelar» cierra sin guardar', async () => {
    await editJuan();
    await sim.say('cancelar');
    expect(sim.cal.savedForms).toHaveLength(0);
    expect(sim.cal.calls('closeAppointmentForm')).toHaveLength(1);
  });
  test('VZ-ES-163 «no» deja el formulario abierto para seguir a mano', async () => {
    await editJuan();
    await sim.say('no');
    expect(sim.cal.state.form.kind).toBe('dialog');
    expect(sim.cal.savedForms).toHaveLength(0);
  });
  test('VZ-ES-164 formulario abierto a mano: lo que se dice es para él', async () => {
    // El formulario se abrió con el mouse (no por voz).
    const appt = sim.cal.appointments.find((a) => a.id === 'a4')!;
    (await import('@/lib/voice/calendar-bridge')).getCalendarVoice()!.actions.openAppointmentForm({ mode: 'edit', appointment: appt, start: new Date(String(appt.start?.dateTime)) });
    await sim.say('con la doctora Ruiz');
    expect(sim.cal.form?.doctor?.id).toBe('d2');
    await sim.say('guardar');
    expect(sim.cal.savedForms).toHaveLength(1);
  });
});

test.describe('N1.15 · Nueva cita', () => {
  test('VZ-ES-170 nueva cita completa abre el formulario y «sí» la guarda', async () => {
    await sim.say('nueva cita para Sofía Castro mañana a las 10 con el doctor Pérez, limpieza');
    expect(sim.cal.calls('openAppointmentForm')[0]?.[0]).toBe('create');
    await sim.say('sí');
    expect(sim.cal.savedForms).toHaveLength(1);
    expect(sim.cal.savedForms[0]).toMatchObject({ patient: { name: 'Sofía Castro' } });
  });
});

test.describe('N1.16 · Exportar agenda', () => {
  test('VZ-ES-180 «exportá la agenda» abre y pregunta si descarga', async () => {
    await sim.say('exportá la agenda');
    expect(sim.cal.state.exportDialog).not.toBeNull();
    expect(sim.card().awaiting).toBe('confirm');
  });
  test('VZ-ES-181 «exportá la agenda de la semana que viene» pone Semana', async () => {
    await sim.say('exportá la agenda de la semana que viene');
    expect(sim.cal.state.exportDialog?.preset).toBe('week');
  });
  test('VZ-ES-182 «exportá la agenda del mes» pone Mes', async () => {
    await sim.say('exportá la agenda del mes');
    expect(sim.cal.state.exportDialog?.preset).toBe('month');
  });
  test('VZ-ES-183 rango «del 1 al 15 de diciembre»', async () => {
    await sim.say('exportá la agenda del 1 al 15 de diciembre');
    expect(sim.cal.state.exportDialog).toMatchObject({ preset: 'custom' });
    expect(sim.cal.state.exportDialog?.from).toMatch(/-12-01$/);
    expect(sim.cal.state.exportDialog?.to).toMatch(/-12-15$/);
  });
  test('VZ-ES-184 de la sede Centro marca sus agendas', async () => {
    await sim.say('exportá la agenda de hoy de la sede Centro');
    expect(sim.cal.state.exportDialog?.calendarIds).toEqual(['c1', 'c2']);
  });
  test('VZ-ES-185 de todas las agendas', async () => {
    await sim.say('exportá la agenda de todas las agendas');
    expect(sim.cal.state.exportDialog?.calendarIds).toEqual(['c1', 'c2', 'c3']);
  });
  test('VZ-ES-186 corregir con el diálogo abierto y «sí» descarga', async () => {
    await sim.say('exportá la agenda');
    await sim.say('mejor la semana que viene');
    expect(sim.cal.state.exportDialog?.preset).toBe('week');
    await sim.say('sí');
    expect(sim.cal.state.exportDialog).toBeNull();
    expect(sim.card().tone).toBe('success');
  });
  test('VZ-ES-187 «cancelar» cierra sin exportar', async () => {
    await sim.say('exportá la agenda');
    await sim.say('cancelar');
    expect(sim.cal.calls('closeExport')).toHaveLength(1);
  });
});

test.describe('N1.17 · Pacientes', () => {
  test('VZ-ES-190 buscá el paciente Juan Pérez: por sus citas, queda en foco', async () => {
    await sim.say('buscá el paciente Juan Pérez');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a2']]);
    expect(sim.store().focusLabel).toBe('Juan Pérez');
  });
  test('VZ-ES-191 citas muy viejas: va al buscador de pacientes y abre la ficha', async () => {
    await sim.say('buscá el paciente Roberto Díaz');
    expect(sim.cal.calls('openPatient')).toEqual([['p8']]);
  });
  test('VZ-ES-192 sin citas: Sofía Castro por el buscador', async () => {
    await sim.say('buscame la información de Sofía Castro');
    expect(sim.cal.calls('openPatient')).toEqual([['p9']]);
  });
  test('VZ-ES-193 no lo encuentra por nombre: pide cédula y busca por ella', async () => {
    await sim.say('buscá el paciente Ernesto Valverde');
    expect(sim.card().message).toMatch(/cédula/);
    await sim.say('cédula 1 2 3 4 5 6 7 8');
    expect(sim.cal.calls('openPatient')).toEqual([['p8']]);
  });
  test('VZ-ES-194 por teléfono directo', async () => {
    await sim.say('buscá el paciente con teléfono 099 123 456');
    expect(sim.cal.calls('openPatient')).toEqual([['p9']]);
  });
  test('VZ-ES-195 por email dictado', async () => {
    await sim.say('buscá el paciente sofia arroba gmail punto com');
    expect(sim.cal.calls('openPatient')).toEqual([['p9']]);
  });
  test('VZ-ES-196 resumen del paciente en foco: sale de sus registros (sin elegir cita ni IA)', async () => {
    await sim.say('la cita de Juan Pérez');
    await sim.say('dame un resumen del paciente');
    expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p2');
    expect(sim.card().rows.join(' ')).toMatch(/Faltó: 2/);
    expect(sim.aiCalls).toEqual([]);
  });
  test('VZ-ES-197 «¿cuánto debe Juan Pérez?»', async () => {
    await sim.say('cuánto debe Juan Pérez');
    expect(sim.card().rows.join(' ')).toMatch(/Deuda: .*1[.,]200/);
  });
  test('VZ-ES-198 pregunta clínica sin acceso a Mi consultorio: no consulta al agente', async () => {
    sim.deny(DASHBOARD_PERMISSIONS.DOCTOR_WORKSPACE_ACCESS);
    await sim.say('la cita de Juan Pérez');
    await sim.say('qué alergias tiene');
    expect(sim.cal.calls('askPatientAi')).toEqual([]);
    expect(sim.card().tone).toBe('error');
  });
  test('VZ-ES-199 pregunta clínica con acceso: va al agente clínico de Mi consultorio', async () => {
    sim.cal.patientAiAnswer = 'Es alérgico a la penicilina.';
    await sim.say('la cita de Juan Pérez');
    await sim.say('qué alergias tiene');
    expect(sim.cal.calls('askPatientAi')[0]?.[0]).toBe('a2');
    expect(sim.card().message).toContain('penicilina');
  });
});
