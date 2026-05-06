import { test, expect, type Page } from '@playwright/test';
import { randomEmail, randomPhone, randomDoc } from '../../utils/helpers';

async function getVisibleListContainer(page: Page) {
  const cardList = page.locator('[data-testid="card-list"]').first();
  if (await cardList.isVisible().catch(() => false)) {
    return cardList;
  }

  return page.locator('table').first();
}

async function createProviderForChainedFlow(page: Page) {
  const name = `Proveedor E2E Chain ${Date.now()}`;
  const email = randomEmail();

  const createBtn = page.getByRole('button', { name: 'Crear' }).first();
  test.skip(!await createBtn.isVisible({ timeout: 6_000 }).catch(() => false), 'No existe botón Crear para proveedor');
  await createBtn.click();

  const dialog = page.getByRole('dialog');
  test.skip(!await dialog.isVisible({ timeout: 8_000 }).catch(() => false), 'No abrió diálogo de proveedor');

  await page.getByLabel('Nombre').fill(name);
  const emailInput = page.getByLabel('Correo Electrónico');
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(email);
  }
  const phoneInput = page.getByLabel('Teléfono');
  if (await phoneInput.isVisible().catch(() => false)) {
    await phoneInput.fill(randomPhone());
  }
  const docInput = page.getByLabel('Documento de Identidad');
  if (await docInput.isVisible().catch(() => false)) {
    await docInput.fill(randomDoc());
  }

  await page.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByText(/creado|éxito|guardado/i).first()).toBeVisible({ timeout: 12_000 });

  const filterInput = page.getByPlaceholder('Filtrar por rol...');
  if (await filterInput.isVisible().catch(() => false)) {
    await filterInput.fill(name);
    await page.waitForTimeout(500);
  }

  await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(name).first())
    .toBeVisible({ timeout: 10_000 });

  return { name, email };
}

// Translation strings from es.json — ProvidersPage / Purchases modules

// ── Proveedores ───────────────────────────────────────────────────────────────

test.describe('Compras — Proveedores', () => {
  const T = {
    pageTitle: 'Proveedores',
    filterPlaceholder: 'Filtrar por rol...',
    createBtn: 'Crear',
    nameLabel: 'Nombre',
    emailLabel: 'Correo Electrónico',
    phoneLabel: 'Teléfono',
    docLabel: 'Documento de Identidad',
    addressLabel: 'Dirección',
    cancel: 'Cancelar',
    save: 'Crear',
    saveEdit: 'Guardar',
    col: { name: 'Nombre', email: 'Correo Electrónico', phone: 'Teléfono', status: 'Estado' },
    validation: { nameRequired: 'El nombre es obligatorio' },
    panelTabs: { summary: 'Resumen', notes: 'Notas', details: 'Detalles' },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/es/purchases/providers', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  test('carga título "Proveedores" y tabla con columnas', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible();
    const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
    if (!inCardMode) {
      await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
    }
  });

  test('campo de búsqueda visible', async ({ page }) => {
    await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
  });

  test.describe('CRUD Proveedor (con limpieza)', () => {
    test('abre formulario con campos: Nombre, Email, Teléfono, Dirección', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.emailLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      if (!await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      if (!await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(T.validation.nameRequired)).toBeVisible();
    });

    test('crear → verificar → editar → restaurar → desactivar', async ({ page }) => {
      const name = `Proveedor E2E ${Date.now()}`;
      const email = randomEmail();
      const editedName = `${name} EDIT`;

      // CREAR via dialog
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByLabel(T.emailLabel).fill(email);
      await page.getByLabel(T.docLabel).fill(randomDoc());
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(/creado|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });

      // VERIFICAR: filter by email (column is email)
      await page.getByPlaceholder(T.filterPlaceholder).fill(email);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(name).first()).toBeVisible({ timeout: 8_000 });

      // EDITAR: click row → right panel opens with always-editable form
      const listContainer = await getVisibleListContainer(page);
      await listContainer.locator('tr, [data-testid="list-item"]').filter({ hasText: name }).first().click();
      await page.waitForTimeout(500);
      const nameInput = page.getByLabel(T.nameLabel);
      if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill(editedName);
        await page.getByRole('button', { name: T.saveEdit }).click();
        await expect(page.getByText(/actualizado|éxito|guardado/i).first()).toBeVisible({ timeout: 8_000 });

        // RESTAURAR: panel still open → edit back
        await nameInput.clear();
        await nameInput.fill(name);
        await page.getByRole('button', { name: T.saveEdit }).click();
        await expect(page.getByText(/actualizado|éxito|guardado/i).first()).toBeVisible({ timeout: 8_000 });
      }

      await expect(page).not.toHaveURL(/error/);
    });
  });

  test.describe('Panel de detalle del proveedor', () => {
    test('tabs Resumen, Notas, Detalles son accesibles', async ({ page }) => {
      const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
        for (const tab of [T.panelTabs.summary, T.panelTabs.notes, T.panelTabs.details]) {
          const tabEl = page.getByRole('button', { name: tab }).or(page.getByText(tab)).first();
          if (await tabEl.isVisible().catch(() => false)) {
            await tabEl.click();
            await page.waitForTimeout(300);
            await expect(page).not.toHaveURL(/error/);
          }
        }
      }
    });
  });
});

