import { closeTopOverlay, hasOpenOverlay, topOverlayElement } from '@/lib/voice/dom-dialog';
import { waitListUpdate } from '@/lib/voice/dom-ui';
import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { getVoiceBridge, listVoiceBridges } from '@/lib/voice/screen-bridge';
import { CRUD_VOICE_DOMAIN } from '@/lib/voice/commands/crud';

import type { CrudVoiceBridge, ExportDialogVoiceBridge, TableVoiceColumn, ViewModeVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * Todo lo que se hace con una tabla (la tabla común, DataTable), donde esté: la lista de la
 * pantalla, la de una pestaña del panel de detalle o la de una ventana. Buscar (escribe en la barra
 * y dice lo que sale), filtros de la barra, exportar (pregunta el formato si no se dijo), páginas
 * (siguiente, anterior, primera, última, la N), cantidad por página, vista tabla/lista, columnas
 * (ocultar, mostrar, ¿cuáles hay?), ordenar por una columna, elegir el registro por posición
 * («el tercero», «el 15») o por el valor de una columna, cerrar el detalle.
 *
 * Capas: lo dicho va primero a la tabla de arriba (ventana > pestaña del detalle > detalle >
 * lista). Si nombra un registro que está en una tabla de más abajo, se cierra lo de arriba y se
 * sigue ahí.
 */

const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.table.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

// ── Las tablas, por capa ──────────────────────────────────────────────────────

const shown = (el: HTMLElement | null | undefined) => !!el && el.isConnected !== false && (el.offsetWidth > 0 || el.offsetHeight > 0 || typeof el.offsetWidth !== 'number');

/** 0: dentro de la ventana de arriba; 1: pestaña activa del detalle; 2: detalle; 3: la lista. */
function layerOf(table: CrudVoiceBridge): number {
  const root = table.root?.();
  if (!root || typeof root.closest !== 'function') return 3;
  const overlay = topOverlayElement();
  if (overlay?.contains(root)) return 0;
  const detail = root.closest('[data-voice-panel="detail"]');
  if (detail) return root.closest('[role="tabpanel"]') ? 1 : 2;
  return 3;
}

interface Layered { table: CrudVoiceBridge; layer: number }

/** Las tablas que se ven, la de más arriba primero. Con una ventana abierta, solo cuentan las de afuera si se cierra. */
function tables(): Layered[] {
  return listVoiceBridges<CrudVoiceBridge>('crud')
    .filter((b): b is CrudVoiceBridge => !!b && Array.isArray(b.rows))
    .filter((b) => !b.root || shown(b.root()))
    .map((table) => ({ table, layer: layerOf(table) }))
    .sort((a, b) => a.layer - b.layer);
}

/** La tabla de arriba que tenga eso; si hay una ventana abierta y la tabla está afuera, primero se cierra. */
async function tableWith(ctx: VoiceCommandContext, has: (t: CrudVoiceBridge) => boolean): Promise<CrudVoiceBridge | null> {
  const found = tables().find((x) => has(x.table));
  if (!found) return null;
  if (found.layer > 0 && hasOpenOverlay()) {
    for (let i = 0; i < 3 && hasOpenOverlay(); i++) { closeTopOverlay(); await settle(150); }
  }
  void ctx;
  return found.table;
}

// ── Lo que se dice ────────────────────────────────────────────────────────────

const ORDINAL = '(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|setim[oa]|octav[oa]|noven[oa]|decim[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)';
const NUMBER_WORDS: Record<string, number> = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, veinte: 20, cincuenta: 50, cien: 100, doscientos: 200, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, hundred: 100 };
const numberOf = (word: string) => (/^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word] ?? null);

