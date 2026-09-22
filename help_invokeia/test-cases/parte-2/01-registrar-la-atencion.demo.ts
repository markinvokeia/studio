/**
 * PARTE 2 — Consultorio · Registrar la atención
 *
 * Fuera del triaje: q093 y q094 (los bloques de IA que describe el manual no
 * aparecen en el diálogo de sesión de este entorno — ver DRIFT.md).
 *
 * Todas de solo lectura: abren el diálogo y lo cierran con Cancelar. No se
 * guarda ninguna sesión clínica: sería un registro asistencial falso en la base
 * de un paciente, aunque sea el de prueba.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { appDialog } from '../../lib/selectors';
import { openDemoPatient, T } from './paciente.support';

/** Diálogo de sesión clínica. */
const S = {
  title: 'Crear Sesión',
  patient: 'Paciente',
  date: 'Fecha',
  doctor: 'Seleccionar un doctor',
  quote: 'Seleccionar presupuesto',
  quoteNew: 'Nuevo',
  procedure: 'Procedimiento',
  procedurePlaceholder: 'Ingrese el procedimiento realizado...',
  addRow: 'Añadir',
  servicePlaceholder: 'Seleccionar servicio...',
  nextPlan: 'Plan para la Próxima Sesión',
  nextPlanPlaceholder: 'Ingrese el plan para la siguiente cita...',
  discharge: 'Dar de alta al paciente al guardar la sesión',
  attachments: 'Archivos adjuntos',
  dropzone: 'Arrastra archivos aquí o haz clic para seleccionar',
  dictation: 'Iniciar dictado',
  cancel: 'Cancelar',
  save: 'Guardar',
};

/** Abre la ficha del paciente de prueba y el diálogo de sesión clínica. */
async function openSessionDialog(page: import('@playwright/test').Page) {
  await openDemoPatient(page);
  await page.getByTestId(T.createMenu).click();
  await page.getByRole('menuitem', { name: /sesión clínica/i }).click();
  const dialog = appDialog(page, S.title);
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_500);
  return dialog;
}

demoTest(['q091', 'q095'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.click(page.getByTestId(T.createMenu), 'El menú Crear de la ficha tiene diez opciones');

  await demo.click(
    page.getByRole('menuitem', { name: /sesión clínica/i }),
    'Elegí «Sesión clínica»',
  );

  const dialog = appDialog(page, S.title);
  await demo.step('Se abre el registro de la atención', async () => {
    await expect(dialog).toBeVisible({ timeout: 20_000 });
  });

  await demo.spotlight(
    dialog.getByText(S.patient).first(),
    'El paciente ya viene puesto: entraste desde su ficha',
  );

  await demo.spotlight(
    dialog.getByText(S.doctor).first(),
    'El doctor es obligatorio: es quien firma el registro',
  );

  await demo.spotlight(
    dialog.getByText(S.quote).first(),
    'Y el presupuesto, que podés enlazar o crear nuevo ahí mismo',
  );

  await demo.type(
    dialog.getByPlaceholder(S.procedurePlaceholder),
    'Ajuste de provisionales, sin signos de infección',
    'En Procedimiento va lo que hiciste',
  );

  await demo.click(
    dialog.getByRole('button', { name: S.addRow }).first(),
    'Con «Añadir» sumás los tratamientos de la sesión',
  );

  await demo.spotlight(
    dialog.getByText(S.servicePlaceholder).first(),
    'Cada línea se elige del catálogo de servicios de la clínica',
  );

  await demo.note('Que salgan del catálogo real es lo que después permite facturarlos sin retipear');

  await demo.click(
    dialog.getByRole('button', { name: S.cancel }),
    'Acá cerramos sin guardar: es sólo la demostración',
  );

  await demo.finish('Permiso: CLINICAL_SESSION_CREATE');
});

demoTest('q092', async ({ demo, page }) => {
  await demo.intro('/patients', '');

  const dialog = await openSessionDialog(page);

  await demo.spotlight(
    dialog.getByRole('button', { name: S.dictation }).first(),
    'Cada campo de texto largo tiene su ícono de micrófono',
  );

  await demo.note('Lo pulsás, hablás, y lo que digas se transcribe en ese campo');

  await demo.spotlight(
    dialog.getByRole('button', { name: S.dictation }).last(),
    'El plan para la próxima sesión también lo tiene',
  );

  await demo.note('Es lo que permite registrar sin soltar el instrumental ni quitarse los guantes');

  await demo.click(dialog.getByRole('button', { name: S.cancel }), 'Cerramos sin guardar');

  await demo.finish();
});

demoTest('q096', async ({ demo, page }) => {
  await demo.intro('/patients', '');

  const dialog = await openSessionDialog(page);

  await demo.spotlight(
    dialog.getByText(S.attachments).first(),
    'Al pie del diálogo está «Archivos adjuntos»',
  );

  await demo.spotlight(
    dialog.getByText(S.dropzone).first(),
    'Arrastrás los archivos ahí, o hacés clic para buscarlos',
  );

  await demo.note('Quedan guardados con la sesión, y también accesibles desde Documentos');

  await demo.note(
    'Hay límite de tamaño y de tipos: si lo rechaza, el sistema dice cuál de los dos fue',
  );

  await demo.click(dialog.getByRole('button', { name: S.cancel }), 'Cerramos sin guardar');

  await demo.finish('Permiso: CLINICAL_SESSION_UPLOAD_ATTACHMENT');
});

demoTest(['q097', 'q098'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  const dialog = await openSessionDialog(page);

  await demo.type(
    dialog.getByPlaceholder(S.nextPlanPlaceholder),
    'Control en 7 días',
    'En «Plan para la Próxima Sesión» dejás anotado lo que sigue',
  );

  await demo.spotlight(
    dialog.getByText(S.discharge).first(),
    'Y si el tratamiento terminó, marcás el alta del paciente',
  );

  await demo.note(
    'Al guardar con eso marcado, el sistema te pide la fecha de alta en el mismo diálogo',
  );

  await demo.click(dialog.getByRole('button', { name: S.cancel }), 'Cerramos sin guardar');

  await demo.finish();
});

demoTest('q099', async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.note('Al guardar una sesión pasan tres cosas');

  await demo.click(
    page.getByText(T.tabHistory).first(),
    'Primero: la sesión entra en la Historia clínica del paciente',
  );

  await demo.note('Queda en su línea de tiempo, junto a las citas y los odontogramas');

  await demo.note('Segundo: la recepción recibe el aviso «Sesión clínica registrada»');

  await demo.note('Así puede facturar o agendar lo siguiente sin que nadie tenga que avisarle');

  await demo.note('Y tercero: si enlazaste un presupuesto, los tratamientos quedan listos para cobrar');

  await demo.note('Por eso conviene enlazarlo: el Cobro Rápido abre con los servicios ya cargados');

  await demo.finish();
});
