/**
 * PARTE 1 — Recepción · La agenda: agendar
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { T, appointmentForm, waitForCalendar } from './agenda.support';

const ready = (page: import('@playwright/test').Page) => () => waitForCalendar(page);

demoTest('q022', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Cinco caminos; cambia el punto de partida', {
    ready: ready(page),
  });

  await demo.note('El más directo: hacés clic sobre un hueco libre del calendario');

  await demo.spotlight(
    page.getByRole('button', { name: T.create }).first(),
    'Con el botón Crear se abre el formulario completo',
  );

  await demo.note('También desde la ficha del paciente, desde el panel de huecos disponibles…');

  await demo.note('…o lo reserva el propio paciente desde su portal, sin que intervenga la recepción');

  await demo.finish('Permiso: APPOINTMENTS_CREATE');
});

demoTest('q023', async ({ demo, page }) => {
  await demo.intro('/appointments', 'El formulario de cita', { ready: ready(page) });

  await demo.click(
    page.getByRole('button', { name: T.create }).first(),
    'Abrí el menú Crear de la barra del calendario',
  );
  await demo.click(page.getByRole('menuitem').first(), 'Elegí «Crear cita»');

  const form = appointmentForm(page);
  await demo.step('Se abre el formulario de cita', async () => {
    await expect(form).toBeVisible();
  });

  await demo.spotlight(
    form.getByText(T.createDialog.patient),
    'Paciente: es obligatorio, sin él no se puede guardar',
  );

  await demo.spotlight(
    form.getByText(T.createDialog.service),
    '«¿Qué se realiza?» es el servicio, y de ahí sale la duración',
  );

  await demo.spotlight(
    form.getByText(T.createDialog.from).first(),
    'Fecha, «Desde» y «Hasta»: al lado se ve la duración que resulta',
  );

  await demo.spotlight(
    form.getByText(T.createDialog.doctor).first(),
    'Doctor y consultorio se eligen acá',
  );

  await demo.spotlight(
    form.getByPlaceholder(T.createDialog.note),
    'Y «Anotación» para lo que haga falta aclarar',
  );

  await demo.note('La hora de fin tiene que ser posterior a la de inicio');

  await demo.note(
    'Si el servicio es «con flujo», avisa que agendar creará un plan de tratamiento con N pasos',
  );

  await demo.click(
    form.getByRole('button', { name: T.createDialog.cancel }).last(),
    'Acá cerramos sin guardar',
  );

  await demo.finish();
});

demoTest('q025', async ({ demo, page }) => {
  await demo.intro('/appointments', 'La duración sale del servicio', { ready: ready(page) });

  await demo.click(page.getByRole('button', { name: T.create }).first(), 'Abrí el menú Crear');
  await demo.click(page.getByRole('menuitem').first(), 'Elegí «Crear cita»');

  const form = appointmentForm(page);

  await demo.spotlight(
    form.getByText(T.createDialog.to).first(),
    'Al abrir, la cita ya trae una duración por defecto',
  );

  await demo.spotlight(
    form.getByText(T.createDialog.service),
    'Al elegir el servicio, la cita toma la duración configurada para ese servicio',
  );

  await demo.note(
    'Si no elegís servicio, toma la duración del slot configurado en tus preferencias de calendario',
  );

  await demo.click(form.getByRole('button', { name: T.createDialog.cancel }).last(), 'Cerramos');

  await demo.finish();
});

demoTest('q027', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Botón «Buscar huecos»', { ready: ready(page) });

  await demo.click(
    page.getByRole('button', { name: T.searchGaps }).first(),
    'Pulsá Buscar huecos en la barra del calendario',
  );

  await demo.step('Se abre el panel de huecos disponibles', async () => {
    await expect(page.getByText(T.gapsPanelTitle).first()).toBeVisible();
  });

  await demo.note('Lista los espacios libres con su duración, y marca «Mayor» el hueco más grande');

  await demo.note('Sólo muestra huecos dentro del horario de atención de la clínica');

  await demo.note(
    'Si dice que no hay ninguno, puede ser que el día esté lleno o que ese día no se atienda',
  );

  await demo.finish();
});

demoTest('q028', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Horarios bloqueados fuera de atención', {
    ready: ready(page),
  });

  await demo.note(
    'Los horarios fuera del horario de atención aparecen atenuados y marcados «No disponible»',
  );

  await demo.note(
    'Si intentás agendar ahí: «La fecha y hora seleccionada está fuera del horario de atención»',
  );

  await demo.note(
    'Se controla en Preferencias → Calendario → Bloquear horarios fuera de atención',
  );

  await demo.note('Y el horario de atención se define en Configuración de Negocio → Horarios');

  await demo.finish();
});
