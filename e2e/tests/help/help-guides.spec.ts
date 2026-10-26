import { test } from '../../fixtures/test.fixture';
import { HELP_USE_CASES, runUseCase } from '../../utils/help';

/**
 * Regresión de las guías del asistente: cada caso de uso del catálogo se recorre
 * hasta el botón de confirmar (sin pulsarlo, no crea datos). Si una pantalla
 * cambia y un help id desaparece, falla acá y en `pnpm knowledge:check`.
 */

const SAMPLE_VALUES: Record<string, Record<string, unknown>> = {
  'onboarding.business': { name: 'Clínica Demo', email: 'demo@invokeia.com' },
  'onboarding.sede': { name: 'Sede E2E', address: 'Av. Brasil 2020' },
  'onboarding.schedules': { start_time: '09:00', end_time: '18:00' },
  'onboarding.calendar': { name: 'Consultorio E2E' },
  'onboarding.doctor': { name: 'Dra. E2E', email: 'dra.e2e@example.com' },
  'onboarding.availability': { start_time: '09:00', end_time: '13:00' },
  'onboarding.service': { name: 'Servicio E2E', price: 1000, duration_minutes: 30 },
  'onboarding.staff': { name: 'Recepción E2E', email: 'recepcion.e2e@example.com' },
  'onboarding.payment-method': { name: 'Medio E2E', code: 'E2E' },
  'patients.create': { name: 'Paciente E2E', phone: '+59899123456' },
  'patients.search': { patient: 'Paciente E2E' },
  'patients.overview': { patient: 'Paciente E2E' },
  'patients.info-tab': { patient: 'Paciente E2E' },
  'patients.edit': { patient: 'Paciente E2E', phone: '+59899000111' },
  'patients.notes': { patient: 'Paciente E2E', notes: 'Nota E2E' },
  'patients.preferences': { patient: 'Paciente E2E' },
  'patients.clinical-tab': { patient: 'Paciente E2E' },
  'patients.anamnesis': { patient: 'Paciente E2E' },
  'patients.history': { patient: 'Paciente E2E' },
  'patients.clinical-session': { patient: 'Paciente E2E', procedure: 'Control E2E' },
  'patients.odontogram': { patient: 'Paciente E2E' },
  'patients.treatment-plans': { patient: 'Paciente E2E' },
  'patients.prescription': { patient: 'Paciente E2E', medication: 'Ibuprofeno', dosage: '400 mg', frequency: 'cada 8 horas' },
  'patients.medical-instruction': { patient: 'Paciente E2E' },
  'patients.documents': { patient: 'Paciente E2E' },
  'patients.finance': { patient: 'Paciente E2E' },
  'patients.quick-bill': { patient: 'Paciente E2E' },
  'patients.quote': { patient: 'Paciente E2E', notes: 'Presupuesto E2E' },
  'patients.invoice': { patient: 'Paciente E2E' },
  'patients.prepaid': { patient: 'Paciente E2E', amount: 100 },
  'patients.appointment': { patient: 'Paciente E2E', notes: 'Cita E2E' },
  'patients.email': { patient: 'Paciente E2E', subject: 'Correo E2E' },
  'patients.whatsapp': { patient: 'Paciente E2E', message: 'Mensaje E2E' },
  'patients.whatsapp-reminder': { patient: 'Paciente E2E' },
  'patients.discharge': { patient: 'Paciente E2E' },
  'patients.toggle-active': { patient: 'Paciente E2E' },
  'dashboard.filters': { branch: 'Consolidado', period: 'prevMonth', currency: 'USD' },
  'appointments.create': { patient: 'Paciente E2E', date: '2030-01-15', time: '10:00', notes: 'Cita E2E' },
  'appointments.create-from-slot': { patient: 'Paciente E2E' },
  'appointments.edit': { time: '11:00' },
  'appointments.find-gaps': { patient: 'Paciente E2E' },
  'appointments.search': { query: 'Paciente E2E' },
  'appointments.reminder': { title: 'Recordatorio E2E', date: '2030-01-15', time: '09:00' },
  'appointments.bulk-reassign': { period: 'Esta semana', doctor: 'Dra. E2E' },
  'workspace.change-period': { period: 'week' },
  'workspace.overview': { demo: true },
  'workspace.complete-session': { procedure: 'Control E2E' },
  'workspace.prescribe': { medication: 'Ibuprofeno', dosage: '400 mg', frequency: 'cada 8 horas' },
  'workspace.odontogram': { demo: true },
  'workspace.agent': { demo: true },
  'alerts.filter': { status: 'Pendiente', priority: 'Todos' },
  'alerts.register-call': { notes: 'Llamada E2E' },
  'alerts.snooze': { quick: '1d', reason: 'Pausa E2E' },
  'alerts.ignore': { reason: 'Ignorada E2E' },
  'alerts.add-note': { note: 'Nota E2E' },
  'alerts.send-email': { subject: 'Correo E2E' },
  'alerts.complete': { demo: true },
  'alerts.bulk': { demo: true },
  'cashier.open': { prefill: 'zero', notes: 'Cierre E2E' },
  'cashier.close': { prefill: 'zero', notes: 'Cierre E2E' },
  'cashier.misc-expense': { category: 'Limpieza', beneficiary: 'Proveedor E2E', payment_method: 'Efectivo', amount: 100, description: 'Gasto E2E' },
  'cashier.misc-income': { category: 'Aportes', beneficiary: 'Socio E2E', payment_method: 'Efectivo', amount: 100, description: 'Ingreso E2E' },
  'cashier.misc-review': { demo: true },
  'cashier.misc-category': { name: 'Categoría E2E', code: 'E2E', type: 'Gasto' },
  'cashier.session-history': { demo: true },
  'cashier.cash-point-create': { name: 'Caja E2E', sede: 'Sede E2E' },
  'cashier.cash-point-edit': { demo: true },
};

test.describe('Guías del asistente', () => {
  for (const useCase of HELP_USE_CASES) {
    test(`${useCase.id} — ${useCase.title}`, async ({ page }) => {
      await runUseCase(page, useCase.id, { values: SAMPLE_VALUES[useCase.id] });
      await page.keyboard.press('Escape');
    });
  }
});
