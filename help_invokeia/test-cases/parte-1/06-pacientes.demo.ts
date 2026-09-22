/**
 * PARTE 1 — Recepción · Pacientes
 *
 * q055 y q057 abren el formulario de alta y lo cierran sin guardar: crear
 * pacientes de prueba en DEV ensucia un listado de más de catorce mil registros
 * reales y dispara el contador de altas de la licencia.
 *
 * q064 y q065 (WhatsApp y correo) necesitan un paciente CON teléfono y correo:
 * la app oculta esas acciones cuando el dato falta. Ver DRIFT.md.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { openDemoPatient, T } from '../parte-2/paciente.support';

const P = {
  create: 'Crear',
  // Formulario de alta
  name: /^nombre/i,
  dependent: /paciente dependiente/i,
  guardian: /contacto responsable/i,
  cancel: /^cancelar$/i,
  // Filtros del listado
  onlyDebtors: /solo deudores|mostrar solo deudores/i,
  onlyActive: /solo activos|mostrar solo activos/i,
  filters: /filtro|filtrar/i,
};

demoTest(['q055', 'q056'], async ({ demo, page }) => {
  await demo.intro('/patients', 'Pacientes → Crear');

  await demo.click(
    page.getByRole('button', { name: P.create }).first(),
    'El botón Crear, arriba del listado',
  );

  const form = page.getByRole('dialog').filter({ hasText: /paciente/i }).first();
  await demo.step('Se abre el formulario de alta', async () => {
    await expect(form).toBeVisible({ timeout: 20_000 });
  });

  await demo.spotlight(
    form.getByLabel(P.name).first(),
    'Sólo el nombre es obligatorio',
  );

  await demo.note('Correo, teléfono, documento, fecha de nacimiento, sexo y dirección');

  await demo.note('Más el doctor por defecto, la sociedad mutual y los grupos');

  await demo.note('Hace falta al menos un correo o un teléfono: sin ninguno de los dos no guarda');

  await demo.note('¿Y si te dice que el correo ya está registrado?');

  await demo.note('El sistema te dice exactamente qué campos chocan, no te deja adivinando');

  await demo.note('Buscá ese dato en el listado: lo más probable es que la persona ya exista');

  await demo.note('Si es un familiar que comparte el correo, dejá ese campo vacío y usá el teléfono');

  await demo.click(
    form.getByRole('button', { name: P.cancel }).last(),
    'Cerramos sin guardar: es sólo la demostración',
  );

  await demo.finish('Permiso: PATIENTS_CREATE');
});

demoTest(['q057', 'q058'], async ({ demo, page }) => {
  await demo.intro('/patients', 'El caso del menor con su tutor');

  await demo.click(page.getByRole('button', { name: P.create }).first(), 'Abrí el alta de paciente');

  const form = page.getByRole('dialog').filter({ hasText: /paciente/i }).first();
  await expect(form).toBeVisible({ timeout: 20_000 });

  await demo.spotlight(
    form.getByText(P.dependent).first(),
    'Marcá «Paciente dependiente»: menor, adulto mayor, alguien a cargo de un tutor',
  );

  await demo.note('Y buscá al tutor entre los pacientes que ya existen');

  await demo.note('Si el tutor todavía no existe, la lista te ofrece «Crear tutor» ahí mismo');

  await demo.note('Se abre un formulario reducido y al guardarlo queda asignado como responsable');

  await demo.note('Antes había que cancelar el alta del chico, crear al padre, y empezar de nuevo');

  await demo.note('¿Qué cambia después? El listado le pone el distintivo «Paciente dependiente»');

  await demo.note('La ficha muestra «Dependiente de», con enlace al perfil del responsable');

  await demo.note('La cita muestra el «Contacto del responsable» con su teléfono');

  await demo.note('Y los avisos y recordatorios se dirigen al responsable, no al paciente');

  await demo.click(form.getByRole('button', { name: P.cancel }).last(), 'Cerramos sin guardar');

  await demo.finish();
});

demoTest(['q059', 'q060'], async ({ demo, page }) => {
  await demo.intro('/patients', 'Mutualista y grupos, en la ficha del paciente');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.note('En sus datos está el campo de sociedad mutual: elegís una, o «Sin asignar»');

  await demo.note('El catálogo se administra en Configuración de Negocio → Sociedades Mutuales');

  await demo.note('Y más abajo, «Grupos del paciente»: selección múltiple con buscador');

  await demo.note('Un paciente puede estar en varios grupos a la vez: convenios, planes, campañas');

  await demo.note('Te dice cuántos tiene, o que no pertenece a ninguno');

  await demo.note('Después podés filtrar el Balance Mensual por grupo, o segmentar envíos');

  await demo.finish();
});

demoTest(['q061', 'q062'], async ({ demo, page }) => {
  await demo.intro('/patients', 'Los filtros del listado');

  await demo.spotlight(
    page.getByPlaceholder(T.filterPlaceholder).first(),
    'El buscador va por nombre, correo o documento',
  );

  const filterBtn = page.getByRole('button', { name: P.filters }).first();
  if (await filterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await demo.click(filterBtn, 'Y al lado están el resto de los filtros');
  }

  await demo.note('Tipo de paciente: todos, paciente, doctor o proveedor');

  await demo.note('Rango de fechas: hoy, esta semana, este mes, personalizado o todo el tiempo');

  await demo.note('«Mostrar solo activos», para sacar de la vista a los dados de baja');

  await demo.note('Y «Mostrar solo deudores», que es el filtro de cobranza');

  await demo.note('Ese último necesita su propio permiso: no todos los roles lo ven');

  await demo.finish('Permiso: PATIENTS_SEARCH_DEBTORS');
});

demoTest(['q063', 'q066'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.note('El historial de citas del paciente está en su propia sub-pestaña');

  await demo.note('Muestra las pasadas y las futuras, cada una con su estado');

  await demo.note('Y desde ahí podés crear o editar citas sin ir al calendario, si tenés permiso');

  // La ficha ya abre en Información → Detalles, así que se va directo a Notas.
  await demo.click(
    page.getByText(T.subNotes, { exact: true }).first(),
    'Para anotar algo administrativo: Información → Notas',
  );

  await demo.note('Texto libre para observaciones sobre el paciente');

  await demo.note('Ojo: esto NO es la historia clínica. Lo asistencial va en la sesión clínica');

  await demo.finish('Permiso: PATIENTS_VIEW_DETAIL_APPOINTMENTS · PATIENTS_VIEW_DETAIL_NOTES');
});

demoTest(['q067', 'q068'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.click(page.getByTestId(T.moreMenu), 'En «Más acciones» está «Dar Alta»');

  await demo.note('Dar de alta cierra el ciclo de tratamiento y registra la fecha');

  await demo.note('Para reabrirlo, el mismo menú ofrece «Reingreso»');

  await demo.note('También se puede dar el alta al guardar una sesión clínica, con una casilla');

  await demo.step('Y una nota sobre las columnas del listado', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  });

  await demo.note('Las columnas de correo y teléfono dependen de un permiso');

  await demo.note('Si no las ves, es que tu rol no tiene «ver los datos de contacto del paciente»');

  await demo.note('Es lo que permite dar acceso clínico sin exponer datos personales');

  await demo.finish('Permiso: PATIENTS_VIEW_DETAIL_INFO');
});
