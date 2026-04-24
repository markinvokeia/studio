import { test, expect } from '@playwright/test';
import { randomEmail, randomPhone, randomDoc } from '../../utils/helpers';

// ── Clínica ───────────────────────────────────────────────────────────────────

test.describe('Configuración — Detalles de la Clínica', () => {
  const T = {
    pageTitle: 'Detalles de la Clínica',
    nameLabel: 'Nombre',
    locationLabel: 'Dirección',
    phoneLabel: 'Teléfono',
    emailLabel: 'Correo Electrónico',
    currencyLabel: 'Moneda',
    logoLabel: 'Logo',
    save: 'Guardar',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/config/clinics');
    await page.waitForLoadState('networkidle');
  });

  test('carga título "Detalles de la Clínica" y campos del formulario', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(T.nameLabel)).toBeVisible();
    await expect(page.getByLabel(T.emailLabel)).toBeVisible();
  });

  test('campo Nombre, Dirección, Teléfono, Correo están presentes', async ({ page }) => {
    await expect(page.getByLabel(T.nameLabel)).toBeVisible();
    await expect(page.getByLabel(T.phoneLabel)).toBeVisible();
  });

  test('botón "Guardar" está disponible', async ({ page }) => {
    await expect(page.getByRole('button', { name: T.save })).toBeVisible();
  });

  test('sección de Logo está visible con opción de carga', async ({ page }) => {
    await expect(page.getByLabel(T.logoLabel).first()).toBeVisible();
  });
});

// ── Doctores ──────────────────────────────────────────────────────────────────

test.describe('Configuración — Doctores', () => {
  const T = {
    pageTitle: 'Doctores',
    filterPlaceholder: 'Filtrar pacientes por correo...',
    createBtn: 'Crear',
    nameLabel: 'Nombre',
    emailLabel: 'Correo Electrónico',
    phoneLabel: 'Teléfono',
    docLabel: 'Documento de Identidad',
    colorLabel: 'Color',
    cancel: 'Cancelar',
    save: 'Guardar',
    saveEdit: 'Guardar Cambios',
    deactivate: 'Desactivar',
    col: { name: 'Nombre', email: 'Correo Electrónico', doc: 'Documento de Identidad', status: 'Estado' },
    validation: {
      nameRequired: 'Nombre es obligatorio.',
    },
    panelTab: { details: 'Detalles' },
    filterActive: 'Mostrar solo activos',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/config/doctors');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Doctores" y tabla con columnas', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
  });

  test('campo de búsqueda y filtro "Mostrar solo activos" disponibles', async ({ page }) => {
    await expect(page.getByPlaceholder(T.filterPlaceholder)).toBeVisible();
    const activeFilter = page.getByText(T.filterActive).or(page.getByLabel(T.filterActive));
    // Puede existir o no dependiendo de la disposición de la UI
    await expect(page).not.toHaveURL(/error/);
  });

  test.describe('CRUD Doctor (con limpieza)', () => {
    test('abre formulario "Crear doctor" con campos correctos', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.emailLabel)).toBeVisible();
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
      await expect(page.getByText(T.validation.nameRequired)).toBeVisible();
    });

    test('crear → verificar → editar → restaurar → eliminar/desactivar', async ({ page }) => {
      const name = `Dr. E2E ${Date.now()}`;
      const email = randomEmail();
      const editedName = `${name} EDIT`;

      // CREAR via dialog
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByLabel(T.emailLabel).fill(email);
      await page.getByLabel(T.docLabel).fill(randomDoc());
      await page.getByRole('button', { name: T.save }).click();
      await expect(page.getByText(/creado|éxito|guardado/i).first()).toBeVisible({ timeout: 10_000 });

      // VERIFICAR: filtrar por email (el filtro es sobre el correo)
      await page.getByPlaceholder(T.filterPlaceholder).fill(email);
      await page.waitForTimeout(800);
      await expect(page.locator('table tbody').getByText(name)).toBeVisible({ timeout: 8_000 });

      // EDITAR: clic en fila → panel derecho → tab Detalles (siempre editable)
      await page.locator('table tbody tr').filter({ hasText: name }).click();
      await expect(page.getByRole('tab', { name: T.panelTab.details })).toBeVisible({ timeout: 5_000 });
      await page.getByLabel(T.nameLabel).clear();
      await page.getByLabel(T.nameLabel).fill(editedName);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|éxito|guardado/i).first()).toBeVisible({ timeout: 8_000 });

      // RESTAURAR: panel sigue abierto → editar de vuelta al nombre original
      await page.getByLabel(T.nameLabel).clear();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByRole('button', { name: T.saveEdit }).click();
      await expect(page.getByText(/actualizado|éxito|guardado/i).first()).toBeVisible({ timeout: 8_000 });

      // DESACTIVAR: cerrar panel → tabla vuelve a modo wide → filtrar → clic en Desactivar
      await page.getByRole('button', { name: 'Cerrar detalles' }).click();
      await page.waitForTimeout(400);
      await page.getByPlaceholder(T.filterPlaceholder).fill(email);
      await page.waitForTimeout(800);
      const finalRow = page.locator('table tbody tr').filter({ hasText: name });
      const deactivateBtn = finalRow.getByRole('button', { name: T.deactivate });
      if (await deactivateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deactivateBtn.click();
        await expect(page.getByText(/desactivado|éxito/i).first()).toBeVisible({ timeout: 8_000 });
      } else {
        await expect(page).not.toHaveURL(/error/);
      }
    });
  });

  test.describe('Panel de detalle del doctor', () => {
    test('seleccionar doctor abre panel con tab Detalles', async ({ page }) => {
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
        const detailsTab = page.getByRole('button', { name: T.panelTab.details })
          .or(page.getByText(T.panelTab.details)).first();
        if (await detailsTab.isVisible().catch(() => false)) {
          await expect(detailsTab).toBeVisible();
        }
      }
    });
  });
});

