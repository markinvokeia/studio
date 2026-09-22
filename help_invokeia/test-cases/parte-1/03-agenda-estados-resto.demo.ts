/**
 * PARTE 1 — Recepción · La agenda: estados (lo que faltaba)
 *
 * q039, q040 y q042 operan sobre una cita, así que cada demo crea la suya y la
 * borra. No se toca ninguna cita real de la clínica.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import {
  anyEvent,
  createDemoAppointment,
  deleteDemoAppointment,
  waitForCalendar,
} from './agenda.support';

const ready = (page: import('@playwright/test').Page) => () => waitForCalendar(page);

const M = {
  changeColor: 'Cambiar color',
  cancelSubmenu: 'Cancelar…',
  reschedule: 'Reagendar',
  deleteAppointment: 'Eliminar cita',
};

demoTest('q039', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Clic derecho → Cambiar color', { ready: ready(page) });

  await demo.step('Trabajamos sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Clic derecho sobre la cita', async () => {
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  await demo.click(
    page.getByRole('menuitem', { name: M.changeColor }).first(),
    'Elegí «Cambiar color»',
  );

  await demo.note('Un color puesto a mano manda sobre el del servicio, el doctor y el consultorio');

  await demo.note('Y también sobre el coloreado por estado: el estado pasa a la franja lateral');

  await demo.step('Cerramos y limpiamos', async () => {
    await page.keyboard.press('Escape');
    await deleteDemoAppointment(page);
  });

  await demo.finish();
});

demoTest(['q040', 'q041'], async ({ demo, page }) => {
  await demo.intro('/appointments', '', { ready: ready(page) });

  await demo.step('Sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Clic derecho sobre la cita a cancelar', async () => {
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  await demo.note('Los motivos más usados están directo en el menú');

  await demo.note('Cancelada con tiempo · Cancelada tarde · Cancelada por el doctor');

  await demo.spotlight(
    page.getByRole('menuitem', { name: M.cancelSubmenu }).first(),
    'Y en «Cancelar…» está el resto, incluido «Otro motivo» con texto libre',
  );

  await demo.note('«Reagendada» no se puede elegir a mano: la pone el sistema al reagendar');

  await demo.note('Cargá siempre el motivo real: el reporte de Cancelaciones analiza por motivo');

  await demo.spotlight(
    page.getByRole('menuitem', { name: M.deleteAppointment }).first(),
    'Ojo con la diferencia: eliminar no es lo mismo que cancelar',
  );

  await demo.note('Cancelar deja registro, con su motivo, y alimenta los reportes');

  await demo.note('Eliminar la borra del sistema, y sólo se ofrece desde estados sin historia');

  await demo.note('En la operación normal, cancelar. Eliminar es para la cita cargada por error');

  await demo.step('Cerramos y limpiamos', async () => {
    await page.keyboard.press('Escape');
    await deleteDemoAppointment(page);
  });

  await demo.finish();
});

demoTest('q042', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Clic derecho → Reagendar', { ready: ready(page) });

  await demo.step('Sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Clic derecho sobre la cita', async () => {
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  await demo.note('Reagendar no es lo mismo que arrastrar la cita');

  await demo.note('Arrastrarla la mueve. Reagendar cancela la original con motivo «Reagendada»…');

  await demo.note('…y crea una nueva. Quedan las dos registradas, con trazabilidad');

  await demo.note('Desde los estados terminales no se puede: Completada, Cancelada, No asistió');

  await demo.step('Cerramos y limpiamos', async () => {
    await page.keyboard.press('Escape');
    await deleteDemoAppointment(page);
  });

  await demo.finish();
});
