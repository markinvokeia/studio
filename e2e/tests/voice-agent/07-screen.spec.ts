import { expect, test } from '@playwright/test';

import { openWindow } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';
import { FakeEl, screen, uiLog } from './sim/page';

/**
 * UI · Cualquier pantalla con la voz, aunque no tenga voz propia (src/lib/voice/dom-ui.ts): lo que
 * se ve se puede tocar. Botones, pestañas, campos, interruptores, listas desplegables, buscador y
 * filas; con una ventana abierta se trabaja sobre lo abierto. Local, sin IA. Español e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());

/** Una lista de pacientes como las de la app. */
function patientsPage() {
  screen.page(
    screen.heading('Pacientes'),
    screen.button('Nuevo paciente'),
    screen.button('Exportar'),
    screen.button('', { aria: 'Actualizar' }),
    screen.tab('Activos', true), screen.tab('Inactivos'), screen.tab('Todos'),
    screen.field('', { placeholder: 'Buscar pacientes...' }),
    screen.toggle('Mostrar archivados'),
    screen.select('Ordenar por', ['Nombre', 'Última visita', 'Deuda'], 'Nombre'),
    screen.table(['Ana García 4.567.890-1 099 111 222', 'Juan Pérez 3.111.222-3 098 333 444', 'Carla Gómez 2.222.333-4 091 555 666']),
  );
}

test.describe('UI-PRESS · Botones y pestañas', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' }); patientsPage(); });
  for (const [said, want] of [
    ['tocá nuevo paciente', 'press:Nuevo paciente'], ['apretá exportar', 'press:Exportar'], ['nuevo paciente', 'press:Nuevo paciente'],
    ['exportar', 'press:Exportar'], ['dale a actualizar', 'press:Actualizar'], ['hacé clic en exportar', 'press:Exportar'],
    ['presioná el botón nuevo paciente', 'press:Nuevo paciente'], ['tocá nuevo', 'press:Nuevo paciente'],
    ['la pestaña inactivos', 'tab:Inactivos'], ['andá a la pestaña todos', 'tab:Todos'], ['abrí la pestaña de inactivos', 'tab:Inactivos'], ['pestaña todos', 'tab:Todos'],
  ] as const) {
    test(`«${said}» → ${want}`, async () => {
      await sim.say(said);
      expect(uiLog).toEqual([want]);
      expect(sim.aiCalls).toHaveLength(0);
    });
  }
  test('lo que no está en la pantalla no se toca', async () => {
    await sim.say('tocá imprimir');
    expect(uiLog).toEqual([]);
  });
});

test.describe('UI-FILL · Campos y buscador', () => {
  test.beforeEach(async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.field('Nombre'), screen.field('Teléfono'), screen.field('Email'), screen.field('Notas', { type: 'textarea' }), screen.field('', { placeholder: 'Buscar...' }));
  });
  for (const [said, want] of [
    ['poné Ana López en nombre', 'fill:Nombre=Ana López'],
    ['el teléfono es 099 123 456', 'fill:Teléfono=099 123 456'],
    ['escribí en notas trae los estudios', 'fill:Notas=trae los estudios'],
    ['notas: llamar el lunes', 'fill:Notas=llamar el lunes'],
    ['el email es ana@mail.com', 'fill:Email=ana@mail.com'],
    ['completá el nombre con Juan Pérez', 'fill:Nombre=Juan Pérez'],
    ['buscá Juan', 'fill:Buscar...=Juan'],
    ['buscá a María Fernández', 'fill:Buscar...=María Fernández'],
  ] as const) {
    test(`«${said}» → ${want}`, async () => { await sim.say(said); expect(uiLog).toEqual([want]); });
  }
  test('sin valor pregunta qué poner', async () => {
    await sim.say('poné el teléfono');
    expect(sim.card().message).toBe('¿Qué pongo en Teléfono?');
    await sim.say('098 765 432');
    expect(uiLog).toEqual(['fill:Teléfono=098 765 432']);
  });
});

