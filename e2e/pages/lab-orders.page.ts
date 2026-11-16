import { type Locator, type Page, expect } from '@playwright/test';

import { BasePage } from './base.page';

export type WizardStep = 'patient' | 'work' | 'laboratory' | 'review';

const STEP_LABEL: Record<WizardStep, RegExp> = {
  patient: /Paciente/,
  work: /Trabajo/,
  laboratory: /Laboratorio/,
  review: /Revisar/,
};

/** 'dd/MM/yyyy' de hoy + n días (lo que escribe una persona en DatePickerInput). */
export function displayDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Órdenes de laboratorio (/lab-orders): la lista, el panel de detalle y el wizard
 * de alta/edición (Paciente → Trabajo → Laboratorio → Revisar).
 */
export class LabOrdersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Navegación ───────────────────────────────────────────────────────────

  async open(orderId?: number) {
    await this.page.goto(orderId ? `/lab-orders?order=${orderId}` : '/lab-orders');
    await expect(this.page.locator('[data-help-id="lab-orders.btn.new"]')).toBeVisible({ timeout: 30_000 });
  }

  // ── Wizard ───────────────────────────────────────────────────────────────

  get dialog(): Locator {
    return this.page.getByRole('dialog').filter({ has: this.page.locator('[data-help-id="lab-orders.section.wizard-steps"]') });
  }

  helpId(id: string): Locator {
    return this.dialog.locator(`[data-help-id="${id}"]`);
  }

  field(name: string): Locator {
    return this.dialog.locator(`[data-help-item="lab-orders.field.${name}"]`);
  }

  get currentStep(): Locator {
    return this.dialog.locator('button[aria-current="step"]');
  }

  get nextButton(): Locator {
    return this.helpId('lab-orders.btn.step-next');
  }

  get submitButton(): Locator {
    return this.dialog.locator('button[type="submit"]');
  }

  get summary(): Locator {
    return this.helpId('lab-orders.section.wizard-summary');
  }

  get review(): Locator {
    return this.helpId('lab-orders.section.review');
  }

  async openNew() {
    await this.page.locator('[data-help-id="lab-orders.btn.new"]').click();
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
    await this.expectStep('patient');
  }

  async expectStep(step: WizardStep) {
    await expect(this.currentStep).toHaveAttribute('data-help-id', `lab-orders.btn.step-${step}`, { timeout: 10_000 });
    await expect(this.currentStep).toContainText(STEP_LABEL[step]);
  }

  async clickStep(step: WizardStep) {
    await this.helpId(`lab-orders.btn.step-${step}`).click();
  }

  async continue() {
    await this.nextButton.click();
  }

  async back() {
    await this.dialog.getByRole('button', { name: /^Atrás$/ }).click();
  }

  /** Popover cmdk: abre el trigger, escribe y elige la opción que contiene el texto. */
  private async pickFromCombobox(trigger: Locator, search: string, option: string | RegExp = search) {
    await trigger.click();
    const input = this.page.locator('[cmdk-input]').last();
    await input.fill(search);
    const opt = this.page.getByRole('option').filter({ hasText: option }).first();
    await expect(opt).toBeVisible({ timeout: 15_000 });
    await opt.click();
  }

  async selectPatient(name: string) {
    await this.pickFromCombobox(this.field('patient_id').getByRole('combobox'), name);
    await expect(this.field('patient_id').getByRole('combobox')).toContainText(name);
  }

  async addService(name: string) {
    await this.pickFromCombobox(this.helpId('lab-orders.btn.add-service').getByRole('combobox'), name);
    await expect(this.helpId('lab-orders.section.services')).toContainText(name);
  }

  /** Primera tarjeta de laboratorio sugerido; devuelve su nombre. */
  async pickFirstSuggestedLab(): Promise<string> {
    const card = this.helpId('lab-orders.section.lab-suggestions').locator('button').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    const name = (await card.locator('span.font-medium').first().innerText()).trim();
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    return name;
  }

  async fillDate(fieldName: string, ddMMyyyy: string) {
    const input = this.field(fieldName).locator('input').first();
    await input.fill('');
    await input.pressSequentially(ddMMyyyy.replace(/\//g, ''));
    await input.blur();
  }

  async fillNotes(text: string) {
    await this.field('notes').locator('textarea').fill(text);
  }

  async chooseSend(send: boolean) {
    await this.dialog.locator(send ? '#lab-order-send-send' : '#lab-order-send-keep').click();
  }

  /** Cierra el wizard sin guardar (con la confirmación de "descartar" si aparece). */
  async discard() {
    await this.dialog.getByRole('button', { name: /^Cancelar$/ }).click();
    const confirm = this.page.getByRole('alertdialog');
    if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirm.getByRole('button').filter({ hasNotText: /^(Cancelar|Seguir editando|Volver)$/i }).last().click();
    }
    await expect(this.dialog).toBeHidden({ timeout: 10_000 });
  }

  // ── Detalle ──────────────────────────────────────────────────────────────

  get detail(): Locator {
    return this.page.locator('[data-help-id="lab-orders.section.detail"]').locator('xpath=..');
  }

  /** Espera el detalle de la orden y devuelve su id (del subtítulo "#123 · …"). */
  async detailOrderId(): Promise<number> {
    const subtitle = this.page.locator('[data-help-id="lab-orders.section.detail"]').getByText(/^#\d+/).first();
    await expect(subtitle).toBeVisible({ timeout: 20_000 });
    const match = (await subtitle.innerText()).match(/#(\d+)/);
    if (!match) throw new Error('No se encontró el id de la orden en el detalle');
    return Number(match[1]);
  }

  get detailStage(): Locator {
    return this.page.locator('[data-help-id="lab-orders.section.detail-stage"]');
  }

  async openEditFromDetail() {
    await this.page.locator('[data-help-id="lab-orders.section.detail"] [data-help-id="lab-orders.btn.edit"]').click();
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
  }

  /** Elimina la orden abierta en el detalle (botón Eliminar + confirmar). */
  async deleteFromDetail() {
    await this.page.locator('[data-help-id="lab-orders.section.detail"] [data-help-id="lab-orders.btn.delete"]').click();
    const confirm = this.page.getByRole('alertdialog');
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    await confirm.getByRole('button', { name: /^Eliminar$/ }).click();
    await expect(this.page.getByText('Orden eliminada').first()).toBeVisible({ timeout: 20_000 });
  }
}
