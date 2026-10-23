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
};

test.describe('Guías del asistente', () => {
  for (const useCase of HELP_USE_CASES) {
    test(`${useCase.id} — ${useCase.title}`, async ({ page }) => {
      await runUseCase(page, useCase.id, { values: SAMPLE_VALUES[useCase.id] });
      await page.keyboard.press('Escape');
    });
  }
});
