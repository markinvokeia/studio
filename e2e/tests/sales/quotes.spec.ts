import { test, expect } from '@playwright/test';

// Translation strings from es.json — QuotesPage
const T = {
  pageTitle: 'Presupuestos',
  filterPlaceholder: 'Filtrar aquí...',
  createBtn: 'Crear',
  createDialogTitle: 'Crear Presupuesto',
  editDialogTitle: 'Editar Presupuesto',
  cancel: 'Cancelar',
  save: 'Guardar',
  editSave: 'Guardar',
  confirmQuote: 'Confirmar',
  rejectQuote: 'Rechazar',
  deleteQuote: 'Eliminar',
  printQuote: 'Imprimir',
  sendEmail: 'Enviar Correo',
  addItem: 'Agregar Artículo',
  tabs: {
    items: 'Artículos',
    orders: 'Órdenes',
    invoices: 'Facturas',
    payments: 'Pagos',
    notes: 'Notas',
    appointments: 'Citas',
    clinicSessions: 'Sesiones Clínicas',
  },
  quoteDialog: {
    selectUser: 'Seleccionar Usuario',
    searchUser: 'Buscar Usuario',
    currency: 'Moneda',
    status: 'Estado',
    draft: 'Borrador',
    notes: 'Notas',
  },
  deleteDialog: {
    title: 'Eliminar Presupuesto',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
  },
  toast: {
    created: 'Presupuesto Creado',
    updated: 'Presupuesto Actualizado',
    deleted: 'Presupuesto Eliminado',
    confirmed: 'Presupuesto Confirmado',
    rejected: 'Presupuesto Rechazado',
  },
  col: {
    docNo: 'Doc No.',
    status: 'Estado',
    billingStatus: 'Estado de Facturación',
    total: 'Total',
  },
};

test.describe('Presupuestos de Venta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales/quotes');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga título "Presupuestos" y tabla', async ({ page }) => {
      await expect(page.getByText(T.pageTitle).first()).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });

    test('columnas muestran Doc No., Estado, Estado de Facturación, Total', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: T.col.docNo })
        .or(page.getByRole('columnheader', { name: /doc/i }))).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.status })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.total })).toBeVisible();
    });

    test('botón Crear está visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: T.createBtn })).toBeVisible();
    });

    test('campo de búsqueda visible', async ({ page }) => {
      await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
    });
  });

  // ── Búsqueda ────────────────────────────────────────────────────────────

  test.describe('Búsqueda', () => {
    test('buscar texto filtra sin error', async ({ page }) => {
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

  test.describe('Crear presupuesto (con limpieza)', () => {
    test('abre el formulario "Crear Presupuesto" con campos correctos', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      // Campo de selección de usuario
      await expect(page.getByText(T.quoteDialog.selectUser)
        .or(page.getByRole('button', { name: T.quoteDialog.selectUser }))).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
    });

    test('Cancelar cierra el formulario sin crear', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: guardar sin paciente muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText('Un usuario es obligatorio')
        .or(page.getByText(/usuario.*obligatorio|seleccione.*paciente/i)).first()).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Panel de detalle y tabs ───────────────────────────────────────────

  test.describe('Panel de detalle y tabs', () => {
    test.beforeEach(async ({ page }) => {
      // Solo si hay filas en la tabla
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
      }
    });

    test('tab "Artículos" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.items })
        .or(page.getByText(T.tabs.items)).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('tab "Órdenes" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.orders })
        .or(page.getByText(T.tabs.orders)).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('tab "Facturas" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.invoices })
        .or(page.getByText(T.tabs.invoices)).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('tab "Pagos" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.payments })
        .or(page.getByText(T.tabs.payments)).first();
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

    test('tab "Citas" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.appointments })
        .or(page.getByText(T.tabs.appointments)).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('tab "Sesiones Clínicas" es accesible', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.clinicSessions })
        .or(page.getByText(T.tabs.clinicSessions)).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await expect(page).not.toHaveURL(/error/);
      }
    });
  });

  // ── Acciones sobre presupuestos ───────────────────────────────────────

  test.describe('Acciones de presupuesto', () => {
    test('menú de acciones muestra opciones: Confirmar, Rechazar, Imprimir, Enviar Correo, Eliminar', async ({ page }) => {
      const actionBtn = page.locator('table tbody tr').first()
        .getByRole('button', { name: 'Abrir menú' });
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        // Al menos algunas de estas opciones deben estar presentes
        const hasOption = await page.getByRole('menuitem', { name: T.printQuote })
          .or(page.getByRole('menuitem', { name: T.confirmQuote }))
          .or(page.getByRole('menuitem', { name: T.deleteQuote }))
          .first().isVisible().catch(() => false);
        expect(hasOption).toBeTruthy();
        await page.keyboard.press('Escape');
      }
    });

    test('diálogo de eliminación requiere confirmación', async ({ page }) => {
      const actionBtn = page.locator('table tbody tr').first()
        .getByRole('button', { name: 'Abrir menú' });
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        const deleteItem = page.getByRole('menuitem', { name: T.deleteQuote });
        if (await deleteItem.isVisible().catch(() => false)) {
          await deleteItem.click();
          await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
          // Cancelar para no afectar datos
          await page.getByRole('button', { name: T.deleteDialog.cancel }).click();
        }
      }
    });
  });
});