test.describe('UI-TOGGLE · Interruptores', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' }); screen.page(screen.toggle('Enviar por email'), screen.toggle('Recordatorio', true)); });
  test('«activá enviar por email»', async () => { await sim.say('activá enviar por email'); expect(uiLog).toEqual(['toggle:Enviar por email=on']); });
  test('«desactivá el recordatorio»', async () => { await sim.say('desactivá el recordatorio'); expect(uiLog).toEqual(['toggle:Recordatorio=off']); });
  test('«prendé recordatorio» ya prendido: lo dice y no lo toca', async () => {
    await sim.say('prendé recordatorio');
    expect(uiLog).toEqual([]);
    expect(sim.card().message).toBe('«Recordatorio» ya está activado.');
  });
  test('«tocá enviar por email» lo cambia', async () => { await sim.say('tocá enviar por email'); expect(uiLog).toEqual(['toggle:Enviar por email=on']); });
  test('«marcá enviar por mail» (mail = email no) no adivina', async () => { await sim.say('marcá la casilla de factura'); expect(uiLog).toEqual([]); });
});

test.describe('UI-SELECT · Listas desplegables', () => {
  test.beforeEach(async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/cashier' });
    screen.page(screen.select('Método de pago', ['Efectivo', 'Tarjeta de crédito', 'Transferencia']), screen.select('Moneda', ['UYU', 'USD']));
  });
  for (const [said, want] of [
    ['elegí efectivo en método de pago', 'select:Método de pago=Efectivo'],
    ['método de pago tarjeta', 'select:Método de pago=Tarjeta de crédito'],
    ['método de pago: transferencia', 'select:Método de pago=Transferencia'],
    ['cambiá la moneda a USD', 'select:Moneda=USD'],
    ['poné tarjeta como método de pago', 'select:Método de pago=Tarjeta de crédito'],
  ] as const) {
    test(`«${said}» → ${want}`, async () => { await sim.say(said); expect(uiLog).toEqual([want]); });
  }
  test('sin opción: abre la lista y pregunta', async () => {
    await sim.say('elegí el método de pago');
    expect(sim.card().choices).toEqual(['Efectivo', 'Tarjeta de crédito', 'Transferencia']);
    await sim.say('la última');
    expect(uiLog).toEqual(['select:Método de pago=Transferencia']);
  });
  test('opción que no está: lo dice y pregunta entre las que hay', async () => {
    await sim.say('método de pago cheque');
    expect(sim.card().message).toContain('No encontré «cheque»');
    await sim.say('efectivo');
    expect(uiLog).toEqual(['select:Método de pago=Efectivo']);
  });
});

test.describe('UI-ROW · Filas de una lista', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' }); patientsPage(); });
  for (const [said, want] of [
    ['abrí el primero', 'row:Ana García 4.567.890-1 099 111 222'], ['abrí el segundo', 'row:Juan Pérez 3.111.222-3 098 333 444'],
    ['abrí el último', 'row:Carla Gómez 2.222.333-4 091 555 666'], ['seleccioná la fila 2', 'row:Juan Pérez 3.111.222-3 098 333 444'],
    ['abrí el de Juan Pérez', 'row:Juan Pérez 3.111.222-3 098 333 444'], ['abrí la de Carla', 'row:Carla Gómez 2.222.333-4 091 555 666'],
    ['el tercero', 'row:Carla Gómez 2.222.333-4 091 555 666'],
  ] as const) {
    test(`«${said}»`, async () => { await sim.say(said); expect(uiLog).toEqual([want]); });
  }
  test('«abrí el de Gómez» con dos Gómez pregunta entre esos', async () => {
    screen.page(screen.table(['Carla Gómez', 'Pedro Gómez', 'Ana Ruiz']));
    await sim.say('abrí el de Gómez');
    expect(sim.card().choices).toEqual(['Carla Gómez', 'Pedro Gómez']);
    await sim.say('Pedro');
    expect(uiLog).toEqual(['row:Pedro Gómez']);
  });
});

