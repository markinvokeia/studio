/**
 * PARTE 1 — Recepción · La agenda: ver y buscar
 *
 * Todas de solo lectura: no crean ni modifican citas.
 *
 * Varias respuestas mandan a una preferencia del calendario. Como esos ajustes
 * NO están en /preferences sino en el botón de ajustes del propio calendario
 * (ver DRIFT.md), las demos abren ese panel y lo muestran.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { T, anyEvent, waitForCalendar } from './agenda.support';

const ready = (page: import('@playwright/test').Page) => () => waitForCalendar(page);

const V = {
  agendas: 'Agendas',
  calendars: 'Calendarios',
  doctors: 'Doctores',
  today: 'Hoy',
};

demoTest('q043', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Botón «Buscar cita»', { ready: ready(page) });

  await demo.click(
    page.getByRole('button', { name: T.searchAppointment }).first(),
    'Pulsá «Buscar cita» en la barra del calendario',
  );

  await demo.step('Se abre el panel de búsqueda', async () => {
    await expect(page.getByPlaceholder(T.searchPlaceholder)).toBeVisible({ timeout: 15_000 });
  });

  await demo.type(
    page.getByPlaceholder(T.searchPlaceholder),
    'Testing',
    'Buscá por nombre, teléfono, correo o documento del paciente',
  );

  await demo.note('También sirve el título de la cita');

  await demo.note(
    'Lo importante: busca en TODAS las fechas, no sólo en el período que estás viendo',
  );

  await demo.note('Es la herramienta para «la señora que llamó y no sé cuándo tenía turno»');

  await demo.note('Y se puede acotar a un calendario concreto');

  await demo.finish();
});

demoTest(['q044', 'q045'], async ({ demo, page }) => {
  await demo.intro('/appointments', '', { ready: ready(page) });

  await demo.click(
    page.getByRole('button', { name: V.agendas }).first(),
    'El botón «Agendas», arriba a la izquierda',
  );

  await demo.note('En modo Personalizado, que es el que viene por defecto, elegís cuál ver…');

  await demo.note('…y esa agenda ocupa la pantalla entera, bien legible');

  await demo.note('El panel se puede fijar para que quede siempre abierto al costado');

  await demo.note('Y recuerda la última agenda que estabas mirando, para la próxima vez');

  await demo.note('¿Y si querés ver varios consultorios a la vez? Ahí va el modo Invoke');

  await demo.note('Modo Invoke más «Agrupar por Consultorios» divide el calendario en columnas');

  await demo.note(
    'Con más de tres o cuatro recursos suele rendir más el Personalizado: las columnas se comprimen',
  );

  await demo.finish();
});

demoTest('q046', async ({ demo, page }) => {
  // OJO: los botones «Calendarios» y «Doctores» que describe el manual NO se
  // renderizan en el modo Personalizado, que es el que viene por defecto. Ahí el
  // control equivalente es el panel «Agendas» (ver DRIFT.md).
  await demo.intro('/appointments', 'Depende del modo de calendario', { ready: ready(page) });

  await demo.click(
    page.getByRole('button', { name: V.agendas }).first(),
    'En modo Personalizado, el panel «Agendas» es el que manda',
  );

  await demo.note('Ahí están todos los consultorios, agrupados por sede');

  await demo.note('Elegís uno y el calendario pasa a mostrar sólo esa agenda');

  await demo.note('Si trabajás en modo Invoke, en cambio, aparecen dos botones más en la barra');

  await demo.note('«Calendarios» y «Doctores», para mostrar u ocultar varios a la vez');

  await demo.note('Te dicen cuántos estás viendo, y traen Seleccionar Todo y Deseleccionar Todo');

  await demo.finish();
});

demoTest(['q047', 'q048'], async ({ demo, page }) => {
  await demo.intro('/appointments', '', { ready: ready(page) });

  await demo.spotlight(
    page.getByTestId('calendar-header-date-picker'),
    'Acá se elige la vista del calendario',
  );

  await demo.note('1 a 6 Días · Semana · Mes · Año · Agenda · Lista');

  await demo.note('¿Y para ver las citas más grandes? Hay dos controles que se combinan');

  await demo.note('El zoom del calendario: acercar, alejar y restablecer');

  await demo.note('Y la altura de la hora, de 60 a 200 píxeles, en los ajustes del calendario');

  await demo.note('Más la duración del slot, que define cuántas divisiones entran por hora');

  await demo.note(
    'La altura de una cita es proporcional a su duración: nunca se agranda para que entre el texto',
  );

  await demo.note('Si lo hiciera, taparía los huecos libres. Lo que hace es compactar la tarjeta');

  await demo.finish();
});

demoTest(['q049', 'q050'], async ({ demo, page }) => {
  await demo.intro('/appointments', '', { ready: ready(page) });

  const card = anyEvent(page).first();

  await demo.spotlight(
    card,
    'El texto de cada cita es configurable, y puede incluir el teléfono',
  );

  await demo.note('Por defecto: hora, paciente con su teléfono, y entre paréntesis notas y tratamiento');

  await demo.note('Se cambia en los ajustes del calendario → Formato de la cita');

  await demo.note('Para recepción ahorra abrir la ficha cada vez que hay que llamar para confirmar');

  await demo.note('¿Y si el paciente es un menor? Entonces no se llama a su teléfono');

  await demo.note('La cita muestra «Contacto del responsable», con el teléfono del tutor');

  await demo.note('Es lo que evita llamar al celular de un chico de ocho años para confirmar');

  await demo.finish();
});

demoTest('q051', async ({ demo, page }) => {
  await demo.intro('/appointments', 'Puede venir de tres lados', { ready: ready(page) });

  await demo.note('Primero: la reservó el propio paciente desde su portal');

  await demo.note('Esas entran en estado Pendiente, para que la clínica las confirme');

  await demo.note('Segundo: la cargó otro usuario, y el calendario se actualiza en vivo');

  await demo.note('No hace falta recargar: lo que hace la recepción aparece en el consultorio');

  await demo.note('Y tercero: viene importada de Google Calendar, si el consultorio tiene esa sincronización');

  await demo.note('Esas se reconocen por su distintivo azul');

  await demo.finish();
});