type Parsed =
  | { op: 'page'; to: 'next' | 'prev' | 'first' | 'last' | number }
  | { op: 'pageSize'; size: number | 'all' }
  | { op: 'view'; mode: 'table' | 'list' }
  | { op: 'columns' }
  | { op: 'column'; name: string; visible: boolean }
  | { op: 'sort'; name: string | null; dir: 'asc' | 'desc' | null }
  | { op: 'search'; text: string | null }
  | { op: 'filter'; text: string }
  | { op: 'row'; index: number | null; ordinal: string | null; column: string | null; value: string | null }
  | { op: 'deselect' }
  | { op: 'export'; format: 'excel' | 'csv' | 'pdf' | null };

const clean = (normalized: string) => normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();

export function parseTable(normalized: string): Parsed | null {
  const t = clean(normalized);
  const GO = '(?:(?:anda\\w*|ve|ir|pasa\\w*|move\\w*|movete|mueve\\w*|go|volve\\w*|vamos)\\s+(?:a\\s+|al\\s+|to\\s+(?:the\\s+)?)?(?:la\\s+)?)?';
  if (new RegExp(`^${GO}(?:(?:la )?(?:siguiente|proxima) pagina|(?:la )?pagina siguiente|next page|the next page|la que sigue)$`).test(t)) return { op: 'page', to: 'next' };
  if (new RegExp(`^${GO}(?:(?:la )?pagina anterior|(?:la )?anterior pagina|previous page|the previous page|una pagina (?:atras|para atras)|back a page)$`).test(t)) return { op: 'page', to: 'prev' };
  if (new RegExp(`^${GO}(?:(?:la )?primera pagina|first page|the first page|(?:al )?principio de la lista)$`).test(t)) return { op: 'page', to: 'first' };
  if (new RegExp(`^${GO}(?:(?:la )?ultima pagina|last page|the last page|(?:al )?final de la lista)$`).test(t)) return { op: 'page', to: 'last' };
  const goto = t.match(new RegExp(`^${GO}(?:pagina|page)\\s+(?:numero\\s+|number\\s+)?(\\w+)$`));
  if (goto && numberOf(goto[1])) return { op: 'page', to: numberOf(goto[1])! };

  const size = t.match(/^(?:(?:pone\w*|pon|mostra\w*|muestra\w*|ensena\w*|ver|quiero(?: ver)?|cambia\w* a|show(?: me)?|set(?: it to)?|display)\s+)?(?:de a\s+)?(\w+)\s+(?:(?:elementos|filas|registros|resultados|items?|rows|records|lines|lineas)\s+)?(?:por pagina|por hoja|per page|a page|on each page|en cada pagina)$/);
  if (size) {
    const n = /^(?:todos|todas|all|everything)$/.test(size[1]) ? 'all' : numberOf(size[1]);
    if (n) return { op: 'pageSize', size: n };
  }
  if (/^(?:(?:mostra\w*|muestra\w*|ver|show(?: me)?)\s+)?(?:todos|todas|all|everything)(?: los registros| the records)? en una (?:sola )?pagina$|^(?:show )?all on one page$/.test(t)) return { op: 'pageSize', size: 'all' };

  const view = t.match(/^(?:(?:pone\w*|cambia\w*|pasa\w*|mostra\w*|muestra\w*|ver|switch|change|show|set|go)\s+(?:a\s+|al\s+|to\s+|it\s+)?(?:(?:la|el|the|en|como|as|in)\s+)?)?(?:(?:vista|modo|view|mode|formato)\s+(?:de\s+)?)?(tabla|lista|tarjetas|table|list|cards)(?:\s+(?:view|mode))?$/);
  if (view && /\b(?:vista|modo|view|mode|formato|como|as|en)\b/.test(t)) return { op: 'view', mode: /tabla|table/.test(view[1]) ? 'table' : 'list' };

  if (/^(?:que|cuales) columnas (?:hay|tiene|tengo|se ven)|^(?:which|what) columns(?: are there| are shown| does it have)?$|^(?:decime|leeme) las columnas$/.test(t)) return { op: 'columns' };
  const hide = t.match(/^(?:oculta\w*|esconde\w*|saca\w*|quita\w*|hide|remove)\s+(?:la\s+|the\s+)?(?:columna\s+(?:de\s+|del\s+)?)?(.+?)(?:\s+column)?$/);
  if (hide && /\b(?:columna|column)\b/.test(t)) return { op: 'column', name: hide[1].trim(), visible: false };
  const showCol = t.match(/^(?:mostra\w*|muestra\w*|pone\w*|agrega\w*|volve\w* a mostrar|show|add|display)\s+(?:la\s+|the\s+)?(?:columna\s+(?:de\s+|del\s+)?)(.+?)$|^(?:show|add|display)\s+(?:the\s+)?(.+?)\s+column$/);
  if (showCol) return { op: 'column', name: (showCol[1] ?? showCol[2]).trim(), visible: true };

  if (/^(?:saca\w*|quita\w*|borra\w*|clear|remove)\s+(?:el\s+|the\s+)?(?:orden|ordenamiento|sort(?:ing)?)$|^sin orden$/.test(t)) return { op: 'sort', name: null, dir: null };
  const DIR = '(ascendente|descendente|de menor a mayor|de mayor a menor|de la a a la z|de la z a la a|de la a la z|alfabeticamente|al reves|de mas nuevo a mas viejo|de mas viejo a mas nuevo|de mas reciente a mas antiguo|asc|desc|ascending|descending|a to z|z to a|reversed|newest first|oldest first)';
  const sort = t.match(new RegExp(`^(?:ordena\\w*|ordenar|sort(?:ea\\w*)?|order)\\s+(?:(?:la lista|la tabla|the list|the table|it)\\s+)?(?:por|by)\\s+(?:la columna\\s+|the column\\s+)?(.+?)(?:\\s+(?:en (?:forma |orden )?)?${DIR})?$`));
  if (sort) return { op: 'sort', name: sort[1].trim(), dir: dirOf(sort[2]) };
  const sortDir = t.match(new RegExp(`^(?:(?:pone\\w*|ordena\\w*|sort|set)\\s+)?(?:la columna\\s+|the column\\s+)?(.+?)\\s+(?:en (?:forma |orden )?)?${DIR}$`));
  if (sortDir) return { op: 'sort', name: sortDir[1].trim(), dir: dirOf(sortDir[2]) };

  if (/^(?:borra\w*|limpia\w*|saca\w*|quita\w*|clear|remove|reset)\s+(?:la\s+|the\s+)?(?:busqueda|search|filtro de texto)$/.test(t)) return { op: 'search', text: null };
  const search = t.match(/^(?:busca\w*|buscar|search(?: for)?|find|look for|look up)\s+(?:en la (?:lista|tabla)\s+|in the (?:list|table)\s+)?(.+)$/);
  if (search) return { op: 'search', text: search[1].trim() };

  if (/^(?:cerra\w*|cierra\w*|close|hide)\s+(?:el\s+|the\s+)?(?:detalle|panel de detalle|panel|details?|detail panel)$|^(?:volve\w*|vuelve|regresa\w*|back|go back)\s+(?:a\s+|to\s+)?(?:la\s+|the\s+)?(?:lista|list)$|^(?:deselecciona\w*|desmarca\w*|solta\w*|deselect|unselect)(?:\s+(?:el|la|the)\s+\w+)?$/.test(t)) return { op: 'deselect' };

  const exp = t.match(/^(?:exporta\w*|descarga\w*|baja\w*|bajate|export|download)(?:lo|la|los|las)?(?:\s+(?:la tabla|la lista|todo|esto|los registros|the table|the list|this|it|everything|the records))?(?:\s+(?:a|en|como|to|as|in))?(?:\s+(?:un |una |an? )?(excel|xls|xlsx|csv|pdf|planilla|spreadsheet))?$/);
  if (exp) return { op: 'export', format: !exp[1] ? null : /pdf/.test(exp[1]) ? 'pdf' : /csv/.test(exp[1]) ? 'csv' : 'excel' };

  // «seleccioná el 15», «abrí el registro 3», «el tercero», «la fila número 2», «select row 4».
  const rowVerb = '(?:selecciona\\w*|elegi\\w*|elige|escoge\\w*|marca\\w*|abri\\w*|abre|mostra\\w*|muestra\\w*|ver|anda\\w* al?|ir al?|select|open|show(?: me)?|pick|choose|go to)';
  const byIndex = t.match(new RegExp(`^${rowVerb}\\s+(?:(?:el|la|the)\\s+)?(?:(?:registro|fila|row|record|item|elemento|linea|line)\\s+)?(?:(?:numero|number|n)\\s+)?(\\d{1,3})$|^${rowVerb}\\s+(?:(?:el|la|the)\\s+)?(?:registro|fila|row|record|item|elemento|linea|line)\\s+(?:numero\\s+|number\\s+)?(\\w+)$`));
  if (byIndex) {
    const n = numberOf(byIndex[1] ?? byIndex[2]);
    if (n) return { op: 'row', index: n, ordinal: null, column: null, value: null };
  }
  const byOrdinal = t.match(new RegExp(`^(?:${rowVerb}\\s+)?(?:(?:el|la|the)\\s+)?(?:(?:registro|fila|row|record|item|elemento)\\s+)?(${ORDINAL})(?:\\s+(?:registro|fila|row|record|item|elemento|one|de la lista|of the list))?$`));
  if (byOrdinal && (t !== byOrdinal[1] || /^(?:primer[oa]|ultim[oa]|first|last)$/.test(byOrdinal[1]))) return { op: 'row', index: null, ordinal: byOrdinal[1], column: null, value: null };
  // «abrí el que tiene teléfono 099…», «seleccioná el registro con email ana@…», «select the one whose name is Ana».
  const byColumn = t.match(new RegExp(`^${rowVerb}\\s+(?:(?:el|la|the)\\s+)?(?:(?:registro|fila|row|record|one|item)\\s+)?(?:que tiene|que tenga|con|cuyo|cuya|de|with|whose|where|that has)\\s+(?:(?:el|la|the)\\s+)?(.+)$`));
  if (byColumn) return { op: 'row', index: null, ordinal: null, column: byColumn[1].trim(), value: null };

  // Filtro de la barra: «solo las notas de crédito», «filtrá por facturas», «mostrá todas».
  const filter = t.match(/^(?:(?:filtra\w*|mostra\w*|muestra\w*|ensena\w*|ver|show(?: me)?|filter(?: by)?|only)\s+)?(?:por\s+|by\s+)?(?:solo|solamente|unicamente|only)\s+(?:las\s+|los\s+|the\s+)?(.+)$|^(?:filtra\w*|filter)\s+(?:por\s+|by\s+)?(?:las\s+|los\s+|the\s+)?(.+)$|^(?:mostra\w*|muestra\w*|ver|show(?: me)?)\s+(?:todas|todos|all)$/);
  if (filter) return { op: 'filter', text: (filter[1] ?? filter[2] ?? 'todos').trim() };
  return null;
}

