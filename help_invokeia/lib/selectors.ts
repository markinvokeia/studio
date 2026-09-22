/**
 * Selectores compartidos por todas las demos.
 */
import type { Locator, Page } from '@playwright/test';

/**
 * Un diálogo de la aplicación, identificado por su título.
 *
 * `getByRole('dialog')` a secas NO sirve en esta app: el panel de notificaciones
 * queda montado permanentemente como `role="dialog"` fuera del viewport
 * (`x = 1280`), y además contiene texto de medio sistema —«Sesión completada
 * por…», «Cobro Rápido», nombres de pacientes—, así que se cuela en casi
 * cualquier filtro por texto que uno intente.
 *
 * Este helper filtra por título y descarta lo que esté fuera de pantalla.
 */
export function appDialog(page: Page, title: string | RegExp): Locator {
  return page
    .getByRole('dialog')
    .filter({ hasText: title })
    .filter({ hasNot: page.getByText('Limpiar todo', { exact: true }) })
    .first();
}

/** Igual, para los `alertdialog` (confirmaciones destructivas, avisos). */
export function appAlert(page: Page, title: string | RegExp): Locator {
  return page.getByRole('alertdialog').filter({ hasText: title }).first();
}
