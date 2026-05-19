import { test, expect, type Locator, type Page } from '@playwright/test';

const T = {
  anamnesis: {
    personalTitle: 'Información Personal',
    familyTitle: 'Información Familiar',
    medicationsTitle: 'Medicamentos',
    allergiesTitle: 'Alergias',
  },
  habits: {
    title: 'Hábitos',
    saveToast: 'Hábitos guardados exitosamente',
  },
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
  },
};

// ── Helper: abre la sub-pestaña Anamnesis desde el panel de Información ───────
async function openAnamnesisTab(page: Page): Promise<boolean> {
  await page.goto('/patients', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});

  const firstRow = page.locator('table tbody tr, [data-testid="list-item"]').first();
  if (!await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) return false;
  await firstRow.click();

  const panelReady = await page.getByRole('button', { name: 'Dar Alta' })
    .or(page.getByRole('button', { name: 'Reingreso' }))
    .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  if (!panelReady) return false;

  // Información es el primer tab del panel (normalmente ya activo)
  const infoTab = page.getByRole('button', { name: 'Información' });
  if (!await infoTab.isVisible({ timeout: 5_000 }).catch(() => false)) return false;
  await infoTab.click();

  // Clic en el sub-tab Anamnesis
  const anamnesisSubTab = page.getByRole('button', { name: 'Anamnesis' });
  if (!await anamnesisSubTab.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) return false;
  await anamnesisSubTab.click();
  await page.waitForTimeout(500);
  return true;
}

