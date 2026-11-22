import { expect, test } from '@playwright/test';

import { clearSimCrud, openSimExportDialog, publishSimCrud, type SimCrud } from './sim/crud';
import { createVoiceSim, type VoiceSim } from './sim/harness';
import { screen } from './sim/page';

/**
 * TB · Tablas (src/lib/voice/commands/table.ts): todo lo que se hace con la tabla común, en
 * cualquier pantalla que la tenga. Buscar, filtro de la barra, exportar (pregunta el formato),
 * páginas, cantidad por página, vista tabla/lista, columnas, ordenar, elegir el registro por
 * posición o por columna, cerrar el detalle. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
let t: SimCrud;
test.afterEach(() => sim.dispose());
const FILTERS = [{ value: 'invoice', label: 'Facturas' }, { value: 'credit_note', label: 'Notas de crédito' }];
const start = async (locale: 'es' | 'es-ES' | 'en' = 'es', opts: Parameters<typeof publishSimCrud>[0] = {}) => {
  sim = await createVoiceSim({ locale, route: '/clinic-catalog/medications' });
  clearSimCrud();
  t = publishSimCrud({ filterOptions: FILTERS, withView: true, ...opts });
};
const log = () => t.log;

test.describe('TB-PAGE · Páginas y cantidad por página', () => {
  for (const [locale, said, want] of [
    ['es', 'siguiente página', 'page:2'], ['es', 'andá a la página siguiente', 'page:2'], ['es', 'pasá a la próxima página', 'page:2'],
    ['es', 'última página', 'page:3'], ['es', 'andá a la última página', 'page:3'], ['es', 'página 2', 'page:2'], ['es', 'andá a la página dos', 'page:2'],
    ['es-ES', 've a la página siguiente', 'page:2'], ['es-ES', 'última página', 'page:3'],
    ['en', 'next page', 'page:2'], ['en', 'go to the last page', 'page:3'], ['en', 'page 2', 'page:2'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«página anterior» y «primera página»', async () => {
    await start();
    await sim.sayAll('última página', 'página anterior', 'primera página');
    expect(log()).toEqual(['page:3', 'page:2', 'page:1']);
  });
  test('en la primera, «página anterior» lo dice', async () => { await start(); await sim.say('página anterior'); expect(log()).toEqual([]); expect(sim.card().message).toBe('Ya estás en la primera página.'); });
  test('en la última, «siguiente página» lo dice', async () => { await start(); await sim.sayAll('última página', 'siguiente página'); expect(sim.card().message).toBe('Ya estás en la última página.'); });
  test('«página 9» cuando hay 3', async () => { await start(); await sim.say('página 9'); expect(sim.card().message).toBe('La lista tiene 3 páginas.'); });
  test('una sola página', async () => { await start('es', { pages: 1 }); await sim.say('siguiente página'); expect(sim.card().message).toBe('La lista tiene una sola página.'); });
  for (const [locale, said, want] of [
    ['es', 'poné 50 por página', 'size:50'], ['es', 'mostrá 10 filas por página', 'size:10'], ['es', '100 por página', 'size:100'],
    ['es', 'mostrá de a cincuenta por página', 'size:50'], ['es', 'mostrá todos en una página', 'size:all'],
    ['es-ES', 'pon 25 por página', 'size:25'], ['en', 'show 50 per page', 'size:50'], ['en', '10 rows per page', 'size:10'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
});

test.describe('TB-VIEW · Vista tabla / lista', () => {
  for (const [locale, said, want] of [
    ['es', 'vista de lista', 'view:list'], ['es', 'poné la vista de tabla', 'view:table'], ['es', 'mostralo como lista', 'view:list'], ['es', 'modo tabla', 'view:table'],
    ['es-ES', 'cambia a vista de lista', 'view:list'], ['en', 'list view', 'view:list'], ['en', 'switch to table view', 'view:table'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('«lista» suelta no cambia la vista', async () => { await start(); await sim.say('lista'); expect(log()).toEqual([]); });
});

test.describe('TB-COL · Columnas y orden', () => {
  for (const [locale, said, want] of [
    ['es', 'ocultá la columna teléfono', 'hide:telefono'], ['es', 'sacá la columna detalle', 'hide:detalle'], ['es', 'mostrá la columna teléfono', 'show:telefono'],
    ['es-ES', 'oculta la columna teléfono', 'hide:telefono'], ['en', 'hide the teléfono column', 'hide:telefono'], ['en', 'show the detalle column', 'show:detalle'],
    ['es', 'ordená por nombre', 'sort:nombre:asc'], ['es', 'ordená por nombre descendente', 'sort:nombre:desc'], ['es', 'ordená por fecha de alta de mayor a menor', 'sort:fecha_alta:desc'],
    ['es', 'nombre de la z a la a', 'sort:nombre:desc'], ['es', 'ordená la lista por detalle ascendente', 'sort:detalle:asc'],
    ['es-ES', 'ordena por nombre', 'sort:nombre:asc'], ['en', 'sort by nombre descending', 'sort:nombre:desc'], ['en', 'sort by fecha de alta', 'sort:fecha_alta:asc'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('una columna que no se puede ocultar lo dice', async () => { await start(); await sim.say('ocultá la columna fecha de alta'); expect(log()).toEqual([]); expect(sim.card().message).toBe('La columna Fecha de alta no se puede ocultar.'); });
  test('una columna por la que no se ordena lo dice', async () => { await start(); await sim.say('ordená por teléfono'); expect(sim.card().message).toBe('Por Teléfono no se puede ordenar.'); });
  test('«sacá el orden»', async () => { await start(); await sim.sayAll('ordená por nombre', 'sacá el orden'); expect(log()).toEqual(['sort:nombre:asc', 'sort:nombre:none']); });
  test('«qué columnas hay»', async () => { await start(); await sim.say('qué columnas hay'); expect(sim.card().message).toBe('Columnas: Nombre, Detalle, Teléfono, Fecha de alta.'); });
  test('en «which columns are there»', async () => { await start('en'); await sim.say('which columns are there'); expect(sim.card().message).toBe('Columns: Nombre, Detalle, Teléfono, Fecha de alta.'); });
  test('una columna que no existe no se toma', async () => { await start(); await sim.say('ocultá la columna precio'); expect(log()).toEqual([]); });
});

test.describe('TB-SEARCH · Buscar y filtrar', () => {
  test('«buscá ibuprofeno» escribe y dice lo que sale', async () => {
    await start();
    await sim.say('buscá ibuprofeno');
    expect(log()).toEqual(['search:ibuprofeno']);
    expect(sim.card().message).toBe('Busqué «ibuprofeno»: 2 resultados.');
  });
  test('sin resultados', async () => { await start(); await sim.say('buscá morfina'); expect(sim.card().message).toBe('Busqué «morfina»: no hay resultados.'); });
  test('«borrá la búsqueda»', async () => { await start(); await sim.sayAll('buscá ibuprofeno', 'borrá la búsqueda'); expect(log()).toEqual(['search:ibuprofeno', 'search:']); });
  test('es-ES «busca paracetamol»', async () => { await start('es-ES'); await sim.say('busca paracetamol'); expect(sim.card().message).toBe('He buscado «paracetamol»: 1 resultado.'); });
  test('en «search for amoxicilina»', async () => { await start('en'); await sim.say('search for amoxicilina'); expect(sim.card().message).toBe('Searched “amoxicilina”: 1 result.'); });
  for (const [locale, said, want] of [
    ['es', 'solo las notas de crédito', 'filter:credit_note'], ['es', 'filtrá por facturas', 'filter:invoice'], ['es', 'mostrá solo las facturas', 'filter:invoice'],
    ['es', 'mostrá todas', 'filter:all'], ['es-ES', 'filtra por notas de crédito', 'filter:credit_note'], ['en', 'only facturas', 'filter:invoice'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('un filtro que la tabla no tiene no se toma', async () => { await start(); await sim.say('solo los presupuestos'); expect(log()).toEqual([]); });
});

test.describe('TB-KEYWORD · Al filtrar se escribe solo la palabra clave', () => {
  for (const [locale, said, want] of [
    ['es', 'filtrá los que se llaman ibuprofeno', 'search:ibuprofeno'],
    ['es', 'filtrá por paracetamol', 'search:paracetamol'],
    ['es', 'buscá los medicamentos que contengan amoxicilina', 'search:amoxicilina'],
    ['es', 'buscá el registro con el nombre Ibuprofeno', 'search:Ibuprofeno'],
    ['es', 'filtrá la lista por los que tengan paracetamol', 'search:paracetamol'],
    ['es-ES', 'filtra los que tengan amoxicilina', 'search:amoxicilina'],
    ['es-ES', 'busca los medicamentos llamados paracetamol', 'search:paracetamol'],
    ['en', 'filter by the ones named paracetamol', 'search:paracetamol'],
    ['en', 'search for records containing ibuprofeno', 'search:ibuprofeno'],
    ['en', 'filter the medications called amoxicilina', 'search:amoxicilina'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('una opción del filtro sigue siendo el filtro («filtrá por facturas»)', async () => { await start(); await sim.say('filtrá por facturas'); expect(log()).toEqual(['filter:invoice']); });
});

test.describe('TB-ID · Elegir por ID o código', () => {
  const codes = ['MED-1', 'MED-2', 'MED-3', 'MED-4'];
  for (const [locale, said, want] of [
    ['es', 'seleccioná el código MED-2', 'open:r2'],
    ['es', 'abrí el de código med 3', 'open:r3'],
    ['es', 'el registro con id r4', 'open:r4'],
    ['es-ES', 'abre el código MED-1', 'open:r1'],
    ['en', 'open the one with code med 4', 'open:r4'],
    ['en', 'select id r2', 'open:r2'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale, { codes }); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('si no está en la página lo busca, y si no aparece lo dice', async () => {
    await start('es', { codes });
    await sim.say('abrí el código MED-9');
    expect(log()).toEqual(['search:MED-9']);
    expect(sim.card().message).toBe('No encontré un registro con «MED-9».');
  });
});

test.describe('TB-ROW · Elegir el registro', () => {
  for (const [locale, said, want] of [
    ['es', 'seleccioná el 3', 'open:r3'], ['es', 'abrí el registro 2', 'open:r2'], ['es', 'seleccioná la fila número 4', 'open:r4'], ['es', 'abrí el tercero', 'open:r3'],
    ['es', 'seleccioná el último', 'open:r4'], ['es', 'el primero', 'open:r1'], ['es', 'abrí el registro tres', 'open:r3'],
    ['es-ES', 'selecciona el 2', 'open:r2'], ['en', 'select row 3', 'open:r3'], ['en', 'open the second one', 'open:r2'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('un número que no está lo dice', async () => { await start(); await sim.say('seleccioná el 15'); expect(sim.card().message).toBe('No hay un registro 15 en lo que se ve (hay 4).'); });
  for (const [locale, said, want] of [
    ['es', 'abrí el que tiene teléfono 093552000', 'open:r3'], ['es', 'seleccioná el registro con detalle 600 mg', 'open:r3'],
    ['es', 'abrí el que tiene fecha de alta 02/03/2026', 'open:r2'], ['en', 'open the one with teléfono 094553000', 'open:r4'],
  ] as const) {
    test(`${locale} «${said}»`, async () => { await start(locale); await sim.say(said); expect(log()).toEqual([want]); });
  }
  test('por columna con varios: pregunta', async () => {
    await start();
    await sim.say('abrí el que tiene nombre ibuprofeno');
    expect(sim.card().choices).toHaveLength(2);
    await sim.say('el segundo');
    expect(log()).toEqual(['open:r3']);
  });
  test('«cerrá el detalle» suelta el registro', async () => { await start(); await sim.sayAll('seleccioná el 2', 'cerrá el detalle'); expect(log()).toEqual(['open:r2', 'deselect']); });
  test('en «back to the list»', async () => { await start('en'); await sim.sayAll('select row 2', 'back to the list'); expect(log()).toEqual(['open:r2', 'deselect']); });
});

test.describe('TB-EXPORT · Exportar', () => {
  test('con la ventana de exportar abierta: «exportá a CSV»', async () => {
    await start();
    openSimExportDialog(log());
    await sim.say('exportá a CSV');
    expect(log()).toEqual(['format:csv', 'export:csv']);
    expect(sim.card().message).toBe('Exporto en CSV.');
  });
  test('sin decir el formato: pregunta', async () => {
    await start();
    openSimExportDialog(log());
    await sim.say('exportá');
    expect(sim.card().choices).toEqual(['Excel', 'CSV']);
    await sim.say('Excel');
    expect(log()).toEqual(['format:excel', 'export:excel']);
  });
  test('PDF no está: pregunta entre los que hay', async () => {
    await start();
    openSimExportDialog(log());
    await sim.say('exportá a PDF');
    expect(sim.card().message).toMatch(/^En PDF no se puede/);
  });
  test('en «export to excel»', async () => { await start('en'); openSimExportDialog(log()); await sim.say('export to excel'); expect(log()).toEqual(['format:excel', 'export:excel']); });
  test('sin nada para exportar lo dice', async () => { await start(); await sim.say('exportá a Excel'); expect(sim.card().message).toBe('Acá no hay para exportar.'); });
});

test.describe('TB-LAYER · La tabla de arriba primero', () => {
  test('con dos tablas (lista y la de una pestaña del detalle), «siguiente página» va a la de arriba', async () => {
    await start();
    const inner = publishSimCrud({ key: 'crud.inner', rows: ['Sesión 1', 'Sesión 2'] });
    // La interna se publicó después: en el simulador (sin DOM) es la misma capa; gana la más reciente.
    await sim.say('seleccioná el 2');
    expect([...inner.log, ...log()]).toHaveLength(1);
  });
});

test.describe('TB-HELP · Después de «¿qué puedo hacer acá?»', () => {
  test('un pedido nuevo se hace sin preguntar si cambiamos de tarea', async () => {
    await start();
    screen.page(screen.button('Crear'), screen.button('Refrescar'));
    await sim.say('qué puedo hacer acá');
    expect(sim.card().message).toMatch(/En la tabla también/);
    await sim.say('ordená por nombre');
    expect(log()).toEqual(['sort:nombre:asc']);
    expect(sim.card().message).not.toMatch(/Cambiamos de tarea/);
  });
});
