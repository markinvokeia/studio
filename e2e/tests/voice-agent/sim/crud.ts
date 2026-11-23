import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import { openWindow } from './dom';
import { FakeEl, screen } from './page';

import type { CrudVoiceBridge, ExportDialogVoiceBridge, TableVoiceColumn, ViewModeVoiceBridge } from '@/lib/types';

/**
 * Una lista con la tabla común (lo que publica DataTable), p. ej. Medicamentos del catálogo: filas
 * con sus columnas, buscador, filtro de la barra, páginas, orden, columnas visibles y la fila
 * elegida. También la vista tabla/lista y la ventana de exportar, como en la app.
 */
export interface SimCrud { bridge: CrudVoiceBridge; log: string[] }

const OWNER = {};
const VIEW_OWNER = {};
const EXPORT_OWNER = {};

const DEFAULT_ROWS = ['Ibuprofeno · 400 mg', 'Amoxicilina · 500 mg', 'Ibuprofeno · 600 mg', 'Paracetamol · 1 g'];

export function publishSimCrud({
  createLabel = '',
  rows = DEFAULT_ROWS,
  key = 'crud.sim',
  filterOptions = null as Array<{ value: string; label: string }> | null,
  pages = 3,
  withView = false,
  codes = null as string[] | null,
  /** La tabla no abre sola (Servicios, Cajas): cada fila trae estos botones («Editar», «Eliminar»). */
  rowActions = null as string[] | null,
} = {}): SimCrud {
  const log: string[] = [];
  const columns: TableVoiceColumn[] = [
    { id: 'nombre', label: 'Nombre', visible: true, canHide: true, canSort: true, sort: null },
    { id: 'detalle', label: 'Detalle', visible: true, canHide: true, canSort: true, sort: null },
    { id: 'telefono', label: 'Teléfono', visible: true, canHide: true, canSort: false, sort: null },
    { id: 'fecha_alta', label: 'Fecha de alta', visible: true, canHide: false, canSort: true, sort: null },
    ...(codes ? [{ id: 'codigo', label: 'Código', visible: true, canHide: true, canSort: true, sort: null }] : []),
  ];
  const allRows = rows.map((label, i) => {
    const [nombre, detalle = ''] = label.split(' · ');
    return { id: `r${i + 1}`, label, cells: { nombre, detalle, telefono: `09${i + 1}55${i}000`, fecha_alta: `0${i + 1}/03/2026`, ...(codes ? { codigo: codes[i] ?? '' } : {}) } };
  });
  let page = 0;
  let size = 25;
  let search = '';
  let filter = 'all';
  const bridge: CrudVoiceBridge = {
    createLabel,
    rows: allRows,
    total: rows.length,
    create: () => {
      log.push('create');
      // Se abre el formulario (con su campo de nombre), como en la app.
      openWindow(createLabel || 'Nuevo', { tree: screen.group(screen.field('Nombre'), screen.field('Descripción'), screen.button('Guardar')) });
    },
    open: (id) => { log.push(`open:${id}`); bridge.selectedId = id; bridge.deselect = () => { log.push('deselect'); bridge.selectedId = null; bridge.deselect = null; }; },
    refresh: () => log.push('refresh'),
    selectedId: null,
    deselect: null,
    columns: () => columns.map((c) => ({ ...c })),
    search: {
      get value() { return search; },
      set: (text: string) => {
        search = text;
        log.push(`search:${text}`);
        const words = text.toLowerCase().split(' ').filter(Boolean);
        bridge.rows = allRows.filter((r) => words.every((w) => r.label.toLowerCase().includes(w)));
      },
    },
    filter: filterOptions ? { options: filterOptions, get value() { return filter; }, set: (v: string) => { filter = v; log.push(`filter:${v}`); } } : null,
    page: {
      get index() { return page; },
      count: pages,
      get size() { return size; },
      sizes: [10, 25, 50, 100, 200],
      go: (i: number) => { page = i; log.push(`page:${i + 1}`); },
      setSize: (n: number | 'all') => { size = n === 'all' ? 9999 : n; log.push(`size:${n}`); },
    },
    sortBy: (id, dir) => { for (const c of columns) c.sort = c.id === id ? dir : null; log.push(`sort:${id}:${dir ?? 'none'}`); },
    setColumnVisible: (id, visible) => { const c = columns.find((x) => x.id === id); if (c) c.visible = visible; log.push(`${visible ? 'show' : 'hide'}:${id}`); },
  };
  if (rowActions) {
    const root = new FakeEl('DIV', { 'data-voice-table': '' });
    for (const r of allRows) {
      const tr = new FakeEl('TR', { 'data-row-id': r.id }, r.label);
      for (const name of rowActions) {
        const b = new FakeEl('BUTTON', {}, name);
        b.onClick = () => log.push(`${name.toLowerCase()}:${r.id}`);
        tr.append(b);
      }
      root.append(tr);
    }
    bridge.open = null;
    bridge.root = () => root as unknown as HTMLElement;
  }
  publishVoiceBridge(key, bridge, OWNER);
  if (withView) {
    const view: ViewModeVoiceBridge = { value: 'table', set: (m) => { view.value = m; log.push(`view:${m}`); }, root: () => null };
    publishVoiceBridge('view.sim', view, VIEW_OWNER);
  }
  return { bridge, log };
}

/** La ventana «Exportar registros» abierta (lo que publica GridExportDialog). */
export function openSimExportDialog(log: string[]): ExportDialogVoiceBridge {
  const dialog: ExportDialogVoiceBridge = {
    formats: ['excel', 'csv'],
    format: 'excel',
    setFormat: (f) => { dialog.format = f; log.push(`format:${f}`); },
    setRange: () => log.push('range'),
    submit: () => { log.push(`export:${dialog.format}`); publishVoiceBridge('export.dialog', null, EXPORT_OWNER); },
  };
  publishVoiceBridge('export.dialog', dialog, EXPORT_OWNER);
  return dialog;
}

export function clearSimCrud() {
  publishVoiceBridge('crud.sim', null, OWNER);
  publishVoiceBridge('view.sim', null, VIEW_OWNER);
  publishVoiceBridge('export.dialog', null, EXPORT_OWNER);
}
