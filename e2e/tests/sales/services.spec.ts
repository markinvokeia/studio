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
    await page.goto('/sales/services');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga título "Servicios" y tabla', async ({ page }) => {
      await expect(page.getByText(T.pageTitle).first()).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });

    test('tabla muestra columnas Nombre y Precio', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Precio' }).or(
        page.getByRole('columnheader', { name: /precio/i })
      ).first()).toBeVisible();
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
      await page.getByPlaceholder(T.filterPlaceholder).fill('zzz_no_existe_99999');
      await page.waitForTimeout(500);
      const rows = await page.locator('table tbody tr').count();
      const empty = await page.getByText('No hay resultados.').isVisible().catch(() => false);
      expect(rows === 0 || empty).toBeTruthy();
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

    test('CRUD completo: crear → verificar → editar → restaurar → eliminar', async ({ page }) => {
      const uniqueName = `Servicio E2E ${Date.now()}`;
      const editedName = `${uniqueName} EDITADO`;

      // CREAR
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(uniqueName);
      await page.getByLabel(T.priceLabel).fill('99.99');
      await page.getByLabel(T.durationLabel).fill('45');
      // Seleccionar categoría si es requerida
      const catTrigger = page.getByRole('combobox').filter({ hasText: /categor|seleccionar/i }).first();
      if (await catTrigger.isVisible().catch(() => false)) {
        await catTrigger.click();
        await page.getByRole('option').first().click();
      }
      await page.getByRole('button', { name: T.save }).click();

      // VERIFICAR toast
      await expect(page.getByText(/guardado|creado|éxito|success/i).first()).toBeVisible({ timeout: 10_000 });

      // VERIFICAR en tabla
      await page.getByPlaceholder(T.filterPlaceholder).fill(uniqueName);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody').getByText(uniqueName)).toBeVisible({ timeout: 8_000 });

      // EDITAR: abrir menú de acciones
      const row = page.locator('table tbody tr').filter({ hasText: uniqueName });
      await row.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('menuitem', { name: 'Editar' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).clear();
      await page.getByLabel(T.nameLabel).fill(editedName);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|guardado|éxito/i).first()).toBeVisible({ timeout: 8_000 });

      // RESTAURAR nombre original
      await page.getByPlaceholder(T.filterPlaceholder).fill(editedName);
      await page.waitForTimeout(600);
      const editedRow = page.locator('table tbody tr').filter({ hasText: editedName });
      await editedRow.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('menuitem', { name: 'Editar' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).clear();
      await page.getByLabel(T.nameLabel).fill(uniqueName);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|guardado|éxito/i).first()).toBeVisible({ timeout: 8_000 });

      // ELIMINAR
      await page.getByPlaceholder(T.filterPlaceholder).fill(uniqueName);
      await page.waitForTimeout(600);
      const finalRow = page.locator('table tbody tr').filter({ hasText: uniqueName });
      await finalRow.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('menuitem', { name: 'Eliminar' }).click();
      // Confirmar en el diálogo de confirmación
      const confirmBtn = page.getByRole('button', { name: 'Confirmar' })
        .or(page.getByRole('button', { name: 'Eliminar' })).last();
      await confirmBtn.click();
      await expect(page.getByText(/eliminado|deleted|success/i).first()).toBeVisible({ timeout: 8_000 });
    });
  });
});
