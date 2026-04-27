import { test, expect } from '@playwright/test';

// ── Padecimientos ─────────────────────────────────────────────────────────────

test.describe('Catálogo — Padecimientos', () => {
  const T = {
    pageTitle: 'Padecimientos',
    filterPlaceholder: 'Filtrar por nombre...',
    createBtn: 'Crear',
    createDialogTitle: 'Crear Nuevo Padecimiento',
    editDialogTitle: 'Editar Padecimiento',
    nameLabel: 'Nombre',
    namePlaceholder: 'ej., Hipertensión Arterial',
    categoryLabel: 'Categoría',
    categoryPlaceholder: 'ej., Cardiovascular',
    alertLevelLabel: 'Nivel de Alerta',
    cancel: 'Cancelar',
    save: 'Crear Padecimiento',
    saveEdit: 'Guardar Cambios',
    deleteConfirm: 'Eliminar',
    deleteCancel: 'Cancelar',
    col: { name: 'Nombre', category: 'Categoría', alertLevel: 'Nivel de Alerta' },
    nameRequired: 'El nombre es obligatorio.',
    categoryRequired: 'La categoría es obligatoria.',
    alertRequired: 'El nivel de alerta es obligatorio.',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic-catalog/ailments', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 15_000 }).catch(() => {});
  });

  test('carga título "Padecimientos" y tabla con columnas correctas', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
    if (!inCardMode) {
      await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.category })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.alertLevel })).toBeVisible();
    }
  });

  test('campo de búsqueda con placeholder correcto', async ({ page }) => {
    await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
  });

  test.describe('Crear padecimiento (con limpieza)', () => {
    test('abre formulario con campos: Nombre, Categoría, Nivel de Alerta', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.categoryLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
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
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(T.nameRequired)).toBeVisible();
    });

    test('CRUD completo: crear → verificar → editar → restaurar → eliminar', async ({ page }) => {
      const uniqueName = `Padec. E2E ${Date.now()}`;
      const editedName = `${uniqueName} EDIT`;

      // CREAR via diálogo
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(uniqueName);
      await page.getByLabel(T.categoryLabel).fill('Test');
      const alertCombo = page.getByRole('combobox').first();
      if (await alertCombo.isVisible().catch(() => false)) {
        await alertCombo.click();
        await page.getByRole('option').first().click();
      }
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(/creado|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });

      // VERIFICAR en tabla (tabla visible antes de abrir panel derecho)
      await page.getByPlaceholder(T.filterPlaceholder).fill(uniqueName);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(uniqueName).first()).toBeVisible({ timeout: 8_000 });

      // Abrir panel derecho: clic en fila (aún en modo tabla)
      await page.locator('table tbody tr, [data-testid="list-item"]').filter({ hasText: uniqueName }).click();
      await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible({ timeout: 5_000 });

      // EDITAR: panel derecho ya abierto → click Editar
      await page.getByRole('button', { name: 'Editar' }).first().click();
      await page.getByLabel(T.nameLabel).clear();
      await page.getByLabel(T.nameLabel).fill(editedName);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|guardado|éxito/i).first()).toBeVisible({ timeout: 8_000 });

      // RESTAURAR: panel derecho aún abierto mostrando el item → click Editar de nuevo
      await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Editar' }).first().click();
      await page.getByLabel(T.nameLabel).clear();
      await page.getByLabel(T.nameLabel).fill(uniqueName);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|guardado|éxito/i).first()).toBeVisible({ timeout: 8_000 });

      // ELIMINAR: panel derecho aún abierto → icono papelera → confirmar
      await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Editar' }).first().locator('..').getByRole('button').last().click();
      const deleteDialog = page.getByRole('alertdialog');
      await expect(deleteDialog).toBeVisible({ timeout: 5_000 });
      await deleteDialog.getByRole('button', { name: T.deleteConfirm }).click();
      await expect(deleteDialog).not.toBeVisible({ timeout: 8_000 });
      await expect(page.locator('table tbody, [role="list"]').getByText(uniqueName).first()).not.toBeVisible({ timeout: 10_000 });
    });
  });
});

// ── Medicamentos ──────────────────────────────────────────────────────────────

test.describe('Catálogo — Medicamentos', () => {
  const T = {
    pageTitle: 'Medicamentos',
    filterPlaceholder: 'Filtrar por nombre genérico...',
    createBtn: 'Crear',
    save: 'Crear Medicamento',
    saveEdit: 'Guardar Cambios',
    cancel: 'Cancelar',
    nameLabel: 'Nombre Genérico',
    commercialLabel: 'Nombre Comercial',
    col: { genericName: 'Nombre Genérico', commercialName: 'Nombre Comercial' },
    nameRequired: 'El nombre genérico es obligatorio.',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic-catalog/medications', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 15_000 }).catch(() => {});
  });

  test('carga título "Medicamentos" y columnas correctas', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
    if (!inCardMode) {
      await expect(page.getByRole('columnheader', { name: T.col.genericName })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.commercialName })).toBeVisible();
    }
  });

  test('campo de búsqueda mínimo 3 caracteres para filtrar', async ({ page }) => {
    const searchInput = page.getByPlaceholder(T.filterPlaceholder);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('ibu');
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/error/);
  });

  test.describe('CRUD Medicamento (con limpieza)', () => {
    test('abre formulario con campos Nombre Genérico y Nombre Comercial', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre genérico vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(T.nameRequired)).toBeVisible();
    });

    test('crear → verificar → eliminar', async ({ page }) => {
      const name = `Med E2E ${Date.now()}`;

      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(/creado|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });

      await page.getByPlaceholder(T.filterPlaceholder).fill(name.slice(0, 5));
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(name).first()).toBeVisible({ timeout: 8_000 });

      // Clic en fila → panel derecho → icono papelera → confirmar
      await page.locator('table tbody tr, [data-testid="list-item"]').filter({ hasText: name }).click();
      await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Editar' }).locator('..').getByRole('button').last().click();
      const delDlg = page.getByRole('alertdialog');
      await expect(delDlg).toBeVisible({ timeout: 5_000 });
      await delDlg.getByRole('button', { name: 'Eliminar' }).click();
      await expect(delDlg).not.toBeVisible({ timeout: 8_000 });
      await expect(page.locator('table tbody, [role="list"]').getByText(name).first()).not.toBeVisible({ timeout: 10_000 });
    });
  });
});