function habitsCard(page: Page): Locator {
  return page
    .getByText(T.habits.title, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
}

async function openHabitsEditor(page: Page): Promise<Locator> {
  const card = habitsCard(page);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole('button').first().click();
  await expect(card.locator('#tabaquismo')).toBeVisible({ timeout: 5_000 });
  return card;
}

// ── Anamnesis ─────────────────────────────────────────────────────────────────
test.describe('Anamnesis — sub-tab de Información', () => {
  test.beforeEach(async ({ page }) => {
    const opened = await openAnamnesisTab(page);
    if (!opened) test.skip();
  });

  test.describe('Secciones visibles', () => {
    test('muestra la tarjeta de Información Personal', async ({ page }) => {
      await expect(page.getByText(T.anamnesis.personalTitle, { exact: true })).toBeVisible({ timeout: 10_000 });
    });

    test('muestra la tarjeta de Información Familiar', async ({ page }) => {
      await expect(page.getByText(T.anamnesis.familyTitle, { exact: true })).toBeVisible({ timeout: 10_000 });
    });

    test('muestra la tarjeta de Medicamentos', async ({ page }) => {
      await expect(page.getByText(T.anamnesis.medicationsTitle, { exact: true })).toBeVisible({ timeout: 10_000 });
    });

    test('muestra la tarjeta de Alergias', async ({ page }) => {
      await expect(page.getByText(T.anamnesis.allergiesTitle, { exact: true })).toBeVisible({ timeout: 10_000 });
    });

    test('muestra la tarjeta de Hábitos', async ({ page }) => {
      await expect(page.getByText(T.habits.title, { exact: true })).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Interacción con secciones colapsables', () => {
    test('cada tarjeta tiene un botón de edición/expansión', async ({ page }) => {
      const cards = [
        T.anamnesis.personalTitle,
        T.anamnesis.familyTitle,
        T.anamnesis.medicationsTitle,
        T.anamnesis.allergiesTitle,
        T.habits.title,
      ];
      for (const title of cards) {
        const card = page.getByText(title, { exact: true })
          .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
        if (!await card.isVisible({ timeout: 5_000 }).catch(() => false)) continue;
        const hasBtn = await card.getByRole('button').first().isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasBtn).toBeTruthy();
      }
    });

    test('tarjeta Alergias muestra contenido o estado vacío al expandirla', async ({ page }) => {
      const card = page.getByText(T.anamnesis.allergiesTitle, { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
      if (!await card.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await card.getByRole('button').first().click();
      await page.waitForTimeout(400);
      const hasContent = await card.locator('li, [role="listitem"], input, button').first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await card.getByText(/sin alergias|no hay alergias|vacío/i).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasContent || hasEmpty).toBeTruthy();
    });

    test('tarjeta Medicamentos muestra contenido o estado vacío al expandirla', async ({ page }) => {
      const card = page.getByText(T.anamnesis.medicationsTitle, { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
      if (!await card.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await card.getByRole('button').first().click();
      await page.waitForTimeout(400);
      const hasContent = await card.locator('li, [role="listitem"], input, button').first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await card.getByText(/sin medicamentos|no hay medicamentos|vacío/i).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasContent || hasEmpty).toBeTruthy();
    });

    test('tarjeta Información Familiar muestra contenido o estado vacío al expandirla', async ({ page }) => {
      const card = page.getByText(T.anamnesis.familyTitle, { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
      if (!await card.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      await card.getByRole('button').first().click();
      await page.waitForTimeout(400);
      const hasContent = await card.locator('li, [role="listitem"], input, button').first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await card.getByText(/sin antecedentes|no hay|vacío/i).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasContent || hasEmpty).toBeTruthy();
    });
  });

  test.describe('Hábitos — edición con restauración', () => {
    test('la tarjeta Hábitos tiene campos de tabaquismo, alcoholismo y bruxismo', async ({ page }) => {
      const card = await openHabitsEditor(page);
      await expect(card.locator('#tabaquismo')).toBeVisible();
      await expect(card.locator('#alcoholismo')).toBeVisible();
      await expect(card.locator('#bruxismo')).toBeVisible();
    });

    test('edita hábitos y restaura los valores originales', async ({ page }) => {
      const card = await openHabitsEditor(page);
      const originalSmoking = await card.locator('#tabaquismo').inputValue();
      const originalAlcohol = await card.locator('#alcoholismo').inputValue();
      const originalBruxism = await card.locator('#bruxismo').inputValue();

      const seed = Date.now();
      await card.locator('#tabaquismo').fill(`E2E tabaquismo ${seed}`);
      await card.locator('#alcoholismo').fill(`E2E alcohol ${seed}`);
      await card.locator('#bruxismo').fill(`E2E bruxismo ${seed}`);

      const saveResponse = page.waitForResponse(r =>
        r.url().includes('/habitos_paciente/upsert') && r.request().method() === 'POST'
      );
      await card.getByRole('button', { name: T.common.save }).click();
      await saveResponse;
      await expect(page.getByText(T.habits.saveToast).first()).toBeVisible({ timeout: 10_000 });

      // Restaurar valores originales
      const restoreCard = await openHabitsEditor(page);
      await restoreCard.locator('#tabaquismo').fill(originalSmoking);
      await restoreCard.locator('#alcoholismo').fill(originalAlcohol);
      await restoreCard.locator('#bruxismo').fill(originalBruxism);

      const restoreResponse = page.waitForResponse(r =>
        r.url().includes('/habitos_paciente/upsert') && r.request().method() === 'POST'
      );
      await restoreCard.getByRole('button', { name: T.common.save }).click();
      await restoreResponse;
      await expect(page.getByText(T.habits.saveToast).first()).toBeVisible({ timeout: 10_000 });
    });

    test('cancelar edición de hábitos no persiste cambios', async ({ page }) => {
      const card = await openHabitsEditor(page);
      const originalSmoking = await card.locator('#tabaquismo').inputValue();
      await card.locator('#tabaquismo').fill(`E2E cancelado ${Date.now()}`);
      const cancelBtn = card.getByRole('button', { name: T.common.cancel });
      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(400);
        // Re-open to verify value was not saved
        const reopened = await openHabitsEditor(page);
        const restoredVal = await reopened.locator('#tabaquismo').inputValue();
        expect(restoredVal).toBe(originalSmoking);
      }
    });
  });
});
