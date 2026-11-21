import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';
import { clearSimCrud, publishSimCrud } from './sim/crud';
import { openWindow } from './sim/dom';
import { screen, uiLog } from './sim/page';

/**
 * LI · Listas con la tabla común (src/lib/voice/commands/crud.ts): Catálogo de la clínica,
 * Configuración del negocio y Sistema. Crear con nombre, abrir por nombre o posición, contar,
 * actualizar; el formulario se completa y guarda con la voz genérica. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());
const log = () => sim.crud()!.log;
const start = async (route = '/clinic-catalog/medications', locale: 'es' | 'es-ES' | 'en' = 'es') => { sim = await createVoiceSim({ locale, route }); };

test.describe('LI-CREATE · Altas', () => {
  test('«nuevo medicamento Diclofenac» abre el alta y escribe el nombre', async () => {
    await start();
    await sim.say('nuevo medicamento Diclofenac');
    expect(log()).toEqual(['create']);
    expect(uiLog).toEqual(['fill:Nombre=Diclofenac']);
    expect(sim.card().message).toBe('Abrí el alta y puse «Diclofenac» en Nombre. Completá lo que falta y decí «guardar».');
  });
  test('«agregá un medicamento llamado Ácido Tranexámico»', async () => { await start(); await sim.say('agregá un medicamento llamado Ácido Tranexámico'); expect(uiLog).toEqual(['fill:Nombre=Ácido Tranexámico']); });
  test('«nuevo medicamento» sin nombre: solo abre', async () => { await start(); await sim.say('nuevo medicamento'); expect(log()).toEqual(['create']); expect(uiLog).toEqual([]); });
  test('después, con la voz genérica: descripción y guardar', async () => {
    await start();
    await sim.sayAll('nuevo medicamento Diclofenac', 'la descripción es antiinflamatorio', 'guardar');
    expect(uiLog).toEqual(['fill:Nombre=Diclofenac', 'fill:Descripción=antiinflamatorio', 'press:Guardar']);
  });
  test('en Sedes: «nueva sede Carrasco»', async () => { await start('/config/sedes'); await sim.say('nueva sede Carrasco'); expect(uiLog).toEqual(['fill:Nombre=Carrasco']); });
  test('«nueva sede» en Medicamentos no es de esta lista', async () => { await start(); await sim.say('nueva sede Carrasco'); expect(log()).toEqual([]); });
  test('es-ES «añade un medicamento llamado Diclofenaco»', async () => { await start('/clinic-catalog/medications', 'es-ES'); await sim.say('añade un medicamento llamado Diclofenaco'); expect(uiLog).toEqual(['fill:Nombre=Diclofenaco']); });
  test('en «add a medication called Diclofenac»', async () => { await start('/clinic-catalog/medications', 'en'); await sim.say('add a medication called Diclofenac'); expect(uiLog).toEqual(['fill:Nombre=Diclofenac']); });
  test('en «new medication Ibuprofen»', async () => { await start('/clinic-catalog/medications', 'en'); await sim.say('new medication Ibuprofen'); expect(log()).toEqual(['create']); expect(uiLog).toEqual(['fill:Nombre=Ibuprofen']); });
  test('en «create a new location Downtown»', async () => { await start('/config/sedes', 'en'); await sim.say('create a location called Downtown'); expect(uiLog).toEqual(['fill:Nombre=Downtown']); });
  test('el botón de la tabla no dice qué crea: lo dice el menú («nuevo medicamento Ketorolac»)', async () => { await start(); await sim.say('nuevo medicamento Ketorolac'); expect(uiLog).toEqual(['fill:Nombre=Ketorolac']); });
  test('«nuevo Ibuprofeno» sin decir la cosa: el resto es el nombre', async () => { await start(); await sim.say('nuevo Ibuprofeno'); expect(uiLog).toEqual(['fill:Nombre=Ibuprofeno']); });
  test('en plural o singular: «nueva unidad de medida Kilogramo»', async () => { await start('/clinic-catalog/measurement-units'); await sim.say('nueva unidad de medida Kilogramo'); expect(uiLog).toEqual(['fill:Nombre=Kilogramo']); });
  test('«nuevo doctor Juan Pérez» en Doctores', async () => { await start('/config/doctors'); await sim.say('nuevo doctor Juan Pérez'); expect(uiLog).toEqual(['fill:Nombre=Juan Pérez']); });
  test('es-ES «crea una moneda llamada Euro»', async () => { await start('/config/currencies', 'es-ES'); await sim.say('crea una moneda llamada Euro'); expect(uiLog).toEqual(['fill:Nombre=Euro']); });
  test('en «new location Downtown» on Medications is not this list', async () => { await start('/clinic-catalog/medications', 'en'); await sim.say('new location Downtown'); expect(log()).toEqual([]); });
});

test.describe('LI-OPEN · Abrir, contar, actualizar', () => {
  test('«abrí la amoxicilina»', async () => { await start(); await sim.say('abrí la amoxicilina'); expect(log()).toEqual(['open:r2']); });
  test('«editá el ibuprofeno» con dos: pregunta', async () => { await start(); await sim.say('editá el ibuprofeno'); expect(sim.card().choices).toHaveLength(2); await sim.say('el de 600'); expect(log()).toEqual(['open:r3']); });
  test('«abrí el último»', async () => { await start(); await sim.say('abrí el último'); expect(log()).toEqual(['open:r4']); });
  test('«abrí la sede Pocitos»', async () => { await start('/config/sedes'); await sim.say('abrí la sede pocitos'); expect(log()).toEqual(['open:r2']); });
  test('«cuántos hay»', async () => { await start(); await sim.say('cuántos hay'); expect(sim.card().message).toBe('Hay 4 registros.'); });
  test('«actualizá la lista»', async () => { await start(); await sim.say('actualizá la lista'); expect(log()).toEqual(['refresh']); });
  test('lo que no está no se abre', async () => { await start(); await sim.say('abrí la morfina'); expect(log()).toEqual([]); });
  test('«abrí el medicamento amoxicilina» (la cosa no se busca)', async () => { await start(); await sim.say('abrí el medicamento amoxicilina'); expect(log()).toEqual(['open:r2']); });
  test('es-ES «abre la sede Centro» y «actualiza la tabla»', async () => { await start('/config/sedes', 'es-ES'); await sim.sayAll('abre la sede centro', 'actualiza la tabla'); expect(log()).toEqual(['open:r1', 'refresh']); });
  test('en «open the second one» y «refresh the list»', async () => { await start('/clinic-catalog/medications', 'en'); await sim.sayAll('open the second', 'refresh the list'); expect(log()).toEqual(['open:r2', 'refresh']); });
  test('en «open the location Pocitos»', async () => { await start('/config/sedes', 'en'); await sim.say('open the location pocitos'); expect(log()).toEqual(['open:r2']); });
  test('en «open amoxicilina» y «how many are there»', async () => { await start('/clinic-catalog/medications', 'en'); await sim.sayAll('open amoxicilina', 'how many are there'); expect(log()).toEqual(['open:r2']); expect(sim.card().message).toBe('There are 4 records.'); });
});

test.describe('LI-NAV · Llegar y crear', () => {
  test('«andá a medicamentos y agregá uno llamado Diclofenac»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a medicamentos y agregá uno llamado Diclofenac');
    expect(sim.navigations).toEqual(['/clinic-catalog/medications']);
    expect(uiLog).toEqual(['fill:Nombre=Diclofenac']);
  });
});

test.describe('LI-BARE · Alta sin decir qué', () => {
  for (const [locale, said] of [['es', 'nuevo'], ['es', 'crear uno'], ['es', 'agregá uno'], ['es-ES', 'añade uno'], ['en', 'new'], ['en', 'add one']] as const) {
    test(`${locale} «${said}» abre el alta`, async () => { await start('/clinic-catalog/medications', locale); await sim.say(said); expect(log()).toEqual(['create']); });
  }
});

test.describe('LI-PAGEBTN · El alta es un botón de la pantalla (no de la tabla)', () => {
  test('«nuevo» aprieta «Crear» de la pantalla', async () => {
    await start('/config/holidays');
    clearSimCrud();
    publishSimCrud({ createLabel: '' }).bridge.create = null;
    screen.page(screen.button('Crear'));
    await sim.say('nuevo');
    expect(uiLog).toEqual(['press:Crear']);
  });
  test('una lista de consulta (sin alta) lo dice', async () => {
    await start('/config/holidays');
    clearSimCrud();
    publishSimCrud({ createLabel: '' }).bridge.create = null;
    await sim.say('nuevo');
    expect(sim.card().message).toBe('En esta lista no se pueden crear registros: es de consulta.');
  });
});

test.describe('LI-OVERLAY · Con una ventana abierta, la tabla de atrás no se lleva lo dicho', () => {
  test('«agregá un artículo» con un presupuesto abierto aprieta «Agregar Artículo» (no crea en la lista)', async () => {
    await start();
    openWindow('Nuevo presupuesto', { buttons: ['Agregar Artículo', 'Guardar'] });
    await sim.say('agregá un artículo');
    expect(log()).toEqual([]);
  });
  test('«siguiente página» con una ventana abierta no mueve la lista de atrás', async () => {
    await start();
    openWindow('Nuevo presupuesto', { buttons: ['Agregar Artículo'] });
    await sim.say('siguiente página');
    expect(log()).toEqual([]);
  });
});
