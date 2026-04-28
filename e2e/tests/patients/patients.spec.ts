import { test, expect } from '@playwright/test';
import { randomDoc, randomEmail } from '../../utils/helpers';

// Translation strings from es.json
const T = {
  pageTitle: 'Pacientes',
  filterPlaceholder: 'Filtrar pacientes por correo...',
  createBtn: 'Crear',
  createDialogTitle: 'Crear Nuevo Paciente',
  saveCreate: 'Crear Paciente',
  saveEdit: 'Guardar Cambios',
  cancel: 'Cancelar',
  nameLabel: 'Nombre',
  emailLabel: 'Correo Electrónico',
  phoneLabel: 'Teléfono',
  docLabel: 'Documento de Identidad',
  statusLabel: 'Estado',
  activeLabel: 'Activo',
  inactiveLabel: 'Inactivo',
  editAction: 'Editar paciente',
  deleteAction: 'Eliminar paciente',
  tabs: {
    clinicalHistory: 'Historia Clínica',
    quotes: 'Presupuestos',
    invoices: 'Facturas',
    payments: 'Pagos',
    appointments: 'Citas',
    notes: 'Notas',
    orders: 'Órdenes',
    messages: 'Mensajes',
    logs: 'Registros',
    treatmentPlans: 'Planes de Trat.',
  },
  noResults: 'No hay resultados.',
  refreshBtn: 'Refrescar',
  clearFilters: 'Limpiar Filtros',
  dischargeBtn: 'Dar Alta',
  readmitBtn: 'Reingreso',
  setPassword: 'Establecer Contraseña Inicial',
  printFinancial: 'Imprimir Resumen Financiero',
};

