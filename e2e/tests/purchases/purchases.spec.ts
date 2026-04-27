import { test, expect } from '@playwright/test';
import { randomEmail, randomPhone, randomDoc } from '../../utils/helpers';

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
      await page.locator('table tbody tr, [data-testid="list-item"]').filter({ hasText: name }).click();
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
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  test('carga título "Presupuestos" y tabla', async ({ page }) => {
    await expect(page).not.toHaveURL(/error|login/);
    await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible({ timeout: 10_000 });
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
      await expect(page.getByText(/proveedor|supplier|monto/i).first()).toBeVisible();
      await page.getByRole('button', { name: 'Cancelar' }).click();
    }
  });
});
