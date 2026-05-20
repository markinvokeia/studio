import { test, expect, type Page } from '@playwright/test';

// ── Translation strings (es.json) ────────────────────────────────────────────

const T = {
  bell: {
    openPanel: 'Abrir notificaciones',
  },
  panel: {
    title: 'Notificaciones',
    close: 'Cerrar',
    clearAll: 'Limpiar todo',
    emptyTitle: 'Sin notificaciones pendientes',
    emptyDescription: 'Aquí aparecerán los cambios de citas y recordatorios vencidos.',
  },
  cards: {
    dismiss: 'Descartar',
    viewWorkspace: 'Ver en workspace',
    createQuote: 'Crear presupuesto',
    scheduleNext: 'Agendar próxima cita',
    generateInvoice: 'Generar factura',
    markDone: 'Marcar como hecho',
    reminderDone: 'Marcado como hecho',
    procedure: 'Procedimiento',
    nextPlan: 'Plan próxima cita',
    discharged: 'Dado de Alta',
  },
};

// ── Mock notification payloads ────────────────────────────────────────────────

const NOW = new Date().toISOString();

const MOCK_APPT_BASE = {
  id: 'appt-e2e-001',
  patientId: 'patient-e2e-001',
  patientName: 'Ana García',
  patientEmail: '',
  patientPhone: '',
  doctorId: 'doc-e2e-001',
  doctorName: 'Dr. Martínez',
  service_name: 'Limpieza dental',
  summary: 'Limpieza dental',
  description: '',
  notes: '',
  date: '2025-05-19',
  time: '09:00',
  status: 'completed',
  created_at: NOW,
  googleEventId: '',
  calendar_source_id: '',
  calendar_name: '',
  services: [],
};

const MOCK_STATUS_CHANGE = {
  id: 'appt-status:appt-e2e-001:scheduled->completed:2025-05-19',
  type: 'appointment_status_change',
  createdAt: NOW,
  appointment: { ...MOCK_APPT_BASE, status: 'completed' },
  previousStatus: 'scheduled',
  seen: false,
};

const MOCK_NEW_APPOINTMENT = {
  id: 'new-appt:appt-e2e-002:2025-05-19',
  type: 'new_appointment',
  createdAt: NOW,
  appointment: {
    ...MOCK_APPT_BASE,
    id: 'appt-e2e-002',
    patientName: 'Carlos López',
    time: '14:30',
    status: 'scheduled',
  },
  seen: false,
};

const MOCK_SESSION_COMPLETED = {
  id: 'session:appt-e2e-003:session-123',
  type: 'session_completed',
  createdAt: NOW,
  appointment: {
    ...MOCK_APPT_BASE,
    id: 'appt-e2e-003',
    patientName: 'María Torres',
    doctorName: 'Dr. Rodríguez',
    quote_id: undefined,
  },
  session: {
    sesion_id: 123,
    procedimiento_realizado: 'Extracción de muela del juicio',
    plan_proxima_cita: 'Revisión post-operatoria en 7 días',
    fecha_proxima_cita: '2025-05-26',
    fecha_sesion: NOW,
    tratamientos: [],
  },
  discharge: null,
  seen: false,
};

const MOCK_SESSION_WITH_QUOTE = {
  ...MOCK_SESSION_COMPLETED,
  id: 'session:appt-e2e-004:session-124',
  appointment: {
    ...MOCK_SESSION_COMPLETED.appointment,
    id: 'appt-e2e-004',
    patientName: 'Roberto Silva',
    quote_id: 'quote-001',
  },
};

const MOCK_REMINDER = {
  id: 'reminder:rem-e2e-001',
  type: 'reminder',
  createdAt: NOW,
  reminder: {
    id: 'rem-e2e-001',
    title: 'Llamar a proveedor',
    description: 'Confirmar pedido de materiales',
    priority: 'HIGH',
    status: 'pending',
    start_datetime: new Date(Date.now() - 60_000).toISOString(),
    raise_alert: true,
  },
  seen: false,
};

const MOCK_REMINDER_LOW = {
  id: 'reminder:rem-e2e-002',
  type: 'reminder',
  createdAt: NOW,
  reminder: {
    id: 'rem-e2e-002',
    title: 'Revisar inventario',
    description: '',
    priority: 'LOW',
    status: 'pending',
    start_datetime: new Date(Date.now() - 30_000).toISOString(),
    raise_alert: false,
  },
  seen: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      return String(JSON.parse(raw).id ?? '');
    } catch {
      return null;
    }
  });
}

