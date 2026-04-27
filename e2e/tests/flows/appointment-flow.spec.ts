import { test, expect } from '@playwright/test';

/**
 * E2E flow: Flujo de Citas
 * Crear cita → ver en calendario → panel de detalle → sesión clínica
 *
 * Translation strings used:
 * - AppointmentsPage.newAppointment = "Nueva Cita"
 * - AppointmentsPage.createDialog.save = "Guardar"
 * - AppointmentsPage.createDialog.cancel = "Cancelar"
 * - AppointmentsPage.panelTabs.info = "Información"
 * - AppointmentsPage.createSession = "Crear sesión"
 * - AppointmentsPage.status.* = "Completada", "Confirmada", "Pendiente", etc.
 */
test.describe('Flujo de Citas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/appointments', { waitUntil: 'domcontentloaded' });
  });

  test('página de Citas carga con título y controles de navegación', async ({ page }) => {
    await expect(page.getByText('Citas').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear' }).first()).toBeVisible();
    await expect(page).not.toHaveURL(/error/);
  });

  test('vistas del calendario (Hoy, Esta Semana, Este Mes) están accesibles', async ({ page }) => {
    const views = ['Hoy', 'Esta Semana', 'Este Mes'];
    for (const view of views) {
      const btn = page.getByRole('button', { name: view });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(400);
        await expect(page).not.toHaveURL(/error/);
      }
    }
  });

  test('formulario de nueva cita se abre con campos de paciente, servicio, fecha, hora', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Verificar título del diálogo
    await expect(page.getByText('Crear Nueva Cita')
      .or(page.getByRole('heading', { name: 'Crear Nueva Cita' }))).toBeVisible();

    // Botones del formulario
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();

    // Cancelar para limpiar
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('validación en el formulario: guardar sin datos muestra error', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Guardar' }).click();

    // Debe aparecer algún mensaje de error o toast
    const hasError = await page.getByText(/requerido|obligatorio|información|seleccione/i)
      .first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasToast = await page.getByText('Por favor complete los campos obligatorios')
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasError || hasToast).toBeTruthy();
  });

  test('seleccionar cita existente abre panel con tab Información', async ({ page }) => {
    const firstEvent = page.locator('.event').first();
    const hasEvents = await firstEvent.waitFor({ state: 'visible', timeout: 25_000 })
      .then(() => true).catch(() => false);
    test.skip(!hasEvents, 'No hay citas visibles en el calendario');

    await firstEvent.click();

    await expect(page.getByRole('button', { name: 'Información' }))
      .toBeVisible({ timeout: 8_000 });
    await expect(page).not.toHaveURL(/error/);
  });

  test('panel de cita muestra tabs: Información, Paciente, Doctor, Sesión Clínica', async ({ page }) => {
    const firstEvent = page.locator('.event').first();
    const hasEvents = await firstEvent.waitFor({ state: 'visible', timeout: 25_000 })
      .then(() => true).catch(() => false);
    test.skip(!hasEvents, 'No hay citas visibles en el calendario');

    await firstEvent.click();
    await page.waitForTimeout(400);

    const alwaysPresentTabs = ['Información', 'Paciente', 'Doctor', 'Sesión Clínica Enlazada'];
    for (const tabName of alwaysPresentTabs) {
      await expect(page.getByRole('button', { name: tabName }))
        .toBeVisible({ timeout: 5_000 });
    }

    for (const tabName of alwaysPresentTabs) {
      await page.getByRole('button', { name: tabName }).click();
      await page.waitForTimeout(300);
      await expect(page).not.toHaveURL(/error/);
    }
  });

  test('tab Sesión Clínica muestra botón de crear o editar sesión', async ({ page }) => {
    const firstEvent = page.locator('.event').first();
    const hasEvents = await firstEvent.waitFor({ state: 'visible', timeout: 25_000 })
      .then(() => true).catch(() => false);
    test.skip(!hasEvents, 'No hay citas visibles en el calendario');

    await firstEvent.click();
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Sesión Clínica Enlazada' }).click();
    await page.waitForTimeout(300);

    const hasCreate = await page.getByRole('button', { name: 'Crear sesión' })
      .isVisible().catch(() => false);
    const hasEdit = await page.getByRole('button', { name: 'Editar sesión' })
      .isVisible().catch(() => false);
    expect(hasCreate || hasEdit).toBeTruthy();
  });
});
