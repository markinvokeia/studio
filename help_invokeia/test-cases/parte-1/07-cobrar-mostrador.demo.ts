/**
 * PARTE 1 — Recepción · Cobrar en el mostrador
 *
 * NINGUNA de estas demos completa una venta. Abren los diálogos, muestran los
 * campos y cancelan: emitir una factura o registrar un pago en la base de DEV
 * dejaría documentos contables falsos, con su numeración consumida.
 */
import { demoTest, expect } from '../../lib/demo.fixture';
import { openDemoPatient, T } from '../parte-2/paciente.support';

const C = {
  railCobrar: 'rail-cobrar',
  cancel: /^cancelar$/i,
  close: /^cerrar$/i,
  // /config/clinic-prefs
  discountsSection: 'Descuentos',
  applyDiscounts: 'Aplicar descuentos',
  whereApplied: '¿Dónde se aplica el descuento?',
  perService: 'Por servicio',
  onTotal: 'Sobre el total',
  defaultPct: 'Descuento por defecto (%)',
  maxPct: 'Descuento máximo (%)',
};

demoTest(['q069', 'q070'], async ({ demo, page }) => {
  await demo.intro('/patients', 'Panel flotante derecho → Cobrar');

  await demo.click(
    page.getByTestId(C.railCobrar),
    'Desde cualquier pantalla, «Cobrar» en la tira derecha',
  );

  await demo.note('El asistente hace toda la cadena en un solo diálogo');

  await demo.note('Confirma el presupuesto, genera la factura y registra el pago');

  await demo.note('¿Cuántos pasos? Depende de desde dónde lo abras');

  await demo.note('Desde una factura existente: Pago y listo, dos pasos');

  await demo.note('Desde un presupuesto: Tratamiento, Pago y listo');

  await demo.note('Desde una cita, una sesión clínica o la ficha: Servicios, Pago y listo');

  await demo.note('Y desde el panel derecho, sin contexto: primero el Paciente, y después el resto');

  await demo.note('Si el presupuesto está en borrador, lo confirma y factura solo: no hacés esos pasos');

  await demo.note('Y si venís de una cita o una sesión, los servicios ya vienen precargados');

  await demo.note('Lo que tenías abierto detrás sigue ahí al cerrarlo, sin perder el estado');

  await demo.finish('Permiso: SALES_PAYMENTS_CREATE');
});

demoTest('q071', async ({ demo, page }) => {
  await demo.intro('/patients', 'No, cobrar no es obligatorio');

  await demo.click(page.getByTestId(C.railCobrar), 'Abrí el Cobro Rápido');

  await demo.note('El paso final ofrece dos salidas distintas');

  await demo.note('«Solo facturar» emite la factura y termina: para cuando el paciente paga después');

  await demo.note('«Facturar y cobrar» hace las dos cosas en una sola operación');

  await demo.note('Y al terminar te ofrece imprimir el recibo en el acto');

  await demo.finish();
});

demoTest('q072', async ({ demo, page }) => {
  // OJO: el manual dice «Ventas → Presupuestos → Crear», pero el listado de
  // presupuestos NO tiene botón Crear. El camino real es la ficha del paciente
  // (ver DRIFT.md).
  await demo.intro('/patients', 'Desde la ficha del paciente');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.click(page.getByTestId(T.createMenu), 'Abrí el menú Crear de la ficha');

  await demo.click(
    page.getByRole('menuitem').filter({ hasText: /^presupuesto$/i }).first(),
    'Elegí «Presupuesto»',
  );

  await demo.note('Cada línea lleva servicio, pieza dental, cantidad y precio unitario');

  await demo.note('Más el descuento, si la clínica los tiene habilitados, y el total');

  await demo.note('El número de pieza es lo que hace que el presupuesto hable el mismo idioma…');

  await demo.note('…que la historia clínica: el paciente ve qué se le va a hacer y en qué diente');

  await demo.step('Cerramos sin guardar', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_500);
  });

  await demo.finish('Permiso: SALES_QUOTES_CREATE');
});

