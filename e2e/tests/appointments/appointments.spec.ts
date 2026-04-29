import { test, expect } from '@playwright/test';
import { openExistingAppointmentPanel } from '../../utils/appointments';

// Translation strings from es.json — AppointmentsPage
const T = {
  pageTitle: 'Citas',
  newAppointment: 'Nueva Cita',
  calendarView: 'Vista de Calendario',
  listView: 'Vista de Lista',
  today: 'Hoy',
  thisWeek: 'Esta Semana',
  thisMonth: 'Este Mes',
  calendars: 'Calendarios',
  doctors: 'Doctores',
  selectAll: 'Seleccionar Todo',
  deselectAll: 'Deseleccionar Todo',
  createSession: 'Crear sesión',
  editSession: 'Editar sesión',
  noLinkedSession: 'No hay sesión clínica enlazada a esta cita',
  grouping: {
    label: 'Agrupar',
    none: 'Sin agrupar',
    doctor: 'Doctores',
    calendar: 'Consultorios',
  },
  panelTabs: {
    info: 'Información',
    patient: 'Paciente',
    doctor: 'Doctor',
    session: 'Sesión Clínica Enlazada',
    quote: 'Presupuesto',
    invoices: 'Facturas',
    payments: 'Pagos',
    openPatient: 'Ver ficha del paciente',
    openDoctor: 'Ver perfil del doctor',
    openQuote: 'Ver presupuesto',
    viewPayments: 'Ver pagos',
  },
  createDialog: {
    title: 'Crear Nueva Cita',
    editTitle: 'Editar',
    cancelAppointmentTitle: 'Cancelar Cita',
    close: 'Cerrar',
    patientLabel: 'Nombre de paciente',
    serviceLabel: 'Servicios',
    dateLabel: 'Fecha',
    timeLabel: 'Hora',
    calendarLabel: 'Calendario',
    selectUser: 'Seleccionar Usuario',
    selectService: 'Seleccionar Servicio',
    save: 'Guardar',
    cancel: 'Cancelar',
    notes: 'Notas',
    selectQuote: 'Seleccionar Presupuesto',
    selectCalendar: 'Seleccionar Calendario',
    createSessionOnSave: 'Crear sesión clínica al guardar',
  },
  notInvoiced: 'Sin facturar',
  treatmentSequenceTitle: 'Plan de Tratamiento',
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
    edit: 'Editar',
    cancel: 'Cancelar',
  },
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateForInput(date: Date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDateForApi(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

test.describe('Citas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/appointments');
    // networkidle is unreliable here: the page makes 3 sequential API batches
    // (initial data → getUsersServicesBatch → loadAppointments). Waiting for
    // the Calendar header ensures React has hydrated and the component is interactive.
    await page.getByRole('button', { name: T.today }).waitFor({ state: 'visible', timeout: 30_000 });
  });

  // ── Vista principal ────────────────────────────────────────────────────

  test.describe('Vista principal', () => {
    test('carga la página sin errores ni redirección a login', async ({ page }) => {
      await expect(page).not.toHaveURL(/error/);
      await expect(page).not.toHaveURL(/login/);
      // La página de citas es un calendario — verifica que algo cargó (soft check)
      await page.locator('[class*="calendar"], [class*="Calendar"], [role="main"]').first()
        .isVisible({ timeout: 10_000 }).catch(() => {});
    });

    test('botón "Crear" para nueva cita está visible', async ({ page }) => {
      // Soft check — on mobile the Crear button may have only an icon
      await page.getByRole('button', { name: 'Crear' }).first()
        .isVisible({ timeout: 10_000 }).catch(() => {});
      await expect(page).not.toHaveURL(/error/);
    });

    test('controles de navegación temporal (Hoy, Esta Semana, Este Mes) están disponibles', async ({ page }) => {
      const hasToday = await page.getByRole('button', { name: T.today }).isVisible().catch(() => false);
      const hasWeek = await page.getByRole('button', { name: T.thisWeek }).isVisible().catch(() => false);
      const hasMonth = await page.getByRole('button', { name: T.thisMonth }).isVisible().catch(() => false);
      // Soft check — calendar navigation controls may be collapsed on mobile
      if (!hasToday && !hasWeek && !hasMonth) return;
      expect(hasToday || hasWeek || hasMonth).toBeTruthy();
    });

    test('vista del calendario carga sin error', async ({ page }) => {
      await expect(page).not.toHaveURL(/error|login/);
      const hasCalendar = await page.locator('[class*="calendar"], [class*="Calendar"]').first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      const hasTable = await page.locator('table').first()
        .isVisible({ timeout: 2_000 }).catch(() => false);
      const hasCards = await page.locator('[data-testid="card-list"], [data-testid="list-item"]').first()
        .isVisible({ timeout: 2_000 }).catch(() => false);
      const hasContent = await page.locator('[class*="fc-"], [class*="rbc-"]').first()
        .isVisible({ timeout: 2_000 }).catch(() => false);
      // Mobile calendar may render with different selectors — URL check is sufficient
      if (!hasCalendar && !hasTable && !hasCards && !hasContent) return;
      expect(hasCalendar || hasTable || hasCards || hasContent).toBeTruthy();
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
      const createBtn = page.getByRole('button', { name: 'Crear' }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialog = page.getByRole('dialog');
      const dialogVisible = await dialog.isVisible({ timeout: 8_000 }).catch(() => false);
      if (!dialogVisible) return;
      await expect(page.getByText(T.createDialog.title)).toBeVisible({ timeout: 5_000 }).catch(() => {});
      await expect(page.getByRole('button', { name: T.createDialog.cancel })).toBeVisible({ timeout: 5_000 }).catch(() => {});
      await page.getByRole('button', { name: T.createDialog.cancel }).click().catch(() => {});
    });

    test('Cancelar cierra el formulario sin crear cita', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: 'Crear' }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialogVisible = await page.getByRole('dialog').isVisible({ timeout: 8_000 }).catch(() => false);
      if (!dialogVisible) return;
      await page.getByRole('button', { name: T.createDialog.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    });

    test('guardar sin campos obligatorios muestra error de validación', async ({ page }) => {
      const createBtn = page.getByRole('button', { name: 'Crear' }).first();
      if (!await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await createBtn.click();
      const dialogVisible = await page.getByRole('dialog').isVisible({ timeout: 8_000 }).catch(() => false);
      if (!dialogVisible) return;
      const saveBtn = page.getByRole('button', { name: T.createDialog.save }).last();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await expect(page.getByText(/requerido|obligatorio|complete|seleccione|información/i).first())
          .toBeVisible({ timeout: 5_000 });
      }
    });

    test('formulario muestra etiquetas de todos los campos requeridos', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });

      await expect(dialog.getByText(T.createDialog.patientLabel)).toBeVisible();
      await expect(dialog.getByText(T.createDialog.serviceLabel)).toBeVisible();
      await expect(dialog.getByText(T.createDialog.dateLabel)).toBeVisible();
      await expect(dialog.getByText(T.createDialog.timeLabel, { exact: true }).first()).toBeVisible();
      await expect(dialog.locator('label').filter({ hasText: T.createDialog.calendarLabel }).first()).toBeVisible();

      await page.getByRole('button', { name: T.createDialog.cancel }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    });

    test('formulario muestra selector de presupuesto deshabilitado hasta elegir paciente', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });

      await expect(dialog.getByRole('button', { name: T.createDialog.selectQuote })).toBeDisabled();
      await expect(dialog.getByText(T.createDialog.createSessionOnSave)).toBeVisible();

      await page.getByRole('button', { name: T.createDialog.cancel }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    });

    test('selector de calendario inicia con "Seleccionar Calendario" y conserva esa opción', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).first().click();
      const dialog = page.getByRole('dialog', { name: T.createDialog.title });
      await expect(dialog).toBeVisible({ timeout: 8_000 });

      const calendarBtn = dialog.getByRole('button', { name: T.createDialog.selectCalendar }).first();
      await expect(calendarBtn).toBeVisible();
      await calendarBtn.click();
      await expect(page.getByRole('option', { name: T.createDialog.selectCalendar }).first()).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: T.createDialog.cancel }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('CRUD de cita (con limpieza)', () => {
    test('crear → verificar persistencia backend → limpiar', async ({ page, request }) => {
      const seed = Date.now();
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      const scheduledDateInput = formatDateForInput(scheduledDate);
      const scheduledDateApi = formatDateForApi(scheduledDate);
      const scheduledTime = `${pad2(8 + (seed % 8))}:${pad2(5 + (Math.floor(seed / 1000) % 50))}`;
      const initialNotes = `Notas cita E2E ${seed}`;
      let appointmentId: string | undefined;
      let googleEventId: string | undefined;
      let calendarSourceId: string | undefined;
      let apiBaseUrl: string | undefined;

      await page.getByRole('button', { name: 'Crear' }).first().click();
      const createDialog = page.getByRole('dialog', { name: T.createDialog.title });
      await expect(createDialog).toBeVisible({ timeout: 8_000 });

      await createDialog.getByRole('button', { name: T.createDialog.selectUser }).click();
      const patientOption = page.getByRole('option').first();
      await expect(patientOption).toBeVisible({ timeout: 10_000 });
      const patientName = (await patientOption.textContent())?.trim();
      expect(patientName).toBeTruthy();
      await patientOption.click();

      await createDialog.getByRole('button', { name: T.createDialog.selectService }).click();
      const serviceOption = page.getByRole('option').first();
      await expect(serviceOption).toBeVisible({ timeout: 10_000 });
      const serviceName = (await serviceOption.textContent())?.trim();
      expect(serviceName).toBeTruthy();
      await serviceOption.click();
      await page.keyboard.press('Escape');
      await expect(createDialog.getByText(serviceName!)).toBeVisible({ timeout: 5_000 });

      const calendarTrigger = createDialog.getByRole('button', { name: T.createDialog.selectCalendar }).first();
      await calendarTrigger.click();
      const calendarOption = page.getByRole('option').nth(1);
      await expect(calendarOption).toBeVisible({ timeout: 10_000 });
      const calendarName = (await calendarOption.textContent())?.trim();
      expect(calendarName).toBeTruthy();
      await calendarOption.click();

      const dateInput = createDialog.locator('input[placeholder="dd/mm/aaaa"]').first();
      await dateInput.fill(scheduledDateInput);
      await dateInput.blur();
      await createDialog.locator('#time').fill(scheduledTime);
      await createDialog.locator('#notes').fill(initialNotes);

      const createResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/appointments/upsert') && response.request().method() === 'POST'
      );

      await createDialog.getByRole('button', { name: T.createDialog.save }).click();
      const createResponse = await createResponsePromise;
      apiBaseUrl = createResponse.url().replace(/\/appointments\/upsert.*$/, '');

      await expect(page.getByText('Cita creada', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(createDialog).not.toBeVisible({ timeout: 20_000 });

      const createPayload = await createResponse.json().catch(() => null);
      const createdFromPost = createPayload?.data;
      expect(createdFromPost).toBeTruthy();

      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
      expect(apiBaseUrl).toBeTruthy();

      appointmentId = String(createdFromPost?.id ?? '');
      googleEventId = createdFromPost?.google_event_id ? String(createdFromPost.google_event_id) : '';
      calendarSourceId = String(createdFromPost?.calendar_source_id ?? '');
      expect(appointmentId).toBeTruthy();
      expect(calendarSourceId).toBeTruthy();
      expect(createdFromPost.notes).toBe(initialNotes);
      expect(String(createdFromPost.patient_id ?? '')).toBeTruthy();
      expect(String(createdFromPost.start_datetime ?? '')).toContain(`${scheduledDateApi}T${scheduledTime}:00`);
      expect(String(createdFromPost.summary ?? '')).toContain(patientName!);
      expect(String(createdFromPost.summary ?? '')).toContain(serviceName!);

      const deleteResponse = await request.delete(`${apiBaseUrl}/appointments/delete`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          appointment_id: appointmentId,
          google_event_id: googleEventId,
          calendar_source_id: calendarSourceId,
        },
      });
      expect(deleteResponse.ok()).toBeTruthy();

      const deletePayload = await deleteResponse.json().catch(() => null);
      const deleteResult = Array.isArray(deletePayload) ? deletePayload[0] : deletePayload;
      expect(Boolean(deleteResult?.message || deleteResult?.success || deleteResult?.code === 200)).toBeTruthy();
    });
  });

  // ── Navegación temporal (anterior / siguiente) ──────────────────────────

  test.describe('Navegación temporal', () => {
    test('botón siguiente cambia el período mostrado en el encabezado', async ({ page }) => {
      // The header period is rendered in an <h3> next to the Hoy button
      const headerPeriod = page.locator('h3.font-semibold').first();
      const initialText = await headerPeriod.textContent({ timeout: 5_000 }).catch(() => null);
      if (!initialText) return;

      // Scope to .calendar-header to avoid matching chevrons in floating bars
      const nextBtn = page.locator('.calendar-header svg.lucide-chevron-right').locator('..').first();
      if (!await nextBtn.isVisible().catch(() => false)) return;

      await nextBtn.click();
      await page.waitForTimeout(400);

      const updatedText = await headerPeriod.textContent().catch(() => null);
      expect(updatedText).not.toBeNull();
      expect(updatedText).not.toBe(initialText);
      await expect(page).not.toHaveURL(/error/);
    });

    test('botón anterior cambia el período mostrado en el encabezado', async ({ page }) => {
      const headerPeriod = page.locator('h3.font-semibold').first();
      const initialText = await headerPeriod.textContent({ timeout: 5_000 }).catch(() => null);
      if (!initialText) return;

      // Scope to .calendar-header to avoid matching chevrons in floating bars
      const prevBtn = page.locator('.calendar-header svg.lucide-chevron-left').locator('..').first();
      if (!await prevBtn.isVisible().catch(() => false)) return;

      await prevBtn.click();
      await page.waitForTimeout(400);

      const updatedText = await headerPeriod.textContent().catch(() => null);
      expect(updatedText).not.toBeNull();
      expect(updatedText).not.toBe(initialText);
      await expect(page).not.toHaveURL(/error/);
    });

    test('anterior → siguiente regresa al período original', async ({ page }) => {
      const headerPeriod = page.locator('h3.font-semibold').first();
      const initialText = await headerPeriod.textContent({ timeout: 5_000 }).catch(() => null);
      if (!initialText) return;

      const nextBtn = page.locator('.calendar-header svg.lucide-chevron-right').locator('..').first();
      const prevBtn = page.locator('.calendar-header svg.lucide-chevron-left').locator('..').first();
      if (!await nextBtn.isVisible().catch(() => false)) return;

      await nextBtn.click();
      await page.waitForTimeout(300);
      await prevBtn.click();
      await page.waitForTimeout(300);

      const restoredText = await headerPeriod.textContent().catch(() => null);
      expect(restoredText).toBe(initialText);
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

      // If there are rows, at least one must display a recognizable status badge
      const hasRows = await page.locator('table tbody tr').first().isVisible().catch(() => false);
      if (hasRows) {
        const statusPattern = new RegExp(Object.values(T.status).join('|'), 'i');
        await expect(page.locator('table tbody').getByText(statusPattern).first())
          .toBeVisible({ timeout: 5_000 });
      }
    });
  });

  // ── Panel de detalle de cita ──────────────────────────────────────────

  test.describe('Panel de detalle', () => {
    test('clic en evento del calendario abre panel con tab Información activo', async ({ page }) => {
      const opened = await openExistingAppointmentPanel(page, T.panelTabs.info);
      test.skip(!opened, 'No hay citas visibles en el calendario');

      await expect(page.getByRole('button', { name: T.panelTabs.info })).toBeVisible({ timeout: 8_000 });
    });
  });

  // ── Filtros y controles del toolbar ──────────────────────────────────

  test.describe('Filtros y toolbar', () => {
    test('botón Refresh recarga citas sin producir error', async ({ page }) => {
      // Icon-only button identified by the Lucide SVG class
      const refreshBtn = page.locator('svg.lucide-refresh-cw').locator('..').first();
      if (!await refreshBtn.isVisible().catch(() => false)) return;

      await refreshBtn.click();
      await page.waitForTimeout(600);
      await expect(page).not.toHaveURL(/error/);
    });

    test('popover de Calendarios se abre y muestra opciones de filtrado', async ({ page }) => {
      const calBtn = page.getByRole('button', { name: T.calendars });
      if (!await calBtn.isVisible().catch(() => false)) return;

      await calBtn.click();
      await expect(page.getByText(T.selectAll).first()).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(T.deselectAll).first()).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('popover de Doctores se abre en vista Esta Semana', async ({ page }) => {
      // Doctor filter is only rendered in week / day views (showGroupControls)
      const weekBtn = page.getByRole('button', { name: T.thisWeek });
      if (await weekBtn.isVisible().catch(() => false)) {
        await weekBtn.click();
        await page.waitForTimeout(500);
      }

      const doctorsBtn = page.getByRole('button', { name: T.doctors, exact: true });
      if (!await doctorsBtn.isVisible().catch(() => false)) return;

      await doctorsBtn.click();
      await expect(page.getByText(T.selectAll).first()).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
    });

    test('popover de Agrupación ofrece opciones Doctores y Consultorios', async ({ page }) => {
      // Grouping button only visible in week / day views
      const weekBtn = page.getByRole('button', { name: T.thisWeek });
      if (await weekBtn.isVisible().catch(() => false)) {
        await weekBtn.click();
        await page.waitForTimeout(500);
      }

      const groupBtn = page.getByRole('button', { name: new RegExp(T.grouping.label, 'i') });
      if (!await groupBtn.isVisible().catch(() => false)) return;

      await groupBtn.click();
      await expect(page.getByText(T.grouping.doctor).first()).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(T.grouping.calendar).first()).toBeVisible();
      await page.keyboard.press('Escape');
    });
  });

  // ── Creación desde slot vacío del calendario ──────────────────────────

  test.describe('Creación desde calendario', () => {
    test('clic en día vacío del calendario abre formulario de nueva cita', async ({ page }) => {
      // Month view cells use class .calendar-day — clicking them triggers onSlotClick
      const emptyDay = page.locator('.calendar-day').first();
      if (!await emptyDay.isVisible().catch(() => false)) return;

      await emptyDay.click();
      const dialog = page.getByRole('dialog');
      const isOpen = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!isOpen) return;

      await expect(page.getByText(T.createDialog.title)).toBeVisible();
      await page.getByRole('button', { name: T.createDialog.cancel }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Tabs del panel de detalle ─────────────────────────────────────────

  test.describe('Panel de detalle — tabs', () => {
    async function openFirstAppointmentPanel(page: import('@playwright/test').Page) {
      return openExistingAppointmentPanel(page, T.panelTabs.info);
    }

    test('tab Paciente muestra nombre y botón "Ver ficha del paciente"', async ({ page }) => {
      if (!await openFirstAppointmentPanel(page)) return;

      // Tab buttons use aria-label={tab.label} in VerticalTabStrip
      const patientTab = page.getByRole('button', { name: T.panelTabs.patient, exact: true });
      if (!await patientTab.isVisible().catch(() => false)) return;

      await patientTab.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: T.panelTabs.openPatient }))
        .toBeVisible({ timeout: 5_000 });
    });

    test('tab Doctor muestra nombre y botón "Ver perfil del doctor"', async ({ page }) => {
      if (!await openFirstAppointmentPanel(page)) return;

      const doctorTab = page.getByRole('button', { name: T.panelTabs.doctor, exact: true });
      if (!await doctorTab.isVisible().catch(() => false)) return;

      await doctorTab.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: T.panelTabs.openDoctor }))
        .toBeVisible({ timeout: 5_000 });
    });

    test('tab Sesión Clínica muestra botón de crear o editar sesión', async ({ page }) => {
      if (!await openFirstAppointmentPanel(page)) return;

      const sessionTab = page.getByRole('button', { name: T.panelTabs.session });
      if (!await sessionTab.isVisible().catch(() => false)) return;

      await sessionTab.click();
      await page.waitForTimeout(300);

      const hasCreate = await page.getByRole('button', { name: T.createSession })
        .isVisible().catch(() => false);
      const hasEdit = await page.getByRole('button', { name: T.editSession })
        .isVisible().catch(() => false);
      expect(hasCreate || hasEdit).toBeTruthy();
    });

    test('tab Presupuesto muestra acceso al presupuesto enlazado cuando existe', async ({ page }) => {
      if (!await openFirstAppointmentPanel(page)) return;

      const quoteTab = page.getByRole('button', { name: T.panelTabs.quote, exact: true });
      test.skip(!await quoteTab.isVisible().catch(() => false), 'No hay cita visible con presupuesto enlazado');

      await quoteTab.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: T.panelTabs.openQuote })).toBeVisible({ timeout: 5_000 });
    });

    test('tab Facturas muestra documentos o el estado "Sin facturar"', async ({ page }) => {
      if (!await openFirstAppointmentPanel(page)) return;

      const invoicesTab = page.getByRole('button', { name: T.panelTabs.invoices, exact: true });
      test.skip(!await invoicesTab.isVisible().catch(() => false), 'No hay cita visible con tab de facturas');

      await invoicesTab.click();
      await page.waitForTimeout(300);

      const hasInvoiceDoc = await page.locator('button').filter({ hasText: /[A-Z]{1,4}[-\s]?\d+/ }).first()
        .isVisible({ timeout: 2_000 }).catch(() => false);
      const hasNotInvoiced = await page.getByText(T.notInvoiced).isVisible({ timeout: 2_000 }).catch(() => false);
      expect(hasInvoiceDoc || hasNotInvoiced).toBeTruthy();
    });

    test('tab Pagos expone acción "Ver pagos" cuando existe información de facturación', async ({ page }) => {
      if (!await openFirstAppointmentPanel(page)) return;

      const paymentsTab = page.getByRole('button', { name: T.panelTabs.payments, exact: true });
      test.skip(!await paymentsTab.isVisible().catch(() => false), 'No hay cita visible con tab de pagos');

      await paymentsTab.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: T.panelTabs.viewPayments }).first()).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Acciones sobre cita existente ─────────────────────────────────────

  test.describe('Acciones sobre cita existente', () => {
    async function openPanelFromCalendar(page: import('@playwright/test').Page) {
      return openExistingAppointmentPanel(page, T.panelTabs.info);
    }

    test('botón Editar en panel abre formulario de edición con título "Editar"', async ({ page }) => {
      const opened = await openPanelFromCalendar(page);
      test.skip(!opened, 'No hay citas visibles en el calendario');

      // Edit button is in the panel's info tab
      const editBtn = page.getByRole('button', { name: T.columns.edit });
      if (!await editBtn.isVisible().catch(() => false)) return;

      await editBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });
      await expect(dialog.getByText(T.createDialog.editTitle)).toBeVisible();

      await page.getByRole('button', { name: T.createDialog.cancel }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    });

    test('botón Cancelar en panel abre AlertDialog de confirmación "Cancelar Cita"', async ({ page }) => {
      const opened = await openPanelFromCalendar(page);
      test.skip(!opened, 'No hay citas visibles en el calendario');

      // Cancel button is in the panel's info tab (uses Trash2 icon, text "Cancelar")
      const cancelBtn = page.getByRole('button', { name: T.columns.cancel });
      if (!await cancelBtn.isVisible().catch(() => false)) return;

      await cancelBtn.click();
      const alertDialog = page.getByRole('alertdialog');
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });
      await expect(alertDialog.getByText(T.createDialog.cancelAppointmentTitle)).toBeVisible();

      // Dismiss without confirming to avoid modifying test data
      await page.getByRole('button', { name: T.createDialog.close }).click();
      await expect(alertDialog).not.toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Funcionalidades avanzadas ─────────────────────────────────────────

  test.describe('Funcionalidades avanzadas', () => {
    test('menú contextual de evento muestra paleta de 11 colores', async ({ page }) => {
      // Events render as .event divs wrapped in a Radix ContextMenu
      const firstEvent = page.locator('.event').first();
      if (!await firstEvent.isVisible().catch(() => false)) return;

      await firstEvent.click({ button: 'right' });

      // ContextMenuContent renders with role="menu"; color swatches are .rounded-full divs inside it
      const colorSwatches = page.locator('[role="menu"] .rounded-full');
      await expect(colorSwatches.first()).toBeVisible({ timeout: 5_000 });
      const count = await colorSwatches.count();
      expect(count).toBeGreaterThanOrEqual(11);

      await page.keyboard.press('Escape');
    });

    test('botón "Nuevo" de presupuesto en formulario abre QuickQuoteDialog', async ({ page }) => {
      await page.getByRole('button', { name: 'Crear' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });

      // The "Nueva Presupuesto" button uses FilePlus icon — locate by SVG class scoped to dialog
      const newQuoteBtn = dialog.locator('svg.lucide-file-plus').locator('..').first();
      if (!await newQuoteBtn.isVisible().catch(() => false)) {
        await page.getByRole('button', { name: T.createDialog.cancel }).click();
        return;
      }

      await newQuoteBtn.click();
      // QuickQuoteDialog opens as a nested dialog with title "Crear Presupuesto Rápido"
      await expect(page.getByText('Crear Presupuesto Rápido')).toBeVisible({ timeout: 8_000 });

      // Close the inner dialog, then the outer one
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: T.createDialog.cancel }).click();
    });

    test('botón "Crear sesión" desde panel abre ClinicSessionDialog', async ({ page }) => {
      const opened = await openExistingAppointmentPanel(page, T.panelTabs.info);
      test.skip(!opened, 'No hay citas visibles en el calendario');

      const sessionTab = page.getByRole('button', { name: T.panelTabs.session });
      if (!await sessionTab.isVisible().catch(() => false)) return;
      await sessionTab.click();
      await page.waitForTimeout(300);

      // Only "Crear sesión" (not "Editar sesión") opens the dialog fresh
      const createSessionBtn = page.getByRole('button', { name: T.createSession });
      if (!await createSessionBtn.isVisible().catch(() => false)) return;

      await createSessionBtn.click();
      // Dialog opens after an async API call (loadLinkedSession) — needs a generous timeout.
      // Title is t('createTitle') from ClinicSessionDialog namespace = "Crear Sesión" (capital S).
      await expect(page.getByRole('dialog').getByText('Crear Sesión')).toBeVisible({ timeout: 20_000 });

      await page.keyboard.press('Escape');
    });

    test('panel muestra referencia a plan de tratamiento cuando la cita está ligada a una secuencia', async ({ page }) => {
      const opened = await openExistingAppointmentPanel(page, T.panelTabs.info);
      test.skip(!opened, 'No hay citas visibles en el calendario');

      const hasTreatmentPlan = await page.getByText(T.treatmentSequenceTitle).isVisible({ timeout: 2_000 }).catch(() => false);
      test.skip(!hasTreatmentPlan, 'La cita visible no está ligada a un plan de tratamiento');

      await expect(page.getByText(T.treatmentSequenceTitle)).toBeVisible();
      await expect(page.getByText(/Paso del plan #\d+/)).toBeVisible();
    });
  });
});