test.describe('UI-HELP · ¿Qué puedo hacer acá?', () => {
  test('lista lo que hay y aprieta lo elegido', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    patientsPage();
    await sim.say('qué puedo hacer acá');
    expect(sim.card().choices).toContain('Nuevo paciente');
    expect(sim.card().choices).toContain('Inactivos');
    await sim.say('nuevo paciente');
    expect(uiLog).toEqual(['press:Nuevo paciente']);
  });
  test('sin botones lo dice', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.heading('Vacío'));
    await sim.say('qué puedo hacer acá');
    expect(sim.card().message).toBe('No veo botones en esta pantalla.');
  });
});

test.describe('UI-OVERLAY · Con una ventana abierta, se trabaja sobre ella', () => {
  test('lo de la ventana y no lo de la página', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    patientsPage();
    openWindow('Nuevo paciente', { tree: screen.group(screen.toggle('Enviar bienvenida'), screen.select('Sexo', ['Femenino', 'Masculino'])) });
    await sim.say('activá enviar bienvenida');
    await sim.say('sexo femenino');
    await sim.say('exportar');
    expect(uiLog).toEqual(['toggle:Enviar bienvenida=on', 'select:Sexo=Femenino']);
  });
});

test.describe('UI-PRIORITY · Lo propio de la pantalla gana', () => {
  test('en la agenda «hoy» es de la agenda aunque haya un botón Hoy', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    screen.page(screen.button('Hoy'));
    await sim.say('hoy');
    expect(uiLog).toEqual([]);
    expect(sim.cal.calls('goToDate').length + sim.cal.calls('today').length).toBeGreaterThan(0);
  });
  test('navegar le gana a un botón con el mismo nombre', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    screen.page(screen.button('Ir a pacientes'));
    await sim.say('andá a pacientes');
    expect(sim.navigations).toEqual(['/patients']);
  });
  test('la agenda sin pantalla de mentira sigue igual (no se rompe sin <main>)', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('qué puedo hacer acá');
    expect(sim.card().message).not.toBe('');
  });
});

test.describe('UI-EN · English', () => {
  test.beforeEach(async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/purchases/providers' });
    screen.page(
      screen.button('New patient'), screen.button('Save changes'), screen.tab('Invoices'), screen.tab('Payments'),
      screen.field('Name'), screen.field('', { placeholder: 'Search patients...' }), screen.toggle('Send by email'),
      screen.select('Payment method', ['Cash', 'Credit card']), screen.table(['Anna Garcia', 'John Smith']),
    );
  });
  for (const [said, want] of [
    ['click new patient', 'press:New patient'], ['save changes', 'press:Save changes'], ['press save', 'press:Save changes'],
    ['go to the payments tab', 'tab:Payments'], ['open the invoices tab', 'tab:Invoices'], ['type John Smith in name', 'fill:Name=John Smith'],
    ['the name is Anna', 'fill:Name=Anna'], ['search for John', 'fill:Search patients...=John'], ['turn on send by email', 'toggle:Send by email=on'],
    ['set payment method to cash', 'select:Payment method=Cash'], ['select credit card as payment method', 'select:Payment method=Credit card'],
    ['open the second one', 'row:John Smith'], ['open the last one', 'row:John Smith'],
  ] as const) {
    test(`«${said}» → ${want}`, async () => { await sim.say(said); expect(uiLog).toEqual([want]); });
  }
  test('«what can I do here»', async () => {
    await sim.say('what can I do here');
    expect(sim.card().message).toMatch(/^Here you can:/);
  });
});

test.describe('UI-ES-ES · Castellano (tú)', () => {
  test('«pulsa nuevo paciente» y «busca a Juan»', async () => {
    sim = await createVoiceSim({ locale: 'es-ES', route: '/purchases/providers' });
    patientsPage();
    await sim.say('pulsa nuevo paciente');
    await sim.say('busca a Juan');
    expect(uiLog).toEqual(['press:Nuevo paciente', 'fill:Buscar pacientes...=Juan']);
  });
  test('«qué puedo hacer aquí»', async () => {
    sim = await createVoiceSim({ locale: 'es-ES', route: '/purchases/providers' });
    patientsPage();
    await sim.say('qué puedo hacer aquí');
    expect(sim.card().message).toMatch(/^Aquí puedes:/);
  });
});

