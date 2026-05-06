import { test, expect, type Locator, type Page } from '@playwright/test';

// Translation strings from es.json — PaymentMethodsPage
const T = {
  pageTitle: 'Métodos de Pago',
  filterPlaceholder: 'Filtrar aquí...',
  createDialogTitle: 'Crear Método de Pago',
  editDialogTitle: 'Editar Método de Pago',
  nameLabel: 'Nombre',
  namePlaceholder: 'ej., Tarjeta de Crédito',
  codeLabel: 'Código',
  codePlaceholder: 'ASD123',
  isCashEquivalentLabel: '¿Es Equivalente a Efectivo?',
  isActiveLabel: '¿Está Activo?',
  cancel: 'Cancelar',
  create: 'Crear',
  saveEdit: 'Guardar Cambios',
  createBtn: 'Crear',
  nameRequired: 'El nombre es obligatorio.',
  codeRequired: 'El código es obligatorio.',
  col: {
    name: 'Nombre',
    code: 'Código',
    cashEquivalent: '¿Es Equivalente a Efectivo?',
    active: '¿Está Activo?',
  },
  deleteDialog: {
    title: 'Eliminar Método de Pago',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
  },
};

async function isVisibleSafe(locator: Locator): Promise<boolean> {
  return await locator.isVisible().catch(() => false);
}

async function getActiveListLocator(page: Page): Promise<Locator> {
  const cardList = page.getByTestId('card-list');
  if (await isVisibleSafe(cardList)) {
    return cardList;
  }

  return page.locator('table').first();
}

async function getActiveRowsLocator(page: Page): Promise<Locator> {
  const cardList = page.getByTestId('card-list');
  if (await isVisibleSafe(cardList)) {
    return page.getByTestId('list-item');
  }

  return page.locator('table tbody tr');
}

async function getEditButton(page: Page): Promise<Locator> {
  const namedButton = page.getByRole('button', { name: 'Editar' }).first();
  if (await isVisibleSafe(namedButton)) {
    return namedButton;
  }

  return page.locator('button').filter({ has: page.locator('svg.lucide-pencil') }).first();
}

test.describe('Métodos de Pago', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/sales/payment-methods', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(T.pageTitle).first()).toBeVisible({ timeout: 30_000 });
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga título "Métodos de Pago" y tabla', async ({ page }) => {
      await expect(page).not.toHaveURL(/error|login/);
      await expect(page.getByText(T.pageTitle).first()).toBeVisible();
      await expect(await getActiveListLocator(page)).toBeVisible({ timeout: 10_000 });
    });

    test('tabla muestra columnas Nombre, Código', async ({ page }) => {
      const inCardMode = await isVisibleSafe(page.getByTestId('card-list'));
      if (!inCardMode) {
        await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: T.col.code })).toBeVisible();
      }
    });

    test('botón Crear visible en toolbar', async ({ page }) => {
      await expect(page.getByRole('button', { name: T.createBtn })).toBeVisible();
    });

    test('campo de búsqueda visible', async ({ page }) => {
      await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
    });
  });

  // ── CRUD completo ────────────────────────────────────────────────────────

  test.describe('Crear método de pago (con limpieza)', () => {
    test('abre formulario con campos nombre, código, toggles', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.codeLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.create })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill('Cancelado');
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await page.getByRole('button', { name: T.create }).click();
      await expect(page.getByText(T.nameRequired)).toBeVisible();
    });

    test('validación: código vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await page.getByLabel(T.nameLabel).fill('Solo Nombre');
      await page.getByRole('button', { name: T.create }).click();
      await expect(page.getByText(T.codeRequired)).toBeVisible();
    });

    test('CRUD completo: crear → verificar → editar → restaurar → eliminar', async ({ page }) => {
      const ts = Date.now();
      const name = `Método E2E ${ts}`;
      const code = `ME${ts}`.slice(-10);
      const editedName = `${name} EDIT`;

      // CREAR via dialog
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByLabel(T.codeLabel).fill(code);
      await page.getByRole('button', { name: T.create }).click();

      // VERIFICAR toast y aparición en tabla
      await expect(page.getByText(/creado|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });
      await page.getByPlaceholder(T.filterPlaceholder).fill(name);
      await page.waitForTimeout(600);
      await expect((await getActiveListLocator(page)).getByText(name).first()).toBeVisible({ timeout: 8_000 });

      // EDITAR: click row → right panel opens
      const row = (await getActiveRowsLocator(page)).filter({ hasText: name }).first();
      await row.click();
      await page.waitForTimeout(500);
      await (await getEditButton(page)).click();
      const nameInput = page.getByLabel(T.nameLabel);
      await nameInput.clear();
      await nameInput.fill(editedName);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|guardado|éxito/i).first()).toBeVisible({ timeout: 8_000 });

      // RESTAURAR nombre original (re-abrir modo edición: save cierra isEditing)
      await (await getEditButton(page)).click();
      await nameInput.clear();
      await nameInput.fill(name);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|guardado|éxito/i).first()).toBeVisible({ timeout: 8_000 });

      // ELIMINAR: trash icon button in panel
      await page.locator('button').filter({ has: page.locator('svg.lucide-trash2') }).first().click();
      await page.getByRole('button', { name: T.deleteDialog.confirm }).click();
      await expect((await getActiveListLocator(page)).getByText(name)).not.toBeVisible({ timeout: 8_000 });
    });
  });
});