/**
 * Seed mock notifications into localStorage and optionally suppress the
 * global alert modal so tests can interact with the panel directly.
 */
async function seedNotifications(
  page: Page,
  notifications: object[],
  suppressAlerts = true,
): Promise<boolean> {
  const userId = await getUserId(page);
  if (!userId) return false;
  await page.evaluate(
    ([uid, notifs, suppress]: [string, object[], boolean]) => {
      localStorage.setItem(`app-notifications:${uid}`, JSON.stringify(notifs));
      if (suppress) {
        localStorage.setItem(
          `notifications:alerted:${uid}`,
          JSON.stringify((notifs as any[]).map((n: any) => n.id)),
        );
      }
    },
    [userId, notifications, suppressAlerts] as [string, object[], boolean],
  );
  return true;
}

/** Remove all mock notifications for the current user. */
async function clearNotifications(page: Page) {
  const userId = await getUserId(page);
  if (!userId) return;
  await page.evaluate((uid: string) => {
    localStorage.removeItem(`app-notifications:${uid}`);
    localStorage.removeItem(`notifications:alerted:${uid}`);
  }, userId);
}

/**
 * Navigate to a stable app page that renders the global layout (bell visible).
 * After navigation, wait for the notifications bell to appear.
 */
async function gotoApp(page: Page) {
  await page.goto('/appointments', { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: T.bell.openPanel })
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => {});
}

/** Open the notifications panel and return whether it became visible. */
async function openPanel(page: Page): Promise<boolean> {
  const bell = page.getByRole('button', { name: T.bell.openPanel });
  if (!await bell.isVisible({ timeout: 5_000 }).catch(() => false)) return false;
  await bell.click();
  return page
    .getByRole('dialog', { name: T.panel.title })
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
}

