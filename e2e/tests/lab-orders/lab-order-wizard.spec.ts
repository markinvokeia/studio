import { type Page, type Request } from '@playwright/test';

import { test, expect } from '../../fixtures/test.fixture';
import { LabOrdersPage, displayDate } from '../../pages/lab-orders.page';

/**
 * Flujo guiado de alta y edición de órdenes de laboratorio (Paciente → Trabajo →
 * Laboratorio → Revisar) contra el backend real de DEV.
 *
 *   pnpm exec playwright test e2e/tests/lab-orders/lab-order-wizard.spec.ts --project=chromium
 *
 * Crea órdenes solo por la UI, con un marcador único en las notas, y en afterAll
 * las elimina por la UI (botón Eliminar del detalle) aunque algún caso falle.
 * Paciente de prueba: no hay "Paciente E2E" en DEV, se usa el paciente demo
 * "Carlos Andrada" (override con E2E_LAB_PATIENT).
 */

const PATIENT = process.env.E2E_LAB_PATIENT ?? 'Carlos Andrada';
const SERVICE = process.env.E2E_LAB_SERVICE ?? 'Corona de zirconio';
const SEND_STAGE = /Enviado al laboratorio/;
const INITIAL_STAGE = /Solicitud creada/;
const STAMP = `E2E wizard ${Date.now()}`;

/** Ids de las órdenes creadas por este spec (se eliminan en afterAll). */
const createdIds: number[] = [];

/** Cuenta los POST de guardado (alta/edición) y de cambio de etapa. */
function trackLabWrites(page: Page) {
  const saves: string[] = [];
  const stageChanges: string[] = [];
  const onRequest = (r: Request) => {
    if (r.method() !== 'POST') return;
    if (/\/lab-orders\/save(\?|$)/.test(r.url())) saves.push(r.url());
    if (/\/lab-orders\/change-stage(\?|$)/.test(r.url())) stageChanges.push(r.url());
  };
  page.on('request', onRequest);
  return { saves, stageChanges, stop: () => page.off('request', onRequest) };
}