test.describe('UI-SEARCHSEL · Selectores con búsqueda (paciente, sede, doctor)', () => {
  const PATIENTS = ['Juan Pérez', 'Juan Bengoa', 'Carolina Píriz Fernández', 'Leonardo Acosta Ramos', 'Martín Machado'];
  test.beforeEach(async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.searchSelect('Paciente', PATIENTS), screen.searchSelect('Sede', ['Centro', 'Pocitos', 'Carrasco']), screen.searchSelect('Doctor', ['Raidel Martínez', 'Sofía Benítez']));
  });
  test('«paciente Carolina Píriz» escribe en la búsqueda y elige', async () => {
    await sim.say('paciente Carolina Píriz');
    expect(uiLog).toEqual(['type:Paciente=Carolina Píriz', 'select:Paciente=Carolina Píriz Fernández']);
  });
  test('«elegí a Leonardo en paciente»', async () => {
    await sim.say('elegí Leonardo en paciente');
    expect(uiLog).toEqual(['type:Paciente=Leonardo', 'select:Paciente=Leonardo Acosta Ramos']);
  });
  test('varios con ese nombre: pregunta entre esos', async () => {
    await sim.say('paciente Juan');
    expect(sim.card().choices).toEqual(['Juan Pérez', 'Juan Bengoa']);
    await sim.say('Bengoa');
    expect(uiLog).toEqual(['type:Paciente=Juan', 'select:Paciente=Juan Bengoa']);
  });
  test('«elegí el paciente» sin decir cuál: pregunta qué buscar y lo escribe', async () => {
    await sim.say('elegí el paciente');
    expect(sim.card().message).toBe('¿Qué Paciente busco?');
    await sim.say('Martín Machado');
    expect(uiLog).toEqual(['type:Paciente=Martín Machado', 'select:Paciente=Martín Machado']);
  });
  test('«la sede Pocitos» y «doctor Martínez»', async () => {
    await sim.sayAll('sede Pocitos', 'doctor Martínez');
    expect(uiLog).toEqual(['type:Sede=Pocitos', 'select:Sede=Pocitos', 'type:Doctor=Martínez', 'select:Doctor=Raidel Martínez']);
  });
  test('en «set the doctor to Benítez»', async () => {
    sim.dispose();
    sim = await createVoiceSim({ locale: 'en', route: '/purchases/providers' });
    screen.page(screen.searchSelect('Doctor', ['Raidel Martínez', 'Sofía Benítez']));
    await sim.say('set the doctor to Benítez');
    expect(uiLog).toEqual(['type:Doctor=Benítez', 'select:Doctor=Sofía Benítez']);
  });
});

test.describe('UI-CREATE · «nuevo» aprieta el botón de alta de la pantalla', () => {
  for (const [locale, said, label] of [['es', 'nuevo', 'Nueva sede'], ['es', 'agregá uno', 'Agregar etapa'], ['es-ES', 'añade uno', 'Agregar etapa'], ['en', 'new', 'New template']] as const) {
    test(`${locale} «${said}» → ${label}`, async () => {
      sim = await createVoiceSim({ locale, route: '/purchases/providers' });
      screen.page(screen.button('Guardar'), screen.button(label), screen.button('Eliminar'));
      await sim.say(said);
      expect(uiLog).toEqual([`press:${label}`]);
    });
  }
  test('con dos botones de alta no adivina', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.button('Nueva sede'), screen.button('Nuevo consultorio'));
    await sim.say('nuevo');
    expect(uiLog).toEqual([]);
  });
});

