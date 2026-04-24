import { type Page } from '@playwright/test';

/** Fill a shadcn/ui combobox (Command popover) by typing and selecting the first match. */
export async function fillCombobox(page: Page, triggerLabel: string, searchText: string) {
  await page.getByRole('button', { name: new RegExp(triggerLabel, 'i') }).click();
  await page.getByPlaceholder(/buscar|search/i).last().fill(searchText);
  await page.waitForTimeout(350); // debounce
  await page.getByRole('option').first().click();
}

/** Fill a date input in YYYY-MM-DD format. */
export async function fillDate(page: Page, labelText: string, dateStr: string) {
  const input = page.getByLabel(new RegExp(labelText, 'i')).first();
  await input.fill(dateStr);
}

/** Upload a file to a file input. */
export async function uploadFile(page: Page, inputSelector: string, filePath: string) {
  await page.locator(inputSelector).setInputFiles(filePath);
}

/** Wait for the network to be idle after an action. */
export async function waitForNetworkIdle(page: Page, timeout = 8_000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/** Generate a random email for test data. */
export function randomEmail(): string {
  return `test_${Date.now()}@e2e.test`;
}

/** Generate a random 8-digit document number. */
export function randomDoc(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

/** Generate a random uruguayan phone number. */
export function randomPhone(): string {
  return `+59899${Math.floor(100000 + Math.random() * 900000)}`;
}

/** Format a Date to YYYY-MM-DD. */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}
