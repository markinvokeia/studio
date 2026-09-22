/**
 * Apoyo compartido por las demos del consultorio (PARTE 2).
 *
 * Todas trabajan sobre la ficha de un paciente. Se usa siempre el mismo paciente
 * de prueba y no uno cualquiera del listado: la base de DEV tiene más de catorce
 * mil pacientes reales, y sus nombres y documentos quedarían grabados en cámara.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** Paciente de prueba con el que se graban las demos. */
export const DEMO_PATIENT = 'Testing Patient';

export const T = {
  // PatientsPage — el buscador no usa el placeholder genérico del DataTable,
  // así que se lo ubica por patrón en vez de por literal.
  filterPlaceholder: /filtrar|buscar/i,
  // Los dos menús del encabezado de la ficha. Por rol no alcanza: hay otro
  // botón «Crear» en la barra del listado y uno más en el panel de
  // notificaciones, fuera del viewport.
  createMenu: 'patient-create-menu',
  moreMenu: 'patient-more-menu',

  // Macro-pestañas de la ficha
  tabInfo: 'Información',
  tabHistory: 'Historia clínica',
  tabFinance: 'Finanzas',

  // Sub-pestañas de Información
  subDetails: 'Detalles',
  subNotes: 'Notas',
  subPreferences: 'Preferencias',
} as const;

/**
 * Abre la ficha del paciente de prueba y espera a que cargue el detalle.
 * Devuelve el panel de detalle para poder acotar los selectores.
 */
export async function openDemoPatient(page: Page, name = DEMO_PATIENT): Promise<Locator> {
  await page.locator('table').waitFor({ timeout: 30_000 });

  await page.getByPlaceholder(T.filterPlaceholder).first().fill(name);
  await page.waitForTimeout(2_000); // debounce del buscador

  const row = page.locator('table tbody tr, [data-testid="list-item"]').first();
  await expect(row, `No aparece el paciente de prueba «${name}» en el listado`).toBeVisible({
    timeout: 15_000,
  });
  await row.click();

  // Las macro-pestañas son la señal fiable de que el detalle cargó. Ni el nombre
  // del paciente es un `heading` ni las pestañas tienen rol `tab`, así que se las
  // ubica por texto.
  await expect(page.getByText(T.tabHistory).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_200);

  return page.getByText(T.tabHistory).first();
}

/** Abre una de las tres macro-pestañas de la ficha. */
export async function openPatientTab(page: Page, tab: string): Promise<void> {
  await page.getByText(tab, { exact: true }).first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_200);
}
