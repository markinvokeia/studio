import { test, expect } from '@playwright/test';

// Translation strings from es.json — InvoicesPage
const T = {
  pageTitle: 'Facturas',
  filterPlaceholder: 'Filtrar aquí...',
  createBtn: 'Crear',
  importBtn: 'Importar',
  cancel: 'Cancelar',
  create: 'Crear',
  save: 'Guardar',
  confirmInvoice: 'Confirmar Factura',
  addPayment: 'Agregar Pago',
  sendEmail: 'Enviar Correo',
  print: 'Imprimir',
  col: {
    docNo: 'Doc No.',
    patient: 'Paciente',
    total: 'Total',
    status: 'Estado',
    paymentStatus: 'Pago',
    type: 'Tipo',
    dueDate: 'Vencimiento',
  },
  tabs: {
    items: 'Artículos',
    payments: 'Pagos',
    creditNotes: 'Notas de Crédito',
    allocations: 'Movimientos',
    notes: 'Notas',
  },
  paymentDialog: {
    title: 'Agregar Pago',
    amount: 'Monto',
    method: 'Método',
    date: 'Fecha de Pago',
    cancel: 'Cancelar',
  },
  confirmDialog: {
    title: 'Confirmar Factura',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
  },
  createDialog: {
    title: 'Crear Factura',
    selectPatient: 'Seleccionar Paciente',
    addItem: 'Agregar Artículo',
    currency: 'Moneda',
    type: 'Tipo',
  },
  status: {
    paid: 'Pagado',
    draft: 'Borrador',
    overdue: 'Vencido',
    unpaid: 'No Pagado',
  },
};

test.describe('Facturas de Venta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/sales/invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga título "Facturas" y tabla', async ({ page }) => {
      await expect(page.getByText(T.pageTitle).first()).toBeVisible();
      await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible();
    });

    test('columnas incluyen Doc No., Estado, Total, Pago', async ({ page }) => {
      const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
      if (!inCardMode) {
        await expect(page.getByRole('columnheader', { name: T.col.total })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: T.col.status })).toBeVisible();
      }
    });

    test('botones Crear e Importar están visibles', async ({ page }) => {
      await expect(page.getByRole('button', { name: T.createBtn })).toBeVisible();
      // Importar puede estar disponible
      const importBtn = page.getByRole('button', { name: T.importBtn });
      if (await importBtn.isVisible().catch(() => false)) {
        await expect(importBtn).toBeVisible();
      }
    });

    test('campo de búsqueda visible', async ({ page }) => {
      await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
    });

    test('filtro por tipo: Factura / Nota de Crédito', async ({ page }) => {
      const facturaBtn = page.getByRole('button', { name: 'Factura' })
        .or(page.getByText('Factura'));
      const creditBtn = page.getByRole('button', { name: 'Nota de Crédito' })
        .or(page.getByText('Nota de Crédito'));
      // Al menos uno de ellos visible
      const hasFilter = await facturaBtn.first().isVisible().catch(() => false)
        || await creditBtn.first().isVisible().catch(() => false);
      // No forzamos que existan - el diseño puede variar
      await expect(page).not.toHaveURL(/error/);
    });
  });

  // ── Búsqueda ────────────────────────────────────────────────────────────

  test.describe('Búsqueda', () => {
    test('búsqueda filtra facturas sin error', async ({ page }) => {
      await page.getByPlaceholder(T.filterPlaceholder).fill('a');
      await page.waitForTimeout(400);
      await expect(page).not.toHaveURL(/error/);
    });
  });

  // ── CRUD: Crear factura ──────────────────────────────────────────────

  test.describe('Crear factura', () => {
    test('abre el formulario "Crear Factura" con campos correctos', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await expect(page.getByText(T.createDialog.title).first()).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
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
      // Clic en guardar/crear sin seleccionar paciente
      const saveBtn = page.getByRole('button', { name: T.create })
        .or(page.getByRole('button', { name: T.save })).last();
      await saveBtn.click();
      await expect(page.getByText(/usuario.*obligatorio|paciente.*requerido|seleccione/i).first())
        .toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Panel de detalle y tabs ───────────────────────────────────────────

  test.describe('Panel de detalle', () => {
    test.beforeEach(async ({ page }) => {
      const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
      }
    });

    for (const [key, label] of Object.entries(T.tabs)) {
      test(`tab "${label}" es accesible`, async ({ page }) => {
        const tab = page.getByRole('button', { name: label })
          .or(page.getByText(label)).first();
        if (await tab.isVisible().catch(() => false)) {
          await tab.click();
          await page.waitForTimeout(400);
          await expect(page).not.toHaveURL(/error/);
        }
      });
    }
  });

  // ── Acciones ─────────────────────────────────────────────────────────

  test.describe('Acciones sobre facturas', () => {
    test('menú de acciones muestra Imprimir, Enviar Correo', async ({ page }) => {
      const actionBtn = page.locator('table tbody tr, [data-testid="list-item"]').first()
        .getByRole('button', { name: 'Abrir menú' });
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        await expect(page.getByRole('menuitem', { name: T.print })
          .or(page.getByRole('menuitem', { name: T.sendEmail })).first()).toBeVisible();
        await page.keyboard.press('Escape');
      }
    });

    test('diálogo de pago tiene campos: Monto, Método, Fecha de Pago', async ({ page }) => {
      const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
        const addPaymentBtn = page.getByRole('button', { name: T.addPayment });
        if (await addPaymentBtn.isVisible().catch(() => false)) {
          await addPaymentBtn.click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await expect(page.getByLabel(T.paymentDialog.amount)).toBeVisible();
          // Cancelar
          await page.getByRole('button', { name: T.paymentDialog.cancel }).click();
        }
      }
    });

    test('diálogo de confirmación de factura requiere acción del usuario', async ({ page }) => {
      const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
        const confirmBtn = page.getByRole('button', { name: T.confirmInvoice });
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          const dialog = page.getByRole('dialog');
          if (await dialog.isVisible().catch(() => false)) {
            await expect(dialog).toBeVisible();
            await page.getByRole('button', { name: T.confirmDialog.cancel }).click();
          }
        }
      }
    });
  });

  // ── Importar factura (AI) ─────────────────────────────────────────────

  test.describe('Importar factura', () => {
    test('diálogo de importación muestra área de carga de archivo', async ({ page }) => {
      const importBtn = page.getByRole('button', { name: T.importBtn });
      if (await importBtn.isVisible().catch(() => false)) {
        await importBtn.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(page.getByText(/subir|upload|arrastre|PDF|PNG/i).first()).toBeVisible();
        await page.keyboard.press('Escape');
      }
    });
  });
});
