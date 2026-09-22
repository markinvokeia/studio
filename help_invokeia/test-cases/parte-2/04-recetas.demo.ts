/**
 * PARTE 2 — Consultorio · Recetas
 *
 * Las demos abren el diálogo de receta y lo cierran sin guardar: una receta
 * guardada es un documento médico, y además puede volcar medicamentos a la
 * anamnesis del paciente.
 *
 * q117 (el aviso de «saldrá sin firmar») depende de que el doctor elegido no
 * tenga firma, así que se narra sin forzar el estado.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { appDialog } from '../../lib/selectors';
import { openDemoPatient, T } from './paciente.support';

const R = {
  menuItem: /receta m[ée]dica/i,
  dialogTitle: 'Nueva Receta Médica',
  // El diálogo de receta cierra con «Cerrar», no con «Cancelar».
  close: /^cerrar$/i,
  addDrug: 'Agregar medicamento',
  editContent: 'Editar contenido de la receta',
  print: 'Imprimir',
  // /config/prescription-templates
  templatesTitle: /plantillas de receta/i,
};

demoTest(['q112', 'q113'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.click(page.getByTestId(T.createMenu), 'Abrí el menú Crear de la ficha');

  await demo.click(
    page.getByRole('menuitem').filter({ hasText: R.menuItem }).first(),
    'Elegí «Receta médica»',
  );

  const dialog = appDialog(page, R.dialogTitle);
  await demo.step('Se abre el diálogo de receta', async () => {
    await expect(dialog).toBeVisible({ timeout: 20_000 });
  });

  await demo.note('En la cabecera: fecha, doctor, plantilla, diagnóstico y notas');

  await demo.note('El doctor es obligatorio, y no es un dato menor: es de quien sale la firma');

  await demo.note('Después se agregan los medicamentos, uno por uno');

  await demo.note('Cada uno lleva el medicamento, del catálogo de la clínica, y su presentación');

  await demo.note('Dosis, vía, frecuencia, duración en días y cantidad');

  await demo.note('Las fechas de inicio y fin, y las indicaciones: «tomar con alimentos»');

  await demo.note('La receta no se guarda sin doctor y sin al menos un medicamento');

  await demo.click(
    dialog.getByRole('button', { name: R.close }).last(),
    'Cerramos sin guardar: es sólo la demostración',
  );

  await demo.finish('Permiso: PATIENT_PRESCRIPTIONS_CREATE');
});

demoTest(['q114', 'q115'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos una receta nueva', async () => {
    await openDemoPatient(page);
    await page.getByTestId(T.createMenu).click();
    await page.getByRole('menuitem').filter({ hasText: R.menuItem }).first().click();
    await expect(appDialog(page, R.dialogTitle)).toBeVisible({ timeout: 20_000 });
  });

  await demo.note('En cada medicamento hay una casilla: «Registrar en la anamnesis del paciente»');

  await demo.note('Marcada, ese medicamento pasa a la medicación activa del paciente');

  await demo.note('Y queda con el distintivo «En anamnesis», para saber cuáles se volcaron');

  await demo.note('Si después borrás la receta, el sistema avisa antes de quitarlos de la anamnesis');

  await demo.note('¿Y se puede ver cómo va a quedar antes de imprimir? Sí');

  await demo.note('El diálogo tiene dos paneles: Datos a un lado, Vista previa al otro');

  await demo.note('La vista previa muestra la receta ya armada con la plantilla elegida');

  await demo.step('Cerramos sin guardar', async () => {
    await appDialog(page, R.dialogTitle).getByRole('button', { name: R.close }).last().click();
  });

  await demo.finish();
});

demoTest(['q116', 'q117'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos una receta nueva', async () => {
    await openDemoPatient(page);
    await page.getByTestId(T.createMenu).click();
    await page.getByRole('menuitem').filter({ hasText: R.menuItem }).first().click();
    await expect(appDialog(page, R.dialogTitle)).toBeVisible({ timeout: 20_000 });
  });

  await demo.note('¿Hay que escribir los medicamentos en el cuerpo de la receta? No');

  await demo.note('Se cargan en los campos de arriba y el sistema arma la tabla al imprimir');

  await demo.note('Existe un editor del contenido, pero el propio sistema aclara para qué es');

  await demo.note('«Sólo si necesita apartarse de la plantilla»');

  await demo.note('La tabla de medicamentos y la firma se arman solas al imprimir');

  await demo.note('Ese editor sirve para ajustar el texto ALREDEDOR de la tabla, no la tabla');

  await demo.note('¿Y si dice que la receta saldrá sin firmar?');

  await demo.note('Es que el doctor elegido no tiene firma cargada en su perfil');

  await demo.note('Al lado del aviso hay un botón «Definir firma», sin salir de la receta');

  await demo.note('Podés subir una imagen o dibujarla, y queda guardada en el perfil del doctor');

  await demo.step('Cerramos sin guardar', async () => {
    await appDialog(page, R.dialogTitle).getByRole('button', { name: R.close }).last().click();
  });

  await demo.finish();
});

demoTest(['q118', 'q119'], async ({ demo, page }) => {
  // La segunda pregunta manda a una pantalla de configuración: el video va y la
  // muestra en vez de nombrarla.
  await demo.intro('/config/prescription-templates', 'Lo impreso y sus plantillas');

  await demo.note('La receta impresa lleva el título «Receta Médica»');

  await demo.note('Los datos y el logo de la clínica, el paciente, la fecha y el doctor');

  await demo.note('El diagnóstico, y la tabla de medicamentos con todas sus columnas');

  await demo.note('Medicamento, presentación, dosis, frecuencia, duración e indicaciones');

  await demo.note('Y al pie, la firma del profesional que la emite');

  await demo.step('El formato sale de una plantilla, y podés tener varias', async () => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 30_000 });
  });

  await demo.note('Acá se define el membrete, cómo se listan los medicamentos y dónde va la firma');

  await demo.note('Una plantilla por sede o por especialidad evita editar el membrete cada vez');

  await demo.finish('Permiso: PRESCRIPTION_TEMPLATES_VIEW');
});
