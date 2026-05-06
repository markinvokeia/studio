import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { randomEmail, randomDoc, randomPhone } from '../utils/helpers';

export class PatientsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/patients');
    await this.page.waitForSelector('table', { timeout: 15_000 });
  }

  async openCreateForm() {
    await this.page.getByRole('button', { name: /nuevo paciente|nuevo|crear|\+/i }).first().click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  async fillCreateForm(data: {
    name: string;
    email?: string;
    phone?: string;
    doc: string;
    birthDate?: string;
    notes?: string;
  }) {
    await this.page.getByLabel(/nombre/i).fill(data.name);
    if (data.email) await this.page.getByLabel(/email|correo/i).fill(data.email);
    if (data.birthDate) await this.page.getByLabel(/nacimiento|birth/i).fill(data.birthDate);
    if (data.notes) await this.page.getByLabel(/notas/i).fill(data.notes);
    // Document field (identity_document)
    await this.page.getByLabel(/documento|identidad/i).fill(data.doc);
  }

  async saveForm() {
    await this.page.getByRole('button', { name: /guardar|crear/i }).last().click();
  }

  async selectRow(index = 0) {
    await this.page.locator('table tbody tr').nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  async openDetailTab(tabName: string) {
    // VerticalTabStrip uses buttons
    await this.page.getByRole('button', { name: new RegExp(tabName, 'i') }).first().click();
    await this.page.waitForTimeout(500);
  }

  async toggleDebtorsFilter() {
    await this.page.getByRole('switch', { name: /deudores/i })
      .or(this.page.getByLabel(/deudores/i))
      .first().click();
  }

  async toggleActiveOnlyFilter() {
    await this.page.getByRole('switch', { name: /activos/i })
      .or(this.page.getByLabel(/solo activos/i))
      .first().click();
  }

  testData() {
    return {
      name: `Test Paciente ${Date.now()}`,
      email: randomEmail(),
      doc: randomDoc(),
      phone: randomPhone(),
    };
  }
}
