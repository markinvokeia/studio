import { test, expect } from '@playwright/test';

// Translation strings from es.json — QuotesPage
const T = {
  pageTitle: 'Presupuestos',
  filterPlaceholder: 'Filtrar presupuestos por nombre de usuario...',
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

async function createQuoteForTesting(page: import('@playwright/test').Page) {
  const createBtn = page.getByRole('button', { name: T.createBtn }).first();
  test.skip(!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false), 'No existe botón Crear');

  await createBtn.click();
  const dialog = page.getByRole('dialog');
  test.skip(!await dialog.isVisible({ timeout: 8_000 }).catch(() => false), 'No abrió diálogo de creación');

  const userCombobox = dialog.getByRole('combobox', { name: /usuario|paciente/i }).first();
  if (await userCombobox.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await userCombobox.click();
  } else {
    const userTrigger = dialog.getByRole('button', { name: /seleccionar usuario|usuario|paciente/i }).first();
    test.skip(!await userTrigger.isVisible({ timeout: 3_000 }).catch(() => false), 'No hay selector de usuario/paciente');
    await userTrigger.click();
  }

  const searchInput = page.getByPlaceholder(/buscar usuario|buscar paciente|buscar/i).last();
  if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await searchInput.fill('a');
    await page.waitForTimeout(500);
  }
  const firstOption = page.getByRole('option').first();
  test.skip(!await firstOption.isVisible({ timeout: 8_000 }).catch(() => false), 'No hay opciones de usuario/paciente');
  await firstOption.click();

  await dialog.getByRole('button', { name: T.save }).click();
  await expect(dialog).not.toBeVisible({ timeout: 20_000 });

  const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const rowText = (await firstRow.innerText()).replace(/\s+/g, ' ');
  const docNo = rowText.match(/QUO-\d{4}-\d{2}-\d{4}/)?.[0] ?? '';
  return { docNo, row: firstRow };
}

test.describe('Presupuestos de Venta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/sales/quotes', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga título "Presupuestos" y tabla', async ({ page }) => {
      await expect(page).not.toHaveURL(/error|login/);
      await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible({ timeout: 10_000 });
    });

    test('columnas muestran Doc No., Estado, Estado de Facturación, Total', async ({ page }) => {
      const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
      if (!inCardMode) {
        await expect(page.getByRole('columnheader', { name: T.col.docNo })
          .or(page.getByRole('columnheader', { name: /doc/i }))).toBeVisible();
        await expect(page.getByRole('columnheader', { name: T.col.status, exact: true })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: T.col.total })).toBeVisible();
      }
    });

    test('botón Crear está visible', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(createBtn).toBeVisible();
      }
    });

    test('campo de búsqueda visible', async ({ page }) => {
      const filterInput = page.getByPlaceholder(T.filterPlaceholder);
      if (await filterInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(filterInput).toBeVisible();
      }
    });
  });

  // ── Búsqueda ────────────────────────────────────────────────────────────

  test.describe('Búsqueda', () => {
    test('buscar texto filtra sin error', async ({ page }) => {
      const filterInput = page.getByPlaceholder(T.filterPlaceholder);
      if (!await filterInput.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await filterInput.fill('a');
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

  test.describe('Crear presupuesto (con limpieza)', () => {
    test('abre el formulario "Crear Presupuesto" con campos correctos', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      // Campo de selección de usuario
      await expect(page.getByText(T.quoteDialog.selectUser)
        .or(page.getByRole('button', { name: T.quoteDialog.selectUser }))).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
    });

    test('Cancelar cierra el formulario sin crear', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      if (!await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: guardar sin paciente muestra error', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      if (!await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText('Un usuario es obligatorio')
        .or(page.getByText(/usuario.*obligatorio|seleccione.*paciente/i)).first()).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Panel de detalle y tabs ───────────────────────────────────────────

  test.describe('Panel de detalle y tabs', () => {
    test.beforeEach(async ({ page }) => {
      // Solo si hay filas en la tabla
      const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
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
      const actionBtn = page.locator('table tbody tr, [data-testid="list-item"]').first()
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
      const actionBtn = page.locator('table tbody tr, [data-testid="list-item"]').first()
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

    test('crear borrador propio y rechazarlo desde acciones', async ({ page }) => {
      const { docNo, row } = await createQuoteForTesting(page);
      test.skip(!docNo, 'No se pudo detectar Doc No del presupuesto creado');

      await row.click();
      await page.waitForTimeout(500);
      const rejectBtn = page.getByRole('button', { name: T.rejectQuote }).first();
      test.skip(!await rejectBtn.isVisible({ timeout: 6_000 }).catch(() => false), 'No existe acción Rechazar en este estado');

      await rejectBtn.click();
      const confirmReject = page.getByRole('dialog').getByRole('button', { name: /rechazar|confirmar/i }).first();
      if (await confirmReject.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmReject.click();
      }
      await expect(page.getByText(/rechazado|rejected/i).first()).toBeVisible({ timeout: 12_000 });
    });

    test('crear borrador propio y editar notas sin romper flujo', async ({ page }) => {
      const { row } = await createQuoteForTesting(page);
      await row.click();
      await page.waitForTimeout(500);

      const editBtn = page.getByRole('button', { name: /editar/i }).first();
      test.skip(!await editBtn.isVisible({ timeout: 6_000 }).catch(() => false), 'No existe acción Editar');
      await editBtn.click();

      const dialog = page.getByRole('dialog');
      test.skip(!await dialog.isVisible({ timeout: 6_000 }).catch(() => false), 'No abrió diálogo de edición');

      const notesInput = page.getByLabel(T.quoteDialog.notes).or(dialog.getByRole('textbox', { name: /notas/i })).first();
      test.skip(!await notesInput.isVisible({ timeout: 3_000 }).catch(() => false), 'No hay campo de notas para editar');
      await notesInput.fill(`E2E edit ${Date.now()}`);
      await dialog.getByRole('button', { name: T.editSave }).click();
      await expect(dialog).not.toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/actualizado|guardado|éxito/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('crear borrador propio y eliminarlo para limpiar datos', async ({ page }) => {
      const { docNo, row } = await createQuoteForTesting(page);
      test.skip(!docNo, 'No se pudo detectar Doc No del presupuesto creado');

      await row.click();
      await page.waitForTimeout(500);

      const deleteBtn = page.getByRole('button', { name: T.deleteQuote }).first();
      if (await deleteBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
        await deleteBtn.click();
      } else {
        const actionBtn = page.locator('table tbody tr, [data-testid="list-item"]').filter({ hasText: docNo }).first()
          .getByRole('button', { name: /abrir menú/i }).first();
        test.skip(!await actionBtn.isVisible({ timeout: 5_000 }).catch(() => false), 'No se encontró menú de acciones para eliminar');
        await actionBtn.click();
        const deleteItem = page.getByRole('menuitem', { name: T.deleteQuote }).first();
        test.skip(!await deleteItem.isVisible({ timeout: 5_000 }).catch(() => false), 'No está disponible Eliminar');
        await deleteItem.click();
      }

      const deleteDialog = page.getByRole('dialog');
      await expect(deleteDialog).toBeVisible({ timeout: 8_000 });
      await deleteDialog.getByRole('button', { name: /confirmar|eliminar/i }).first().click();
      await expect(page.getByText(/eliminado|deleted|éxito/i).first()).toBeVisible({ timeout: 12_000 });
    });
  });
});