function dirOf(word: string | undefined): 'asc' | 'desc' | null {
  if (!word) return 'asc';
  return /descendente|mayor a menor|z a la a|al reves|mas nuevo|mas reciente|desc|descending|z to a|reversed|newest/.test(word) ? 'desc' : 'asc';
}

// ── Columnas y filas ──────────────────────────────────────────────────────────

const singular = (w: string) => w.replace(/(?:es|s)$/, '');
const sameWords = (a: string, b: string) => {
  const x = normalizeSpeech(a).split(' ').filter(Boolean).map(singular);
  const y = normalizeSpeech(b).split(' ').filter(Boolean).map(singular);
  return x.length > 0 && x.every((w) => y.includes(w));
};

/** La columna nombrada («teléfono», «fecha de alta», «the email column»). */
function findColumn(columns: TableVoiceColumn[], name: string): TableVoiceColumn | null {
  const key = normalizeSpeech(name).replace(/\b(?:columna|column)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return columns.find((c) => normalizeSpeech(c.label) === key)
    ?? columns.find((c) => sameWords(key, c.label))
    ?? columns.find((c) => sameWords(c.label, key))
    ?? columns.find((c) => normalizeSpeech(c.id.replace(/[_-]+/g, ' ')) === key)
    ?? null;
}

/** «teléfono 099 123» → la columna y el valor (lo que sigue al nombre de la columna). */
function columnAndValue(columns: TableVoiceColumn[], text: string): { column: TableVoiceColumn; value: string } | null {
  const words = normalizeSpeech(text).split(' ');
  for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
    // Lo dicho tiene que ser el nombre de la columna (no al revés: «detalle 600» no es «Detalle»).
    const key = words.slice(0, n).join(' ');
    const column = columns.find((c) => normalizeSpeech(c.label) === key) ?? columns.find((c) => sameWords(key, c.label));
    if (column) {
      const value = words.slice(n).join(' ').replace(/^(?:es|sea|igual a|=|is|equals|of|de)\s+/, '').trim();
      if (value) return { column, value };
    }
  }
  return null;
}

