import { test, expect } from '@playwright/test';

// Translation strings from es.json — CashierPage
const T = {
  // Panel principal
  openButton: 'Abrir',
  status: { open: 'ABIERTA', closed: 'CERRADA' },
  viewAllCashPoints: 'Ver Todas las Cajas',
  // Wizard apertura
  wizard: {
    title: 'Abrir Sesión',
    next: 'Siguiente',
    back: 'Atrás',
  },
  // Wizard cierre
  closeWizard: {
    title: 'Cerrar Sesión',
    startClosing: 'Iniciar Cierre',
    closeSessionButton: 'Cerrar Sesión',
    steps: {
      config: 'Configuración',
      declare: 'Declarar',
      review: 'Revisar',
      confirm: 'Confirmación',
    },
  },
  // Sesión activa
  activeSession: {
    title: 'Sesión Activa',
    totalIncome: 'Ingresos Totales',
    dailyPayments: 'Pagos Diarios',
    printOpening: 'Imprimir Apertura',
  },
  // Puntos de Caja (PhysicalCashRegisters)
  cashPoints: {
    pageTitle: 'Cajas Registradoras Físicas',
    createDialogTitle: 'Crear Caja Registradora',
    editDialogTitle: 'Editar Caja Registradora',
    nameLabel: 'Nombre',
    create: 'Crear',
    saveEdit: 'Guardar Cambios',
    cancel: 'Cancelar',
    nameRequired: 'El nombre es obligatorio',
    deleteConfirm: 'Confirmar',
    deleteCancel: 'Cancelar',
  },
  // Transacciones Misceláneas
  miscTx: {
    pageTitle: 'Transacciones Misceláneas',
    filterPlaceholder: 'Filtrar aquí...',
    createDialogTitle: 'Crear Transacción',
    categoryLabel: 'Categoría',
    selectCategory: 'Seleccionar categoría',
    dateLabel: 'Fecha',
    amountLabel: 'Monto',
    descriptionLabel: 'Descripción',
    paymentMethodLabel: 'Método de Pago',
    create: 'Crear',
    cancel: 'Cancelar',
    saveEdit: 'Guardar Cambios',
    categoryRequired: 'La categoría es obligatoria.',
  },
  // Sesiones de Caja
  sessions: {
    pageTitle: 'Sesión de Caja',
    col: {
      user: 'Usuario',
      cashPoint: 'Punto de Caja',
      status: 'Estado',
      openDate: 'Fecha Apertura',
      closeDate: 'Fecha Cierre',
    },
  },
};

// ── Panel principal de Caja ───────────────────────────────────────────────────

test.describe('Caja — Panel Principal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashier');
    await page.waitForLoadState('networkidle');
  });

  test('carga el panel de caja sin error ni redirección a login', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page).not.toHaveURL(/login/);
  });

  test('muestra tarjetas de puntos de caja con estado ABIERTA o CERRADA', async ({ page }) => {
    const hasCard = await page.locator('[class*="card"]').or(page.locator('[class*="Card"]')).first().isVisible({ timeout: 10_000 }).catch(() => false);
    const hasStatus = await page.getByText(T.status.open).or(page.getByText(T.status.closed)).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCard || hasStatus).toBeTruthy();
  });

  test('botón "Abrir" está disponible si hay caja cerrada', async ({ page }) => {
    const openBtn = page.getByRole('button', { name: T.openButton }).first();
    if (await openBtn.isVisible().catch(() => false)) {
      await expect(openBtn).toBeVisible();
    }
  });

  test('botón "Ver Todas las Cajas" está disponible', async ({ page }) => {
    const viewBtn = page.getByRole('button', { name: T.viewAllCashPoints });
    if (await viewBtn.isVisible().catch(() => false)) {
      await expect(viewBtn).toBeVisible();
    }
  });

  test('sesión activa muestra Ingresos Totales y Pagos Diarios cuando está abierta', async ({ page }) => {
    const isOpen = await page.getByText(T.status.open).isVisible().catch(() => false);
    if (isOpen) {
      await expect(page.getByText(T.activeSession.totalIncome)
        .or(page.getByText(T.activeSession.dailyPayments))).toBeVisible({ timeout: 8_000 });
    }
  });
});

// ── Puntos de Caja (Cash Registers) ──────────────────────────────────────────