/** Errores de consola (para documentar bugs si aparecen). */
function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test.describe('Órdenes de laboratorio — wizard de alta y edición', () => {
  // Serie y sin reintentos: un reintento volvería a crear órdenes.
  test.describe.configure({ mode: 'serial', retries: 0 });
  test.setTimeout(150_000);

  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsole(page);
  });

  test.afterEach(async ({}, testInfo) => {
    if (consoleErrors.length) {
      await testInfo.attach('console-errors', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    if (!createdIds.length) return;
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
      baseURL: testInfo.project.use.baseURL,
      locale: 'es',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const lab = new LabOrdersPage(page);
    const result: string[] = [];
    for (const id of [...createdIds]) {
      try {
        await lab.open(id);
        expect(await lab.detailOrderId()).toBe(id);
        await lab.deleteFromDetail();
        result.push(`#${id} eliminada`);
      } catch (error) {
        result.push(`#${id} NO eliminada: ${(error as Error).message.split('\n')[0]}`);
      }
    }
    console.log(`[lab-order-wizard] limpieza: ${result.join(' · ')}`);
    await context.close();
  });

  test('pasos: validación, volver atrás, resumen y "Enviarla ahora" sin guardar', async ({ page }) => {
    const lab = new LabOrdersPage(page);
    const writes = trackLabWrites(page);
    await lab.open();
    await lab.openNew();

    // Paciente vacío: Continuar no avanza y marca el error.
    await lab.continue();
    await lab.expectStep('patient');
    await expect(lab.field('patient_id')).toContainText(/(Elegí|Elige) el paciente\./);
    // El stepper tampoco deja saltar hacia adelante.
    await lab.clickStep('review');
    await lab.expectStep('patient');

    await lab.selectPatient(PATIENT);
    await expect(lab.summary).toContainText(PATIENT);
    await lab.continue();
    await lab.expectStep('work');

    // Trabajo sin servicio ni descripción: no avanza.
    await lab.continue();
    await lab.expectStep('work');
    await expect(lab.field('work_description')).toContainText(/(Agregá|Añade) al menos un servicio o describ(í|e) el trabajo\./);

    // Con la descripción, Continuar avanza (Enter se cubre en su propio caso, abajo).
    await lab.field('work_description').locator('input').fill(`Trabajo ${STAMP}`);
    await lab.continue();
    await lab.expectStep('laboratory');

    // Volver a pasos anteriores: con "Atrás" y con el stepper.
    await lab.back();
    await lab.expectStep('work');
    await lab.clickStep('patient');
    await lab.expectStep('patient');
    await lab.clickStep('work');
    await lab.expectStep('work');

    // Agregar un servicio con piezas: el resumen lo refleja.
    await lab.addService(SERVICE);
    await page.locator('input[name="items.0.teeth"]').fill('11, 21');
    await expect(lab.summary).toContainText(SERVICE);
    await expect(lab.summary).toContainText('Piezas 11, 21');
    await expect(lab.summary).toContainText(PATIENT);
    await lab.continue();
    await lab.expectStep('laboratory');

    // "Decidir el laboratorio después" salta a Revisar.
    await lab.helpId('lab-orders.btn.lab-later').click();
    await lab.expectStep('review');
    await expect(lab.review).toContainText('Se elige al enviarla');
    await expect(lab.review).toContainText(SERVICE);
    await expect(lab.submitButton).toHaveText(/Crear orden/);

    // Bug corregido: Continuar en Laboratorio NO guarda.
    await lab.clickStep('laboratory');
    await lab.expectStep('laboratory');
    await lab.continue();
    await lab.expectStep('review');
    expect(writes.saves, 'Continuar en el paso Laboratorio no guarda la orden').toHaveLength(0);

    // "Enviarla ahora" exige laboratorio y fecha de entrega.
    await lab.chooseSend(true);
    await expect(lab.submitButton).toHaveText(/Crear y enviar/);
    await expect(lab.dialog).toContainText('Para enviarla falta elegir el laboratorio.');
    await expect(lab.dialog).toContainText(/Falta: .*el laboratorio para enviarla.*la fecha de entrega/);
    await lab.submitButton.click();
    await lab.expectStep('review');
    await expect(lab.field('send_due_date')).toContainText(/Indic(á|a) la fecha de entrega\./);
    expect(writes.saves, 'sin laboratorio/fecha no se guarda').toHaveLength(0);

    // Elegir laboratorio y volver a Revisar.
    await lab.dialog.getByRole('button', { name: 'Elegir laboratorio' }).click();
    await lab.expectStep('laboratory');
    const labName = await lab.pickFirstSuggestedLab();
    await expect(lab.summary).toContainText(labName);
    await lab.continue();
    await lab.expectStep('review');
    await expect(lab.review).toContainText(labName);

    // Fecha anterior a hoy: no se acepta.
    await lab.fillDate('send_due_date', displayDate(-1));
    await lab.submitButton.click();
    await expect(lab.field('send_due_date')).toContainText('La fecha de entrega no puede ser anterior a hoy.');
    await lab.expectStep('review');
    await page.waitForTimeout(500);
    expect(writes.saves, 'con fecha pasada no se guarda').toHaveLength(0);
    expect(writes.stageChanges).toHaveLength(0);

    await lab.discard();
    await page.waitForTimeout(500);
    expect(writes.saves, 'cerrar sin guardar no escribe').toHaveLength(0);
    writes.stop();
  });

  test('Enter en un campo de un paso intermedio avanza y no guarda', async ({ page }) => {
    // El paso Trabajo no tiene botón submit y tiene 2+ inputs (descripción + piezas): sin el
    // onKeyDown del formulario, Enter no hacía nada (no hay "implicit submission").
    const lab = new LabOrdersPage(page);
    const writes = trackLabWrites(page);
    await lab.open();
    await lab.openNew();
    await lab.selectPatient(PATIENT);
    await lab.continue();
    await lab.expectStep('work');

    const description = lab.field('work_description').locator('input');
    await description.fill(`Trabajo ${STAMP}`);
    await description.press('Enter');
    await page.waitForTimeout(800);
    expect(writes.saves, 'Enter en un paso intermedio no guarda').toHaveLength(0);
    try {
      await expect(lab.currentStep).toHaveAttribute('data-help-id', 'lab-orders.btn.step-laboratory', { timeout: 3_000 });
    } finally {
      await lab.discard();
      expect(writes.saves).toHaveLength(0);
      writes.stop();
    }
  });

  test('crear y enviar: queda en la etapa siguiente con laboratorio y fecha de entrega', async ({ page }) => {
    const lab = new LabOrdersPage(page);
    const writes = trackLabWrites(page);
    const notes = `${STAMP} enviada`;
    const due = displayDate(7);
    await lab.open();
    await lab.openNew();

    await lab.selectPatient(PATIENT);
    await lab.continue();
    await lab.expectStep('work');
    await lab.addService(SERVICE);
    await page.locator('input[name="items.0.teeth"]').fill('11');
    await page.locator('input[name="items.0.notes"]').fill('Color A2');
    await lab.continue();
    await lab.expectStep('laboratory');
    const labName = await lab.pickFirstSuggestedLab();
    await expect(lab.summary).toContainText(labName);
    // El bug: Continuar en Laboratorio guardaba la orden sola.
    await lab.continue();
    await lab.expectStep('review');
    await page.waitForTimeout(800);
    expect(writes.saves, 'Continuar en Laboratorio no guarda').toHaveLength(0);

    await lab.chooseSend(true);
    await lab.fillDate('send_due_date', due);
    await lab.fillNotes(notes);
    await expect(lab.dialog).toContainText('Lista para crear y enviar');
    await expect(lab.submitButton).toHaveText(/Crear y enviar/);
    expect(writes.saves, 'nada se guarda antes del botón final').toHaveLength(0);

    const saveResponse = page.waitForResponse((r) => /\/lab-orders\/save/.test(r.url()) && r.request().method() === 'POST');
    const stageResponse = page.waitForResponse((r) => /\/lab-orders\/change-stage/.test(r.url()) && r.request().method() === 'POST');
    await lab.submitButton.click();
    expect((await saveResponse).ok()).toBeTruthy();
    expect((await stageResponse).ok()).toBeTruthy();
    await expect(lab.dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(/Orden #\d+ creada y enviada/).first()).toBeVisible({ timeout: 10_000 });

    const id = await lab.detailOrderId();
    createdIds.push(id);
    expect(writes.saves).toHaveLength(1);
    expect(writes.stageChanges).toHaveLength(1);

    // Detalle: etapa siguiente a la inicial, laboratorio, fecha y notas.
    await expect(lab.detailStage).toContainText(SEND_STAGE, { timeout: 15_000 });
    const panel = lab.detailStage.locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
    await expect(panel).toContainText(labName);
    await expect(panel).toContainText(due);
    await expect(panel).toContainText(notes);
    await expect(panel).toContainText(SERVICE);

    // Lista: la fila de la orden muestra la etapa enviada.
    await lab.open();
    await page.locator('[data-help-id="lab-orders.filter.search"]').fill(String(id));
    const row = page.locator('table tbody tr').filter({ hasText: `#${id}` });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(SEND_STAGE);
    await expect(row).toContainText(labName);
    await expect(row).toContainText(due);
    writes.stop();
  });

  test('crear sin enviar: queda en la etapa inicial sin fecha de entrega', async ({ page }) => {
    const lab = new LabOrdersPage(page);
    const writes = trackLabWrites(page);
    const notes = `${STAMP} sin enviar`;
    await lab.open();
    await lab.openNew();

    await lab.selectPatient(PATIENT);
    await lab.continue();
    await lab.field('work_description').locator('input').fill(`Placa ${STAMP}`);
    await lab.field('teeth').locator('input').fill('21');
    await lab.continue();
    await lab.expectStep('laboratory');
    await lab.helpId('lab-orders.btn.lab-later').click();
    await lab.expectStep('review');
    await expect(lab.dialog.locator('#lab-order-send-keep')).toHaveAttribute('data-state', 'checked');
    await lab.fillNotes(notes);
    await expect(lab.submitButton).toHaveText(/Crear orden/);
    expect(writes.saves).toHaveLength(0);

    const saveResponse = page.waitForResponse((r) => /\/lab-orders\/save/.test(r.url()) && r.request().method() === 'POST');
    await lab.submitButton.click();
    expect((await saveResponse).ok()).toBeTruthy();
    await expect(lab.dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(/Orden #\d+ creada$/).first()).toBeVisible({ timeout: 10_000 });

    const id = await lab.detailOrderId();
    createdIds.push(id);
    expect(writes.saves).toHaveLength(1);
    expect(writes.stageChanges, 'sin enviar no cambia la etapa').toHaveLength(0);

    await expect(lab.detailStage).toContainText(INITIAL_STAGE, { timeout: 15_000 });
    const dueValue = page.locator('dt', { hasText: 'Entrega estimada' }).locator('xpath=following-sibling::dd[1]');
    await expect(dueValue).toHaveText(/^—/);
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: notes })).toBeVisible();
    writes.stop();
  });

  test('editar: abre en Revisar, "Volver a revisar" no guarda y "Guardar cambios" guarda', async ({ page }) => {
    test.skip(createdIds.length === 0, 'no hay orden creada para editar');
    const id = createdIds[createdIds.length - 1];
    const lab = new LabOrdersPage(page);
    const writes = trackLabWrites(page);
    const editedNotes = `${STAMP} editada`;
    const editedWork = `Placa editada ${STAMP}`;
    await lab.open(id);
    expect(await lab.detailOrderId()).toBe(id);

    await lab.openEditFromDetail();
    await lab.expectStep('review');
    await expect(lab.submitButton).toHaveText(/Guardar cambios/);
    await expect(lab.dialog.locator('#lab-order-send-send')).toHaveCount(0);

    // "Editar" de la fila Trabajo lleva al paso; "Volver a revisar" regresa sin guardar.
    await lab.review.getByRole('button', { name: 'Editar' }).nth(1).click();
    await lab.expectStep('work');
    await expect(lab.nextButton).toHaveText(/Volver a revisar/);
    await lab.field('work_description').locator('input').fill(editedWork);
    await lab.nextButton.click();
    await lab.expectStep('review');
    await expect(lab.review).toContainText(editedWork);
    await page.waitForTimeout(800);
    expect(writes.saves, '"Volver a revisar" no guarda').toHaveLength(0);

    // "Editar" de la fila Paciente y Enter… vuelve a Revisar (en edición el destino es Revisar).
    await lab.review.getByRole('button', { name: 'Editar' }).nth(0).click();
    await lab.expectStep('patient');
    await expect(lab.nextButton).toHaveText(/Volver a revisar/);
    await lab.nextButton.click();
    await lab.expectStep('review');
    expect(writes.saves).toHaveLength(0);

    await lab.fillNotes(editedNotes);
    const saveResponse = page.waitForResponse((r) => /\/lab-orders\/save/.test(r.url()) && r.request().method() === 'POST');
    await lab.submitButton.click();
    expect((await saveResponse).ok()).toBeTruthy();
    await expect(lab.dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText('Orden guardada').first()).toBeVisible({ timeout: 10_000 });
    expect(writes.saves).toHaveLength(1);
    expect(writes.stageChanges).toHaveLength(0);

    // La nota aparece en la sección Notas (y además en el historial, como cambio de la edición).
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: editedNotes })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-help-id="lab-orders.section.detail-work"]')).toContainText(editedWork);
    await expect(lab.detailStage).toContainText(INITIAL_STAGE);
    writes.stop();
  });
});
