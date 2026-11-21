import { expect, test } from '@playwright/test';

import { createVoiceSim, type VoiceSim } from './sim/harness';
import { uiLog } from './sim/page';

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
  test('en «new medicamento called Diclofenac»', async () => { await start('/clinic-catalog/medications', 'en'); await sim.say('add a medicamento called Diclofenac'); expect(uiLog).toEqual(['fill:Name=Diclofenac'.replace('Name', 'Nombre')]); });
});

test.describe('LI-OPEN · Abrir, contar, actualizar', () => {
  test('«abrí la amoxicilina»', async () => { await start(); await sim.say('abrí la amoxicilina'); expect(log()).toEqual(['open:r2']); });
  test('«editá el ibuprofeno» con dos: pregunta', async () => { await start(); await sim.say('editá el ibuprofeno'); expect(sim.card().choices).toHaveLength(2); await sim.say('el de 600'); expect(log()).toEqual(['open:r3']); });
  test('«abrí el último»', async () => { await start(); await sim.say('abrí el último'); expect(log()).toEqual(['open:r4']); });
  test('«abrí la sede Pocitos»', async () => { await start('/config/sedes'); await sim.say('abrí la sede pocitos'); expect(log()).toEqual(['open:r2']); });
  test('«cuántos hay»', async () => { await start(); await sim.say('cuántos hay'); expect(sim.card().message).toBe('Hay 4 registros.'); });
  test('«actualizá la lista»', async () => { await start(); await sim.say('actualizá la lista'); expect(log()).toEqual(['refresh']); });
  test('lo que no está no se abre', async () => { await start(); await sim.say('abrí la morfina'); expect(log()).toEqual([]); });
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