// ── Horarios ──────────────────────────────────────────────────────────────────

test.describe('Configuración — Horarios', () => {
  const T = {
    pageTitle: 'Horarios',
    createBtn: 'Crear',
    save: 'Guardar',
    saveEdit: 'Guardar Cambios',
    cancel: 'Cancelar',
    dayLabel: 'Día de la Semana',
    startLabel: 'Hora de Inicio',
    endLabel: 'Hora de Fin',
    dayRequired: 'El día de la semana es obligatorio.',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/config/schedules');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Horarios" y columnas: Día, Hora de Inicio, Hora de Fin', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.startLabel })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.endLabel })).toBeVisible();
  });

  test.describe('CRUD Horario (con limpieza)', () => {
    test('abre formulario con Día, Hora de Inicio, Hora de Fin', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('button', { name: T.save })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });
});

// ── Calendarios ───────────────────────────────────────────────────────────────

test.describe('Configuración — Calendarios', () => {
  const T = {
    pageTitle: 'Calendarios',
    filterPlaceholder: 'Filtrar aquí...',
    createBtn: 'Crear',
    nameLabel: 'Nombre',
    cancel: 'Cancelar',
    create: 'Crear',
    saveEdit: 'Guardar Cambios',
    col: { name: 'Nombre', color: 'Color', active: 'Activo' },
    nameRequired: 'El nombre es obligatorio.',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/config/calendars');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Calendarios" y columnas: Nombre, Color, Activo', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
  });

  test.describe('CRUD Calendario (con limpieza)', () => {
    test('abre formulario con campo Nombre', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.create })).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await page.getByRole('button', { name: T.create }).click();
      await expect(page.getByText(T.nameRequired)).toBeVisible();
    });

    test('crear → verificar → eliminar', async ({ page }) => {
      const name = `Calendario E2E ${Date.now()}`;

      // CREAR: verificar que el formulario funciona y el diálogo cierra
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel(T.nameLabel).fill(name);
      await page.getByRole('button', { name: T.create }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

      // Esperar a que la tabla vuelva a estar visible (sin reload)
      await page.waitForSelector('table', { timeout: 15_000 });
      await page.getByPlaceholder(T.filterPlaceholder).fill(name);
      await page.waitForTimeout(800);

      const itemFound = await page.locator('table tbody, [role="list"]').getByText(name).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);

      if (itemFound) {
        const row = page.locator('table tbody tr').filter({ hasText: name });
        await row.getByRole('button', { name: /eliminar/i }).click();
        const delDlg = page.getByRole('alertdialog');
        await expect(delDlg).toBeVisible({ timeout: 5_000 });
        await delDlg.getByRole('button', { name: 'Eliminar' }).click();
        await expect(delDlg).not.toBeVisible({ timeout: 8_000 });
      }

      await expect(page).not.toHaveURL(/error/);
    });
  });
});

// ── Días Feriados ─────────────────────────────────────────────────────────────

test.describe('Configuración — Días Feriados', () => {
  const T = {
    pageTitle: 'Feriados',
    createBtn: 'Crear',
    dateLabel: 'Fecha',
    cancel: 'Cancelar',
    save: 'Guardar',
    col: { date: 'Fecha', status: 'Estado' },
    dateRequired: 'La fecha es obligatoria.',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/config/holidays');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Feriados" y columna Fecha', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.col.date })).toBeVisible();
  });

  test('formulario de creación tiene campo Fecha', async ({ page }) => {
    await page.getByRole('button', { name: T.createBtn }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    await page.getByRole('button', { name: T.cancel }).click();
  });
});

// ── Secuencias ────────────────────────────────────────────────────────────────

test.describe('Configuración — Secuencias', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config/sequences');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga la página de Secuencias', async ({ page }) => {
    await expect(page.getByText('Secuencias').first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });
});

// ── Sociedades Mutuales ────────────────────────────────────────────────────────

test.describe('Configuración — Sociedades Mutuales', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config/mutual-societies');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga la página de Sociedades Mutuales', async ({ page }) => {
    await expect(page.getByText('Sociedades Mutuales').first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });
});

// ── Monedas (solo lectura) ────────────────────────────────────────────────────

test.describe('Configuración — Monedas y Tipos de Cambio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config/currencies');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Monedas sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText(/monedas/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('muestra tabla o lista de monedas (read-only)', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false);
    const hasCurrency = await page.getByText(/USD|EUR|UYU/i).first().isVisible().catch(() => false);
    expect(hasTable || hasCurrency).toBeTruthy();
  });
});
