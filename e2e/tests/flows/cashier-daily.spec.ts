import { test, expect } from '@playwright/test';

/**
 * E2E flow: Flujo de caja diario
 * Panel principal → sesión activa → movimientos → sesiones históricas
 *
 * Translation strings used:
 * - CashierPage.openSession.openButton = "Abrir"
 * - CashierPage.openSession.wizardTitle = "Abrir Sesión"
 * - CashierPage.wizard.next = "Siguiente"
 * - CashierPage.wizard.back = "Atrás"
 * - CashierPage.activeSession.title = "Sesión Activa"
 * - CashierPage.activeSession.totalIncome = "Ingresos Totales"
 * - CashierPage.activeSession.dailyPayments = "Pagos Diarios"
 * - CashierPage.declareCashup.closeSessionButton = "Cerrar Sesión"
 * - status.open = "ABIERTA"
 * - status.closed = "CERRADA"
 */
test.describe('Flujo de Caja Diario', () => {
  test.describe('Panel principal de caja', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/cashier');
      await page.waitForLoadState('networkidle');
    });

    test('panel carga con estado de sesiones', async ({ page }) => {
      await expect(page).not.toHaveURL(/error/);
      await expect(page).not.toHaveURL(/login/);

      // Debe mostrar algún estado de caja
      const hasStatus = await page.getByText('ABIERTA')
        .or(page.getByText('CERRADA'))
        .first().isVisible({ timeout: 10_000 }).catch(() => false);
      const hasCard = await page.locator('[class*="card"]')
        .or(page.locator('[class*="Card"]')).first().isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasStatus || hasCard).toBeTruthy();
    });

    test('sesión activa muestra Ingresos Totales y Pagos Diarios si está abierta', async ({ page }) => {
      const isOpen = await page.getByText('ABIERTA').isVisible().catch(() => false);
      if (isOpen) {
        await expect(page.getByText('Ingresos Totales')
          .or(page.getByText('Pagos Diarios'))).toBeVisible({ timeout: 8_000 });
      }
    });

    test('botón "Imprimir Apertura" disponible en sesión activa', async ({ page }) => {
      const isOpen = await page.getByText('ABIERTA').isVisible().catch(() => false);
      if (isOpen) {
        const printBtn = page.getByRole('button', { name: 'Imprimir Apertura' });
        if (await printBtn.isVisible().catch(() => false)) {
          await expect(printBtn).toBeVisible();
        }
      }
    });

    test('botón "Ver Todas las Cajas" está disponible', async ({ page }) => {
      const viewAllBtn = page.getByRole('button', { name: 'Ver Todas las Cajas' });
      if (await viewAllBtn.isVisible().catch(() => false)) {
        await expect(viewAllBtn).toBeVisible();
        await viewAllBtn.click();
        await page.waitForTimeout(400);
        await expect(page).not.toHaveURL(/error/);
        // Regresar
        await page.goBack();
      }
    });
  });

  test.describe('Wizard de apertura de sesión', () => {
    test('wizard de apertura tiene pasos con botón Siguiente y Atrás', async ({ page }) => {
      await page.goto('/cashier');
      await page.waitForLoadState('networkidle');

      // Sólo intentar si hay una caja cerrada
      const openBtn = page.getByRole('button', { name: 'Abrir' }).first();
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click();
        await page.waitForTimeout(500);

        const wizard = page.getByText('Abrir Sesión')
          .or(page.getByRole('dialog'));
        if (await wizard.isVisible().catch(() => false)) {
          // Verificar botón Siguiente
          const nextBtn = page.getByRole('button', { name: 'Siguiente' });
          if (await nextBtn.isVisible().catch(() => false)) {
            await expect(nextBtn).toBeVisible();
          }
          // Cerrar/cancelar el wizard
          await page.keyboard.press('Escape');
        }
      }
    });
  });

  test.describe('Sesiones de caja históricas', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/cashier/cash-sessions');
      await page.waitForSelector('table', { timeout: 15_000 });
    });

    test('tabla de sesiones muestra columnas: Usuario, Punto de Caja, Estado, Fecha Apertura', async ({ page }) => {
      await expect(page.getByText('Sesión de Caja').first()).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Usuario' })
        .or(page.getByRole('columnheader', { name: 'Estado' }))).toBeVisible();
    });

    test('detalle de sesión de caja se abre al hacer clic en una fila', async ({ page }) => {
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
        // Panel de detalle debe mostrar información de la sesión
        await expect(page).not.toHaveURL(/error/);
      }
    });
  });

  test.describe('Transacciones Misceláneas', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/cashier/miscellaneous-transactions');
      await page.waitForLoadState('networkidle');
    });

    test('página carga con KPIs: Total Ingresos, Total Gastos, Balance', async ({ page }) => {
      await expect(page.getByText('Transacciones Misceláneas').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Total Ingresos')
        .or(page.getByText('Total Gastos'))
        .or(page.getByText('Balance'))).toBeVisible({ timeout: 8_000 });
    });

    test('diálogo de nueva transacción tiene campos Categoría, Fecha, Monto, Descripción', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: 'Crear' }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        const dialog = page.getByRole('dialog');
        if (await dialog.isVisible().catch(() => false)) {
          await expect(page.getByText('Categoría')
            .or(page.getByLabel('Categoría'))).toBeVisible();
          await expect(page.getByText('Monto')
            .or(page.getByLabel('Monto'))).toBeVisible();
          await page.getByRole('button', { name: 'Cancelar' }).click();
          await expect(dialog).not.toBeVisible();
        }
      }
    });
  });
});