function rowLabel(table: CrudVoiceBridge, row: CrudVoiceBridge['rows'][number]): string {
  if (row.label) return row.label;
  const el = table.root?.()?.querySelector?.(`[data-row-id="${row.id}"]`);
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || row.id;
}

// ── Exportar ──────────────────────────────────────────────────────────────────

const exportDialog = () => getVoiceBridge<ExportDialogVoiceBridge>('export.dialog');
const EXPORT_RE = /\b(?:export\w*|descarga\w*|download|excel|csv|pdf|planilla)\b/i;

function exportButton(table: CrudVoiceBridge | null): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const root = table?.root?.();
  const scope: ParentNode = (root?.closest?.('[role="dialog"], [data-voice-panel], main') as HTMLElement | null) ?? document.querySelector('main') ?? document;
  const buttons = Array.from(scope.querySelectorAll<HTMLElement>('button, [role="button"]'));
  return buttons.find((b) => {
    const label = `${b.textContent ?? ''} ${b.getAttribute('aria-label') ?? ''} ${b.getAttribute('title') ?? ''} ${b.querySelector('.sr-only')?.textContent ?? ''}`;
    return EXPORT_RE.test(normalizeSpeech(label)) && shown(b);
  }) ?? null;
}

const formatName = (f: string) => (f === 'excel' ? 'Excel' : f.toUpperCase());

