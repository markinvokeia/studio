/**
 * PARTE 2 — Consultorio · Empezar el día
 *
 * Regla de estas demos: cuando la respuesta menciona una configuración, el video
 * **va hasta esa pantalla y la muestra**. Y cuando hay varias formas de hacer
 * algo, se muestran todas, aunque el video quede más largo.
 *
 * La cuenta con la que se graba no tiene citas asignadas hoy, así que el
 * workspace se filma en su estado vacío. Es honesto —es lo que ve un profesional
 * sin agenda— y muestra igual los controles, que es lo que preguntan.
 */
import { demoTest, expect } from '../../lib/demo.fixture';

const T = {
  // DoctorWorkspacePage
  agendaTitle: 'Agenda del día',
  assignedToMe: 'Asignadas a mí',
  myCalendars: 'Mis calendarios',
  // PreferencesPage.*
  workspaceSection: 'Espacio de trabajo',
  alertStyleModal: 'Modal',
  alertStyleToast: 'Notificación',
  // CalendarsPage
  calendarsFilter: 'Filtrar aquí...',
};

const workspaceReady = (page: import('@playwright/test').Page) => async () => {
  await page.getByText(T.agendaTitle).first().waitFor({ state: 'visible', timeout: 30_000 });
};

demoTest(['q084', 'q085'], async ({ demo, page }) => {
  await demo.intro('/workspace', '', { ready: workspaceReady(page) });

  await demo.spotlight(
    page.getByText(T.agendaTitle).first(),
    'Mi Consultorio es la pantalla para pasar la jornada adentro',
  );

  await demo.spotlight(
    page.getByRole('button', { name: T.assignedToMe }),
    '«Asignadas a mí» son tus citas del día',
  );

  await demo.spotlight(
    page.getByRole('button', { name: T.myCalendars }),
    'Y «Mis calendarios», las de las agendas a las que tenés acceso',
  );

  await demo.note('Al elegir una cita se abre el panel clínico rápido, con tres accesos');

  await demo.note('Paciente abre su ficha completa');

  await demo.note(
    'Contexto arma con ayuda de IA los antecedentes, los tratamientos en curso y lo último de la visita anterior',
  );

  await demo.note('Y Sesión abre el diálogo para registrar lo que hiciste');

  await demo.finish('Permiso: DASHBOARD_DOCTOR_WORKSPACE_ACCESS');
});

demoTest(['q086', 'q087'], async ({ demo, page }) => {
  await demo.intro('/workspace', '', { ready: workspaceReady(page) });

  // El selector de día se rotula con la fecha actual («Jueves 17 Sep»).
  const dayPicker = page.getByRole('button').filter({ hasText: /\d{1,2}\s+\w{3}/ }).first();

  await demo.spotlight(dayPicker, 'Arriba de la agenda está el selector de período');

  await demo.click(dayPicker, 'Abrilo para elegir otro día');

  await demo.note('Hoy · Mañana · Esta semana · Próximos 7 días, o un rango que armes vos');

  await demo.note('En el rango personalizado marcás primero el día de inicio y después el de fin');

  await demo.note(
    'Ojo: los días que no son hoy se abren en solo lectura, con la marca «Solo lectura (no es hoy)»',
  );

  await demo.note('Es deliberado: el registro clínico se hace el día de la atención');

  await demo.step('Para ver o corregir otra fecha, el camino es la ficha del paciente', async () => {
    await page.keyboard.press('Escape');
    await page.goto('/patients', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 25_000 });
  });

  await demo.note('Historia clínica → Línea de tiempo, donde está todo lo que se le hizo');

  await demo.finish();
});

demoTest('q088', async ({ demo, page }) => {
  await demo.intro('/workspace', 'El acceso se define consultorio por consultorio', {
    ready: workspaceReady(page),
  });

  await demo.spotlight(
    page.getByRole('button', { name: T.myCalendars }),
    'Acá ves las agendas a las que tenés acceso',
  );

  // La respuesta menciona una pantalla de configuración: hay que ir y mostrarla.
  await demo.step('Quién ve cada agenda se define en Configuración → Calendarios', async () => {
    await page.goto('/config/calendars', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 25_000 });
  });

  await demo.click(
    page.locator('table tbody tr').first(),
    'Abrí el consultorio que quieras revisar',
  );

  await demo.note('En su pestaña «Doctores con acceso» se elige quién lo ve desde su workspace');

  await demo.note('Es lo que evita que cada profesional vea las agendas de todos sus colegas');

  await demo.note('Si te falta una agenda, pedile a administración que te agregue ahí');

  await demo.finish();
});

demoTest(['q089', 'q090'], async ({ demo, page }) => {
  await demo.intro('/workspace', '', { ready: workspaceReady(page) });

  await demo.note('El sistema te avisa en el momento, sin que tengas que recargar nada');

  await demo.note('Tienes una cita nueva · Una cita cambió de estado · Se reagendó una cita de hoy');

  await demo.note('Te reasignaron una cita · Se editó una cita de hoy');

  await demo.note('Cada aviso te ofrece abrir la primera cita, o cerrarlo');

  await demo.step('Y si te interrumpen, se cambia en Preferencias → Espacio de trabajo', async () => {
    await page.goto('/preferences', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(T.workspaceSection).first()).toBeVisible({ timeout: 25_000 });
  });

  await demo.spotlight(
    page.getByText(T.workspaceSection).first(),
    'Acá está «Estilo de alertas»',
  );

  await demo.click(
    page.getByRole('button', { name: T.alertStyleModal }),
    'Modal abre una ventana en el centro: imposible de ignorar',
  );

  await demo.click(
    page.getByRole('button', { name: T.alertStyleToast }),
    'Notificación es un mensaje discreto en la esquina, que se desvanece solo',
  );

  await demo.finish();
});
