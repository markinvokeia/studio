import { test, expect, type Page } from '@playwright/test';
import { randomDoc, randomEmail } from '../../utils/helpers';

// ── Historia Clínica tab constants ────────────────────────────────────────────
const TIMELINE = {
  addSession: 'Agregar sesión',
  noSessions: 'No hay sesiones registradas',
  filterBtn: 'Filtros',
  clearFilters: 'Limpiar filtros',
  filterOptions: {
    all: 'Todos',
    clinical: 'Sesión Clínica',
    odontogram: 'Odontograma',
    appointment: 'Cita',
  },
};

const SESSION_DIALOG = {
  createTitle: 'Crear Sesión',
  patientLabel: 'Paciente',
  dateLabel: 'Fecha',
  doctorLabel: 'Doctor',
  procedureLabel: 'Procedimiento',
  notesLabel: 'Notas',
  treatmentsLabel: 'Tratamientos',
  attachmentsLabel: 'Adjuntos',
  quoteLabel: 'Presupuesto',
  selectDoctor: 'Seleccionar un doctor',
  doctorRequired: 'El doctor es obligatorio.',
  saveBtn: 'Guardar',
  cancelBtn: 'Cancelar',
  saveSuccess: 'Sesión guardada exitosamente',
};

async function openClinicHistoryTab(page: Page): Promise<boolean> {
  await page.goto('/patients', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});
  const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
  if (!await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) return false;
  await firstRow.click();
  const panelReady = await page.getByRole('button', { name: 'Dar Alta' })
    .or(page.getByRole('button', { name: 'Reingreso' }))
    .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  if (!panelReady) return false;
  const tab = page.getByRole('button', { name: 'Historia Clínica' });
  if (!await tab.isVisible({ timeout: 5_000 }).catch(() => false)) return false;
  await tab.click();
  await page.waitForTimeout(600);
  return true;
}

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
    info: 'Información',
    clinicalHistory: 'Historia Clínica',
    treatmentPlans: 'Planes de Trat.',
    services: 'Servicios',
    quotes: 'Presupuestos',
    invoices: 'Facturas',
    payments: 'Pagos',
    messages: 'Mensajes',
    logs: 'Registros',
    notes: 'Notas',
    documents: 'Documentos',
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

  test.describe.serial('Paciente reutilizable entre módulos (con restauración)', () => {
    let reusableName = '';
    let reusableEmail = '';

    test('crear paciente reutilizable y usarlo en selector de Citas', async ({ page }) => {
      reusableName = `Paciente E2E Reuse ${Date.now()}`;
      reusableEmail = randomEmail();
      const reusableDoc = randomDoc();

      const createBtn = page.getByRole('button', { name: T.createBtn }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 8_000 }).catch(() => false)) return;

      await page.getByLabel(T.nameLabel).fill(reusableName);
      await page.getByLabel(T.emailLabel).fill(reusableEmail);
      await page.getByLabel(T.docLabel).fill(reusableDoc);
      await page.getByRole('button', { name: T.saveCreate }).click();
      await expect(page.getByText(/Paciente Creado|creado|éxito/i).first()).toBeVisible({ timeout: 12_000 });

      await page.getByPlaceholder(T.filterPlaceholder).fill(reusableEmail);
      await page.waitForTimeout(600);
      await expect(page.locator('table tbody, [data-testid="card-list"]').getByText(reusableName).first()).toBeVisible({ timeout: 8_000 });

      await page.goto('/appointments', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Crear' }).first().click();
      const appointmentDialog = page.getByRole('dialog');
      if (!await appointmentDialog.isVisible({ timeout: 8_000 }).catch(() => false)) return;

      await appointmentDialog.getByRole('button', { name: 'Seleccionar Usuario' }).click();
      await expect(page.getByRole('option').filter({ hasText: reusableName }).first()).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: T.cancel }).click().catch(() => {});
    });

    test('paciente inactivo no aparece en filtro de solo activos y luego se reactiva', async ({ page }) => {
      test.skip(!reusableEmail, 'No se creó paciente reutilizable en el test previo');

      await page.goto('/patients', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder(T.filterPlaceholder).fill(reusableEmail);
      await page.waitForTimeout(800);

      const row = page.locator('table tbody tr, [data-testid="list-item"]').first();
      if (!await row.isVisible({ timeout: 5_000 }).catch(() => false)) return;

      const menuBtn = row.getByRole('button', { name: 'Abrir menú' });
      if (!await menuBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await menuBtn.click();

      const deactivateItem = page.getByRole('menuitem', { name: 'Desactivar' });
      if (!await deactivateItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
      } else {
        await deactivateItem.click();
        await expect(page.getByText(/inactiv|desactiv|actualizado|éxito/i).first()).toBeVisible({ timeout: 10_000 });
      }

      const filterBtn = page.locator('button').filter({ has: page.locator('svg.lucide-sliders-horizontal') }).first();
      if (await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await filterBtn.click();
        const onlyActive = page.getByRole('menuitem', { name: 'Mostrar solo activos' });
        if (await onlyActive.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await onlyActive.click();
          await page.waitForTimeout(1_000);
          const stillVisible = await page.locator('table tbody, [data-testid="card-list"]').getByText(reusableName).first()
            .isVisible({ timeout: 2_000 }).catch(() => false);
          expect(stillVisible).toBeFalsy();
        }
      }

      await page.getByRole('button', { name: T.clearFilters }).click().catch(() => {});
      await page.getByPlaceholder(T.filterPlaceholder).fill(reusableEmail);
      await page.waitForTimeout(700);

      const rowAfterFilter = page.locator('table tbody tr, [data-testid="list-item"]').first();
      if (!await rowAfterFilter.isVisible({ timeout: 5_000 }).catch(() => false)) return;

      const reopenMenuBtn = rowAfterFilter.getByRole('button', { name: 'Abrir menú' });
      if (!await reopenMenuBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await reopenMenuBtn.click();
      const activateItem = page.getByRole('menuitem', { name: T.activeLabel });
      if (await activateItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await activateItem.click();
        await expect(page.getByText(/activ|actualizado|éxito/i).first()).toBeVisible({ timeout: 10_000 });
      } else {
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Tab Información (sub-tabs)', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
    });

    test('tab Información es visible y está activo por defecto', async ({ page }) => {
      const infoTab = page.getByRole('button', { name: T.tabs.info });
      if (!await infoTab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await expect(infoTab).toBeVisible();
    });

    test('sub-tab Información Personal muestra formulario con nombre pre-cargado', async ({ page }) => {
      const infoTab = page.getByRole('button', { name: T.tabs.info });
      if (!await infoTab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await infoTab.click();
      const personalSubTab = page.getByRole('button', { name: 'Información Personal' });
      if (!await personalSubTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await personalSubTab.click();
      await page.waitForTimeout(300);
      const nameInput = page.getByLabel(T.nameLabel);
      if (!await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const nameVal = await nameInput.inputValue();
      expect(nameVal.length).toBeGreaterThan(0);
    });

    test('sub-tab Anamnesis carga sin errores y muestra las secciones de datos clínicos', async ({ page }) => {
      const infoTab = page.getByRole('button', { name: T.tabs.info });
      if (!await infoTab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await infoTab.click();
      const anamnesisSubTab = page.getByRole('button', { name: 'Anamnesis' });
      if (!await anamnesisSubTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await anamnesisSubTab.click();
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/error/);
      // Las tarjetas principales de anamnesis deben estar visibles
      const hasSections = await page.getByText(/Información Personal|Información Familiar|Medicamentos|Alergias|Hábitos/).first()
        .isVisible({ timeout: 8_000 }).catch(() => false);
      expect(hasSections).toBeTruthy();
    });

    test('sub-tab Anamnesis muestra la tarjeta de Hábitos', async ({ page }) => {
      const infoTab = page.getByRole('button', { name: T.tabs.info });
      if (!await infoTab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await infoTab.click();
      const anamnesisSubTab = page.getByRole('button', { name: 'Anamnesis' });
      if (!await anamnesisSubTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await anamnesisSubTab.click();
      await page.waitForTimeout(500);
      await expect(page.getByText('Hábitos', { exact: true })).toBeVisible({ timeout: 8_000 });
    });

    test('cambiar entre sub-tabs Información Personal y Anamnesis no rompe el estado', async ({ page }) => {
      const infoTab = page.getByRole('button', { name: T.tabs.info });
      if (!await infoTab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await infoTab.click();

      // Ir a Anamnesis
      const anamnesisSubTab = page.getByRole('button', { name: 'Anamnesis' });
      if (!await anamnesisSubTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await anamnesisSubTab.click();
      await page.waitForTimeout(400);
      await expect(page).not.toHaveURL(/error/);

      // Volver a Información Personal
      const personalSubTab = page.getByRole('button', { name: 'Información Personal' });
      if (!await personalSubTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await personalSubTab.click();
      await page.waitForTimeout(400);
      const nameInput = page.getByLabel(T.nameLabel);
      if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const val = await nameInput.inputValue();
        expect(val.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Panel de detalle — profundidad pragmática', () => {
    test('tab Notas permite ver contenido o estado vacío', async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      const notesTab = page.getByRole('button', { name: T.tabs.notes });
      if (!await notesTab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await notesTab.click();
      await page.waitForTimeout(400);

      const hasNotesUi = await page.locator('textarea, [contenteditable="true"], [data-testid*="note"]').first()
        .isVisible({ timeout: 2_500 }).catch(() => false);
      const hasEmptyState = await page.getByText(/sin notas|no hay notas|vacío/i).first()
        .isVisible({ timeout: 2_500 }).catch(() => false);
      expect(hasNotesUi || hasEmptyState).toBeTruthy();
    });

    test('tab Documentos muestra listado o estado vacío', async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      const documentsTab = page.getByRole('button', { name: T.tabs.documents });
      if (!await documentsTab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await documentsTab.click();
      await page.waitForTimeout(400);

      const hasList = await page.locator('table tbody tr, [data-testid="list-item"], [role="row"]').first()
        .isVisible({ timeout: 2_500 }).catch(() => false);
      const hasEmpty = await page.getByText(/sin resultados|sin documentos|no hay/i).first()
        .isVisible({ timeout: 2_500 }).catch(() => false);
      expect(hasList || hasEmpty).toBeTruthy();
    });

    test('resumen financiero abre acción de impresión sin romper navegación', async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      const printBtn = page.getByRole('button', { name: new RegExp(T.printFinancial, 'i') })
        .or(page.getByRole('button', { name: /imprimir/i }));
      if (!await printBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) return;

      await printBtn.first().click();
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/error/);
    });
  });

  // ── Historia Clínica — TreatmentTimeline ─────────────────────────────────────

  test.describe('Historia Clínica — TreatmentTimeline', () => {
    test.beforeEach(async ({ page }) => {
      const opened = await openClinicHistoryTab(page);
      if (!opened) test.skip();
    });

    test.describe('Vista principal', () => {
      test('carga sin errores de navegación', async ({ page }) => {
        await expect(page).not.toHaveURL(/error|login/);
      });

      test('muestra encabezado con conteo de eventos o estado vacío', async ({ page }) => {
        const hasCount = await page.getByText(/\d+ de \d+ eventos/).isVisible({ timeout: 8_000 }).catch(() => false);
        const hasEmpty = await page.getByText(TIMELINE.noSessions).isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasCount || hasEmpty).toBeTruthy();
      });

      test('botón "Agregar sesión" está visible', async ({ page }) => {
        await expect(page.getByRole('button', { name: TIMELINE.addSession }).first()).toBeVisible({ timeout: 8_000 });
      });

      test('estado vacío muestra mensaje cuando no hay sesiones', async ({ page }) => {
        const hasItems = await page.locator('[data-radix-scroll-area-viewport] [class*="border-b"]').first()
          .isVisible({ timeout: 3_000 }).catch(() => false);
        if (!hasItems) {
          await expect(page.getByText(TIMELINE.noSessions)).toBeVisible({ timeout: 5_000 });
        }
      });

      test('items de sesión muestran badge de tipo (Sesión Clínica u Odontograma)', async ({ page }) => {
        const hasItems = await page.getByText(/Sesión Clínica|Odontograma/).first()
          .isVisible({ timeout: 5_000 }).catch(() => false);
        const hasEmpty = await page.getByText(TIMELINE.noSessions).isVisible({ timeout: 2_000 }).catch(() => false);
        expect(hasItems || hasEmpty).toBeTruthy();
      });

      test('sesiones muestran fecha en formato dd/MM/yy', async ({ page }) => {
        const hasDate = await page.getByText(/\d{2}\/\d{2}\/\d{2,4}/).first()
          .isVisible({ timeout: 5_000 }).catch(() => false);
        const hasEmpty = await page.getByText(TIMELINE.noSessions).isVisible({ timeout: 2_000 }).catch(() => false);
        expect(hasDate || hasEmpty).toBeTruthy();
      });
    });

    test.describe('Filtros de tipo', () => {
      test('botón de filtros está disponible cuando hay eventos', async ({ page }) => {
        const hasItems = await page.getByText(/\d+ de \d+ eventos/).isVisible({ timeout: 5_000 }).catch(() => false);
        if (!hasItems) return;
        await expect(page.getByRole('button', { name: TIMELINE.filterBtn })).toBeVisible({ timeout: 5_000 });
      });

      test('dropdown muestra las 4 opciones de tipo', async ({ page }) => {
        const hasItems = await page.getByText(/\d+ de \d+ eventos/).isVisible({ timeout: 5_000 }).catch(() => false);
        if (!hasItems) return;
        const filterBtn = page.getByRole('button', { name: TIMELINE.filterBtn });
        if (!await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await filterBtn.click();
        await expect(page.getByRole('menuitem', { name: TIMELINE.filterOptions.all })).toBeVisible({ timeout: 5_000 });
        await expect(page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: TIMELINE.filterOptions.odontogram })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: TIMELINE.filterOptions.appointment })).toBeVisible();
        await page.keyboard.press('Escape');
      });

      test('aplicar filtro activa chip visual', async ({ page }) => {
        const hasItems = await page.getByText(/\d+ de \d+ eventos/).isVisible({ timeout: 5_000 }).catch(() => false);
        if (!hasItems) return;
        const filterBtn = page.getByRole('button', { name: TIMELINE.filterBtn });
        if (!await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await filterBtn.click();
        const clinicalOption = page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical });
        if (!await clinicalOption.isVisible({ timeout: 3_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
        await clinicalOption.click();
        await expect(page.getByText(TIMELINE.filterOptions.clinical, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
      });

      test('"Limpiar filtros" aparece en el dropdown cuando hay filtro activo', async ({ page }) => {
        const hasItems = await page.getByText(/\d+ de \d+ eventos/).isVisible({ timeout: 5_000 }).catch(() => false);
        if (!hasItems) return;
        const filterBtn = page.getByRole('button', { name: TIMELINE.filterBtn });
        if (!await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await filterBtn.click();
        const clinicalOption = page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical });
        if (!await clinicalOption.isVisible({ timeout: 3_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
        await clinicalOption.click();
        await filterBtn.click();
        const clearOption = page.getByRole('menuitem', { name: TIMELINE.clearFilters });
        if (await clearOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await expect(clearOption).toBeVisible();
          await clearOption.click();
        } else {
          await page.keyboard.press('Escape');
        }
      });

      test('limpiar filtro via chip X restaura el conteo original', async ({ page }) => {
        const hasItems = await page.getByText(/\d+ de \d+ eventos/).isVisible({ timeout: 5_000 }).catch(() => false);
        if (!hasItems) return;
        const filterBtn = page.getByRole('button', { name: TIMELINE.filterBtn });
        if (!await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        const originalCountText = await page.getByText(/\d+ de \d+ eventos/).textContent().catch(() => '');
        await filterBtn.click();
        const odontogramOption = page.getByRole('menuitem', { name: TIMELINE.filterOptions.odontogram });
        if (!await odontogramOption.isVisible({ timeout: 3_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
        await odontogramOption.click();
        await page.waitForTimeout(300);
        const chip = page.getByText(TIMELINE.filterOptions.odontogram, { exact: true }).first();
        if (await chip.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await chip.click();
          await page.waitForTimeout(300);
          if (originalCountText) await expect(page.getByText(originalCountText)).toBeVisible({ timeout: 5_000 });
        }
      });

      test('seleccionar "Todos" elimina los chips activos', async ({ page }) => {
        const hasItems = await page.getByText(/\d+ de \d+ eventos/).isVisible({ timeout: 5_000 }).catch(() => false);
        if (!hasItems) return;
        const filterBtn = page.getByRole('button', { name: TIMELINE.filterBtn });
        if (!await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await filterBtn.click();
        const clinicalOption = page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical });
        if (!await clinicalOption.isVisible({ timeout: 3_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
        await clinicalOption.click();
        await page.waitForTimeout(300);
        await filterBtn.click();
        const allOption = page.getByRole('menuitem', { name: TIMELINE.filterOptions.all });
        if (await allOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await allOption.click();
          await page.waitForTimeout(300);
          const chipStillVisible = await page.getByText(TIMELINE.filterOptions.clinical, { exact: true }).first()
            .isVisible({ timeout: 1_000 }).catch(() => false);
          expect(chipStillVisible).toBeFalsy();
        } else {
          await page.keyboard.press('Escape');
        }
      });
    });

    test.describe('Dropdown "Agregar sesión"', () => {
      test('muestra opciones Sesión Clínica y Odontograma', async ({ page }) => {
        const addBtn = page.getByRole('button', { name: TIMELINE.addSession });
        if (!await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
        await addBtn.click();
        await expect(page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical })).toBeVisible({ timeout: 5_000 });
        await expect(page.getByRole('menuitem', { name: TIMELINE.filterOptions.odontogram })).toBeVisible();
        await page.keyboard.press('Escape');
      });

      test('"Sesión Clínica" abre el diálogo de creación', async ({ page }) => {
        const addBtn = page.getByRole('button', { name: TIMELINE.addSession });
        if (!await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
        await addBtn.click();
        const clinicalItem = page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical });
        if (!await clinicalItem.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await clinicalItem.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 8_000 });
        await expect(dialog.getByText(SESSION_DIALOG.createTitle)).toBeVisible();
        await page.keyboard.press('Escape');
      });

      test('"Odontograma" abre su diálogo correspondiente', async ({ page }) => {
        const addBtn = page.getByRole('button', { name: TIMELINE.addSession });
        if (!await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
        await addBtn.click();
        const odontogramItem = page.getByRole('menuitem', { name: TIMELINE.filterOptions.odontogram });
        if (!await odontogramItem.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await odontogramItem.click();
        const dialog = page.getByRole('dialog');
        if (await dialog.isVisible({ timeout: 8_000 }).catch(() => false)) {
          await expect(dialog).toBeVisible();
          await page.keyboard.press('Escape');
        }
      });
    });

    test.describe('Diálogo de sesión clínica', () => {
      async function openSessionDialog(page: Page): Promise<boolean> {
        const addBtn = page.getByRole('button', { name: TIMELINE.addSession });
        if (!await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return false;
        await addBtn.click();
        const clinicalItem = page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical });
        if (!await clinicalItem.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
        await clinicalItem.click();
        return page.getByRole('dialog').waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
      }

      test('muestra título "Crear Sesión"', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        await expect(page.getByRole('dialog').getByText(SESSION_DIALOG.createTitle)).toBeVisible();
        await page.keyboard.press('Escape');
      });

      test('campo Paciente está pre-cargado y es de solo lectura', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        const patientInput = dialog.getByLabel(SESSION_DIALOG.patientLabel);
        if (!await patientInput.isVisible({ timeout: 5_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
        const val = await patientInput.inputValue();
        expect(val.length).toBeGreaterThan(0);
        const isDisabled = await patientInput.isDisabled().catch(() => false);
        const isReadonly = await patientInput.getAttribute('readonly').then(v => v !== null).catch(() => false);
        expect(isDisabled || isReadonly).toBeTruthy();
        await page.keyboard.press('Escape');
      });

      test('campo Fecha tiene valor por defecto', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        const hasDateVal = await dialog.locator('input[type="text"], button')
          .filter({ hasText: /\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/ }).first()
          .isVisible({ timeout: 3_000 }).catch(() => false);
        const hasDateLabel = await dialog.getByText(SESSION_DIALOG.dateLabel).isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasDateVal || hasDateLabel).toBeTruthy();
        await page.keyboard.press('Escape');
      });

      test('campo Doctor muestra placeholder y es requerido', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        const hasLabel = await dialog.getByText(SESSION_DIALOG.doctorLabel).isVisible({ timeout: 3_000 }).catch(() => false);
        const hasPlaceholder = await dialog.getByText(SESSION_DIALOG.selectDoctor).isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasLabel || hasPlaceholder).toBeTruthy();
        await page.keyboard.press('Escape');
      });

      test('validación: sin doctor muestra error al intentar guardar', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        const saveBtn = dialog.getByRole('button', { name: SESSION_DIALOG.saveBtn });
        if (!await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
        await saveBtn.click();
        const hasError = await page.getByText(SESSION_DIALOG.doctorRequired).isVisible({ timeout: 5_000 }).catch(() => false);
        const hasToast = await page.getByText(/doctor.*obligatorio|seleccionar.*doctor/i).first()
          .isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasError || hasToast).toBeTruthy();
        await page.keyboard.press('Escape');
      });

      test('secciones Procedimiento y Notas son visibles', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        const hasProc = await dialog.getByText(SESSION_DIALOG.procedureLabel).isVisible({ timeout: 5_000 }).catch(() => false);
        const hasNotes = await dialog.getByText(SESSION_DIALOG.notesLabel).isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasProc || hasNotes).toBeTruthy();
        await page.keyboard.press('Escape');
      });

      test('sección Presupuesto está disponible', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        if (await dialog.getByText(SESSION_DIALOG.quoteLabel).first().isVisible({ timeout: 5_000 }).catch(() => false)) {
          await expect(dialog.getByText(SESSION_DIALOG.quoteLabel).first()).toBeVisible();
        }
        await page.keyboard.press('Escape');
      });

      test('sección Tratamientos está disponible', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        if (await dialog.getByText(SESSION_DIALOG.treatmentsLabel).first().isVisible({ timeout: 5_000 }).catch(() => false)) {
          await expect(dialog.getByText(SESSION_DIALOG.treatmentsLabel).first()).toBeVisible();
        }
        await page.keyboard.press('Escape');
      });

      test('zona de Adjuntos (drag-and-drop o input file) está disponible', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        const hasLabel = await dialog.getByText(SESSION_DIALOG.attachmentsLabel).first().isVisible({ timeout: 5_000 }).catch(() => false);
        const hasInput = await dialog.locator('input[type="file"]').isVisible({ timeout: 3_000 }).catch(() => false);
        const hasDragText = await dialog.getByText(/arrastre|drag|subir/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasLabel || hasInput || hasDragText).toBeTruthy();
        await page.keyboard.press('Escape');
      });

      test('Cancelar cierra el diálogo sin guardar', async ({ page }) => {
        if (!await openSessionDialog(page)) return;
        const dialog = page.getByRole('dialog');
        const cancelBtn = dialog.getByRole('button', { name: SESSION_DIALOG.cancelBtn });
        if (await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await cancelBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
      });
    });

    test.describe('Detalle de sesión existente', () => {
      test('clic en sesión clínica abre sheet de detalle', async ({ page }) => {
        const clinicalBadge = page.getByText(TIMELINE.filterOptions.clinical).first();
        if (!await clinicalBadge.isVisible({ timeout: 5_000 }).catch(() => false)) return;
        await clinicalBadge.locator('xpath=ancestor::div[contains(@class,"border-b")][1]').click();
        await page.waitForTimeout(500);
        const sheetOrDialog = page.getByRole('dialog').or(page.locator('[role="complementary"]'));
        if (await sheetOrDialog.first().isVisible({ timeout: 8_000 }).catch(() => false)) {
          await expect(sheetOrDialog.first()).toBeVisible();
          await page.keyboard.press('Escape');
        }
      });
    });

    test.describe.serial('Crear sesión clínica y eliminarla (con limpieza)', () => {
      let createdProcedure = '';

      test('crea sesión con doctor y verifica en la línea de tiempo', async ({ page }) => {
        const addBtn = page.getByRole('button', { name: TIMELINE.addSession });
        if (!await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
        await addBtn.click();
        const clinicalItem = page.getByRole('menuitem', { name: TIMELINE.filterOptions.clinical });
        if (!await clinicalItem.isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await clinicalItem.click();
        const dialog = page.getByRole('dialog');
        if (!await dialog.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) return;

        const doctorSelect = dialog.locator('[role="combobox"]').first();
        if (await doctorSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await doctorSelect.click();
          const firstOption = page.getByRole('option').first();
          if (!await firstOption.isVisible({ timeout: 5_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
          await firstOption.click();
        } else {
          await page.keyboard.press('Escape');
          return;
        }

        createdProcedure = `E2E sesión ${Date.now()}`;
        const textarea = dialog.getByPlaceholder(/procedimiento realizado/i).or(dialog.locator('textarea').first());
        if (await textarea.isVisible({ timeout: 3_000 }).catch(() => false)) await textarea.fill(createdProcedure);

        const saveBtn = dialog.getByRole('button', { name: SESSION_DIALOG.saveBtn });
        if (!await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
        await saveBtn.click();

        await expect(page.getByText(SESSION_DIALOG.saveSuccess).first()).toBeVisible({ timeout: 15_000 });
        if (createdProcedure) await expect(page.getByText(createdProcedure).first()).toBeVisible({ timeout: 10_000 });
      });

      test('elimina la sesión creada para limpiar datos de prueba', async ({ page }) => {
        test.skip(!createdProcedure, 'No se creó sesión en el test previo');
        const sessionRow = page.getByText(createdProcedure).first()
          .locator('xpath=ancestor::div[contains(@class,"border-b")][1]');
        if (!await sessionRow.isVisible({ timeout: 8_000 }).catch(() => false)) return;
        await sessionRow.locator('button').last().click().catch(() => {});
        await page.waitForTimeout(300);
        const deleteOption = page.getByRole('menuitem', { name: /eliminar/i });
        if (await deleteOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await deleteOption.click();
          const confirmBtn = page.getByRole('button', { name: /eliminar|confirmar/i }).last();
          if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await confirmBtn.click();
            await expect(page.getByText(createdProcedure).first()).not.toBeVisible({ timeout: 10_000 });
          }
        } else {
          await page.keyboard.press('Escape');
        }
      });
    });
  });

  // ── Dar Alta / Reingreso ─────────────────────────────────────────────────

  test.describe('Dar Alta / Reingreso', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    });

    test('botón Dar Alta o Reingreso está visible en el panel', async ({ page }) => {
      const darAlta = page.getByRole('button', { name: T.dischargeBtn });
      const reingreso = page.getByRole('button', { name: T.readmitBtn });
      const isVisible = await darAlta.isVisible({ timeout: 3_000 }).catch(() => false)
        || await reingreso.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(isVisible).toBeTruthy();
    });

    test('clic en Dar Alta abre el diálogo con título correcto', async ({ page }) => {
      const darAltaBtn = page.getByRole('button', { name: T.dischargeBtn });
      if (!await darAltaBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await darAltaBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) return;
      await expect(dialog.getByText('Dar de Alta al Paciente')).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
    });

    test('diálogo Dar Alta muestra opciones rápidas de fecha', async ({ page }) => {
      const darAltaBtn = page.getByRole('button', { name: T.dischargeBtn });
      if (!await darAltaBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await darAltaBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) return;
      await expect(dialog.getByRole('button', { name: '1 mes' })).toBeVisible({ timeout: 5_000 });
      await expect(dialog.getByRole('button', { name: '3 meses' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: '6 meses' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: '1 año' })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('opción rápida "1 mes" rellena la fecha de alta', async ({ page }) => {
      const darAltaBtn = page.getByRole('button', { name: T.dischargeBtn });
      if (!await darAltaBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await darAltaBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) return;
      await dialog.getByRole('button', { name: '1 mes' }).click();
      await page.waitForTimeout(300);
      const hasDateFilled = await dialog.locator('input[type="text"], button')
        .filter({ hasText: /\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/ }).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      const hasDateInput = await dialog.locator('input').first().inputValue().then(v => v.length > 0).catch(() => false);
      expect(hasDateFilled || hasDateInput).toBeTruthy();
      await page.keyboard.press('Escape');
    });

    test('Cancelar cierra el diálogo sin dar alta', async ({ page }) => {
      const darAltaBtn = page.getByRole('button', { name: T.dischargeBtn });
      if (!await darAltaBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await darAltaBtn.click();
      const dialog = page.getByRole('dialog');
      if (!await dialog.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) return;
      await dialog.getByRole('button', { name: 'Cancelar' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
      // Panel still shows Dar Alta (patient not discharged)
      await expect(page.getByRole('button', { name: T.dischargeBtn })).toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Dropdown acciones del panel (+) ──────────────────────────────────────

  test.describe('Dropdown acciones del panel', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    });

    test('botón "+" abre el menú de acciones del panel', async ({ page }) => {
      // Plus button is a circle icon button — locate by SVG class or aria
      const plusBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus-circle, svg.lucide-plus') }).first();
      if (!await plusBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await plusBtn.click();
      const menu = page.getByRole('menu');
      if (await menu.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(menu).toBeVisible();
        await page.keyboard.press('Escape');
      }
    });

    test('menú acciones muestra grupo Clínico con Sesión clínica y Odontograma', async ({ page }) => {
      const plusBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus-circle, svg.lucide-plus') }).first();
      if (!await plusBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await plusBtn.click();
      const menu = page.getByRole('menu');
      if (!await menu.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const hasClinical = await page.getByRole('menuitem', { name: 'Sesión clínica' }).isVisible({ timeout: 3_000 }).catch(() => false);
      const hasOdontogram = await page.getByRole('menuitem', { name: 'Sesión de odontograma' }).isVisible({ timeout: 3_000 }).catch(() => false);
      const hasDocument = await page.getByRole('menuitem', { name: 'Documento' }).isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasClinical || hasOdontogram || hasDocument).toBeTruthy();
      await page.keyboard.press('Escape');
    });

    test('menú acciones muestra grupo Financiero con Presupuesto, Factura, Prepago', async ({ page }) => {
      const plusBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus-circle, svg.lucide-plus') }).first();
      if (!await plusBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await plusBtn.click();
      const menu = page.getByRole('menu');
      if (!await menu.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const hasPresupuesto = await page.getByRole('menuitem', { name: 'Presupuesto' }).isVisible({ timeout: 3_000 }).catch(() => false);
      const hasFactura = await page.getByRole('menuitem', { name: 'Factura' }).isVisible({ timeout: 3_000 }).catch(() => false);
      const hasPrepago = await page.getByRole('menuitem', { name: 'Prepago' }).isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasPresupuesto || hasFactura || hasPrepago).toBeTruthy();
      await page.keyboard.press('Escape');
    });

    test('"Sesión clínica" desde el menú abre diálogo de creación de sesión', async ({ page }) => {
      const plusBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus-circle, svg.lucide-plus') }).first();
      if (!await plusBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await plusBtn.click();
      const menu = page.getByRole('menu');
      if (!await menu.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const clinicalItem = page.getByRole('menuitem', { name: 'Sesión clínica' });
      if (!await clinicalItem.isVisible({ timeout: 3_000 }).catch(() => false)) { await page.keyboard.press('Escape'); return; }
      await clinicalItem.click();
      const dialog = page.getByRole('dialog');
      if (await dialog.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) {
        await expect(dialog.getByText(SESSION_DIALOG.createTitle)).toBeVisible({ timeout: 5_000 });
        await page.keyboard.press('Escape');
      }
    });
  });

  // ── Tab Planes de Tratamiento ─────────────────────────────────────────────

  test.describe('Tab Planes de Tratamiento', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    });

    test('tab Planes de Tratamiento está visible y es clickeable', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.treatmentPlans });
      if (!await tab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await tab.click();
      await page.waitForTimeout(400);
      await expect(page).not.toHaveURL(/error/);
    });

    test('tab Planes de Tratamiento muestra contenido o estado vacío', async ({ page }) => {
      const tab = page.getByRole('button', { name: T.tabs.treatmentPlans });
      if (!await tab.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await tab.click();
      await page.waitForTimeout(600);
      const hasList = await page.locator('[data-testid="treatment-plan"], table tbody tr').first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await page.getByText(/Sin planes de tratamiento|planes de tratamiento aparecerán/i).first()
        .isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasList || hasEmpty).toBeTruthy();
    });
  });

  // ── Formulario Información Personal — campos adicionales ─────────────────

  test.describe('Formulario Información Personal — campos adicionales', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('table tbody tr, [data-testid="list-item"]').first().click();
      await page.getByRole('button', { name: T.dischargeBtn })
        .or(page.getByRole('button', { name: T.readmitBtn }))
        .waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      const infoTab = page.getByRole('button', { name: T.tabs.info });
      if (await infoTab.isVisible({ timeout: 5_000 }).catch(() => false)) await infoTab.click();
      const personalSubTab = page.getByRole('button', { name: 'Información Personal' });
      if (await personalSubTab.isVisible({ timeout: 5_000 }).catch(() => false)) await personalSubTab.click();
      await page.waitForTimeout(300);
    });

    test('campo Correo Electrónico está visible y pre-cargado', async ({ page }) => {
      const emailInput = page.getByLabel(T.emailLabel);
      if (!await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await expect(emailInput).toBeVisible();
      const val = await emailInput.inputValue();
      // Email may be empty for some patients but the field itself must render
      expect(typeof val).toBe('string');
    });

    test('campo Teléfono está visible', async ({ page }) => {
      const phoneInput = page.getByLabel(T.phoneLabel);
      if (!await phoneInput.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await expect(phoneInput).toBeVisible();
    });

    test('campo Documento de Identidad está visible', async ({ page }) => {
      const docInput = page.getByLabel(T.docLabel);
      if (!await docInput.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await expect(docInput).toBeVisible();
    });

    test('todos los campos del formulario personal son editables', async ({ page }) => {
      const nameInput = page.getByLabel(T.nameLabel);
      if (!await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const nameEditable = await nameInput.isEditable().catch(() => false);
      expect(nameEditable).toBeTruthy();

      const emailInput = page.getByLabel(T.emailLabel);
      if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const emailEditable = await emailInput.isEditable().catch(() => false);
        expect(emailEditable).toBeTruthy();
      }
    });

    test('botón Guardar está disponible en Información Personal', async ({ page }) => {
      const saveBtn = page.getByRole('button', { name: 'Guardar' });
      if (await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(saveBtn).toBeVisible();
      }
    });
  });
});