test.describe('UI-ROWACT · La acción de una fila («desactivá la etapa X»)', () => {
  const stageRow = (name: string) => {
    const row = new FakeEl('DIV', { 'data-voice-row': '' }, name);
    row.append(screen.button('Desactivar'), screen.button('Eliminar'));
    return row;
  };
  test.beforeEach(async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(stageRow('Solicitud creada'), stageRow('Enviado al laboratorio'), stageRow('Recibido en clínica'));
  });
  test('«desactivá la etapa enviado al laboratorio»', async () => {
    await sim.say('desactivá la etapa enviado al laboratorio');
    expect(uiLog).toEqual(['press:Desactivar']);
    expect(sim.card().message).toMatch(/^Apreté «Desactivar» en «Enviado al laboratorio/);
  });
  test('«eliminá recibido en clínica»', async () => {
    await sim.say('eliminá recibido en clínica');
    expect(uiLog).toEqual(['press:Eliminar']);
  });
  test('una fila que no está: nada', async () => {
    await sim.say('desactivá la etapa entregado');
    expect(uiLog).toEqual([]);
  });
  test('en «deactivate solicitud creada»', async () => {
    sim.dispose();
    sim = await createVoiceSim({ locale: 'en', route: '/purchases/providers' });
    const row = new FakeEl('DIV', { 'data-voice-row': '' }, 'Solicitud creada');
    row.append(screen.button('Deactivate'));
    screen.page(row);
    await sim.say('deactivate solicitud creada');
    expect(uiLog).toEqual(['press:Deactivate']);
  });
});

test.describe('UI-ROWCOLOR · El color de una fila («el color de Confirmada es rojo»)', () => {
  const colorRow = (name: string) => {
    const row = new FakeEl('DIV', { 'data-voice-row': '' });
    const input = new FakeEl('INPUT', { type: 'color' });
    input.type = 'color';
    input.onInput = (v) => uiLog.push(`color:${name}=${v}`);
    row.append(new FakeEl('TD', {}, name), input);
    return row;
  };
  for (const [locale, said, row, want] of [
    ['es', 'el color de confirmada es rojo', 'Confirmada', '#ef4444'],
    ['es', 'poné programada en azul', 'Programada', '#3b82f6'],
    ['es', 'cambiá el color de cancelada a #ff0000', 'Cancelada', '#ff0000'],
    ['es-ES', 'pon el color de confirmada en verde', 'Confirmada', '#22c55e'],
    ['en', 'set the color of confirmada to purple', 'Confirmada', '#8b5cf6'],
  ] as const) {
    test(`${locale} «${said}»`, async () => {
      sim = await createVoiceSim({ locale, route: '/purchases/providers' });
      screen.page(colorRow('Programada'), colorRow('Confirmada'), colorRow('Cancelada'));
      await sim.say(said);
      expect(uiLog).toEqual([`color:${row}=${want}`]);
    });
  }
  test('una fila que no está: no pinta nada', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(colorRow('Programada'));
    await sim.say('el color de atendida es rojo');
    expect(uiLog.filter((l) => l.startsWith('color:'))).toEqual([]);
  });
});

test.describe('UI-FIELDNAME · Nombre sin paréntesis y número sin unidad', () => {
  test('«la duración es 5 días» en «Duración (días)» (numérico)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.field('Duración (días)', { type: 'number' }), screen.field('Dosis'));
    await sim.say('la duración es 5 días');
    expect(uiLog).toEqual(['fill:Duración (días)=5']);
  });
  test('«la hora es las 9 y media» en un campo de hora', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.field('Hora', { type: 'time' }));
    await sim.say('la hora es las 9 y media');
    expect(uiLog).toEqual(['fill:Hora=09:30']);
  });
});

test.describe('UI-EDIT · Editar un campo dicho de cualquier forma', () => {
  test.beforeEach(async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.field('Nombre'), screen.field('Teléfono'), screen.field('Fecha de inicio', { placeholder: 'dd/mm/aaaa' }), screen.field('Fecha de fin', { placeholder: 'dd/mm/aaaa' }));
  });
  for (const [said, want] of [
    ['modificá el nombre de la clínica a Clínica Prueba', 'fill:Nombre=Clínica Prueba'],
    ['cambiá el teléfono por 099 123 456', 'fill:Teléfono=099 123 456'],
    ['editá el nombre a Centro Dental', 'fill:Nombre=Centro Dental'],
    ['asigná el teléfono 098 765', 'fill:Teléfono=098 765'],
    ['la fecha de inicio es el 15 de diciembre', 'fill:Fecha de inicio=15/12/2026'],
    ['poné la fecha de fin el 20 de diciembre', 'fill:Fecha de fin=20/12/2026'],
  ] as const) {
    test(`«${said}»`, async () => { await sim.say(said); expect(uiLog[0]?.replace(/\/20\d\d$/, '/2026')).toBe(want); });
  }
});

