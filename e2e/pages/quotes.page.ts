import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class QuotesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/sales/quotes');
    await this.page.waitForSelector('table', { timeout: 15_000 });
  }

  async openCreateForm() {
    await this.page.getByRole('button', { name: /nuevo presupuesto|nuevo|\+/i }).first().click();
    await expect(this.page.getByRole('dialog').or(this.page.locator('[class*="sheet"]'))).toBeVisible({ timeout: 8_000 });
  }

  async selectRow(index = 0) {
    await this.page.locator('table tbody tr').nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  async openTab(tabName: string) {
    await this.page.getByRole('button', { name: new RegExp(tabName, 'i') })
      .or(this.page.getByRole('tab', { name: new RegExp(tabName, 'i') }))
      .first().click();
    await this.page.waitForTimeout(500);
  }

  async clickAddItem() {
    await this.page.getByRole('button', { name: /agregar ítem|agregar|add item/i }).first().click();
  }

  async clickConvertToOrder() {
    await this.page.getByRole('button', { name: /convertir.*orden|crear orden/i }).first().click();
  }

  async clickPrint() {
    await this.page.getByRole('button', { name: /imprimir|print/i }).first().click();
  }

  async clickSendEmail() {
    await this.page.getByRole('button', { name: /enviar.*email|email/i }).first().click();
  }

  async changeStatus(status: string) {
    await this.page.getByRole('combobox', { name: /estado/i })
      .or(this.page.getByRole('button', { name: /estado/i }))
      .first().click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }
}
