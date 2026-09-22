/**
 * PARTE 1 — Recepción · el resto de «agendar», «modificar» y «estados».
 *
 * Preguntas cuya respuesta es una explicación o un gesto que no se puede
 * reproducir en un navegador de escritorio (el arrastre táctil de q033).
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import {
  T,
  anyEvent,
  createDemoAppointment,
  deleteDemoAppointment,
  waitForCalendar,
} from './agenda.support';

const ready = (page: import('@playwright/test').Page) => () => waitForCalendar(page);

demoTest('q024', async ({ demo, page }) => {
  // OJO: el manual dice «Preferencias → Calendario», pero /preferences NO tiene
  // sección Calendario en esta versión: los ajustes están en el botón de ajustes
  // del propio calendario (ver DRIFT.md).
  await demo.intro('/appointments', 'Los ajustes del calendario, en el propio calendario', {
    ready: ready(page),
  });

  await demo.note('Abrí los ajustes del calendario desde su barra de herramientas');

  await demo.note('Ahí encendés «Crear cita en el calendario (sin modal)»');

  await demo.note(
    'Con eso, al hacer clic en un hueco la cita se crea directo sobre la rejilla, sin abrir ninguna ventana',
  );

  await demo.note('Es el camino más rápido para agendar en mostrador con el paciente delante');

  await demo.note('El botón Crear sigue abriendo el formulario completo igual');

  await demo.finish();
});

demoTest('q026', async ({ demo, page }) => {
  await demo.intro('/appointments', 'La columna en la que hacés clic ya queda elegida', {
    ready: ready(page),
  });

  await demo.note('No hace falta volver a elegir el consultorio');

  await demo.note(
    'Estando en vista agrupada, al hacer clic dentro de la columna de un consultorio o de un doctor…',
  );

  await demo.note('…ese recurso queda seleccionado por defecto en la cita nueva');

  await demo.finish();
});

demoTest('q031', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Arrastrala, o clic derecho → Mover a…', { ready: ready(page) });

  await demo.step('Sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Clic derecho sobre la cita', async () => {
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  const moveTo = page.getByRole('menuitem', { name: /mover a/i }).first();
  await demo.spotlight(moveTo, '«Mover a…» te deja elegir el consultorio o el doctor destino');

  await demo.note('La otra forma es arrastrarla directamente a la columna del otro recurso');

  await demo.step('Cerramos y limpiamos', async () => {
    await page.keyboard.press('Escape');
    await deleteDemoAppointment(page);
  });

  await demo.finish();
});

demoTest('q032', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Tres formas, según la distancia', { ready: ready(page) });

  await demo.note('En vista de mes: arrastrala directamente al día destino');

  await demo.note(
    'Arrastrando hasta el borde lateral y sosteniendo: el calendario cambia de período solo…',
  );

  await demo.note('…y podés encadenar varias semanas sin soltar la cita');

  await demo.note('O editás la cita y le cambiás la fecha a mano');

  await demo.note('La cita conserva su color al moverse entre períodos');

  await demo.finish();
});

demoTest('q033', async ({ demo, page }) => {
  await demo.intro('/appointments', 'En táctil cambia el gesto, no la función', {
    ready: ready(page),
  });

  await demo.note('Mantené el dedo apretado un instante sobre la cita, y después arrastrá');

  await demo.note('Si el dedo no se mueve, en cambio, se abre el menú contextual');

  await demo.note('Es la misma distinción que en escritorio hay entre arrastrar y clic derecho');

  await demo.finish();
});

demoTest('q034', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Doble clic, o clic derecho → Editar', { ready: ready(page) });

  await demo.step('Sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Hacé doble clic sobre la cita', async () => {
    await card.dblclick();
  });

  await demo.note('Se abre el formulario con todos los datos de la cita para modificarlos');

  await demo.step('Cerramos sin guardar y limpiamos', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_000);
    await deleteDemoAppointment(page);
  });

  await demo.finish();
});

demoTest('q037', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Los diez estados de una cita', { ready: ready(page) });

  await demo.step('Sobre una cita de ejemplo', async () => {
    await createDemoAppointment(page);
  });

  const card = anyEvent(page).filter({ hasText: /demo/i }).first();

  await demo.step('Clic derecho → Cambiar estado', async () => {
    await card.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible();
  });

  await demo.note('Pendiente: llegó la solicitud, todavía no está agendada en firme');

  await demo.note('Programada es «agendada pero sin confirmar»; Confirmada es que el paciente confirmó');

  await demo.note('Llegó · Llegó tarde · En curso · Completada · Se le atiende tarde');

  await demo.note('No asistió, cuando no se presentó. Y Cancelada, que siempre lleva un motivo');

  await demo.step('Cerramos y limpiamos', async () => {
    await page.keyboard.press('Escape');
    await deleteDemoAppointment(page);
  });

  await demo.finish();
});

demoTest('q038', async ({ demo, page }) => {
  await demo.intro('/appointments', 'El color sale de una cadena de herencia', { ready: ready(page) });

  await demo.note('Etiqueta propia de la cita → Servicio → Doctor → Consultorio');

  await demo.note('Y encima de eso, el estado');

  await demo.note(
    'Si la cita tiene color propio o de servicio, lo conserva y el estado va como franja a la izquierda',
  );

  await demo.note(
    'Si sólo hereda el color del doctor o del consultorio, se pinta entera con el color del estado',
  );

  await demo.note(
    'Lila es Programada: todavía no confirmó. Gris oscuro es No asistió. Esos dos se pintan siempre',
  );

  await demo.note('Son los dos que hay que reconocer de un vistazo, sin leer nada');

  await demo.finish();
});