demoTest(['q073', 'q074'], async ({ demo, page }) => {
  await demo.intro('/sales/quotes', 'Del presupuesto a la factura');

  await demo.step('Este es el listado de presupuestos', async () => {
    await expect(page.locator('table')).toBeVisible({ timeout: 25_000 });
  });

  await demo.note('Para facturar, el presupuesto tiene que estar Aceptado o Confirmado');

  await demo.note('Desde borrador no se puede: primero hay que confirmarlo');

  await demo.note('La acción «Facturar» genera la factura por todo el total pendiente');

  await demo.note('¿Y si querés facturar sólo una parte? Ahí va «Facturación personalizada»');

  await demo.note('El diálogo muestra siempre cuatro cifras, para que no te pierdas');

  await demo.note('Total del presupuesto, lo ya facturado, lo pendiente, y el total de esta factura');

  await demo.note('Agregás las líneas eligiendo servicio y monto, y ves cuánto falta de cada una');

  await demo.note('Los servicios ya completos quedan marcados «Facturado completo»');

  await demo.note('Y no te deja pasarte: ni del pendiente del presupuesto, ni del de cada servicio');

  await demo.finish();
});

demoTest(['q075', 'q076'], async ({ demo, page }) => {
  // La respuesta manda a una pantalla de configuración, así que el video va y la
  // muestra en vez de nombrarla.
  await demo.intro('/config/clinic-prefs', 'Los descuentos se configuran para toda la clínica');

  await demo.spotlight(
    page.getByText(C.discountsSection).first(),
    'En Preferencias de Clínica está el bloque Descuentos',
  );

  await demo.spotlight(
    page.getByText(C.applyDiscounts).first(),
    'Este interruptor es el que los enciende o apaga para toda la clínica',
  );

  await demo.note('Con esto apagado, NINGUNA pantalla de venta muestra el campo de descuento');

  await demo.spotlight(
    page.getByText(C.whereApplied).first(),
    'Y acá se elige dónde se aplica. Las dos opciones son excluyentes',
  );

  await demo.note('Por servicio: cada línea del presupuesto lleva su propio descuento');

  await demo.note('Sobre el total: un único descuento sobre el total del documento');

  await demo.spotlight(
    page.getByText(C.maxPct).first(),
    'El tope que el formulario deja guardar, en porcentaje',
  );

  await demo.note('Aplica también a los descuentos escritos como importe fijo');

  await demo.note('En la venta, el campo admite porcentaje o importe, y te muestra cuánto descuenta');

  await demo.note('¿Y si no podés poner el descuento? Hay dos causas, con síntomas distintos');

  await demo.note('Si NO ves el campo en ninguna pantalla: están apagados acá, para toda la clínica');

  await demo.note('Si lo ves pero no lo podés editar: te falta el permiso «Aplicar Descuentos»');

  await demo.note('Que se vea en solo lectura es deliberado: sabés qué descuento lleva el documento');

  await demo.note('Y si te rechaza el valor, estás por encima del tope configurado acá');

  await demo.finish('Permiso: SALES_APPLY_DISCOUNT');
});

demoTest(['q077', 'q078'], async ({ demo, page }) => {
  await demo.intro('/patients', '');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.note('En la cabecera de la ficha está el Resumen financiero');

  await demo.note('Cuatro cifras: total facturado, total pagado, deuda actual y saldo disponible');

  await demo.click(
    page.getByText(T.tabFinance, { exact: true }).filter({ visible: true }).first(),
    'Y para el detalle movimiento por movimiento, la pestaña Finanzas',
  );

  await demo.note('Son dos documentos distintos, según lo que necesites');

  await demo.note('El Resumen Financiero se imprime desde la cabecera y son esas cuatro cifras');

  await demo.note('El Estado de cuenta es el detalle completo, con saldo corriente');

  await demo.note('Si no hay movimientos en el período elegido, avisa en vez de imprimir en blanco');

  await demo.finish();
});

demoTest('q079', async ({ demo, page }) => {
  await demo.intro('/patients', 'El crédito a favor del paciente');

  await demo.step('Abrimos la ficha del paciente', async () => {
    await openDemoPatient(page);
  });

  await demo.note('El crédito aparece en el Resumen financiero como «Saldo Disponible»');

  await demo.note('Puede venir de un prepago, o de una nota de crédito');

  await demo.note('Al registrar el pago, si hay crédito disponible el sistema te lo ofrece');

  await demo.note('Lo aplicás y la factura queda saldada contra ese crédito');

  await demo.note('Ojo con esto en el arqueo: la factura figura cobrada, pero no entró efectivo');

  await demo.finish('Permiso: SALES_PAYMENTS_USE_CREDITS');
});
