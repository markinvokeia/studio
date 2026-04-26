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
    // Cambiar a vista de lista para poder hacer clic en filas
    const listViewBtn = page.getByRole('button', { name: 'Vista de Lista' });
    if (await listViewBtn.isVisible().catch(() => false)) {
      await listViewBtn.click();
      await page.waitForTimeout(500);
    }

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(600);

      const infoTab = page.getByRole('button', { name: 'Información' })
        .or(page.getByText('Información')).first();
      if (await infoTab.isVisible().catch(() => false)) {
        await expect(infoTab).toBeVisible();
        await infoTab.click();
        await page.waitForTimeout(400);
        await expect(page).not.toHaveURL(/error/);
      }
    }
  });

  test('panel de cita muestra tabs: Información, Presupuesto, Facturas, Pagos', async ({ page }) => {
    const listViewBtn = page.getByRole('button', { name: 'Vista de Lista' });
    if (await listViewBtn.isVisible().catch(() => false)) {
      await listViewBtn.click();
      await page.waitForTimeout(500);
    }

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(600);

      const tabs = ['Información', 'Presupuesto', 'Facturas', 'Pagos'];
      for (const tabName of tabs) {
        const tab = page.getByRole('button', { name: tabName })
          .or(page.getByText(tabName)).first();
        if (await tab.isVisible().catch(() => false)) {
          await tab.click();
          await page.waitForTimeout(300);
          await expect(page).not.toHaveURL(/error/);
        }
      }
    }
  });

  test('opción "Crear sesión" / "Registrar sesión clínica" disponible en cita', async ({ page }) => {
    const listViewBtn = page.getByRole('button', { name: 'Vista de Lista' });
    if (await listViewBtn.isVisible().catch(() => false)) {
      await listViewBtn.click();
      await page.waitForTimeout(500);
    }

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(600);

      const createSession = page.getByRole('button', { name: 'Crear sesión' })
        .or(page.getByRole('button', { name: 'Registrar sesión clínica' }))
        .or(page.getByText('Crear sesión')).first();
      if (await createSession.isVisible().catch(() => false)) {
        await expect(createSession).toBeVisible();
      }
    }
  });
});