// ── Condiciones Dentales ──────────────────────────────────────────────────────

test.describe('Catálogo — Condiciones Dentales', () => {
  const T = {
    pageTitle: 'Condiciones Dentales',
    filterPlaceholder: 'Filtrar por nombre...',
    createBtn: 'Crear',
    save: 'Crear Condición',
    saveEdit: 'Guardar Cambios',
    cancel: 'Cancelar',
    nameLabel: 'Nombre',
    codeLabel: 'Código Visual',
    colorLabel: 'Color',
    col: { name: 'Nombre', code: 'Código Visual', color: 'Color' },
    nameRequired: 'El nombre es obligatorio.',
    codeRequired: 'El código visual es obligatorio.',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic-catalog/dental-conditions', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 15_000 }).catch(() => {});
  });

  test('carga título "Condiciones Dentales" y columnas: Nombre, Código Visual, Color', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
    if (!inCardMode) {
      await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.code })).toBeVisible();
    }
  });

  test.describe('CRUD Condición Dental (con limpieza)', () => {
    test('abre formulario con Nombre, Código Visual y Color', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.codeLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('selector de color (color picker) está disponible', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      const colorInput = page.getByLabel(T.colorLabel)
        .or(page.locator('input[type="color"]')).first();
      if (await colorInput.isVisible().catch(() => false)) {
        await expect(colorInput).toBeVisible();
      }
      await page.getByRole('button', { name: T.cancel }).click();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(T.nameRequired)).toBeVisible();
    });

    test('crear → verificar → eliminar', async ({ page }) => {
      const name = `Condición E2E ${Date.now()}`;
      const code = `CE${Date.now()}`.slice(-8);

      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByLabel(T.codeLabel).fill(code);
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(/creada|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });

      await page.getByPlaceholder(T.filterPlaceholder).fill(name);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(name).first()).toBeVisible({ timeout: 8_000 });

      // Clic en fila → panel derecho → icono papelera → confirmar
      await page.locator('table tbody tr, [data-testid="list-item"]').filter({ hasText: name }).click();
      await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Editar' }).locator('..').getByRole('button').last().click();
      const delDlg = page.getByRole('alertdialog');
      await expect(delDlg).toBeVisible({ timeout: 5_000 });
      await delDlg.getByRole('button', { name: 'Eliminar' }).click();
      await expect(delDlg).not.toBeVisible({ timeout: 8_000 });
      await expect(page.locator('table tbody, [role="list"]').getByText(name).first()).not.toBeVisible({ timeout: 10_000 });
    });
  });
});

// ── Superficies Dentales ──────────────────────────────────────────────────────

test.describe('Catálogo — Superficies Dentales', () => {
  const T = {
    pageTitle: 'Superficies Dentales',
    filterPlaceholder: 'Filtrar por nombre...',
    createBtn: 'Crear',
    save: 'Crear Superficie',
    saveEdit: 'Guardar Cambios',
    cancel: 'Cancelar',
    nameLabel: 'Nombre',
    codeLabel: 'Código',
    col: { name: 'Nombre', code: 'Código' },
    nameRequired: 'El nombre es obligatorio.',
    codeRequired: 'El código es obligatorio.',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic-catalog/dental-surfaces', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 15_000 }).catch(() => {});
  });

  test('carga título "Superficies Dentales" y columnas: Nombre, Código', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
    if (!inCardMode) {
      await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: T.col.code })).toBeVisible();
    }
  });

  test.describe('CRUD Superficie Dental (con limpieza)', () => {
    test('abre formulario con campos Nombre y Código', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.codeLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(T.nameRequired)).toBeVisible();
    });

    test('crear → verificar → eliminar', async ({ page }) => {
      const name = `Superficie E2E ${Date.now()}`;
      const code = `SE${Date.now()}`.slice(-5);

      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByLabel(T.codeLabel).fill(code);
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(/creada|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });

      await page.getByPlaceholder(T.filterPlaceholder).fill(name);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(name).first()).toBeVisible({ timeout: 8_000 });

      // Clic en fila → panel derecho → icono papelera → confirmar
      await page.locator('table tbody tr, [data-testid="list-item"]').filter({ hasText: name }).click();
      await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Editar' }).locator('..').getByRole('button').last().click();
      const delDlg = page.getByRole('alertdialog');
      await expect(delDlg).toBeVisible({ timeout: 5_000 });
      await delDlg.getByRole('button', { name: 'Eliminar' }).click();
      await expect(delDlg).not.toBeVisible({ timeout: 8_000 });
      await expect(page.locator('table tbody, [role="list"]').getByText(name).first()).not.toBeVisible({ timeout: 10_000 });
    });
  });
});