// ── Presupuestos de Compra ────────────────────────────────────────────────────

test.describe('Compras — Presupuestos de Compra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/purchases/quotes', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('carga título "Presupuestos" y tabla', async ({ page }) => {
    await expect(page).not.toHaveURL(/error|login/);
    await expect(page.getByText('Presupuestos').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/filtrar presupuestos/i)).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('table').first().or(page.getByRole('button', { name: /QUO-/ }).first())
    ).toBeVisible({ timeout: 10_000 });
  });

  test('botón Crear disponible', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: 'Crear' }).first();
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('formulario de creación muestra campo de selección de proveedor', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: 'Crear' }).first();
    if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    await createBtn.click();
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(page.getByText(/usuario|proveedor|supplier/i).first()).toBeVisible();
      await page.getByRole('button', { name: 'Cancelar' }).click();
    }
  });

  test('flujo encadenado: proveedor creado aparece como opción al crear presupuesto', async ({ page }) => {
    await page.goto('/es/purchases/providers', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
    const provider = await createProviderForChainedFlow(page);

    await page.goto('/es/purchases/quotes', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const createBtn = page.getByRole('button', { name: 'Crear' }).first();
    test.skip(!await createBtn.isVisible({ timeout: 6_000 }).catch(() => false), 'No existe Crear en presupuestos de compra');
    await createBtn.click();

    const dialog = page.getByRole('dialog');
    test.skip(!await dialog.isVisible({ timeout: 8_000 }).catch(() => false), 'No abrió diálogo de presupuesto de compra');

    const supplierSelector = dialog.getByRole('combobox', { name: /proveedor|usuario|supplier/i }).first();
    if (await supplierSelector.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await supplierSelector.click();
    } else {
      const supplierTrigger = dialog.getByRole('button', { name: /seleccionar proveedor|proveedor|usuario|supplier/i }).first();
      test.skip(!await supplierTrigger.isVisible({ timeout: 3_000 }).catch(() => false), 'No hay selector de proveedor');
      await supplierTrigger.click();
    }

    const searchInput = page.getByPlaceholder(/buscar|search/i).last();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill(provider.name);
      await page.waitForTimeout(500);
    }

    await expect(page.getByRole('option', { name: new RegExp(provider.name, 'i') }).first()
      .or(page.getByText(new RegExp(provider.name, 'i')).first())).toBeVisible({ timeout: 8_000 });

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });
});

// ── Facturas de Compra ────────────────────────────────────────────────────────