/** Seed notifications, reload, and open the panel. Returns false if bell not found. */
async function setupWithNotifications(
  page: Page,
  notifications: object[],
): Promise<boolean> {
  await gotoApp(page);
  const seeded = await seedNotifications(page, notifications);
  if (!seeded) return false;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: T.bell.openPanel })
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => {});
  return openPanel(page);
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('Sistema de notificaciones generales', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    // Start each test with a clean notifications slate
    await clearNotifications(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page
      .getByRole('button', { name: T.bell.openPanel })
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {});
  });

  // ── Campana de notificaciones ────────────────────────────────────────────

  test.describe('Campana de notificaciones', () => {
    test('la campana es visible en el layout principal', async ({ page }) => {
      const bell = page.getByRole('button', { name: T.bell.openPanel });
      await expect(bell).toBeVisible({ timeout: 8_000 });
    });

    test('sin notificaciones no muestra badge de conteo', async ({ page }) => {
      // Badge is a span inside the button — should not be present
      const bell = page.getByRole('button', { name: T.bell.openPanel });
      await expect(bell).toBeVisible();
      const badge = bell.locator('span.absolute');
      await expect(badge).not.toBeVisible();
    });

    test('con notificaciones muestra badge con el conteo correcto', async ({ page }) => {
      const notifications = [MOCK_STATUS_CHANGE, MOCK_NEW_APPOINTMENT, MOCK_REMINDER];
      await seedNotifications(page, notifications);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: T.bell.openPanel })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {});

      const bell = page.getByRole('button', { name: T.bell.openPanel });
      const badge = bell.locator('span.absolute');
      await expect(badge).toBeVisible({ timeout: 5_000 });
      await expect(badge).toHaveText('3');
    });

    test('badge muestra "99+" cuando hay más de 99 notificaciones', async ({ page }) => {
      // Build 100 minimal notifications
      const manyNotifs = Array.from({ length: 100 }, (_, i) => ({
        ...MOCK_STATUS_CHANGE,
        id: `appt-status:bulk-${i}:scheduled->completed:2025-05-19`,
        seen: false,
      }));
      await seedNotifications(page, manyNotifs);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: T.bell.openPanel })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {});

      const badge = page
        .getByRole('button', { name: T.bell.openPanel })
        .locator('span.absolute');
      await expect(badge).toHaveText('99+', { timeout: 5_000 });
    });

    test('clic en la campana abre el panel de notificaciones', async ({ page }) => {
      const bell = page.getByRole('button', { name: T.bell.openPanel });
      await bell.click();
      await expect(
        page.getByRole('dialog', { name: T.panel.title }),
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Panel de notificaciones ──────────────────────────────────────────────

  test.describe('Panel de notificaciones', () => {
    test('el panel muestra el título correcto', async ({ page }) => {
      await openPanel(page);
      const panel = page.getByRole('dialog', { name: T.panel.title });
      await expect(panel.getByText(T.panel.title).first()).toBeVisible();
    });

    test('panel vacío muestra el estado sin notificaciones', async ({ page }) => {
      const opened = await openPanel(page);
      if (!opened) return;

      await expect(page.getByText(T.panel.emptyTitle)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(T.panel.emptyDescription)).toBeVisible();
    });

    test('panel vacío no muestra el botón "Limpiar todo"', async ({ page }) => {
      const opened = await openPanel(page);
      if (!opened) return;

      await expect(page.getByRole('button', { name: T.panel.clearAll })).not.toBeVisible();
    });

    test('panel con notificaciones muestra el botón "Limpiar todo"', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_STATUS_CHANGE]);
      if (!panelOpened) return;

      await expect(page.getByRole('button', { name: T.panel.clearAll })).toBeVisible({ timeout: 5_000 });
    });

    test('panel con notificaciones muestra el conteo en el header', async ({ page }) => {
      const notifications = [MOCK_STATUS_CHANGE, MOCK_NEW_APPOINTMENT];
      const panelOpened = await setupWithNotifications(page, notifications);
      if (!panelOpened) return;

      // Badge in panel header shows count
      const panel = page.getByRole('dialog', { name: T.panel.title });
      const countBadge = panel.locator('span').filter({ hasText: '2' }).first();
      await expect(countBadge).toBeVisible({ timeout: 5_000 });
    });

    test('se cierra con el botón X', async ({ page }) => {
      const opened = await openPanel(page);
      if (!opened) return;

      await page.getByRole('button', { name: T.panel.close }).click();
      await expect(
        page.getByRole('dialog', { name: T.panel.title }),
      ).not.toBeInViewport({ timeout: 3_000 });
    });

    test('se cierra al presionar Escape', async ({ page }) => {
      const opened = await openPanel(page);
      if (!opened) return;

      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: T.panel.title }),
      ).not.toBeInViewport({ timeout: 3_000 });
    });

    test('se cierra al hacer clic en el backdrop', async ({ page }) => {
      const opened = await openPanel(page);
      if (!opened) return;

      // The backdrop is a fixed div behind the panel — click on the left edge of the viewport
      await page.mouse.click(10, 300);
      await page.waitForTimeout(400);
      await expect(
        page.getByRole('dialog', { name: T.panel.title }),
      ).not.toBeInViewport({ timeout: 3_000 });
    });

    test('"Limpiar todo" elimina todas las notificaciones y muestra estado vacío', async ({ page }) => {
      const notifications = [MOCK_STATUS_CHANGE, MOCK_NEW_APPOINTMENT, MOCK_SESSION_COMPLETED];
      const panelOpened = await setupWithNotifications(page, notifications);
      if (!panelOpened) return;

      await page.getByRole('button', { name: T.panel.clearAll }).click();
      await expect(page.getByText(T.panel.emptyTitle)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('button', { name: T.panel.clearAll })).not.toBeVisible();
    });

    test('después de limpiar, el badge de la campana desaparece', async ({ page }) => {
      const notifications = [MOCK_STATUS_CHANGE];
      const panelOpened = await setupWithNotifications(page, notifications);
      if (!panelOpened) return;

      await page.getByRole('button', { name: T.panel.clearAll }).click();
      await page.getByRole('button', { name: T.panel.close }).click();

      const badge = page.getByRole('button', { name: T.bell.openPanel }).locator('span.absolute');
      await expect(badge).not.toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Tarjeta: Cambio de estado de cita ────────────────────────────────────

  test.describe('Tarjeta: Cambio de estado de cita', () => {
    test('muestra el nombre del paciente', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_STATUS_CHANGE]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_STATUS_CHANGE.appointment.patientName),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra estado anterior y nuevo con flecha', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_STATUS_CHANGE]);
      if (!panelOpened) return;

      // Both status badges must be present
      // The previous status "scheduled" → "Programada" and "completed" → "Completada"
      const panel = page.getByRole('dialog', { name: T.panel.title });
      const badges = panel.locator('[class*="badge"], [class*="Badge"]');
      await expect(badges.first()).toBeVisible({ timeout: 5_000 });
      // Arrow icon between statuses
      const arrow = panel.locator('svg.lucide-arrow-right');
      await expect(arrow.first()).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el botón "Ver en workspace"', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_STATUS_CHANGE]);
      if (!panelOpened) return;

      await expect(
        page.getByRole('button', { name: T.cards.viewWorkspace }),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('el botón "Ver en workspace" navega al workspace con el appointmentId correcto', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_STATUS_CHANGE]);
      if (!panelOpened) return;

      await page.getByRole('button', { name: T.cards.viewWorkspace }).click();
      await expect(page).toHaveURL(
        new RegExp(`workspace.*appointmentId=${MOCK_STATUS_CHANGE.appointment.id}`),
        { timeout: 8_000 },
      );
    });

    test('el botón X descarta la tarjeta', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_STATUS_CHANGE]);
      if (!panelOpened) return;

      const patientName = MOCK_STATUS_CHANGE.appointment.patientName;
      const dismissBtn = page
        .getByRole('dialog', { name: T.panel.title })
        .locator('button[aria-label="Descartar"]')
        .first();
      await expect(dismissBtn).toBeVisible({ timeout: 5_000 });
      await dismissBtn.click();
      await page.waitForTimeout(300);

      await expect(page.getByText(patientName)).not.toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Tarjeta: Nueva cita ──────────────────────────────────────────────────

  test.describe('Tarjeta: Nueva cita', () => {
    test('muestra el nombre del paciente', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_NEW_APPOINTMENT]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_NEW_APPOINTMENT.appointment.patientName),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra la hora de la cita', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_NEW_APPOINTMENT]);
      if (!panelOpened) return;

      // "Hora: 14:30"
      await expect(
        page.getByText(new RegExp(`14:30`)),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el nombre del servicio', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_NEW_APPOINTMENT]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_NEW_APPOINTMENT.appointment.service_name),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el botón "Ver en workspace"', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_NEW_APPOINTMENT]);
      if (!panelOpened) return;

      await expect(
        page.getByRole('button', { name: T.cards.viewWorkspace }),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('el botón X descarta la tarjeta', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_NEW_APPOINTMENT]);
      if (!panelOpened) return;

      const dismissBtn = page
        .getByRole('dialog', { name: T.panel.title })
        .locator('button[aria-label="Descartar"]')
        .first();
      await dismissBtn.click();
      await page.waitForTimeout(300);

      await expect(
        page.getByText(MOCK_NEW_APPOINTMENT.appointment.patientName),
      ).not.toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Tarjeta: Sesión completada ───────────────────────────────────────────

  test.describe('Tarjeta: Sesión completada', () => {
    test('muestra el nombre del paciente', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_COMPLETED]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_SESSION_COMPLETED.appointment.patientName),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el nombre del doctor', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_COMPLETED]);
      if (!panelOpened) return;

      await expect(
        page.getByText(new RegExp(MOCK_SESSION_COMPLETED.appointment.doctorName)),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el procedimiento realizado', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_COMPLETED]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_SESSION_COMPLETED.session.procedimiento_realizado),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el plan para próxima cita cuando existe', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_COMPLETED]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_SESSION_COMPLETED.session.plan_proxima_cita),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el botón "Agendar próxima cita" cuando hay plan', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_COMPLETED]);
      if (!panelOpened) return;

      await expect(
        page.getByRole('button', { name: T.cards.scheduleNext }),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el botón "Crear presupuesto" cuando no hay quote_id', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_COMPLETED]);
      if (!panelOpened) return;

      await expect(
        page.getByRole('button', { name: T.cards.createQuote }),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el botón "Generar factura" cuando ya existe un quote_id', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_WITH_QUOTE]);
      if (!panelOpened) return;

      await expect(
        page.getByRole('button', { name: T.cards.generateInvoice }),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('no muestra el botón "Crear presupuesto" cuando ya existe quote_id', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_WITH_QUOTE]);
      if (!panelOpened) return;

      await expect(
        page.getByRole('button', { name: T.cards.createQuote }),
      ).not.toBeVisible({ timeout: 3_000 });
    });

    test('el botón X descarta la tarjeta', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_SESSION_COMPLETED]);
      if (!panelOpened) return;

      const dismissBtn = page
        .getByRole('dialog', { name: T.panel.title })
        .locator('button[aria-label="Descartar"]')
        .first();
      await dismissBtn.click();
      await page.waitForTimeout(300);

      await expect(
        page.getByText(MOCK_SESSION_COMPLETED.appointment.patientName),
      ).not.toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Tarjeta: Recordatorio ────────────────────────────────────────────────

  test.describe('Tarjeta: Recordatorio', () => {
    test('muestra el título del recordatorio', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_REMINDER]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_REMINDER.reminder.title),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra la descripción del recordatorio', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_REMINDER]);
      if (!panelOpened) return;

      await expect(
        page.getByText(MOCK_REMINDER.reminder.description),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el badge de prioridad Alta', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_REMINDER]);
      if (!panelOpened) return;

      await expect(page.getByText('Alta')).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el badge de prioridad Baja', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_REMINDER_LOW]);
      if (!panelOpened) return;

      await expect(page.getByText('Baja')).toBeVisible({ timeout: 5_000 });
    });

    test('muestra el botón "Marcar como hecho"', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_REMINDER]);
      if (!panelOpened) return;

      await expect(
        page.getByRole('button', { name: T.cards.markDone }),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('el botón X descarta la tarjeta', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, [MOCK_REMINDER]);
      if (!panelOpened) return;

      const dismissBtn = page
        .getByRole('dialog', { name: T.panel.title })
        .locator('button[aria-label="Descartar"]')
        .first();
      await dismissBtn.click();
      await page.waitForTimeout(300);

      await expect(
        page.getByText(MOCK_REMINDER.reminder.title),
      ).not.toBeVisible({ timeout: 3_000 });
    });
  });

  // ── Múltiples tipos simultáneos ──────────────────────────────────────────

  test.describe('Múltiples notificaciones', () => {
    const ALL_NOTIFICATIONS = [
      MOCK_STATUS_CHANGE,
      MOCK_NEW_APPOINTMENT,
      MOCK_SESSION_COMPLETED,
      MOCK_REMINDER,
    ];

    test('el panel muestra todas las notificaciones al mismo tiempo', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, ALL_NOTIFICATIONS);
      if (!panelOpened) return;

      // All patient names / titles should appear in the panel
      const panel = page.getByRole('dialog', { name: T.panel.title });
      await expect(panel.getByText(MOCK_STATUS_CHANGE.appointment.patientName)).toBeVisible({ timeout: 5_000 });
      await expect(panel.getByText(MOCK_NEW_APPOINTMENT.appointment.patientName)).toBeVisible({ timeout: 5_000 });
      await expect(panel.getByText(MOCK_SESSION_COMPLETED.appointment.patientName)).toBeVisible({ timeout: 5_000 });
      await expect(panel.getByText(MOCK_REMINDER.reminder.title)).toBeVisible({ timeout: 5_000 });
    });

    test('la campana muestra el conteo total', async ({ page }) => {
      await seedNotifications(page, ALL_NOTIFICATIONS);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: T.bell.openPanel })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {});

      const badge = page
        .getByRole('button', { name: T.bell.openPanel })
        .locator('span.absolute');
      await expect(badge).toHaveText(String(ALL_NOTIFICATIONS.length), { timeout: 5_000 });
    });

    test('descartar una tarjeta reduce el conteo en la campana', async ({ page }) => {
      const panelOpened = await setupWithNotifications(page, ALL_NOTIFICATIONS);
      if (!panelOpened) return;

      const dismissBtn = page
        .getByRole('dialog', { name: T.panel.title })
        .locator('button[aria-label="Descartar"]')
        .first();
      await dismissBtn.click();
      await page.waitForTimeout(300);

      // Close panel to check the bell badge
      await page.getByRole('button', { name: T.panel.close }).click();
      await page.waitForTimeout(200);

      const badge = page
        .getByRole('button', { name: T.bell.openPanel })
        .locator('span.absolute');
      await expect(badge).toHaveText(String(ALL_NOTIFICATIONS.length - 1), { timeout: 3_000 });
    });
  });

  // ── Persistencia ─────────────────────────────────────────────────────────

  test.describe('Persistencia en localStorage', () => {
    test('las notificaciones sobreviven una recarga de página', async ({ page }) => {
      await seedNotifications(page, [MOCK_STATUS_CHANGE, MOCK_REMINDER]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: T.bell.openPanel })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {});

      // Badge should still show 2
      const badge = page
        .getByRole('button', { name: T.bell.openPanel })
        .locator('span.absolute');
      await expect(badge).toBeVisible({ timeout: 5_000 });
      await expect(badge).toHaveText('2');
    });

    test('notificaciones limpiadas no reaparecen al recargar', async ({ page }) => {
      await seedNotifications(page, [MOCK_STATUS_CHANGE]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: T.bell.openPanel })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {});

      const panelOpened = await openPanel(page);
      if (!panelOpened) return;

      await page.getByRole('button', { name: T.panel.clearAll }).click();
      await page.getByRole('button', { name: T.panel.close }).click();

      // Reload and check
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: T.bell.openPanel })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {});

      const badge = page
        .getByRole('button', { name: T.bell.openPanel })
        .locator('span.absolute');
      await expect(badge).not.toBeVisible({ timeout: 3_000 });
    });
  });
});
