import { test, expect, type Locator, type Page } from '@playwright/test';

const T = {
  clinicalHistoryTab: 'Historia Clínica',
  views: {
    anamnesis: 'Anamnesis',
    timeline: 'Línea de Tiempo',
    documents: 'Documentos',
  },
  anamnesis: {
    personalTitle: 'Información Personal',
    familyTitle: 'Información Familiar',
    medicationsTitle: 'Medicamentos',
    allergiesTitle: 'Alergias',
  },
  habits: {
    title: 'Hábitos',
    smoking: 'Tabaquismo',
    alcohol: 'Alcoholismo',
    bruxism: 'Bruxismo',
    saveToast: 'Hábitos guardados exitosamente',
  },
  timeline: {
    title: 'Línea de Tiempo',
    addSession: 'Agregar sesión',
    empty: 'No hay sesiones registradas',
  },
  documents: {
    add: 'Agregar documento',
    empty: 'No hay documentos disponibles',
  },
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
  },
};

async function openFirstPatientClinicalHistory(page: Page): Promise<boolean> {
  await page.goto('/patients', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});

  const firstRadio = page.getByRole('radio').first();
  if (!await firstRadio.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    return false;
  }

  await firstRadio.click();

  const historyTab = page.getByRole('button', { name: T.clinicalHistoryTab });
  if (!await historyTab.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
    return false;
  }

  await historyTab.click();
  await page.getByRole('button', { name: T.views.anamnesis }).waitFor({ state: 'visible', timeout: 10_000 });
  return true;
}

function habitsCard(page: Page): Locator {
  return page
    .getByText(T.habits.title, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
}

async function openHabitsEditor(page: Page) {
  const card = habitsCard(page);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole('button').first().click();
  await expect(card.locator('#tabaquismo')).toBeVisible({ timeout: 5_000 });
  return card;
}

test.describe('Historia clínica', () => {
  test('muestra la navegación principal y las tarjetas de anamnesis', async ({ page }) => {
    const opened = await openFirstPatientClinicalHistory(page);
    expect(opened).toBeTruthy();

    await expect(page.getByRole('button', { name: T.views.anamnesis })).toBeVisible();
    await expect(page.getByRole('button', { name: T.views.timeline })).toBeVisible();
    await expect(page.getByRole('button', { name: T.views.documents })).toBeVisible();

    await expect(page.getByText(T.anamnesis.personalTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(T.anamnesis.familyTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(T.anamnesis.medicationsTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(T.anamnesis.allergiesTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(T.habits.title, { exact: true })).toBeVisible();
  });

  test('permite alternar entre anamnesis, línea de tiempo y documentos', async ({ page }) => {
    const opened = await openFirstPatientClinicalHistory(page);
    expect(opened).toBeTruthy();

    await page.getByRole('button', { name: T.views.timeline }).click();
    await expect(page.getByRole('heading', { name: T.timeline.title })).toBeVisible({ timeout: 10_000 });
    const hasTimelineContent = await page.getByRole('button', { name: T.timeline.addSession }).isVisible({ timeout: 5_000 }).catch(() => false);
    const hasTimelineEmpty = await page.getByText(T.timeline.empty).isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasTimelineContent || hasTimelineEmpty).toBeTruthy();

    await page.getByRole('button', { name: T.views.documents }).click();
    const hasUploadButton = await page.getByRole('button', { name: T.documents.add }).isVisible({ timeout: 10_000 }).catch(() => false);
    const hasEmptyDocuments = await page.getByText(T.documents.empty).isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasUploadButton || hasEmptyDocuments).toBeTruthy();

    await page.getByRole('button', { name: T.views.anamnesis }).click();
    await expect(page.getByText(T.habits.title, { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('edita hábitos y restaura los valores originales', async ({ page }) => {
    const opened = await openFirstPatientClinicalHistory(page);
    expect(opened).toBeTruthy();

    const card = await openHabitsEditor(page);
    const originalSmoking = await card.locator('#tabaquismo').inputValue();
    const originalAlcohol = await card.locator('#alcoholismo').inputValue();
    const originalBruxism = await card.locator('#bruxismo').inputValue();

    const seed = Date.now();
    const updatedSmoking = `E2E tabaquismo ${seed}`;
    const updatedAlcohol = `E2E alcohol ${seed}`;
    const updatedBruxism = `E2E bruxismo ${seed}`;

    await card.locator('#tabaquismo').fill(updatedSmoking);
    await card.locator('#alcoholismo').fill(updatedAlcohol);
    await card.locator('#bruxismo').fill(updatedBruxism);

    const saveResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/habitos_paciente/upsert') && response.request().method() === 'POST'
    );

    await card.getByRole('button', { name: T.common.save }).click();
    await saveResponsePromise;
    await expect(page.getByText(T.habits.saveToast).first()).toBeVisible({ timeout: 10_000 });

    await expect(habitsCard(page).getByText(updatedSmoking)).toBeVisible({ timeout: 10_000 });
    await expect(habitsCard(page).getByText(updatedAlcohol)).toBeVisible({ timeout: 10_000 });
    await expect(habitsCard(page).getByText(updatedBruxism)).toBeVisible({ timeout: 10_000 });

    const restoreCard = await openHabitsEditor(page);
    await restoreCard.locator('#tabaquismo').fill(originalSmoking);
    await restoreCard.locator('#alcoholismo').fill(originalAlcohol);
    await restoreCard.locator('#bruxismo').fill(originalBruxism);

    const restoreResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/habitos_paciente/upsert') && response.request().method() === 'POST'
    );

    await restoreCard.getByRole('button', { name: T.common.save }).click();
    await restoreResponsePromise;
    await expect(page.getByText(T.habits.saveToast).first()).toBeVisible({ timeout: 10_000 });
  });
});