async function runExport(ctx: VoiceCommandContext, wanted: 'excel' | 'csv' | 'pdf' | null) {
  let dialog = exportDialog();
  if (!dialog) {
    const button = exportButton(tables()[0]?.table ?? null);
    if (!button) { await say(ctx, T(ctx, 'noExport'), 'info'); return; }
    button.click();
    // Se abre la ventana de exportar o un menú con los formatos (o se descarga directo).
    for (let i = 0; i < 25 && !exportDialog() && !menuFormats().length; i++) await settle(60);
    dialog = exportDialog();
    if (!dialog) {
      const options = menuFormats();
      if (!options.length) { await say(ctx, T(ctx, 'exportStarted')); return; }
      let pick = wanted ? options.find((o) => o.format === wanted) : options.length === 1 ? options[0] : undefined;
      if (!pick) {
        const question = T(ctx, 'exportWhich', { options: options.map((o) => o.label).join(', ') });
        const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: options.map((o) => ({ label: o.label })) }, question);
        pick = options[index];
      }
      pick.element.click();
      await say(ctx, T(ctx, 'exporting', { format: pick.label }));
      return;
    }
  }
  let format = wanted && wanted !== 'pdf' && dialog.formats.includes(wanted) ? wanted : null;
  if (!format) {
    const labels = dialog.formats.map(formatName);
    const question = wanted === 'pdf' ? T(ctx, 'exportNoPdf', { options: labels.join(', ') }) : T(ctx, 'exportWhich', { options: labels.join(', ') });
    const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: labels.map((label) => ({ label })) }, question);
    format = dialog.formats[index];
  }
  dialog.setFormat(format);
  await settle(60);
  exportDialog()?.submit();
  await say(ctx, T(ctx, 'exporting', { format: formatName(format) }));
}

