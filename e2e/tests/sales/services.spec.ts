import { test, expect } from '@playwright/test';

// Translation strings from es.json — ServicesPage
const T = {
  pageTitle: 'Servicios',
  filterPlaceholder: 'Filtrar aquí...',
  createDialogTitle: 'Crear Servicio',
  editDialogTitle: 'Editar Servicio',
  nameLabel: 'Nombre',
  namePlaceholder: 'ej., Empastes',
  categoryLabel: 'Categoría',
  priceLabel: 'Precio',
  durationLabel: 'Duración',
  descriptionLabel: 'Descripción',
  colorLabel: 'Color',
  activeLabel: 'Activo',
  cancel: 'Cancelar',
  save: 'Guardar',
  saveEdit: 'Guardar Cambios',
  createBtn: 'Crear',
  refreshBtn: 'Refrescar',
  nameRequired: 'El nombre es obligatorio',
};

test.describe('Servicios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/sales/services', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga título "Servicios" y tabla', async ({ page }) => {
      await expect(page.getByText(T.pageTitle).first()).toBeVisible();
      await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible();
    });

    test('tabla muestra columnas Nombre y Precio', async ({ page }) => {
      const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
      if (!inCardMode) {
        await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Precio' }).or(
          page.getByRole('columnheader', { name: /precio/i })
        ).first()).toBeVisible();
      }
    });

    test('botón Crear está visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: T.createBtn })).toBeVisible();
    });

    test('campo de búsqueda está visible', async ({ page }) => {
      await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
    });
  });

  // ── Búsqueda ────────────────────────────────────────────────────────────

  test.describe('Búsqueda', () => {
    test('buscar texto filtra resultados sin error', async ({ page }) => {
      await page.getByPlaceholder(T.filterPlaceholder).fill('a');
      await page.waitForTimeout(400);
      await expect(page).not.toHaveURL(/error/);
    });

    test('búsqueda sin resultados muestra estado vacío', async ({ page }) => {
      const filterInput = page.getByPlaceholder(T.filterPlaceholder);
      if (!await filterInput.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await filterInput.fill('zzz_no_existe_99999');
      const gotEmpty = await page.getByText('No hay resultados.')
        .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      if (!gotEmpty) {
        const rows = await page.locator('table tbody tr, [data-testid="list-item"]').count();
        expect(rows).toBe(0);
      }
    });
  });

  // ── CRUD completo ────────────────────────────────────────────────────────

  test.describe('Crear servicio (con limpieza)', () => {
    test('abre formulario con campos correctos y botones', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.priceLabel)).toBeVisible();
      await expect(page.getByLabel(T.durationLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario sin crear', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill('Servicio Cancelado');
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(T.nameRequired)).toBeVisible();
    });

    test('CRUD completo: crear → verificar → eliminar', async ({ page }) => {
      const uniqueName = `Servicio E2E ${Date.now()}`;

      // CREAR
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(uniqueName);
      await page.getByLabel(T.priceLabel).fill('99.99');
      await page.getByLabel(T.durationLabel).fill('45');
      const catTrigger = page.getByRole('combobox').filter({ hasText: /categor|seleccionar/i }).first();
      if (await catTrigger.isVisible().catch(() => false)) {
        await catTrigger.click();
        await page.getByRole('option').first().click();
      }
      await page.getByRole('button', { name: T.save }).click();

      // VERIFICAR toast
      await expect(page.getByText(/guardado|creado|éxito|success/i).first()).toBeVisible({ timeout: 10_000 });

      // VERIFICAR en tabla (server-side filter — wait longer)
      await page.getByPlaceholder(T.filterPlaceholder).fill(uniqueName);
      await page.waitForTimeout(1500);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(uniqueName).first()).toBeVisible({ timeout: 8_000 });

      // ELIMINAR: inline delete button
      const finalRow = page.locator('table tbody tr, [data-testid="list-item"]').filter({ hasText: uniqueName });
      await finalRow.getByRole('button', { name: 'Eliminar' }).click();
      await page.getByRole('button', { name: 'Confirmar' }).click();
      await expect(page.getByText(/eliminado|deleted|success/i).first()).toBeVisible({ timeout: 8_000 });
    });
  });
});
