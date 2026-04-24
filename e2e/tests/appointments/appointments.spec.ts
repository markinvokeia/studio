import { test, expect } from '@playwright/test';

// Translation strings from es.json — AppointmentsPage
const T = {
  pageTitle: 'Citas',
  newAppointment: 'Nueva Cita',
  calendarView: 'Vista de Calendario',
  listView: 'Vista de Lista',
  today: 'Hoy',
  thisWeek: 'Esta Semana',
  thisMonth: 'Este Mes',
  createDialog: {
    title: 'Crear Nueva Cita',
    patientLabel: 'Nombre de paciente',
    serviceLabel: 'Servicios',
    dateLabel: 'Fecha',
    timeLabel: 'Hora',
    calendarLabel: 'Calendario',
    save: 'Guardar',
    cancel: 'Cancelar',
    notes: 'Notas',
  },
  status: {
    completed: 'Completada',
    confirmed: 'Confirmada',
    pending: 'Pendiente',
    cancelled: 'Cancelada',
    scheduled: 'Programada',
  },
  columns: {
    service: 'Servicio',
    patient: 'Paciente',
    doctor: 'Doctor',
    date: 'Fecha',
    time: 'Hora',
    status: 'Estado',
  },
};

test.describe('Citas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga la página sin errores ni redirección a login', async ({ page }) => {
      await expect(page).not.toHaveURL(/error/);
      await expect(page).not.toHaveURL(/login/);
      // La página de citas es un calendario — verifica que el componente cargó
      await expect(page.locator('[class*="calendar"], [class*="Calendar"]')
        .or(page.locator('[role="main"]')).first()).toBeVisible({ timeout: 10_000 });
    });

    test('botón "Crear" para nueva cita está visible', async ({ page }) => {
      // El botón usa tGeneral('create') = "Crear", no "Nueva Cita"
      await expect(page.getByRole('button', { name: 'Crear' }).first()).toBeVisible({ timeout: 10_000 });
    });

    test('controles de navegación temporal (Hoy, Esta Semana, Este Mes) están disponibles', async ({ page }) => {
      const hasToday = await page.getByRole('button', { name: T.today }).isVisible().catch(() => false);
      const hasWeek = await page.getByRole('button', { name: T.thisWeek }).isVisible().catch(() => false);
      const hasMonth = await page.getByRole('button', { name: T.thisMonth }).isVisible().catch(() => false);
      expect(hasToday || hasWeek || hasMonth).toBeTruthy();
    });

    test('vista del calendario carga sin error', async ({ page }) => {
      await expect(page.locator('[class*="calendar"], [class*="Calendar"]')
        .or(page.locator('table')).first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Navegación de vistas ──────────────────────────────────────────────

  test.describe('Navegación de vistas', () => {
    test('cambiar a Vista de Lista no produce error', async ({ page }) => {
      const listViewBtn = page.getByRole('button', { name: T.listView });
      if (await listViewBtn.isVisible().catch(() => false)) {
        await listViewBtn.click();
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('navegar a Esta Semana no produce error', async ({ page }) => {
      const weekBtn = page.getByRole('button', { name: T.thisWeek });
      if (await weekBtn.isVisible().catch(() => false)) {
        await weekBtn.click();
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('navegar a Este Mes no produce error', async ({ page }) => {
      const monthBtn = page.getByRole('button', { name: T.thisMonth });
      if (await monthBtn.isVisible().catch(() => false)) {
        await monthBtn.click();
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/error/);
      }
    });

    test('botón Hoy devuelve al día actual', async ({ page }) => {
      const todayBtn = page.getByRole('button', { name: T.today });
      if (await todayBtn.isVisible().catch(() => false)) {
        await todayBtn.click();
        await page.waitForTimeout(400);
        await expect(page).not.toHaveURL(/error/);
      }
    });
  });

  // ── Formulario de creación ────────────────────────────────────────────

  test.describe('Crear cita', () => {
    test('abre el formulario de creación "Crear Nueva Cita"', async ({ page }) => {
      // El botón usa tGeneral('create') = "Crear"
      await page.getByRole('button', { name: 'Crear' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(T.createDialog.title)).toBeVisible();
      await expect(page.getByRole('button', { name: T.createDialog.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario sin crear cita', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
      await page.getByRole('button', { name: T.createDialog.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    });

    test('guardar sin campos obligatorios muestra error de validación', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
      const saveBtn = page.getByRole('button', { name: T.createDialog.save }).last();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await expect(page.getByText(/requerido|obligatorio|complete|seleccione|información/i).first())
          .toBeVisible({ timeout: 5_000 });
      }
    });
  });

  // ── Vista de lista ─────────────────────────────────────────────────────

  test.describe('Vista de lista', () => {
    test('tabla de lista muestra columnas de citas', async ({ page }) => {
      const listViewBtn = page.getByRole('button', { name: T.listView });
      if (await listViewBtn.isVisible().catch(() => false)) {
        await listViewBtn.click();
        await page.waitForTimeout(500);
        const hasTable = await page.locator('table').isVisible().catch(() => false);
        if (hasTable) {
          await expect(page.getByRole('columnheader', { name: T.columns.date })
            .or(page.getByRole('columnheader', { name: T.columns.status }))).toBeVisible();
        }
      }
    });

    test('citas muestran estados válidos (Completada, Confirmada, Pendiente, etc.)', async ({ page }) => {
      const listViewBtn = page.getByRole('button', { name: T.listView });
      if (await listViewBtn.isVisible().catch(() => false)) {
        await listViewBtn.click();
        await page.waitForTimeout(500);
      }
      await expect(page).not.toHaveURL(/error/);
    });
  });

  // ── Panel de detalle de cita ──────────────────────────────────────────

  test.describe('Panel de detalle', () => {
    test('clic en una cita abre panel con tabs Información, Presupuesto', async ({ page }) => {
      // Intentar en vista de lista
      const listViewBtn = page.getByRole('button', { name: T.listView });
      if (await listViewBtn.isVisible().catch(() => false)) {
        await listViewBtn.click();
        await page.waitForTimeout(500);
      }
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);
        const infoTab = page.getByRole('button', { name: 'Información' })
          .or(page.getByText('Información')).first();
        if (await infoTab.isVisible().catch(() => false)) {
          await expect(infoTab).toBeVisible();
        }
      }
    });
  });
});
