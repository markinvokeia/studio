/**
 * PARTE 2 — Consultorio · Historia clínica
 *
 * Fuera del triaje: q104 (el bloque «Alertas clínicas» vive en Mi Consultorio,
 * no en la cabecera de la ficha — ver DRIFT.md).
 *
 * Todas de solo lectura.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { anyEvent, waitForCalendar } from '../parte-1/agenda.support';
import { openDemoPatient, openPatientTab, T } from './paciente.support';

const S = {
  // Sub-pestañas de Historia clínica
  anamnesis: 'Anamnesis',
  timeline: 'Línea de tiempo',
  plans: 'Planes de Tratamiento',
  instructions: 'Indicaciones Médicas',
  documents: 'Documentos',
  // Bloques de la anamnesis
  personal: 'Información Personal',
  medications: 'Medicamentos',
  family: 'Información Familiar',
  allergies: 'Alergias',
  habits: 'Hábitos',
  // Línea de tiempo
  timelineTitle: 'Línea de Tiempo',
  addSession: 'Agregar sesión',
  // Hoja de historia clínica (se abre desde el calendario)
  contextHistory: 'Historia',
  printAction: 'Imprimir historia clínica',
};

demoTest(['q100', 'q102'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.click(
    page.getByText(T.tabHistory).first(),
    'La macro-pestaña «Historia clínica» reúne todo el registro asistencial',
  );

  await demo.spotlight(page.getByText(S.anamnesis).first(), 'Anamnesis: los antecedentes');
  await demo.spotlight(page.getByText(S.plans).first(), 'Planes de Tratamiento e Indicaciones Médicas');
  await demo.spotlight(page.getByText(S.documents).first(), 'Y Documentos, para radiografías e informes');

  await demo.click(
    page.getByText(S.timeline).first(),
    'La Línea de tiempo es donde ves todo lo que se le hizo',
  );

  await demo.step('Reúne sesiones clínicas, odontogramas y citas en una sola cronología', async () => {
    await expect(page.getByText(S.timelineTitle).first()).toBeVisible({ timeout: 20_000 });
  });

  await demo.note('Desde acá abrís el detalle de cualquier sesión');

  await demo.note('Y si tenés permiso, editás una cita o le cambiás el estado sin ir al calendario');

  await demo.finish('Permiso: PATIENTS_VIEW_DETAIL_HISTORY · TIMELINE_VIEW');
});

demoTest('q101', async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha y su historia clínica', async () => {
    await openDemoPatient(page);
    await openPatientTab(page, T.tabHistory);
  });

  await demo.click(page.getByText(S.anamnesis).first(), 'Entrá a la sub-pestaña Anamnesis');

  await demo.spotlight(
    page.getByText(S.allergies).first(),
    'Alergias, que es lo primero que hay que tener a mano',
  );

  await demo.spotlight(page.getByText(S.personal).first(), 'Información Personal y Familiar');

  await demo.spotlight(
    page.getByText(S.medications).first(),
    'Medicamentos, separando la medicación activa de la finalizada',
  );

  await demo.spotlight(
    page.getByText(S.habits).first(),
    'Y Hábitos: tabaquismo, alcoholismo, bruxismo',
  );

  await demo.note('Los medicamentos de una receta pueden pasar acá solos, si lo marcás al emitirla');

  await demo.finish('Permiso: ANAMNESIS_VIEW · ANAMNESIS_ADD_PERSONAL');
});

demoTest('q103', async ({ demo, page }) => {
  // El botón de imprimir NO está en la ficha del paciente: vive en la hoja de
  // historia clínica, que se abre desde el menú contextual de una cita.
  await demo.intro('/appointments', 'Se abre desde el menú contextual de una cita', {
    ready: () => waitForCalendar(page),
  });

  const card = anyEvent(page).first();
  await demo.step('Clic derecho sobre una cita del paciente', async () => {
    await expect(card, 'La demo necesita una cita visible en el calendario').toBeVisible({
      timeout: 20_000,
    });
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  // «Historia» no está al primer nivel: cuelga del submenú que abre el nombre
  // del paciente, junto a Cuentas, Imágenes y archivos e Historial de Citas.
  await demo.click(
    page.getByRole('menuitem').first(),
    'Pasá por el nombre del paciente, arriba del menú',
  );

  await demo.click(
    page.getByRole('menuitem', { name: S.contextHistory, exact: true }).first(),
    'Y elegí «Historia»',
  );

  await demo.spotlight(
    page.getByRole('button', { name: S.printAction }).first(),
    'Arriba está «Imprimir historia clínica»',
  );

  await demo.note('Genera el documento con los datos del paciente y la anamnesis completa');

  await demo.note(
    'Más el historial de sesiones en tabla: fecha, profesional, detalle y próxima cita',
  );

  await demo.note(
    'Si el paciente no tiene historia lo dice, en vez de imprimir una hoja vacía',
  );

  await demo.finish();
});
