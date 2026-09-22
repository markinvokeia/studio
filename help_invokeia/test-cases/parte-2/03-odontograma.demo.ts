/**
 * PARTE 2 — Consultorio · Odontograma
 *
 * Fuera del triaje: q108, q109 y q110 (vista plana, pantalla completa y
 * navegación entre sesiones existen en `DentalRecordViewer`, que sólo se
 * renderiza en /clinic-history/[user_id] — ver DRIFT.md).
 *
 * El odontograma se edita SIEMPRE dentro de una sesión, así que la demo abre el
 * diálogo «Nueva sesión — Odontograma» y lo cierra con Cancelar. No se guarda
 * ninguna sesión: sería un registro clínico falso.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { openDemoPatient, T } from './paciente.support';

const S = {
  dialogTitle: 'Nueva sesión — Odontograma',
  groupSurfaces: 'Superficies',
  groupTooth: 'Pieza',
  groupOverlay: 'Superposición',
  activeTool: 'Herramienta activa',
  clearAll: 'Limpiar odontograma',
  registerSession: 'Registrar Sesión',
  cancel: 'Cancelar',
};

/** Abre el diálogo de sesión de odontograma del paciente de prueba. */
async function openOdontogram(page: import('@playwright/test').Page) {
  await openDemoPatient(page);
  await page.getByTestId(T.createMenu).click();
  await page.getByRole('menuitem', { name: /odontograma/i }).click();
  await expect(page.getByText(S.dialogTitle).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
}

demoTest(['q105', 'q106'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.click(page.getByTestId(T.createMenu), 'Abrí el menú Crear de la ficha');

  await demo.click(
    page.getByRole('menuitem', { name: /odontograma/i }),
    'Elegí «Sesión de odontograma»',
  );

  await demo.step('El odontograma se edita siempre dentro de una sesión', async () => {
    await expect(page.getByText(S.dialogTitle).first()).toBeVisible({ timeout: 20_000 });
  });

  await demo.note('Sin sesión abierta está en solo lectura: acá ya estamos editando');

  await demo.spotlight(
    page.getByRole('button', { name: S.groupSurfaces, exact: true }).first(),
    'Las condiciones vienen agrupadas en tres categorías',
  );

  await demo.note('Superficies: hacés clic en una zona del diente y afecta sólo a esa cara');

  await demo.spotlight(
    page.getByRole('button', { name: S.groupTooth, exact: true }).first(),
    'Pieza: el clic aplica la condición al diente completo',
  );

  await demo.spotlight(
    page.getByRole('button', { name: S.groupOverlay, exact: true }).first(),
    'Y Superposición: agrega o quita una marca encima del diente',
  );

  await demo.note('El sistema te dice en pantalla cómo se aplica la condición que elegiste');

  await demo.click(
    page.getByRole('button', { name: S.cancel }).first(),
    'Cerramos sin guardar: es sólo la demostración',
  );

  await demo.finish('Permiso: ODONTOGRAM_VIEW · ODONTOGRAM_REGISTER_SESSION');
});

demoTest(['q107', 'q111'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos una sesión de odontograma', async () => {
    await openOdontogram(page);
  });

  await demo.spotlight(
    page.getByRole('button', { name: S.groupSurfaces, exact: true }).first(),
    'En Superficies: Sano, Caries, Obturación, Tratamiento Pulpar, Discromía, Desgaste',
  );

  await demo.click(
    page.getByRole('button', { name: S.groupTooth, exact: true }).first(),
    'Desplegá Pieza para ver el resto',
  );

  await demo.click(
    page.getByRole('button', { name: S.groupOverlay, exact: true }).first(),
    'Y Superposición',
  );

  await demo.note(
    'Fractura, Diastema, Migración, Rotación, Erupción, Implante, Perno y bastantes más',
  );

  await demo.note(
    'El catálogo es configurable en Catálogo de la Clínica → Condiciones Dentales',
  );

  await demo.spotlight(
    page.getByRole('button', { name: S.clearAll }).first(),
    'Y si cargaste algo mal, «Limpiar odontograma» borra todo',
  );

  await demo.note('También podés limpiar un solo diente, sin perder el resto del trabajo');

  await demo.click(page.getByRole('button', { name: S.cancel }).first(), 'Cerramos sin guardar');

  await demo.finish();
});
