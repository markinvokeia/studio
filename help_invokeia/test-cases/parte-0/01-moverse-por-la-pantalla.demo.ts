/**
 * PARTE 0 — Para todos · Moverse por la pantalla
 *
 * Fuera del triaje: q006 y q009 (conceptuales — exigen dos sesiones con roles
 * distintos para mostrar el contraste; ver filmability.overrides.json).
 */
import { demoTest, expect } from '../../lib/demo.fixture';

const T = {
  // Nav de la barra lateral (src/config/nav.ts)
  navPacientes: 'Pacientes',
  navPanelControl: 'Panel de Control',
  // Tira derecha: data-testid="rail-<label>" en header.tsx
  railPaciente: 'rail-paciente',
  railCaja: 'rail-caja',
  railNotas: 'rail-notas',
  railCambio: 'rail-cambio',
  // Diálogo de descartar cambios
  discardTitle: /descartar cambios/i,
  keepEditing: /seguir editando/i,
};

demoTest('q007', async ({ demo, page }) => {
  await demo.intro('/patients', 'Tres zonas fijas: navegación, trabajo y acciones');

  await demo.spotlight(
    page.locator('nav').first(),
    'A la izquierda, la barra de navegación: el índice del sistema',
  );

  await demo.spotlight(
    page.locator('main').first(),
    'En el centro trabajás: listados, formularios, calendario',
  );

  await demo.spotlight(
    page.getByTestId(T.railPaciente),
    'A la derecha, el panel flotante: lo que necesitás desde cualquier pantalla',
  );

  await demo.finish('La navegación a la izquierda, el trabajo al centro, lo urgente a la derecha');
});

demoTest('q008', async ({ demo, page }) => {
  await demo.intro('/patients', 'El centro de control rápido');

  await demo.spotlight(
    page.getByTestId(T.railPaciente),
    'Paciente: buscar y abrir una ficha desde donde estés',
  );
  await demo.spotlight(page.getByTestId(T.railCaja), 'Caja: el estado de la sesión y el saldo del cajón');
  await demo.spotlight(page.getByTestId(T.railCambio), 'Cambio: el tipo de cambio con el que se abrió la caja');
  await demo.spotlight(page.getByTestId(T.railNotas), 'Notas: notas adhesivas sobre la pantalla');

  await demo.note('Cada acceso depende de tus permisos: si no lo tenés, el botón no aparece');

  await demo.finish();
});

demoTest('q010', async ({ demo, page }) => {
  await demo.intro('/patients', 'Tabla cuando hay ancho, tarjetas cuando no');

  await demo.step('Con el listado a pantalla completa ves la tabla, densa y con muchas columnas', async () => {
    await expect(page.locator('table')).toBeVisible();
  });

  // En la mayoría de las pantallas el cambio es automático: al abrir un registro,
  // el listado se comprime y no entra una tabla, así que pasa a tarjetas.
  await demo.click(
    page.locator('table tbody tr').first(),
    'Abrí un registro: el listado se comprime para dejarle lugar al detalle',
  );

  await demo.step('Cada fila pasa a ser una tarjeta, legible en poco ancho', async () => {
    await expect(page.getByTestId('card-list')).toBeVisible();
  });

  await demo.note('Pasa lo mismo cuando la ventana es angosta o estás en el teléfono');

  await demo.finish();
});

demoTest('q011', async ({ demo, page }) => {
  await demo.intro('/patients', 'El divisor entre el listado y el detalle');

  await demo.click(page.locator('table tbody tr').first(), 'Abrí un registro para que aparezca el detalle');

  const divider = page.locator('[role="separator"], [data-panel-resize-handle-id]').first();
  await demo.spotlight(divider, 'Entre los dos paneles hay un divisor');

  await demo.step('Arrastralo para darle más espacio a uno u otro', async () => {
    const box = await divider.boundingBox();
    expect(box, 'el divisor debe ser visible para poder arrastrarlo').not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x - 160, box!.y + box!.height / 2, { steps: 24 });
    await page.mouse.up();
  });

  await demo.note('La posición queda guardada en tu navegador para la próxima vez');

  await demo.finish();
});

demoTest('q013', async ({ demo, page }) => {
  await demo.intro('/patients', 'La protección contra pérdida de datos');

  await demo.click(
    page.getByRole('button', { name: /nuevo|crear|agregar/i }).first(),
    'Abrí un formulario largo',
  );

  const nombre = page.getByLabel(/^nombre/i).first();
  await demo.type(nombre, 'Paciente de prueba', 'Escribí algo y no lo guardes');

  await demo.click(
    page.getByRole('button', { name: /^cancelar$/i }).first(),
    'Intentá cerrar sin guardar',
  );

  await demo.step('El sistema pregunta antes de perder el trabajo', async () => {
    // El texto aparece dos veces (título del diálogo y botón de confirmación),
    // por eso se apunta al rol de diálogo y no al texto suelto.
    await expect(page.getByRole('alertdialog').or(page.getByRole('dialog')).last()).toContainText(
      T.discardTitle,
    );
  });

  await demo.click(
    page.getByRole('button', { name: T.keepEditing }).first(),
    'Seguir editando te devuelve al formulario intacto',
  );

  await demo.note('Los diálogos tampoco se cierran por un clic accidental fuera de ellos');

  await demo.finish();
});