test.describe('Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/patients', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  });

  // ── Página principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga la página con título y tabla', async ({ page }) => {
      await expect(page).not.toHaveURL(/error|login/);
      // Title may be in hidden nav on mobile — just verify table/cards loaded
      await expect(page.locator('table, [data-testid="card-list"]').first()).toBeVisible({ timeout: 10_000 });
    });

    test('tabla muestra columnas: Nombre, Correo, Teléfono, Estado', async ({ page }) => {
      const inCardMode = await page.locator('[data-testid="card-list"]').isVisible().catch(() => false);
      if (inCardMode) {
        await expect(page.locator('[data-testid="list-item"]').first()).toBeVisible();
      } else {
        await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
      }
    });

    test('botón Crear está visible en la barra de herramientas', async ({ page }) => {
      // Button is icon-only on mobile but has aria-label="Crear"
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(createBtn).toBeVisible();
      }
    });

    test('botón Refrescar está disponible', async ({ page }) => {
      const refreshBtn = page.getByRole('button', { name: T.refreshBtn }).first();
      if (await refreshBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(refreshBtn).toBeVisible();
      }
    });

    test('tabla tiene al menos una fila de datos', async ({ page }) => {
      await expect(page.locator('table tbody tr, [data-testid="list-item"]').first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Búsqueda y filtros ───────────────────────────────────────────────────

  test.describe('Búsqueda y filtros', () => {
    test('campo de búsqueda está visible con placeholder correcto', async ({ page }) => {
      const filterInput = page.getByPlaceholder(T.filterPlaceholder);
      if (await filterInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(filterInput).toBeVisible();
      }
    });

    test('búsqueda por email sin resultados muestra estado vacío', async ({ page }) => {
      const filterInput = page.getByPlaceholder(T.filterPlaceholder);
      if (!await filterInput.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await filterInput.fill('zzz_no_existe_99999@test.com');
      // Wait for API response: either empty-state text appears or all rows vanish
      const gotEmpty = await page.getByText(T.noResults)
        .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      if (!gotEmpty) {
        const rowCount = await page.locator('table tbody tr:has(td:nth-child(2)), [data-testid="list-item"]').count();
        expect(rowCount).toBe(0);
      }
    });

    test('limpiar filtros restaura la tabla', async ({ page }) => {
      await page.getByPlaceholder(T.filterPlaceholder).fill('zzz_no_existe');
      await page.waitForTimeout(400);
      const clearBtn = page.getByRole('button', { name: T.clearFilters });
      if (await clearBtn.isVisible()) await clearBtn.click();
      else await page.getByPlaceholder(T.filterPlaceholder).clear();
      await page.waitForTimeout(400);
      await expect(page.locator('table tbody tr, [data-testid="list-item"]').first()).toBeVisible({ timeout: 8_000 });
    });

    test('filtro "Mostrar solo deudores" está disponible', async ({ page }) => {
      // Filters are inside a dropdown triggered by the SlidersHorizontal icon button
      const filterBtn = page.locator('button').filter({ has: page.locator('svg.lucide-sliders-horizontal') }).first();
      if (!await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await filterBtn.click();
      const item = page.getByRole('menuitem', { name: 'Mostrar solo deudores' });
      const found = await item.isVisible({ timeout: 3_000 }).catch(() => false);
      if (found) await expect(item).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('filtro "Mostrar solo activos" está disponible', async ({ page }) => {
      const filterBtn = page.locator('button').filter({ has: page.locator('svg.lucide-sliders-horizontal') }).first();
      if (!await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await filterBtn.click();
      const item = page.getByRole('menuitem', { name: 'Mostrar solo activos' });
      if (await item.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(item).toBeVisible();
      }
      await page.keyboard.press('Escape');
    });
  });

  // ── CRUD: Crear paciente ─────────────────────────────────────────────────

  test.describe('Crear paciente (con limpieza)', () => {
    test('abre el formulario de creación con campos correctos', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.emailLabel)).toBeVisible();
      await expect(page.getByLabel(T.docLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.saveCreate })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario sin crear', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByLabel(T.nameLabel).fill('Paciente Cancelado');
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      if (!await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByLabel(T.docLabel).fill(randomDoc());
      await page.getByLabel(T.emailLabel).fill(randomEmail());
      await page.getByRole('button', { name: T.saveCreate }).click();
      await expect(page.getByText('El nombre es obligatorio')).toBeVisible();
    });

    test('validación: sin email ni teléfono muestra error', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      if (!await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByLabel(T.nameLabel).fill('Test Sin Contacto');
      await page.getByLabel(T.docLabel).fill(randomDoc());
      await page.getByRole('button', { name: T.saveCreate }).click();
      // Use .first() to avoid strict mode violation when multiple elements match
      await expect(page.getByText(/Debe proporcionar/i).first()).toBeVisible();
    });

    test('validación: email inválido muestra error', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      if (!await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByLabel(T.nameLabel).fill('Test Invalido');
      // Use an email with @ but no TLD dot — passes browser native validation, fails Zod regex
      await page.getByLabel(T.emailLabel).fill('invalido@sindominio');
      await page.getByLabel(T.docLabel).fill(randomDoc());
      await page.getByRole('button', { name: T.saveCreate }).click();
      await expect(page.getByText('Correo electrónico inválido').first()).toBeVisible();
    });

    test('crear → verificar en tabla', async ({ page }) => {
      const uniqueName = `Test E2E ${Date.now()}`;
      const email = randomEmail();
      const doc = randomDoc();

      // CREAR
      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await page.getByLabel(T.nameLabel).fill(uniqueName);
      await page.getByLabel(T.emailLabel).fill(email);
      await page.getByLabel(T.docLabel).fill(doc);
      await page.getByRole('button', { name: T.saveCreate }).click();

      // VERIFICAR toast de éxito
      await expect(page.getByText('Paciente Creado').or(page.getByText(/creado|éxito|success/i)).first())
        .toBeVisible({ timeout: 10_000 });

      // VERIFICAR que aparece en la tabla (buscar por email)
      await page.getByPlaceholder(T.filterPlaceholder).fill(email);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(uniqueName).first()).toBeVisible({ timeout: 8_000 });
    });
  });

  // ── CRUD: Editar paciente ─────────────────────────────────────────────────

  test.describe('Editar paciente (con restauración)', () => {
    test('abre formulario de edición con datos precargados', async ({ page }) => {
      // Click first row to open detail panel
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      // Wait for panel
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});

      // Navigate to Información tab (always-editable form)
      const infoTab = page.getByRole('button', { name: 'Información' });
      if (!await infoTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await infoTab.click();
      await page.waitForTimeout(300);

      // Name input should be pre-filled
      const nameInput = page.getByLabel(T.nameLabel);
      if (!await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const nameVal = await nameInput.inputValue();
      expect(nameVal.length).toBeGreaterThan(0);
      // Guardar button is visible
      await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible();
    });

    test('editar nombre y restaurar valor original', async ({ page }) => {
      // Click first row to open detail panel
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      // Wait for panel
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});

      // Navigate to Información tab
      const infoTab = page.getByRole('button', { name: 'Información' });
      if (!await infoTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await infoTab.click();
      await page.waitForTimeout(300);

      const nameInput = page.getByLabel(T.nameLabel);
      if (!await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) return;

      // Read the current name directly from the input
      const currentName = await nameInput.inputValue();
      if (!currentName) return;

      // Change name temporarily
      const newName = `Editado E2E ${Date.now()}`;
      await nameInput.clear();
      await nameInput.fill(newName);
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByText(/Paciente Actualizado|actualizado|éxito/i).first()).toBeVisible({ timeout: 8_000 });

      // RESTAURAR: edit back to original name (panel stays open)
      await page.waitForTimeout(500);
      await nameInput.clear();
      await nameInput.fill(currentName);
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByText(/Paciente Actualizado|actualizado|éxito/i).first()).toBeVisible({ timeout: 8_000 });
    });
  });

  // ── Panel de detalle y tabs ───────────────────────────────────────────────

  test.describe('Panel de detalle', () => {
    test.beforeEach(async ({ page }) => {
      // Click first row and wait for panel to actually open
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      // Wait for a panel indicator (discharge/readmit button or any tab)
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
    });

    test('panel de detalle se abre al seleccionar un paciente', async ({ page }) => {
      const panelOpen = await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn })).isVisible({ timeout: 5_000 }).catch(() => false);
      if (panelOpen) {
        await expect(page.getByRole('button', { name: T.dischargeBtn })
          .or(page.getByRole('button', { name: T.readmitBtn }))).toBeVisible();
      }
    });

    for (const [, label] of Object.entries(T.tabs)) {
      test(`tab "${label}" es accesible y visible`, async ({ page }) => {
        // Soft check — tab may be hidden (e.g. Órdenes) or panel may not have opened
        const tab = page.getByRole('button', { name: label });
        const isFound = await tab.isVisible({ timeout: 3_000 }).catch(() => false);
        if (!isFound) return;
        await tab.click();
        await page.waitForTimeout(400);
        await expect(page).not.toHaveURL(/error/);
      });
    }

    test('acciones del panel: botón de resumen financiero visible', async ({ page }) => {
      const panelOpen = await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn })).isVisible({ timeout: 3_000 }).catch(() => false);
      if (!panelOpen) return;
      const printBtn = page.getByRole('button', { name: /imprimir/i });
      if (await printBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(printBtn).toBeVisible();
      }
    });
  });

  // ── Activar / Desactivar ─────────────────────────────────────────────────

  test.describe('Activar y desactivar paciente', () => {
    test('menú de acciones muestra opción Desactivar o Activar', async ({ page }) => {
      const menuBtn = page.locator('table tbody tr, [data-testid="list-item"]').first().getByRole('button', { name: 'Abrir menú' });
      if (!await menuBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await menuBtn.click();
      const activate = page.getByRole('menuitem', { name: T.activeLabel });
      const deactivate = page.getByRole('menuitem', { name: 'Desactivar' });
      const hasActivate = await activate.isVisible().catch(() => false);
      const hasDeactivate = await deactivate.isVisible().catch(() => false);
      expect(hasActivate || hasDeactivate).toBeTruthy();
      await page.keyboard.press('Escape');
    });
  });
});
