import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class AppointmentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/appointments');
    // Calendar renders — wait for the calendar container
    await this.page.waitForSelector('[class*="calendar"], [class*="Calendar"], .fc', { timeout: 15_000 }).catch(() =>
      this.page.waitForLoadState('networkidle')
    );
  }

  async clickCreateButton() {
    await this.page.getByRole('button', { name: /nueva cita|nuevo|\+/i }).first().click();
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
  }

  async setView(view: 'Día' | 'Semana' | 'Mes' | '2 días' | '3 días') {
    await this.page.getByRole('button', { name: new RegExp(view, 'i') }).first().click();
    await this.page.waitForTimeout(500);
  }

  async navigateNext() {
    await this.page.getByRole('button', { name: /siguiente|next|›|>/i }).first().click();
  }

  async navigatePrev() {
    await this.page.getByRole('button', { name: /anterior|prev|‹|</i }).first().click();
  }

  async navigateToday() {
    await this.page.getByRole('button', { name: /hoy|today/i }).first().click();
  }

  async openCalendarFilter() {
    await this.page.getByRole('button', { name: /calendario|filtrar/i }).first().click();
  }
}
