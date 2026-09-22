/**
 * PARTE 1 — Recepción · Alertas y pantalla de espera
 *
 * De solo lectura. Las acciones sobre alertas (enviar, pausar, ignorar) no se
 * ejecutan: mandarían mensajes reales a pacientes reales.
 * q083 tampoco enciende la TV: la pantalla de sala de espera es compartida.
 */
import { demoTest, expect } from '../../lib/demo.fixture';

const A = {
  // AlertCenterPage
  pending: /pendientes/i,
  critical: /cr[íi]ticas/i,
  railTv: 'rail-tv',
};

demoTest(['q080', 'q081'], async ({ demo, page }) => {
  await demo.intro('/alerts', 'La bandeja de tareas que genera el sistema solo');

  await demo.step('Este es el Centro de Alertas', async () => {
    await expect(page.getByText(A.pending).first()).toBeVisible({ timeout: 25_000 });
  });

  await demo.spotlight(
    page.getByText(A.pending).first(),
    'Arriba, cuántas hay: total pendientes, críticas, alta y media',
  );

  await demo.note('Recordatorios de cita, facturas vencidas, pacientes a seguir');

  await demo.note('No las carga nadie: las genera el sistema con las reglas de alerta');

  await demo.note('Se filtra por estado, prioridad y categoría');

  await demo.note('¿Qué podés hacer con una? Contactar al paciente por correo, WhatsApp o SMS');

  await demo.note('Registrar una llamada, para que quede constancia de que llamaste');

  await demo.note('Marcarla como completada, asignársela a alguien, o agregarle una nota');

  await demo.note('Y dos que conviene no confundir: pausar e ignorar');

  await demo.note('Pausar es «sigue pendiente, pero no ahora». Pide fecha y razón');

  await demo.note('Ignorar es «esto no corresponde». También pide razón');

  await demo.note('Usar una por la otra ensucia las estadísticas: las ignoradas se leen como error');

  await demo.note('Si el paciente no tiene correo o teléfono, la acción sale deshabilitada y te dice por qué');

  await demo.finish('Permiso: ALERT_CENTER_VIEW_MENU');
});

demoTest('q082', async ({ demo, page }) => {
  await demo.intro('/alerts', 'Acciones en masa');

  await demo.step('Partimos del Centro de Alertas', async () => {
    await expect(page.getByText(A.pending).first()).toBeVisible({ timeout: 25_000 });
  });

  await demo.note('Seleccionás varias alertas y aparece una barra flotante');

  await demo.note('Enviar WhatsApp a todas · Enviar Correo a todas');

  await demo.note('Marcar todas como completadas · Ignorar todas · Pausar todas');

  await demo.note('El envío masivo te informa el resultado desglosado');

  await demo.note('«N enviados, N omitidos, N fallidos»');

  await demo.note('Los omitidos suelen ser pacientes sin teléfono…');

  await demo.note('…o con ese canal deshabilitado en sus preferencias de comunicación');

  await demo.finish('Permiso: ALERT_CENTER_BULK_ACTIONS');
});

demoTest('q083', async ({ demo, page }) => {
  await demo.intro('/patients', 'Panel flotante derecho → TV');

  await demo.spotlight(
    page.getByTestId(A.railTv),
    'Desde cualquier pantalla, el acceso «TV» de la tira derecha',
  );

  await demo.note('Desde ahí: encender, apagar y pausar la pantalla de sala de espera');

  await demo.step('Y para el control completo, la pantalla de gestión', async () => {
    await page.goto('/tv-display', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(2_000);
  });

  await demo.note('Acá además tenés «Actualizar datos» y «Mostrar promo»');

  await demo.note('El estado se ve siempre: encendida, apagada, pausada o mostrando promo');

  await demo.note('Y hay una vista previa, para ajustar sin ir hasta el televisor');

  await demo.finish('Permiso: TV_DISPLAY_VIEW_MENU · TV_DISPLAY_CONTROL_DISPLAY');
});