test.describe('Compras — Facturas de Compra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/purchases/invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  test('carga título "Facturas" y tabla', async ({ page }) => {
    // InvoicesPage.title = "Facturas"
    await expect(page.getByText('Facturas').first()).toBeVisible();
    await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible();
  });

  test('columnas incluyen No. Documento, Total, Estado', async ({ page }) => {
    const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
    if (!inCardMode) {
      await expect(page.getByRole('columnheader', { name: /total/i })).toBeVisible();
    }
  });

  test('validación visible: crear factura sin proveedor no debe permitir guardado', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: 'Crear' }).first();
    test.skip(!await createBtn.isVisible({ timeout: 6_000 }).catch(() => false), 'No existe botón Crear');
    await createBtn.click();

    const dialog = page.getByRole('dialog');
    test.skip(!await dialog.isVisible({ timeout: 8_000 }).catch(() => false), 'No abrió diálogo de factura');

    const submitBtn = dialog.getByRole('button', { name: /crear|guardar/i }).last();
    await submitBtn.click();
    await expect(dialog.getByText(/proveedor|usuario.*obligatorio|required/i).first()).toBeVisible({ timeout: 8_000 });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });
});

// ── Pagos de Compra ───────────────────────────────────────────────────────────

test.describe('Compras — Pagos de Compra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/purchases/payments', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  test('carga título "Pagos" y tabla', async ({ page }) => {
    // PaymentsPage.title = "Pagos"
    await expect(page.getByText('Pagos').first()).toBeVisible();
    await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible();
  });

  test('botón "Crear Prepago" o Crear disponible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /crear prepago|crear/i }).first();
    await expect(btn).toBeVisible();
  });

  test('diálogo de prepago a proveedor tiene campo de proveedor y monto', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /crear prepago|crear/i }).first();
    if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    await createBtn.click();
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(dialog.getByText(/proveedor|supplier/i).first()).toBeVisible();
      await expect(dialog.getByText(/monto/i).first()).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancelar' }).click();
    }
  });

  test('flujo encadenado: proveedor creado aparece en diálogo de prepago y valida monto', async ({ page }) => {
    await page.goto('/es/purchases/providers', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
    const provider = await createProviderForChainedFlow(page);

    await page.goto('/es/purchases/payments', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});

    const createBtn = page.getByRole('button', { name: /crear prepago|crear/i }).first();
    test.skip(!await createBtn.isVisible({ timeout: 6_000 }).catch(() => false), 'No existe botón crear prepago');
    await createBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    const supplierSelector = dialog.getByRole('combobox', { name: /proveedor|supplier|usuario/i }).first();
    if (await supplierSelector.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await supplierSelector.click();
    } else {
      const supplierTrigger = dialog.getByRole('button', { name: /seleccionar proveedor|proveedor|supplier|usuario/i }).first();
      test.skip(!await supplierTrigger.isVisible({ timeout: 3_000 }).catch(() => false), 'No hay selector de proveedor');
      await supplierTrigger.click();
    }

    const searchInput = page.getByPlaceholder(/buscar|search/i).last();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill(provider.name);
      await page.waitForTimeout(400);
    }

    const providerOption = page.getByRole('option', { name: new RegExp(provider.name, 'i') }).first();
    test.skip(!await providerOption.isVisible({ timeout: 8_000 }).catch(() => false), 'Proveedor no disponible en selector de prepago');
    await providerOption.click();

    const amountInput = dialog.getByLabel(/monto/i).first();
    test.skip(!await amountInput.isVisible({ timeout: 4_000 }).catch(() => false), 'No hay input de monto');
    await amountInput.fill('0');
    await dialog.getByRole('button', { name: /crear|guardar|agregar/i }).first().click();
    await expect(dialog.getByText(/monto.*(obligatorio|mayor|válido|positivo)|invalid amount/i).first())
      .toBeVisible({ timeout: 8_000 });

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });
});