test.describe('UI-ABBR · Etiquetas abreviadas', () => {
  test('«la cantidad es 2» en «Cant.»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.field('Cant.'), screen.field('Precio'));
    await sim.say('la cantidad es 2');
    expect(uiLog).toEqual(['fill:Cant.=2']);
  });
});

test.describe('UI-SYN · Sinónimos de «poner un valor» (verbos y sustantivos) y campo + valor', () => {
  test.beforeEach(async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.field('Vía'), screen.field('Dosis'), screen.field('Precio', { type: 'number' }), screen.field('Notas'));
  });
  for (const [said, want] of [
    ['definí la vía oral', 'fill:Vía=oral'], ['registrá la dosis 400 mg', 'fill:Dosis=400 mg'], ['establecé el precio en 1500', 'fill:Precio=1500'],
    ['fijá la vía a sublingual', 'fill:Vía=sublingual'], ['indicá la dosis 2 comprimidos', 'fill:Dosis=2 comprimidos'], ['colocá en notas tomar con comida', 'fill:Notas=tomar con comida'],
    ['especificá la vía tópica', 'fill:Vía=tópica'], ['cambio de vía a oral', 'fill:Vía=oral'], ['actualización del precio a 2000', 'fill:Precio=2000'],
    ['nueva dosis 500 mg', 'fill:Dosis=500 mg'], ['vía oral', 'fill:Vía=oral'], ['dosis 400 mg', 'fill:Dosis=400 mg'], ['seteá la vía en oral', 'fill:Vía=oral'],
  ] as const) {
    test(`«${said}»`, async () => { await sim.say(said); expect(uiLog).toEqual([want]); });
  }
  test('en «set the dosis to 400 mg» / «record the precio 1500»', async () => {
    sim.dispose();
    sim = await createVoiceSim({ locale: 'en', route: '/purchases/providers' });
    screen.page(screen.field('Dosis'), screen.field('Precio', { type: 'number' }));
    await sim.sayAll('set the dosis to 400 mg', 'record the precio 1500');
    expect(uiLog).toEqual(['fill:Dosis=400 mg', 'fill:Precio=1500']);
  });
});

test.describe('UI-FILTER-EN · «filter …» en inglés escribe la palabra clave en el buscador', () => {
  test('«filter the ones that have Carolina»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/purchases/providers' });
    screen.page(screen.heading('Orders'), screen.field('', { placeholder: 'Search orders', type: 'search' }));
    await sim.say('filter the ones that have Carolina');
    expect(uiLog).toEqual(['fill:Search orders=Carolina']);
  });
});

test.describe('UI-NOSEARCH · Buscar donde no hay buscador', () => {
  test('«filtrá por Juan» lo dice (no «no entendí»)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    screen.page(screen.heading('Plantillas'), screen.button('Nueva plantilla'));
    await sim.say('filtrá por Juan');
    expect(sim.card().message).toBe('Esta tabla no tiene buscador.');
  });
});

test.describe('UI-SEARCHSEL-MISS · Una opción que no aparece no cierra la ventana', () => {
  test('«elegí Zeta en proveedor» con el pago abierto: lo dice y la ventana sigue', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/purchases/providers' });
    const w = openWindow('Nuevo Pre-pago a Proveedor', { tree: screen.group(screen.searchSelect('Proveedor', ['Laboratorio Dental Sur', 'Acme']), screen.button('Guardar')) });
    await sim.wait(80);
    await sim.say('elegí Zeta en proveedor');
    expect(w.open).toBe(true);
    expect(w.pressed).toEqual([]);
  });
});
