import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Base page helpers shared across all DataTable-based pages in the app.
 * Every module (patients, invoices, services, etc.) follows the same TwoPanelLayout pattern.
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  async goto(path: string) {
    await this.page.goto(path);
    await this.waitForTable();
  }

  // ── Table helpers ────────────────────────────────────────────────────────

  async waitForTable() {
    // DataTable renders a <table> element; wait for it to appear
    await this.page.waitForSelector('table', { timeout: 15_000 });
  }

  async getTableRows(): Promise<Locator> {
    return this.page.locator('table tbody tr');
  }

  async getRowCount(): Promise<number> {
    return this.page.locator('table tbody tr').count();
  }

  async clickRow(index = 0) {
    const rows = this.page.locator('table tbody tr');
    await rows.nth(index).click();
  }

  async searchFor(text: string) {
    const searchInput = this.page.getByPlaceholder(/buscar|search/i).first();
    await searchInput.fill(text);
    // Wait for debounce and table refresh
    await this.page.waitForTimeout(400);
    await this.page.waitForLoadState('networkidle');
  }

  async clearSearch() {
    const searchInput = this.page.getByPlaceholder(/buscar|search/i).first();
    await searchInput.clear();
    await this.page.waitForTimeout(400);
  }

  // ── CRUD actions ─────────────────────────────────────────────────────────

  async clickCreate() {
    await this.page.getByRole('button', { name: /nuevo|crear|new|add|\+/i }).first().click();
  }

  async clickEdit() {
    await this.page.getByRole('button', { name: /editar|edit/i }).first().click();
  }

  async clickDelete() {
    await this.page.getByRole('button', { name: /eliminar|delete/i }).first().click();
  }

  async confirmDialog() {
    // AlertDialog confirm button
    await this.page.getByRole('button', { name: /confirmar|confirm|sí|yes|aceptar/i }).click();
  }

  async cancelDialog() {
    await this.page.getByRole('button', { name: /cancelar|cancel/i }).click();
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  async fillInput(labelOrPlaceholder: string, value: string) {
    const input = this.page
      .getByLabel(labelOrPlaceholder)
      .or(this.page.getByPlaceholder(labelOrPlaceholder))
      .first();
    await input.clear();
    await input.fill(value);
  }

  async selectOption(labelText: string, optionText: string) {
    // Works for shadcn/ui Select (trigger + popover)
    const trigger = this.page.getByRole('combobox').filter({ hasText: labelText }).first()
      .or(this.page.locator(`[aria-label*="${labelText}"]`).first());
    await trigger.click();
    await this.page.getByRole('option', { name: optionText }).click();
  }

  async submitForm() {
    await this.page.getByRole('button', { name: /guardar|save|crear|create|confirmar/i }).last().click();
  }

  // ── Toast / feedback ──────────────────────────────────────────────────────

  async expectToast(messagePattern: string | RegExp) {
    await expect(this.page.getByRole('status').or(this.page.locator('[data-radix-toast-root]')).first())
      .toContainText(messagePattern instanceof RegExp ? messagePattern : new RegExp(messagePattern, 'i'), { timeout: 8_000 });
  }

  async expectSuccessToast() {
    await this.expectToast(/éxito|success|guardado|creado|actualizado|eliminado/i);
  }

  // ── Panel helpers ─────────────────────────────────────────────────────────

  async clickTab(tabName: string) {
    await this.page.getByRole('tab', { name: new RegExp(tabName, 'i') }).click();
    await this.page.waitForLoadState('networkidle');
  }

  // ── Filter helpers ────────────────────────────────────────────────────────

  async applyDateFilter(preset: string) {
    await this.page.getByRole('button', { name: /filtrar|filter|fecha/i }).first().click();
    await this.page.getByText(new RegExp(preset, 'i')).first().click();
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async expectRowWithText(text: string) {
    await expect(this.page.locator('table tbody').getByText(text)).toBeVisible({ timeout: 8_000 });
  }

  async expectNoRowWithText(text: string) {
    await expect(this.page.locator('table tbody').getByText(text)).not.toBeVisible();
  }

  async expectFormError(message: string | RegExp) {
    await expect(this.page.getByText(message instanceof RegExp ? message : new RegExp(message, 'i'))).toBeVisible();
  }

  async expectEmptyState() {
    await expect(
      this.page.getByText(/no hay|sin resultados|no results|empty|vacío/i)
    ).toBeVisible({ timeout: 8_000 });
  }
}
