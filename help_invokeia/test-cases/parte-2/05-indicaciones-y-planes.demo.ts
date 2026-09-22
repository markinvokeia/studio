/**
 * PARTE 2 — Consultorio · Indicaciones al paciente y Planes de tratamiento
 *
 * De solo lectura: abren los diálogos y los cierran sin guardar.
 *
 * q122 manda a una pantalla de configuración, así que el video va y la muestra.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { openDemoPatient, openPatientTab, T } from './paciente.support';

const I = {
  subInstructions: 'Indicaciones Médicas',
  subPlans: 'Planes de Tratamiento',
  close: /^cerrar$/i,
  cancel: /^cancelar$/i,
};

demoTest(['q120', 'q121'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha y su historia clínica', async () => {
    await openDemoPatient(page);
    await openPatientTab(page, T.tabHistory);
  });

  await demo.click(
    page.getByText(I.subInstructions).first(),
    'Sub-pestaña «Indicaciones Médicas»',
  );

  await demo.note('Son las instrucciones que se le entregan al paciente por escrito');

  await demo.note('Cuidados post-extracción, preparación previa, pautas de higiene');

  await demo.note('Elegís una plantilla, por ejemplo «Post-extracción»');

  await demo.note('El sistema completa solo las variables: nombre, clínica, fecha, pieza dental');

  await demo.note('Ajustás el texto si hace falta, y lo imprimís');

  await demo.note('¿Se puede imprimir en el momento de guardarla? Sí, y está pensado así');

  await demo.note('Al guardar, el diálogo NO se cierra, justamente para que imprimas ahí mismo');

  await demo.note('Antes había que cerrarlo y volver a abrirlo sólo para imprimir');

  await demo.finish('Permiso: PATIENT_MEDICAL_INSTRUCTIONS_CREATE');
});

demoTest('q122', async ({ demo, page }) => {
  await demo.intro(
    '/config/medical-instruction-templates',
    'Configuración → Plantillas de Indicaciones Médicas',
    {
      ready: async () => {
        await expect(page.locator('table').first()).toBeVisible({ timeout: 30_000 });
      },
    },
  );

  await demo.note('Cada plantilla tiene nombre, descripción, contenido y si está activa');

  await demo.note('El nombre es el que vas a ver al emitir la indicación: «Post-extracción»');

  await demo.note('El botón «Variables» inserta los campos que se completan solos');

  await demo.note('Nombre del paciente, clínica, fecha y pieza dental');

  await demo.note('Y hay vista previa, para ver el resultado antes de guardar la plantilla');

  await demo.finish('Permiso: MEDICAL_INSTRUCTION_TEMPLATES_CREATE');
});

demoTest(['q123', 'q124'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha y su historia clínica', async () => {
    await openDemoPatient(page);
    await openPatientTab(page, T.tabHistory);
  });

  await demo.click(page.getByText(I.subPlans).first(), 'Sub-pestaña «Planes de Tratamiento»');

  await demo.note('Un plan es el seguimiento de algo que necesita varias citas seguidas');

  await demo.note('Ortodoncia, implantes, endodoncias de varias sesiones');

  await demo.note('No se crean a mano: se generan solos al agendar un «servicio con flujo»');

  await demo.note('Al agendar, el formulario avisa: «esta cita creará un plan con N pasos»');

  await demo.note('Acá seguís el avance: estado activo, completado, cancelado o pausado');

  await demo.note('El progreso con los hitos cumplidos, la próxima cita y el paso siguiente');

  await demo.note('Y «Paso Ausente» cuando alguno quedó sin hacer');

  await demo.note('Desde acá editás los pasos, o creás directamente la cita del paso siguiente');

  await demo.finish();
});

demoTest('q125', async ({ demo, page }) => {
  await demo.intro('/patients', 'El sistema los marca solo');

  await demo.step('Abrimos los planes de tratamiento del paciente', async () => {
    await openDemoPatient(page);
    await openPatientTab(page, T.tabHistory);
    await page.getByText(I.subPlans).first().click();
    await page.waitForTimeout(2_000);
  });

  await demo.note('Cuando un plan queda abandonado, el sistema lo marca sin que nadie revise');

  await demo.note('«Paciente con tratamiento interrumpido» y «Sin reprogramar hace N días»');

  await demo.note('Con un botón «Contactar» directo, al lado del aviso');

  await demo.note('En la práctica es la herramienta de recuperación de pacientes');

  await demo.note('Identifica sola a quien dejó algo a medias. Conviene revisarla con periodicidad fija');

  await demo.finish();
});
