import { type Page } from '@playwright/test';

const CALENDAR_EVENT_SELECTORS = [
  '[data-testid="calendar-event"]',
  '[data-testid="calendar-day-event"]',
  '[data-testid="calendar-month-agenda-event"]',
  '[data-testid="calendar-schedule-event"]',
  '.event',
  '.event-in-day-view',
] as const;

async function clickFirstVisible(page: Page, selector: string, timeout: number) {
  const locator = page.locator(selector).first();
  const visible = await locator.isVisible({ timeout }).catch(() => false);
  if (!visible) return false;
  await locator.click();
  return true;
}

export async function openExistingAppointmentPanel(
  page: Page,
  infoTabLabel = 'Información',
  timeout = 25_000,
): Promise<boolean> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const selector of CALENDAR_EVENT_SELECTORS) {
      if (!await clickFirstVisible(page, selector, 250)) continue;

      const opened = await page.getByRole('button', { name: infoTabLabel })
        .isVisible({ timeout: 8_000 })
        .catch(() => false);
      if (opened) return true;
    }

    await page.waitForTimeout(400);
  }

  // Last fallback for mobile if the month agenda has not been populated yet.
  const scheduleTab = page.getByRole('button', { name: /Agenda|Schedule/i }).first();
  if (!await scheduleTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return false;
  }

  await scheduleTab.click();

  if (!await clickFirstVisible(page, '[data-testid="calendar-schedule-event"]', timeout)) {
    return false;
  }

  return page.getByRole('button', { name: infoTabLabel })
    .isVisible({ timeout: 8_000 })
    .catch(() => false);
}
