/**
 * PARTE 1 — Recepción · La agenda: herramientas
 *
 * q052 y q053 abren sus diálogos y los cierran sin ejecutar: exportar descargaría
 * un archivo y reasignar en lote movería citas reales de la clínica.
 * q054 crea un recordatorio y lo borra.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { appDialog } from '../../lib/selectors';
import { T, waitForCalendar } from './agenda.support';

const ready = (page: import('@playwright/test').Page) => () => waitForCalendar(page);

const H = {
  exportExcel: /exportar agenda a excel|exportar agenda/i,
  bulkTitle: /operaciones en lotes/i,
  reminder: /recordatorio/i,
  note: /^crear nota$/i,
  cancel: 'Cancelar',
};

demoTest('q052', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Exportar agenda a Excel', { ready: ready(page) });

  await demo.note('La planilla para imprimir y dejar en el mostrador, o darle al profesional');

  await demo.note('Elegís el calendario y el período: día, semana, mes o un rango');

  await demo.note('Y descarga tres columnas: horario, nombre y apellido, y teléfono');

  await demo.note(
    'Importante: el Excel excluye las canceladas y las ausencias. Es quién efectivamente viene',
  );

  await demo.finish();
});

demoTest('q053', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Operaciones en Lotes', { ready: ready(page) });

  await demo.click(
    page.getByRole('button', { name: T.bulkMode }).first(),
    'Pulsá «Operaciones en Lotes» en la barra del calendario',
  );

  await demo.note('Primero filtrás: rango de fechas, doctores, calendarios y estados');

  await demo.note('Después «Buscar y seleccionar»: el sistema te dice cuántas citas entraron');

  await demo.note('Y por último «Reasignar doctor»: elegís el destino y confirmás');

  await demo.note('Te informa cuántas se reasignaron y, si hubo fallos, cuántas no');

  await demo.note(
    'Antes de reasignar verificá que el doctor destino preste esos servicios y tenga hueco',
  );

  await demo.note('La reasignación masiva no valida disponibilidad cita por cita');

  await demo.finish();
});

demoTest('q054', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Botón Crear → Recordatorio', { ready: ready(page) });

  await demo.click(page.getByRole('button', { name: T.create }).first(), 'Abrí el menú Crear');

  await demo.spotlight(
    page.getByRole('menuitem').filter({ hasText: H.reminder }).first(),
    'Además de citas, el calendario guarda recordatorios y notas',
  );

  await demo.note('El recordatorio es una tarea interna con prioridad y vencimiento: avisa');

  await demo.note('La nota es silenciosa: se ve en el calendario, pero no avisa nada');

  await demo.click(
    page.getByRole('menuitem').filter({ hasText: H.reminder }).first(),
    'Creemos un recordatorio',
  );

  await demo.note('Título, descripción, fecha, hora y duración, con un mínimo de cinco minutos');

  await demo.note('Prioridad baja, media o alta. Más el calendario y el color');

  await demo.note('La casilla «Solo para mí» define el alcance');

  await demo.note('Sin marcar es general: todo el equipo puede verlo, editarlo y eliminarlo');

  await demo.note('Marcada es personal, y sólo quien lo creó puede cambiar ese alcance');

  await demo.note('«Mejorar con IA» pule la redacción y detecta acciones dentro del texto');

  await demo.note(
    'Si dice «presupuestar la ortodoncia de la señora Pérez», te ofrece crear el presupuesto',
  );

  await demo.step('Cerramos sin guardar', async () => {
    const dialog = appDialog(page, H.reminder);
    const cancel = dialog.getByRole('button', { name: H.cancel }).last();
    if (await cancel.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await cancel.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(page.getByRole('button', { name: T.today })).toBeVisible({ timeout: 15_000 });
  });

  await demo.finish();
});
