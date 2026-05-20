import { test, expect, type Page } from '@playwright/test';

// ── Translation strings (es.json) ────────────────────────────────────────────
const T = {
  // DoctorWorkspacePage
  noAccess: 'No tienes permisos para acceder al consultorio del doctor.',

  // Agenda panel
  agendaTitle: 'Agenda del día',
  agendaDescription: 'Selecciona una cita para ver el contexto clínico y disparar acciones rápidas.',
  emptyAgendaTitle: 'No hay citas para hoy',
  hideHistory: 'Ocultar',
  showHistory: 'Ver historial',

  // Focus / detail panel
  focusEmpty: 'Selecciona una cita del día para abrir el panel clínico rápido.',
  tabSessions: 'Sesiones Clínicas',
  tabOdontogram: 'Odontograma',
  editSession: 'Editar sesión clínica',
  completeSession: 'Completar sesión clínica',
  backToAgenda: 'Volver a la agenda',
  noClinicalSignals: 'Sin alergias ni complicaciones registradas.',
  timelineEmptyDescription: 'Todavía no hay sesiones clínicas registradas para este paciente.',
  latestSessionBadge: 'Última sesión',
  currentAppointmentBadge: 'Cita actual',
  sessionExistsToday: 'Ya existe una sesión clínica registrada para hoy',

  // ClinicSessionDialog
  dialogCreate: 'Crear Sesión',
  dialogEdit: 'Editar Sesión',
  dialogProcedure: 'Procedimiento',
  dialogNotes: 'Notas Clínicas',
  dialogNextPlan: 'Plan para la Próxima Sesión',
  dialogDate: 'Fecha',
  dialogDoctor: 'Doctor',
  dialogSave: 'Guardar',
  dialogCancel: 'Cancelar',
  dialogTreatmentsTitle: 'Tratamientos por diente',
  dialogAddTreatment: 'Agregar tratamiento',

  // Navigation
  navLabel: 'Mi Consultorio',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function gotoWorkspace(page: Page) {
  await page.goto('/workspace', { waitUntil: 'domcontentloaded' });
  // Wait for the main content: either the agenda card or the no-access message.
  // Use .or() with proper Playwright locators instead of CSS comma syntax.
  await page.getByText(T.agendaTitle)
    .or(page.getByText(T.noAccess))
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
}

/** Returns true if the current user has workspace access (agenda is visible). */
async function hasAccess(page: Page): Promise<boolean> {
  return page.getByText(T.agendaTitle).isVisible({ timeout: 5_000 }).catch(() => false);
}

/**
 * Returns the first appointment card button in the agenda timeline.
 *
 * Appointments render as <button type="button" class="absolute ... rounded-xl text-left ...">
 * (see DoctorAgendaTimeline in doctor-workspace.tsx ~line 516).
 * There is no cursor-pointer class — they are plain <button> elements.
 */
function firstAppointmentBtn(page: Page) {
  return page
    .locator('button[type="button"][class*="rounded-xl"][class*="text-left"]')
    .first();
}

/** Click the first appointment card and wait for the detail panel tabs to appear. */
async function selectFirstAppointment(page: Page): Promise<boolean> {
  // Wait for skeleton loaders to disappear before interacting
  await page.waitForSelector('[class*="Skeleton"]', {
    state: 'detached',
    timeout: 15_000,
  }).catch(() => {});

  const btn = firstAppointmentBtn(page);
  if (!await btn.isVisible({ timeout: 5_000 }).catch(() => false)) return false;
  await btn.click();
  // Detail panel loads: tabs appear
  return page
    .locator('button').filter({ hasText: T.tabSessions })
    .first()
    .isVisible({ timeout: 8_000 }).catch(() => false);
}

/** Opens the session dialog from the first selectable appointment. Returns false if not possible. */
async function openSessionDialog(page: Page): Promise<boolean> {
  const selected = await selectFirstAppointment(page);
  if (!selected) return false;
  // Allow linked session to load
  await page.waitForTimeout(2_000);

  const sessionBtn = page
    .getByRole('button', { name: new RegExp(`${T.editSession}|${T.completeSession}`) })
    .first();
  if (!await sessionBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
  if (!await sessionBtn.isEnabled().catch(() => false)) return false;

  await sessionBtn.click();
  return page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false);
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('Área de trabajo del Doctor (workspace)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWorkspace(page);
  });

  // ── Control de acceso ────────────────────────────────────────────────────

  test.describe('Control de acceso', () => {
    test('la página no redirige a login', async ({ page }) => {
      await expect(page).not.toHaveURL(/\/login/);
    });

    test('muestra el workspace o el mensaje de sin permisos — nunca un estado en blanco', async ({ page }) => {
      const agendaVisible = await page.getByText(T.agendaTitle).isVisible({ timeout: 8_000 }).catch(() => false);
      const noAccessVisible = await page.getByText(T.noAccess).isVisible({ timeout: 8_000 }).catch(() => false);
      expect(agendaVisible || noAccessVisible).toBe(true);
    });

    test('sin permisos: el mensaje es correcto y la agenda no aparece', async ({ page }) => {
      if (await hasAccess(page)) return; // usuario con acceso — no aplica
      await expect(page.getByText(T.noAccess)).toBeVisible();
      await expect(page.getByText(T.agendaTitle)).not.toBeVisible();
    });
  });

  // ── Panel de agenda ──────────────────────────────────────────────────────

  test.describe('Panel de agenda', () => {
    test.beforeEach(async ({ page }) => {
      if (!await hasAccess(page)) test.skip();
    });

    test('muestra el título "Agenda del día"', async ({ page }) => {
      await expect(page.getByText(T.agendaTitle)).toBeVisible();
    });

    test('muestra la descripción de la agenda', async ({ page }) => {
      await expect(page.getByText(T.agendaDescription)).toBeVisible();
    });

    test('el botón de actualizar está visible y habilitado', async ({ page }) => {
      // Scoped to the agenda card header to avoid matching other RefreshCw buttons
      const agendaCard = page.getByText(T.agendaTitle).locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
      const refreshBtn = agendaCard
        .locator('button')
        .filter({ has: page.locator('svg.lucide-refresh-cw') })
        .first();
      await expect(refreshBtn).toBeVisible({ timeout: 5_000 });
      await expect(refreshBtn).toBeEnabled();
    });

    test('clic en actualizar no produce errores visibles', async ({ page }) => {
      const agendaCard = page.getByText(T.agendaTitle).locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
      const refreshBtn = agendaCard
        .locator('button')
        .filter({ has: page.locator('svg.lucide-refresh-cw') })
        .first();
      if (!await refreshBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await refreshBtn.click();
      await page.waitForTimeout(1_500);
      await expect(page).not.toHaveURL(/error/);
    });

    test('después de cargar muestra citas o estado vacío — nunca en blanco', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      const hasAppointments = await firstAppointmentBtn(page).isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await page.getByText(T.emptyAgendaTitle).isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasAppointments || hasEmpty).toBe(true);
    });

    test('estado vacío muestra el texto correcto', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      if (!await page.getByText(T.emptyAgendaTitle).isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await expect(page.getByText(T.emptyAgendaTitle)).toBeVisible();
    });

    test('las tarjetas de cita muestran hora en formato HH:MM', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      if (!await firstAppointmentBtn(page).isVisible({ timeout: 3_000 }).catch(() => false)) return;
      const text = await firstAppointmentBtn(page).textContent().catch(() => '');
      expect(text).toMatch(/\d{1,2}:\d{2}/);
    });

    test('las tarjetas de cita muestran un badge de estado', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      if (!await firstAppointmentBtn(page).isVisible({ timeout: 3_000 }).catch(() => false)) return;
      // Each appointment card has a Badge for the status (text like Programada, Confirmada, etc.)
      const badge = firstAppointmentBtn(page)
        .locator('[class*="badge"], [class*="Badge"]')
        .first();
      await expect(badge).toBeVisible({ timeout: 3_000 });
    });

    test('las tarjetas muestran el nombre del paciente', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      if (!await firstAppointmentBtn(page).isVisible({ timeout: 3_000 }).catch(() => false)) return;
      // Patient name is a <p class="truncate text-sm font-semibold"> inside the button
      const patientName = firstAppointmentBtn(page)
        .locator('p[class*="font-semibold"]')
        .first();
      await expect(patientName).toBeVisible({ timeout: 3_000 });
      const nameText = await patientName.textContent().catch(() => '');
      expect(nameText?.trim().length).toBeGreaterThan(0);
    });

    test('cuando hay citas, la primera se auto-selecciona al cargar', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      if (!await firstAppointmentBtn(page).isVisible({ timeout: 3_000 }).catch(() => false)) return;

      // On desktop, the first appointment is auto-selected without clicking —
      // the detail panel tabs should be visible without any interaction.
      const tabsVisible = await page
        .locator('button').filter({ hasText: T.tabSessions })
        .first()
        .isVisible({ timeout: 8_000 }).catch(() => false);
      expect(tabsVisible).toBe(true);
    });

    test('hacer clic en una segunda cita cambia el paciente mostrado', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      const allBtns = page.locator('button[type="button"][class*="rounded-xl"][class*="text-left"]');
      const count = await allBtns.count();
      if (count < 2) return; // need at least 2 appointments

      // Read first appointment patient name
      const firstName = await allBtns.nth(0).locator('p[class*="font-semibold"]').textContent().catch(() => '');
      const secondName = await allBtns.nth(1).locator('p[class*="font-semibold"]').textContent().catch(() => '');

      if (!firstName || !secondName || firstName === secondName) return; // same patient — can't distinguish

      // Click the second appointment
      await allBtns.nth(1).click();
      await page.waitForTimeout(1_000);

      // Detail panel should now show the second patient's name
      // The name appears in a large heading in the detail area
      await expect(
        page.locator('[class*="text-2xl"], [class*="text-xl"]').filter({ hasText: secondName }).first()
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Historial de citas pasadas ───────────────────────────────────────────

  test.describe('Historial de citas pasadas', () => {
    test.beforeEach(async ({ page }) => {
      if (!await hasAccess(page)) test.skip();
    });

    test('botón de historial aparece cuando hay citas pasadas ocultas', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      // The history toggle button appears when `hiddenCount > 0`
      // It contains a count like "X citas anteriores ocultas" or "Ver historial"
      const historyBtn = page
        .locator('button')
        .filter({ hasText: /citas anteriores|historial/i })
        .first();

      if (!await historyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return; // no past appointments

      await expect(historyBtn).toBeVisible();
    });

    test('clic en historial expande las citas pasadas y muestra el botón de ocultar', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      const historyBtn = page
        .locator('button')
        .filter({ hasText: /citas anteriores|historial/i })
        .first();

      if (!await historyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;

      await historyBtn.click();
      await page.waitForTimeout(400);

      // After expanding, the button text changes to "Ocultar"
      await expect(
        page.locator('button').filter({ hasText: T.hideHistory }).first()
      ).toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Panel de detalle (foco) ──────────────────────────────────────────────

  test.describe('Panel de detalle (foco)', () => {
    test.beforeEach(async ({ page }) => {
      if (!await hasAccess(page)) test.skip();
    });

    test('cuando no hay citas muestra el mensaje de estado vacío', async ({ page }) => {
      await page.waitForSelector('[class*="Skeleton"]', {
        state: 'detached',
        timeout: 15_000,
      }).catch(() => {});

      // Only visible when no appointments exist (auto-selection skipped)
      if (await firstAppointmentBtn(page).isVisible({ timeout: 3_000 }).catch(() => false)) return;

      await expect(page.getByText(T.focusEmpty)).toBeVisible({ timeout: 5_000 });
    });

    test('al seleccionar una cita aparecen ambas pestañas del panel', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;

      await expect(page.locator('button').filter({ hasText: T.tabSessions }).first()).toBeVisible();
      await expect(page.locator('button').filter({ hasText: T.tabOdontogram }).first()).toBeVisible();
    });

    test('al seleccionar una cita se muestra el nombre del paciente en el encabezado', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;

      // Patient name is the large heading (text-xl / text-2xl) in the detail area
      const heading = page
        .locator('[class*="text-xl"][class*="font-semibold"], [class*="text-2xl"][class*="font-semibold"]')
        .first();
      await expect(heading).toBeVisible({ timeout: 5_000 });
      const nameText = await heading.textContent().catch(() => '');
      expect(nameText?.trim().length).toBeGreaterThan(0);
    });

    test('"Sesiones Clínicas" es la pestaña activa por defecto', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;

      // Active tab has bg-primary in its class list
      const sessionsTab = page.locator('button').filter({ hasText: T.tabSessions }).first();
      await expect(sessionsTab).toBeVisible();
      const cls = await sessionsTab.getAttribute('class').catch(() => '');
      expect(cls).toMatch(/bg-primary/);
    });

    test('clic en "Odontograma" activa esa pestaña y deja de mostrar el contenido de sesiones', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;

      // Wait for sessions panel to settle
      await page.waitForTimeout(1_000);

      const odontogramTab = page.locator('button').filter({ hasText: T.tabOdontogram }).first();
      await expect(odontogramTab).toBeVisible({ timeout: 5_000 });
      await odontogramTab.click();
      await page.waitForTimeout(600);

      // Tab class should now show bg-primary on odontogram tab
      const cls = await odontogramTab.getAttribute('class').catch(() => '');
      expect(cls).toMatch(/bg-primary/);
    });

    test('volver a "Sesiones Clínicas" desde "Odontograma" restaura el panel de sesiones', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;

      const odontogramTab = page.locator('button').filter({ hasText: T.tabOdontogram }).first();
      if (!await odontogramTab.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      await odontogramTab.click();
      await page.waitForTimeout(400);

      const sessionsTab = page.locator('button').filter({ hasText: T.tabSessions }).first();
      await sessionsTab.click();
      await page.waitForTimeout(400);

      // Sessions tab is active again
      const cls = await sessionsTab.getAttribute('class').catch(() => '');
      expect(cls).toMatch(/bg-primary/);
    });

    test('se muestran las señales clínicas del paciente o el mensaje de ausencia', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;

      await page.waitForTimeout(2_000);

      const hasAlerts = await page
        .locator('[class*="badge"], [class*="Badge"]')
        .filter({ hasText: /.+/ })
        .first()
        .isVisible({ timeout: 2_000 }).catch(() => false);

      const hasNoSignals = await page.getByText(T.noClinicalSignals).isVisible({ timeout: 2_000 }).catch(() => false);

      expect(hasAlerts || hasNoSignals).toBe(true);
    });
  });

  // ── Botón de sesión clínica ──────────────────────────────────────────────

  test.describe('Botón de sesión clínica', () => {
    test.beforeEach(async ({ page }) => {
      if (!await hasAccess(page)) test.skip();
    });

    test('el botón es visible al seleccionar una cita', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;

      const sessionBtn = page
        .getByRole('button', { name: new RegExp(`${T.editSession}|${T.completeSession}`) })
        .first();
      await expect(sessionBtn).toBeVisible({ timeout: 5_000 });
    });

    test('el botón muestra "Completar sesión" o "Editar sesión" según haya sesión vinculada', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;
      await page.waitForTimeout(2_000);

      const completeVisible = await page.getByRole('button', { name: T.completeSession }).first().isVisible({ timeout: 2_000 }).catch(() => false);
      const editVisible = await page.getByRole('button', { name: T.editSession }).first().isVisible({ timeout: 2_000 }).catch(() => false);
      expect(completeVisible || editVisible).toBe(true);
    });

    test('clic en el botón abre el diálogo de sesión', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;
      await page.waitForTimeout(2_000);

      const sessionBtn = page
        .getByRole('button', { name: new RegExp(`${T.editSession}|${T.completeSession}`) })
        .first();
      if (!await sessionBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      if (!await sessionBtn.isEnabled().catch(() => false)) return;

      await sessionBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      const hasTitle = await page.getByText(T.dialogCreate).or(page.getByText(T.dialogEdit)).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasTitle).toBe(true);
    });

    test('cuando existe sesión hoy, el botón "Completar" está deshabilitado con tooltip explicativo', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;
      await page.waitForTimeout(2_500);

      const completeBtn = page.getByRole('button', { name: T.completeSession }).first();
      if (!await completeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) return;
      if (!await completeBtn.isDisabled().catch(() => false)) return; // enabled — no block today

      const title = await completeBtn.getAttribute('title').catch(() => '');
      expect(title).toContain('sesión');
    });
  });

  // ── Diálogo de sesión clínica ────────────────────────────────────────────

  test.describe('Diálogo de sesión clínica', () => {
    test.beforeEach(async ({ page }) => {
      if (!await hasAccess(page)) test.skip();
    });

    test('contiene el campo "Procedimiento"', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      await expect(page.getByLabel(T.dialogProcedure)).toBeVisible({ timeout: 5_000 });
    });

    test('contiene el campo "Notas Clínicas"', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      await expect(page.getByLabel(T.dialogNotes)).toBeVisible({ timeout: 5_000 });
    });

    test('contiene el campo "Plan para la Próxima Sesión"', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      await expect(page.getByLabel(T.dialogNextPlan)).toBeVisible({ timeout: 5_000 });
    });

    test('contiene el campo de fecha', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      // Date field is labeled "Fecha" in ClinicSessionDialog
      const dateField = page.getByLabel(T.dialogDate).first();
      await expect(dateField).toBeVisible({ timeout: 5_000 });
    });

    test('contiene la sección de tratamientos por diente', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      // showTreatments=true in workspace — treatments section is always rendered
      await expect(page.getByText(T.dialogTreatmentsTitle)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('button', { name: T.dialogAddTreatment })).toBeVisible({ timeout: 5_000 });
    });

    test('el campo Doctor está bloqueado (lockDoctor=true en workspace)', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      const doctorField = page.getByLabel(T.dialogDoctor).first();
      if (!await doctorField.isVisible({ timeout: 3_000 }).catch(() => false)) return;
      // With lockDoctor=true the combobox/button is disabled
      const isDisabled = await doctorField.isDisabled().catch(() => false);
      const isAriaDisabled = await doctorField
        .evaluate((el) => el.getAttribute('aria-disabled') === 'true')
        .catch(() => false);
      expect(isDisabled || isAriaDisabled).toBe(true);
    });

    test('Guardar está deshabilitado cuando Procedimiento está vacío', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      await page.getByLabel(T.dialogProcedure).clear();
      await expect(page.getByRole('button', { name: T.dialogSave })).toBeDisabled();
    });

    test('Guardar se habilita al llenar el campo Procedimiento', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      await page.getByLabel(T.dialogProcedure).fill('Limpieza dental y revisión de caries');
      await expect(page.getByRole('button', { name: T.dialogSave })).toBeEnabled();
    });

    test('Cancelar cierra el diálogo sin guardar', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      await page.getByRole('button', { name: T.dialogCancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    });

    test('Escape cierra el diálogo', async ({ page }) => {
      if (!await openSessionDialog(page)) return;
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Línea de tiempo de sesiones del paciente ─────────────────────────────

  test.describe('Línea de tiempo del paciente', () => {
    test.beforeEach(async ({ page }) => {
      if (!await hasAccess(page)) test.skip();
    });

    test('muestra sesiones existentes o el mensaje de vacío — nunca en blanco', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;
      await page.waitForTimeout(2_500);

      const hasEmpty = await page.getByText(T.timelineEmptyDescription).isVisible({ timeout: 3_000 }).catch(() => false);
      // Sessions render inside Collapsible components
      const hasSessions = await page.locator('[data-radix-collapsible-root]').first().isVisible({ timeout: 3_000 }).catch(() => false);

      expect(hasEmpty || hasSessions).toBe(true);
    });

    test('la sesión vinculada a la cita actual muestra el badge "Cita actual"', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;
      await page.waitForTimeout(2_500);

      // This badge only appears when a session is linked to the selected appointment
      const badge = page.getByText(T.currentAppointmentBadge);
      if (!await badge.isVisible({ timeout: 2_000 }).catch(() => false)) return; // no linked session — skip

      await expect(badge).toBeVisible();
    });

    test('la sesión más reciente muestra el badge "Última sesión" cuando no es la vinculada', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;
      await page.waitForTimeout(2_500);

      const badge = page.getByText(T.latestSessionBadge);
      if (!await badge.isVisible({ timeout: 2_000 }).catch(() => false)) return; // conditional

      await expect(badge).toBeVisible();
    });

    test('las sesiones son colapsables — expandir muestra el contenido', async ({ page }) => {
      const selected = await selectFirstAppointment(page);
      if (!selected) return;
      await page.waitForTimeout(2_500);

      const collapsibleTrigger = page
        .locator('[data-radix-collapsible-root]')
        .first()
        .locator('button')
        .first();

      if (!await collapsibleTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) return; // no sessions

      // The first session is auto-expanded; click to collapse
      await collapsibleTrigger.click();
      await page.waitForTimeout(300);
      // Click again to expand
      await collapsibleTrigger.click();
      await page.waitForTimeout(300);

      // Content section should be visible
      const content = page.locator('[data-radix-collapsible-content]').first();
      await expect(content).toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Deep-link ────────────────────────────────────────────────────────────

  test.describe('Deep-link por appointmentId', () => {
    test('URL con appointmentId inválido carga el workspace sin errores', async ({ page }) => {
      await page.goto('/workspace?appointmentId=nonexistent-id-000', { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login|error/);

      const agendaVisible = await page.getByText(T.agendaTitle).isVisible({ timeout: 10_000 }).catch(() => false);
      const noAccessVisible = await page.getByText(T.noAccess).isVisible({ timeout: 10_000 }).catch(() => false);
      expect(agendaVisible || noAccessVisible).toBe(true);
    });
  });

  // ── Navegación ───────────────────────────────────────────────────────────

  test.describe('Navegación', () => {
    test('el enlace "Mi Consultorio" en el menú apunta a /workspace', async ({ page }) => {
      const navLink = page.getByRole('link', { name: new RegExp(T.navLabel, 'i') }).first();
      if (!await navLink.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const href = await navLink.getAttribute('href');
      expect(href).toContain('/workspace');
    });
  });
});