/** Las opciones de formato de un menú abierto (Excel / PDF / CSV). */
function menuFormats(): Array<{ label: string; format: 'excel' | 'csv' | 'pdf'; element: HTMLElement }> {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .filter((el) => shown(el))
    .map((el) => {
      const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      const n = normalizeSpeech(label);
      const format = /pdf/.test(n) ? 'pdf' as const : /csv/.test(n) ? 'csv' as const : /excel|xls|planilla/.test(n) ? 'excel' as const : null;
      return format ? { label, format, element: el } : null;
    })
    .filter((x): x is { label: string; format: 'excel' | 'csv' | 'pdf'; element: HTMLElement } => !!x);
}

// ── El comando ────────────────────────────────────────────────────────────────

registerVoiceCommand<Parsed>({
  id: 'table.act',
  domain: CRUD_VOICE_DOMAIN,
  // Por encima de las altas y aperturas por nombre (crud.act), por debajo de lo propio de cada pantalla.
  priority: 6,
  // Una tabla dentro de una ventana se maneja sin cerrarla (si la tabla está afuera, se cierra a mano).
  keepsOverlay: true,
  match: (normalized) => {
    const all = tables();
    const views = listVoiceBridges<ViewModeVoiceBridge>('view').filter(Boolean);
    if (!all.length && !views.length && !exportDialog()) return null;
    const parsed = parseTable(normalized);
    if (!parsed) return null;
    if (parsed.op === 'view') return views.length ? parsed : null;
    if (parsed.op === 'export') return parsed;
    if (!all.length) return null;
    if (parsed.op === 'filter') {
      // Solo si alguna tabla tiene ese filtro (si no, es de otro comando: «solo los deudores» en Pacientes).
      const key = parsed.text;
      return all.some(({ table }) => table.filter && (/^(?:todos|todas|all)$/.test(key) || table.filter.options.some((o) => sameWords(key, o.label) || sameWords(o.label, key)))) ? parsed : null;
    }
    if (parsed.op === 'column' || (parsed.op === 'sort' && parsed.name)) {
      const name = parsed.name!;
      return all.some(({ table }) => table.columns && findColumn(table.columns(), name)) ? parsed : null;
    }
    if (parsed.op === 'row' && parsed.column) {
      return all.some(({ table }) => table.columns && columnAndValue(table.columns(), parsed.column!)) ? parsed : null;
    }
    if (parsed.op === 'search') return all.some(({ table }) => table.search) ? parsed : null;
    if (parsed.op === 'deselect') return all.some(({ table }) => table.selectedId && table.deselect) ? parsed : null;
    return parsed;
  },
  run: async (parsed, ctx) => {
    switch (parsed.op) {
      case 'export': await runExport(ctx, parsed.format); return;
      case 'view': {
        const views = listVoiceBridges<ViewModeVoiceBridge>('view').filter(Boolean);
        const view = views.find((v) => shown(v.root())) ?? views[0];
        if (!view) { await say(ctx, T(ctx, 'noView'), 'info'); return; }
        view.set(parsed.mode);
        await say(ctx, T(ctx, parsed.mode === 'table' ? 'viewTable' : 'viewList'));
        return;
      }
      case 'page': {
        const table = await tableWith(ctx, (t) => !!t.page);
        const page = table?.page;
        if (!table || !page) { await say(ctx, T(ctx, 'noPages'), 'info'); return; }
        const last = page.count - 1;
        const to = parsed.to === 'next' ? page.index + 1 : parsed.to === 'prev' ? page.index - 1 : parsed.to === 'first' ? 0 : parsed.to === 'last' ? last : parsed.to - 1;
        if (page.count <= 1) { await say(ctx, T(ctx, 'onePage'), 'info'); return; }
        if (to > last) { await say(ctx, parsed.to === 'next' ? T(ctx, 'alreadyLast') : T(ctx, 'noSuchPage', { count: page.count }), 'info'); return; }
        if (to < 0) { await say(ctx, T(ctx, 'alreadyFirst'), 'info'); return; }
        page.go(to);
        await say(ctx, T(ctx, 'page', { page: to + 1, count: page.count }));
        return;
      }
      case 'pageSize': {
        const table = await tableWith(ctx, (t) => !!t.page);
        if (!table?.page) { await say(ctx, T(ctx, 'noPages'), 'info'); return; }
        table.page.setSize(parsed.size);
        await say(ctx, parsed.size === 'all' ? T(ctx, 'pageSizeAll') : T(ctx, 'pageSize', { size: parsed.size }));
        return;
      }
      case 'columns': {
        const table = await tableWith(ctx, (t) => !!t.columns);
        const cols = table?.columns?.() ?? [];
        if (!cols.length) { await say(ctx, T(ctx, 'noColumns'), 'info'); return; }
        await say(ctx, T(ctx, 'columns', { list: cols.map((c) => c.label).join(', ') }), 'info', cols.map((c) => ({ label: c.label, value: c.visible ? T(ctx, 'visible') : T(ctx, 'hidden') })));
        return;
      }
      case 'column': {
        const table = await tableWith(ctx, (t) => !!t.columns && !!findColumn(t.columns(), parsed.name));
        const column = table?.columns ? findColumn(table.columns(), parsed.name) : null;
        if (!table || !column) { await say(ctx, T(ctx, 'columnNotFound', { name: parsed.name }), 'info'); return; }
        if (!column.canHide || !table.setColumnVisible) { await say(ctx, T(ctx, 'cantHide', { name: column.label }), 'info'); return; }
        table.setColumnVisible(column.id, parsed.visible);
        await say(ctx, T(ctx, parsed.visible ? 'columnShown' : 'columnHidden', { name: column.label }));
        return;
      }
      case 'sort': {
        if (!parsed.name) {
          const table = await tableWith(ctx, (t) => !!t.columns && t.columns().some((c) => c.sort));
          const sorted = table?.columns?.().find((c) => c.sort);
          if (table && sorted) table.sortBy?.(sorted.id, null);
          await say(ctx, T(ctx, 'sortCleared'));
          return;
        }
        const table = await tableWith(ctx, (t) => !!t.columns && !!findColumn(t.columns(), parsed.name!));
        const column = table?.columns ? findColumn(table.columns(), parsed.name) : null;
        if (!table || !column) { await say(ctx, T(ctx, 'columnNotFound', { name: parsed.name }), 'info'); return; }
        if (!column.canSort || !table.sortBy) { await say(ctx, T(ctx, 'cantSort', { name: column.label }), 'info'); return; }
        table.sortBy(column.id, parsed.dir);
        await say(ctx, T(ctx, 'sorted', { name: column.label, dir: T(ctx, parsed.dir === 'desc' ? 'desc' : 'asc') }));
        return;
      }
      case 'search': {
        const table = await tableWith(ctx, (t) => !!t.search);
        if (!table?.search) { await say(ctx, T(ctx, 'noSearch'), 'info'); return; }
        if (parsed.text === null) { table.search.set(''); await say(ctx, T(ctx, 'searchCleared')); return; }
        const idsOf = (t: CrudVoiceBridge) => t.rows.map((r) => r.id).join(',');
        const before = idsOf(table);
        table.search.set(parsed.text);
        // La búsqueda puede ir al servidor: hasta que cambien las filas (o pase un rato) y termine de cargar.
        const current = () => tables().find((x) => x.table.search && normalizeSpeech(x.table.search.value) === normalizeSpeech(parsed.text!))?.table ?? table;
        const start = Date.now();
        while (Date.now() - start < 3000 && !ctx.signal.aborted && idsOf(current()) === before) await settle(100);
        await waitListUpdate(ctx.signal, 0);
        const after = current();
        const rows = after.rows;
        await say(ctx, T(ctx, 'searched', { text: parsed.text, count: rows.length }), 'info', rows.slice(0, 8).map((r, i) => ({ label: String(i + 1), value: rowLabel(after, r) })));
        return;
      }
      case 'filter': {
        const all = /^(?:todos|todas|all)$/.test(parsed.text);
        const table = await tableWith(ctx, (t) => !!t.filter && (all || t.filter.options.some((o) => sameWords(parsed.text, o.label) || sameWords(o.label, parsed.text))));
        const filter = table?.filter;
        if (!filter) { await say(ctx, T(ctx, 'noFilter'), 'info'); return; }
        const option = all ? null : filter.options.find((o) => normalizeSpeech(o.label) === normalizeSpeech(parsed.text)) ?? filter.options.find((o) => sameWords(parsed.text, o.label) || sameWords(o.label, parsed.text));
        filter.set(option ? option.value : 'all');
        await say(ctx, option ? T(ctx, 'filtered', { label: option.label }) : T(ctx, 'filterAll'));
        return;
      }
      case 'deselect': {
        const table = await tableWith(ctx, (t) => !!t.selectedId && !!t.deselect);
        if (!table?.deselect) { await say(ctx, T(ctx, 'noSelection'), 'info'); return; }
        table.deselect();
        await say(ctx, T(ctx, 'deselected'));
        return;
      }
      case 'row': {
        if (parsed.column) {
          // Por el valor de una columna: la primera tabla (de arriba hacia abajo) que lo tenga.
          for (const { table } of tables()) {
            const cols = table.columns?.() ?? [];
            const cv = columnAndValue(cols, parsed.column);
            if (!cv || !table.open) continue;
            const value = normalizeSpeech(cv.value);
            const hits = table.rows.filter((r) => normalizeSpeech(r.cells?.[cv.column.id] ?? '').includes(value) || normalizeSpeech(r.cells?.[cv.column.id] ?? '').replace(/\s/g, '').includes(value.replace(/\s/g, '')));
            if (!hits.length) continue;
            const target = await tableWith(ctx, (t) => t === table);
            let row = hits[0];
            if (hits.length > 1) {
              const question = T(ctx, 'which');
              const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: hits.slice(0, 8).map((r) => ({ label: rowLabel(table, r) })) }, `${question} ${hits.slice(0, 5).map((r, i) => `${i + 1}: ${rowLabel(table, r)}`).join('. ')}.`);
              row = hits[index];
            }
            target?.open?.(row.id);
            await say(ctx, T(ctx, 'selected', { label: rowLabel(table, row) }));
            return;
          }
          await say(ctx, T(ctx, 'byColumnNotFound', { text: parsed.column }), 'info');
          return;
        }
        const table = await tableWith(ctx, (t) => !!t.open && t.rows.length > 0);
        if (!table?.open) { await say(ctx, T(ctx, 'noRows'), 'info'); return; }
        const index = parsed.index !== null ? parsed.index - 1 : parseChoice(parsed.ordinal!, table.rows.length);
        const row = index !== null && index >= 0 ? table.rows[index] : undefined;
        if (!row) { await say(ctx, T(ctx, 'rowNotFound', { n: parsed.index ?? parsed.ordinal ?? '', count: table.rows.length }), 'info'); return; }
        table.open(row.id);
        await say(ctx, T(ctx, 'selected', { label: rowLabel(table, row) }));
      }
    }
  },
});
