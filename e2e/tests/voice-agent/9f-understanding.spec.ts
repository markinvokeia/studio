import { expect, test } from '@playwright/test';

import { openPopup, openWindow } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';
import { screen, uiLog } from './sim/page';

/**
 * UN · Entender lo que no se dijo tal cual (src/lib/voice/suggest.ts y la sesión): si no se
 * entiende pero se parece a algo que se puede hacer, se propone lo más cercano («¿Te referís a…?»)
 * y lo elegido se hace; «no» / «ninguna» deja todo como estaba; otro pedido sigue sin preguntar.
 * Y al abrirse una ventana (a mano o por voz), se dice cuál y qué se le puede pedir.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());

const page = () => screen.page(screen.heading('Sedes'), screen.button('Sincronizar mapas'), screen.button('Exportar listado'), screen.toggle('Mostrar inactivas'));

test.describe('UN-SUGGEST · «¿Te referís a…?»', () => {
  for (const [locale, said, want] of [
    ['es', 'los mapas sincronizados', 'apretar «Sincronizar mapas»'],
    ['es', 'el listado para exportar', 'apretar «Exportar listado»'],
    ['es-ES', 'los mapas sincronizados', 'pulsar «Sincronizar mapas»'],
    ['en', 'listado exportar please', 'press “Exportar listado”'],
  ] as const) {
    test(`${locale} «${said}» propone ${want}`, async () => {
      sim = await createVoiceSim({ locale, route: '/config/sedes' });
      page();
      await sim.say(said);
      expect(uiLog).toEqual([]);
      expect(sim.card().choices).toContain(want);
      expect(sim.card().awaiting).toBe('choice');
    });
  }
  test('elegir la propuesta la hace («la primera»)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    await sim.say('los mapas sincronizados');
    await sim.say('la primera');
    expect(uiLog).toEqual(['press:Sincronizar mapas']);
  });
  test('o por su nombre («sincronizar mapas»)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    await sim.sayAll('los mapas sincronizados', 'sincronizar mapas');
    expect(uiLog).toEqual(['press:Sincronizar mapas']);
  });
  for (const no of ['no', 'ninguna', 'no, nada que ver', 'none of those']) {
    test(`«${no}» no hace nada`, async () => {
      sim = await createVoiceSim({ locale: no.startsWith('none') ? 'en' : 'es', route: '/config/sedes' });
      page();
      await sim.sayAll('los mapas sincronizados', no);
      expect(uiLog).toEqual([]);
      expect(sim.card().awaiting).toBeNull();
    });
  }
  test('otro pedido sigue sin preguntar («exportar listado»)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    await sim.sayAll('los mapas sincronizados', 'exportar listado');
    expect(uiLog).toEqual(['press:Exportar listado']);
    expect(sim.card().title).not.toMatch(/Cambiamos/);
  });
  test('lo que no se parece a nada: «no entendí» sin propuestas', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    await sim.say('qué lindo día hace hoy en la playa');
    expect(sim.card().choices).toEqual([]);
    expect(uiLog).toEqual([]);
  });
});

test.describe('UN-OVERLAY · Se abrió una ventana: se dice qué se le puede pedir', () => {
  test('abierta a mano: el título, sus campos y sus botones', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    openWindow('Nueva sede', { fields: ['Nombre', 'Dirección'], buttons: ['Guardar', 'Cancelar'] });
    await sim.wait(80);
    expect(sim.card().title).toBe('Nueva sede');
    expect(sim.card().message).toBe('Se abrió «Nueva sede». Decime qué completar (Nombre, Dirección…) o qué apretar: Guardar o Cancelar.');
    expect(sim.card().choices).toEqual(['Guardar', 'Cancelar']);
  });
  test('sin campos: ¿qué hago?', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    openWindow('Importar sedes', { buttons: ['Subir archivo', 'Cerrar'] });
    await sim.wait(80);
    expect(sim.card().message).toBe('Se abrió «Importar sedes». ¿Qué hago? Subir archivo.');
  });
  test('lo que se dice después va a la ventana («guardar»)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    const w = openWindow('Nueva sede', { fields: ['Nombre'], buttons: ['Guardar', 'Cancelar'] });
    await sim.wait(80);
    await sim.say('el nombre es Sede Pocitos');
    await sim.say('guardar');
    expect(w.values.Nombre).toBe('Sede Pocitos');
    expect(w.pressed).toEqual(['Guardar']);
  });
  test('«cerrá» cierra la ventana (lo último que se abrió)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    const first = openWindow('Nueva sede', { fields: ['Nombre'], buttons: ['Guardar'] });
    const second = openWindow('Elegir color', { buttons: ['Aceptar'] });
    await sim.wait(80);
    await sim.say('cerrá');
    expect(second.open).toBe(false);
    expect(first.open).toBe(true);
    await sim.say('cerrá');
    expect(first.open).toBe(false);
  });
  test('es-ES y en', async () => {
    sim = await createVoiceSim({ locale: 'es-ES', route: '/config/sedes' });
    page();
    openWindow('Nueva sede', { fields: ['Nombre'], buttons: ['Guardar'] });
    await sim.wait(80);
    expect(sim.card().message).toBe('Se ha abierto «Nueva sede». Dime qué completar (Nombre…) o qué pulsar: Guardar.');
    sim.dispose();
    sim = await createVoiceSim({ locale: 'en', route: '/config/sedes' });
    page();
    openWindow('New branch', { buttons: ['Save', 'Cancel'] });
    await sim.wait(80);
    expect(sim.card().message).toBe('“New branch” is open. What should I do? Save or Cancel.');
  });
});

test.describe('UN-AI · La IA de la pantalla (n8n «screen»): pasos y propuestas con lo que se ve', () => {
  const form = () => openWindow('Nueva sede', { tree: screen.group(screen.field('Nombre'), screen.toggle('Enviar recordatorios', true), screen.button('Guardar'), screen.button('Cancelar')) });
  test('arma los pasos y los hace («dejame esto guardado con el nombre Sede Pocitos»)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    form();
    await sim.wait(80);
    sim.ai.reply(/guardado/, { relation: 'new', intent: 'steps', steps: [{ op: 'fill', target: 'Nombre', value: 'Sede Pocitos' }, { op: 'press', target: 'Guardar' }], confidence: 0.92 });
    await sim.say('dejame esto guardado con el nombre Sede Pocitos');
    expect(uiLog).toEqual(['fill:Nombre=Sede Pocitos', 'press:Guardar']);
    const call = sim.aiCalls.find((c) => (c.context as { screen?: unknown }).screen);
    expect(call?.prompt).toContain('- button · Guardar');
    expect(call?.prompt).toContain('- toggle · Enviar recordatorios (on: true)');
  });
  test('un control que no está en pantalla no se toca (lo descarta la validación)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    form();
    await sim.wait(80);
    sim.ai.reply(/borrado/, { relation: 'new', intent: 'steps', steps: [{ op: 'press', target: 'Eliminar sede' }], confidence: 0.95 });
    await sim.say('quiero esto borrado del sistema');
    expect(uiLog).toEqual([]);
  });
  test('«que no mande los recordatorios» → desactiva el interruptor', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    form();
    await sim.wait(80);
    sim.ai.reply(/recordatorios/, { relation: 'new', intent: 'steps', steps: [{ op: 'toggle', target: 'Enviar recordatorios', on: false }], confidence: 0.9 });
    await sim.say('que no mande los recordatorios');
    expect(uiLog).toEqual(['toggle:Enviar recordatorios=off']);
  });
  test('propuestas de la IA: se elige y se hace', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    form();
    await sim.wait(80);
    sim.ai.reply(/nombre/, { relation: 'new', intent: 'suggest', suggestions: [{ label: 'apretar «Guardar»', op: 'press', target: 'Guardar' }, { label: 'apretar «Cancelar»', op: 'press', target: 'Cancelar' }], confidence: 0.6 });
    await sim.say('no sé qué hacer con el nombre');
    expect(sim.card().choices).toEqual(['apretar «Guardar»', 'apretar «Cancelar»']);
    await sim.say('la segunda');
    expect(uiLog).toEqual(['press:Cancelar']);
  });
  test('en inglés', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/config/sedes' });
    page();
    openWindow('New branch', { tree: screen.group(screen.field('Name'), screen.button('Save')) });
    await sim.wait(80);
    sim.ai.reply(/stored/, { relation: 'new', intent: 'steps', steps: [{ op: 'fill', target: 'Name', value: 'Downtown' }, { op: 'press', target: 'Save' }], confidence: 0.9 });
    await sim.say('get this stored with the name Downtown');
    expect(uiLog).toEqual(['fill:Name=Downtown', 'press:Save']);
  });
  test('lo que está en las filas no viaja a la IA (pueden ser pacientes)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    const row = screen.button('Carolina Píriz');
    const holder = screen.group(row);
    holder.setAttribute('data-voice-row', '');
    screen.page(screen.heading('Sedes'), screen.button('Sincronizar mapas'), holder);
    await sim.say('quiero los mapas al día ya mismo');
    const call = sim.aiCalls.find((c) => (c.context as { screen?: unknown }).screen);
    expect(call?.prompt ?? '').not.toContain('Carolina');
  });
});

test.describe('UN-SWITCH · Con un aviso abierto, otro pedido es un cambio de contexto', () => {
  test('«andá a pacientes» cierra el aviso sin elegir y va', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    const popup = openPopup('Atención', [{ label: 'No' }, { label: 'Sí' }], { description: '¿Darle esta nueva hora?' });
    await sim.wait(80);
    expect(sim.card().awaiting).toBe('choice');
    await sim.say('andá a pacientes');
    await sim.wait(400);
    expect(popup.open).toBe(false);
    expect(popup.pressed).toEqual([]);
    expect(sim.navigations).toContain('/patients');
  });
  test('«sí» sigue siendo la respuesta del aviso', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    const popup = openPopup('Atención', [{ label: 'No' }, { label: 'Sí' }]);
    await sim.wait(80);
    await sim.say('sí');
    expect(popup.pressed).toEqual(['Sí']);
  });
});

test.describe('UN-NONAME · Una pregunta que no es de ninguna tarea no pregunta «¿Cambiamos de tarea?»', () => {
  test('con «¿Te referís a…?» abierto, «andá a pacientes» va sin preguntar ni nombrar «»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    await sim.say('los mapas sincronizados');
    expect(sim.card().awaiting).toBe('choice');
    await sim.say('andá a pacientes');
    await sim.wait(300);
    expect(sim.card().message ?? '').not.toMatch(/Estábamos con «»|Cambiamos de tarea/);
    expect(sim.navigations).toContain('/patients');
  });
  test('con la ventana recién abierta a mano, «andá a pacientes» va sin preguntar', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    openWindow('Importar sedes', { buttons: ['Subir archivo', 'Cerrar'] });
    await sim.wait(80);
    await sim.say('andá a pacientes');
    await sim.wait(300);
    expect(sim.card().message ?? '').not.toMatch(/Estábamos con «»/);
  });
});

test.describe('UN-VERBS · El verbo dicho con otra palabra («aplicá los cambios» → «Confirmar todo»)', () => {
  for (const [said, want] of [
    ['aplicá los cambios', 'Confirmar todo'],
    ['aceptá todo', 'Confirmar todo'],
    ['grabá', 'Guardar'],
    ['borrá esto', 'Eliminar'],
  ] as const) {
    test(`«${said}» → ${want}`, async () => {
      sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
      screen.page(screen.heading('Odontograma'), screen.button('Confirmar todo'), screen.button('Guardar'), screen.button('Eliminar'));
      await sim.say(said);
      expect(uiLog).toEqual([`press:${want}`]);
    });
  }
});

test.describe('UN-OVERLAY2 · El aviso de ventana con los nombres de los campos y los botones de acción primero', () => {
  test('etiquetas (no ejemplos) y Guardar/Cancelar antes que los demás', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/config/sedes' });
    page();
    openWindow('Crear sesión', { tree: screen.group(screen.field('Procedimiento', { placeholder: 'Ingrese el procedimiento realizado...' }), screen.button('22/11/2026'), screen.button('Añadir'), screen.button('Cancelar'), screen.button('Guardar')) });
    await sim.wait(80);
    expect(sim.card().message).toBe('Se abrió «Crear sesión». Decime qué completar (Procedimiento…) o qué apretar: Cancelar o Guardar o Añadir.');
  });
});

test.describe('UN-NAMED · Un botón de lo abierto que se llama así gana (la bandeja sobre el riel)', () => {
  test('«cobro rápido» con la bandeja abierta aprieta el de la notificación', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/workspace' });
    const inbox = openWindow('Notificaciones', { buttons: ['Ver en workspace', 'Cobro Rápido1 precargados', 'Crear presupuesto'] });
    await sim.wait(80);
    await sim.say('cobro rápido');
    expect(inbox.pressed).toEqual(['Cobro Rápido1 precargados']);
    expect(sim.rail.log.filter((l) => /bill|cobr/i.test(l))).toEqual([]);
  });
});