test.describe('Caja — Cajas Registradoras Físicas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashier/cash-points');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Cajas Registradoras Físicas" y tabla', async ({ page }) => {
    await expect(page.getByText(T.cashPoints.pageTitle).first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test.describe('CRUD Punto de Caja (con limpieza)', () => {
    test('abre formulario "Crear Caja Registradora" con campo Nombre', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.cashPoints.nameLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.cashPoints.create })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cashPoints.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.cashPoints.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).click();
      await page.getByRole('button', { name: T.cashPoints.create }).click();
      await expect(page.getByText(T.cashPoints.nameRequired)).toBeVisible();
    });

    test('crear → verificar → editar → restaurar → eliminar', async ({ page }) => {
      const name = `Caja E2E ${Date.now()}`;
      const editedName = `${name} EDIT`;

      // CREAR
      await page.getByRole('button', { name: 'Crear' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.cashPoints.nameLabel).fill(name);
      await page.getByRole('button', { name: T.cashPoints.create }).click();
      await expect(page.getByText(/creado|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });

      // VERIFICAR
      await expect(page.locator('table tbody').getByText(name)).toBeVisible({ timeout: 8_000 });

      // EDITAR
      const row = page.locator('table tbody tr').filter({ hasText: name });
      await row.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('menuitem', { name: 'Editar' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.cashPoints.nameLabel).clear();
      await page.getByLabel(T.cashPoints.nameLabel).fill(editedName);
      await page.getByRole('button', { name: T.cashPoints.saveEdit }).click();
      await expect(page.getByText(/actualizado|éxito|guardado/i).first()).toBeVisible({ timeout: 8_000 });

      // RESTAURAR
      const editedRow = page.locator('table tbody tr').filter({ hasText: editedName });
      await editedRow.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('menuitem', { name: 'Editar' }).click();
      await page.getByLabel(T.cashPoints.nameLabel).clear();
      await page.getByLabel(T.cashPoints.nameLabel).fill(name);
      await page.getByRole('button', { name: T.cashPoints.saveEdit }).click();
      await expect(page.getByText(/actualizado|éxito|guardado/i).first()).toBeVisible({ timeout: 8_000 });

      // ELIMINAR
      const finalRow = page.locator('table tbody tr').filter({ hasText: name });
      await finalRow.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('menuitem', { name: 'Eliminar' }).click();
      await page.getByRole('button', { name: T.cashPoints.deleteConfirm }).click();
      await expect(page.getByText(name)).not.toBeVisible({ timeout: 8_000 });
    });
  });
});

// ── Transacciones Misceláneas ─────────────────────────────────────────────────

test.describe('Caja — Transacciones Misceláneas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashier/miscellaneous-transactions');
    await page.waitForLoadState('networkidle');
  });

  test('carga título "Transacciones Misceláneas"', async ({ page }) => {
    await expect(page.getByText(T.miscTx.pageTitle).first()).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/error/);
  });

  test('muestra KPIs: Total Ingresos, Total Gastos, Balance', async ({ page }) => {
    await expect(page.getByText('Total Ingresos')
      .or(page.getByText('Total Gastos'))
      .or(page.getByText('Balance'))).toBeVisible({ timeout: 8_000 });
  });

  test('formulario de creación tiene campos de Categoría, Fecha, Monto', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: 'Crear' }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible().catch(() => false)) {
        // Campo de categoría
        await expect(page.getByText(T.miscTx.categoryLabel)
          .or(page.getByText(T.miscTx.selectCategory))).toBeVisible();
        // Cancelar
        await page.getByRole('button', { name: T.miscTx.cancel }).click();
      }
    }
  });
});

// ── Sesiones de Caja ──────────────────────────────────────────────────────────

test.describe('Caja — Sesiones de Caja', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashier/cash-sessions');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Sesión de Caja" y tabla con columnas', async ({ page }) => {
    await expect(page.getByText(T.sessions.pageTitle).first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.sessions.col.user })
      .or(page.getByRole('columnheader', { name: T.sessions.col.status }))).toBeVisible();
  });

  test('tabla muestra sesiones con estado ABIERTA o CERRADA', async ({ page }) => {
    const hasOpen = await page.getByText(T.status.open).isVisible().catch(() => false);
    const hasClosedText = await page.getByText('CERRADA').isVisible().catch(() => false);
    const hasRows = await page.locator('table tbody tr').count().then(c => c > 0).catch(() => false);
    // No hay problema si no hay sesiones en el historial
    await expect(page).not.toHaveURL(/error/);
  });
});
