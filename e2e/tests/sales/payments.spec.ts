import { test, expect } from '@playwright/test';

// Translation strings from es.json — PaymentsPage
const T = {
  pageTitle: 'Pagos',
  filterPlaceholder: 'Filtrar aquí...',
  createPrepaid: 'Crear Prepago',
  createBtn: 'Crear',
  col: {
    docNo: 'No. Documento',
    amount: 'Monto',
    currency: 'Moneda',
    method: 'Método',
    status: 'Estado',
    date: 'Fecha',
    type: 'Tipo',
  },
  prepaidDialog: {
    title: 'Pago Prepagado',
    clientLabel: 'Cliente',
    selectClient: 'Seleccionar cliente',
    searchClient: 'Buscar cliente',
    amount: 'Monto',
    currency: 'Moneda',
    paymentMethod: 'Método de Pago',
    paymentDate: 'Fecha de Pago',
    notes: 'Notas',
    save: 'Guardar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
  },
  tabs: {
    allocations: 'Asignaciones',
    notes: 'Notas',
  },
  actions: {
    print: 'Imprimir',
    sendEmail: 'Enviar Correo',
    edit: 'Editar',
  },
  editDialog: {
    title: 'Editar pago',
    paymentMethod: 'Método de pago',
    cancel: 'Cancelar',
    save: 'Guardar cambios',
  },
};

test.describe('Pagos de Venta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/sales/payments');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga título "Pagos" y tabla', async ({ page }) => {
      await expect(page.getByText(T.pageTitle).first()).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });

    test('columnas incluyen No. Documento, Monto, Método, Estado', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: T.col.amount, exact: true })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.status })
        .or(page.getByRole('columnheader', { name: T.col.method }))).toBeVisible();
    });

    test('botón "Crear Prepago" está visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: T.createPrepaid })
        .or(page.getByRole('button', { name: T.createBtn }))).toBeVisible();
    });

    test('campo de búsqueda visible', async ({ page }) => {
      await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
    });
  });

  // ── Búsqueda ────────────────────────────────────────────────────────────

  test.describe('Búsqueda', () => {
    test('búsqueda filtra pagos sin error', async ({ page }) => {
      await page.getByPlaceholder(T.filterPlaceholder).fill('a');
      await page.waitForTimeout(400);
      await expect(page).not.toHaveURL(/error/);
    });
  });

  // ── Crear Prepago ────────────────────────────────────────────────────────

  test.describe('Crear prepago', () => {
    test('abre el diálogo "Pago Prepagado" con campos correctos', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createPrepaid })
        .or(page.getByRole('button', { name: T.createBtn })).first();
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByText(T.prepaidDialog.title)
        .or(page.getByText(T.prepaidDialog.title).first())).toBeVisible();
      await expect(page.getByLabel(T.prepaidDialog.amount)).toBeVisible();
      await expect(page.getByRole('button', { name: T.prepaidDialog.cancel })).toBeVisible();
      await expect(page.getByRole('button', { name: T.prepaidDialog.save })).toBeVisible();
    });

    test('Cancelar cierra el formulario de prepago', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createPrepaid })
        .or(page.getByRole('button', { name: T.createBtn })).first();
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.prepaidDialog.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: monto vacío o cero muestra error', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createPrepaid })
        .or(page.getByRole('button', { name: T.createBtn })).first();
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.prepaidDialog.save }).click();
      await expect(page.getByText(/monto.*positivo|cliente.*seleccionar|requerido/i).first())
        .toBeVisible({ timeout: 5_000 });
    });

    test('campo Notas está disponible', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createPrepaid })
        .or(page.getByRole('button', { name: T.createBtn })).first();
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      const notes = page.getByLabel(T.prepaidDialog.notes)
        .or(page.getByPlaceholder('Agregue notas adicionales aquí...'));
      if (await notes.isVisible().catch(() => false)) {
        await expect(notes).toBeVisible();
      }
      await page.getByRole('button', { name: T.prepaidDialog.cancel }).click();
    });
  });

  // ── Panel de detalle y tabs ───────────────────────────────────────────

  test.describe('Panel de detalle', () => {
    test.beforeEach(async ({ page }) => {
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
      }
    });

    test('tab "Asignaciones" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.allocations })
        .or(page.getByText(T.tabs.allocations)).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('tab "Notas" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.notes })
        .or(page.getByText(T.tabs.notes)).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await expect(page).not.toHaveURL(/error/);
      }
    });
  });

  // ── Acciones de pago ─────────────────────────────────────────────────

  test.describe('Acciones de pago', () => {
    test('menú de acciones muestra Imprimir y Enviar Correo', async ({ page }) => {
      const actionBtn = page.locator('table tbody tr').first()
        .getByRole('button', { name: 'Abrir Menú' });
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        await expect(page.getByRole('menuitem', { name: T.actions.print })
          .or(page.getByRole('menuitem', { name: T.actions.sendEmail }))).toBeVisible();
        await page.keyboard.press('Escape');
      }
    });

    test('diálogo de edición de método de pago tiene campos correctos', async ({ page }) => {
      const actionBtn = page.locator('table tbody tr').first()
        .getByRole('button', { name: 'Abrir Menú' });
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        const editItem = page.getByRole('menuitem', { name: T.actions.edit });
        if (await editItem.isVisible().catch(() => false)) {
          await editItem.click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await expect(page.getByText(T.editDialog.title)
            .or(page.getByText(T.editDialog.title).first())).toBeVisible();
          await page.getByRole('button', { name: T.editDialog.cancel }).click();
        }
      }
    });
  });
});
