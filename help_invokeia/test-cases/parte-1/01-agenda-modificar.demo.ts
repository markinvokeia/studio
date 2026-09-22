/**
 * PARTE 1 — Recepción · La agenda: modificar
 *
 * Estas demos operan sobre una cita real del calendario, así que cada una crea
 * la suya («Cita de ejemplo · demo») y la borra al terminar. Nunca se toca una
 * cita de la clínica: la base de DEV es compartida.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import {
  T,
  anyEvent,
  createDemoAppointment,
  deleteDemoAppointment,
  dragBy,
  waitForCalendar,
} from './agenda.support';

const ready = (page: import('@playwright/test').Page) => () => waitForCalendar(page);

demoTest('q029', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Arrastrala y soltala en el horario nuevo', {
    ready: ready(page),
  });

  await demo.step('Trabajamos sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.spotlight(card, 'Esta es la cita que vamos a mover');

  await demo.step('Agarrala y soltala una hora más abajo', async () => {
    await dragBy(page, card, 0, 110);
  });

  await demo.toast('El sistema confirma: «Cita movida», con el horario nuevo');

  await demo.note('Sirve igual para moverla a la columna de otro doctor o de otro consultorio');

  await demo.step('Y la quitamos, que era sólo para el ejemplo', async () => {
    await deleteDemoAppointment(page);
  });

  await demo.finish('Permiso: APPOINTMENTS_UPDATE');
});

demoTest('q030', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Arrastrá el borde inferior de la tarjeta', {
    ready: ready(page),
  });

  await demo.step('Partimos de una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();
  await demo.spotlight(card, 'Al pasar por el borde inferior aparece el tirador de duración');

  await demo.step('Estirala hacia abajo para alargar la cita', async () => {
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const bottom = box!.y + box!.height - 2;
    await page.mouse.move(x, bottom);
    await page.mouse.down();
    await page.mouse.move(x, bottom + 40, { steps: 10 });
    await page.mouse.move(x, bottom + 80, { steps: 10 });
    await page.mouse.up();
  });

  await demo.note('Confirma con «Duración actualizada», mostrando el horario y los minutos');

  await demo.note(
    'Si la cita es muy corta y no entra el tirador, subí la altura de la hora o usá el clic derecho → Duración',
  );

  await demo.step('Limpiamos la cita de ejemplo', async () => {
    await deleteDemoAppointment(page);
  });

  await demo.finish('Permiso: APPOINTMENTS_UPDATE');
});

demoTest('q035', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Clic derecho sobre una cita', { ready: ready(page) });

  await demo.step('Usamos una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Hacé clic derecho sobre la cita', async () => {
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  await demo.note('Cambiar estado · Mover a… · Duración');

  await demo.note('Editar · Reagendar · Cancelar · Eliminar');

  await demo.note('Ver estado de cuenta del paciente · Cambiar color · Enlazar presupuesto o factura');

  await demo.note('En tablet y celular, el equivalente es mantener pulsado sin mover el dedo');

  await demo.step('Cerramos el menú y limpiamos', async () => {
    await page.keyboard.press('Escape');
    await deleteDemoAppointment(page);
  });

  await demo.finish();
});

demoTest('q036', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Clic derecho → Llegó', { ready: ready(page) });

  await demo.step('Sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Clic derecho sobre la cita del paciente que acaba de llegar', async () => {
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  const arrived = page.getByRole('menuitem', { name: new RegExp(`^${T.status.arrived}$`, 'i') }).first();
  await demo.click(arrived, 'Elegí «Llegó»');

  await demo.note('El color de la cita cambia, y toda la clínica lo ve al instante');

  await demo.note('También se puede desde el panel de detalle de la cita o desde su línea de tiempo');

  await demo.step('Limpiamos la cita de ejemplo', async () => {
    await deleteDemoAppointment(page);
  });

  await demo.finish('Permiso: APPOINTMENTS_UPDATE');
});
