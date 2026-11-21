import { normalizeSpeech } from '@/lib/voice/parse';

/**
 * Lo que se ve en la pantalla, para manejarlo con la voz en cualquier página aunque no tenga voz
 * propia: botones, pestañas, enlaces, campos, interruptores, listas desplegables y filas de una
 * tabla. Se lee la «superficie» de arriba: la ventana o panel lateral abierto si hay uno (lo
 * abierto tiene prioridad); si no, el contenido de la página (<main>). El riel derecho y el menú
 * tienen sus propios comandos.
 *
 * Solo usa lo básico del DOM (querySelectorAll('*'), atributos, texto, click) para que funcione
 * igual en el navegador y en las pruebas.
 */

export type UiKind = 'button' | 'tab' | 'link' | 'field' | 'search' | 'toggle' | 'select' | 'row';

export interface UiControl {
  kind: UiKind;
  /** Lo que se lee (texto, aria-label, etiqueta del campo). */
  label: string;
  /** Normalizado y sin palabras de relleno, para comparar con lo dicho. */
  key: string;
  /** Todas sus palabras (también «nuevo», «de»), para encontrarlo por una parte. */
  words?: string[];
  element: HTMLElement;
  /** Interruptores: prendido o no. */
  checked?: boolean;
  /** Campos y listas: lo que tienen ahora. */
  value?: string;
}

export interface UiSurface {
  root: HTMLElement;
  /** Título de la ventana abierta ('' en la página). */
  title: string;
  isOverlay: boolean;
  controls: UiControl[];
}

type El = HTMLElement & { labels?: ArrayLike<{ textContent: string | null }> | null; type?: string; value?: string; disabled?: boolean };

const attr = (el: Element, name: string) => el.getAttribute?.(name) ?? null;
const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Palabras que no distinguen un control («el», «botón», «the»…). */
const FILLER = new Set(['el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'the', 'an', 'of', 'boton', 'button', 'pestana', 'solapa', 'tab', 'opcion', 'option', 'campo', 'field', 'por', 'favor', 'please', 'mi', 'my', 'su', 'nuevo', 'nueva', 'new']);

/** «guardá» = «guardar», «servicios» = «servicio»: lo justo para comparar con lo dicho. */
export function stemUi(word: string): string {
  let w = word;
  for (const end of ['s', 'e', 'r']) if (w.length > 3 && w.endsWith(end)) w = w.slice(0, -1);
  return w;
}

/** Lo dicho o la etiqueta, en palabras comparables. «Nuevo» se ignora salvo que sea lo único. */
export function uiKey(textValue: string): string {
  const words = normalizeSpeech(textValue).split(' ').filter(Boolean);
  const kept = words.filter((w) => !FILLER.has(w));
  return (kept.length ? kept : words).map(stemUi).join(' ');
}

function isHidden(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttribute?.('hidden') || attr(node, 'aria-hidden') === 'true' || attr(node, 'data-voice-ignore') !== null) return true;
    if (attr(node, 'data-voice-card') !== null) return true;
  }
  const width = (el as HTMLElement).offsetWidth;
  // Sin diseño (pruebas) no hay medidas: se toma como visible.
  return typeof width === 'number' && width === 0 && typeof (el as HTMLElement).getClientRects === 'function' && (el as HTMLElement).getClientRects().length === 0;
}

const isDisabled = (el: El) => el.disabled === true || attr(el, 'aria-disabled') === 'true' || el.hasAttribute?.('disabled');

function ownLabel(el: El, all: Element[], usePlaceholder = true): string {
  const fromLabels = el.labels && el.labels.length ? text(el.labels[0] as unknown as Element) : '';
  if (fromLabels) return fromLabels;
  const aria = attr(el, 'aria-label');
  if (aria) return aria.trim();
  const labelledBy = attr(el, 'aria-labelledby');
  if (labelledBy) {
    const ref = all.find((n) => attr(n, 'id') === labelledBy);
    if (ref && text(ref)) return text(ref);
  }
  const id = attr(el, 'id');
  if (id) {
    const label = all.find((n) => n.tagName === 'LABEL' && attr(n, 'for') === id);
    if (label && text(label)) return text(label);
  }
  return ((usePlaceholder ? attr(el, 'placeholder') : null) ?? attr(el, 'title') ?? '').trim();
}

function buttonLabel(el: El): string {
  const own = text(el);
  // Botón tipo tarjeta (título + descripción): el nombre es el título.
  if (own.length > 40 && typeof (el as unknown as Element).querySelectorAll === 'function') {
    const parts = Array.from((el as unknown as Element).querySelectorAll('h1, h2, h3, h4, strong, b, [class*="font-semibold"], [class*="font-medium"], span, p'))
      .map((n) => text(n)).filter((x) => x.length >= 2 && x.length <= 40);
    if (parts.length) return parts[0];
  }
  if (own) return own;
  const aria = attr(el, 'aria-label') ?? attr(el, 'title');
  if (aria) return aria.trim();
  return '';
}

/**
 * El nombre de un control sin etiqueta asociada: en una grilla, la fila y la columna («Citas
 * email»); si no, el título que tiene al lado (el primer texto corto de su bloque: «Aplicar
 * descuentos», «Activo», «¿Está Activa?»).
 */
function nearbyLabel(el: El): string {
  const node = el as unknown as HTMLElement;
  if (typeof node.closest !== 'function') return '';
  const cell = node.closest('td');
  if (cell) {
    const row = cell.parentElement;
    const cells = row ? Array.from(row.children) : [];
    const index = cells.indexOf(cell);
    const rowLabel = cells.map((c) => text(c as Element)).find((x) => x.length >= 2) ?? '';
    const table = cell.closest('table');
    const header = table?.querySelectorAll('thead th')[index];
    const col = header ? text(header) : '';
    const label = [rowLabel, col].filter(Boolean).join(' ').trim();
    if (label) return label;
  }
  let up: HTMLElement | null = node.parentElement;
  // Primero las etiquetas, después los títulos, al final cualquier texto corto; las de una barra de
  // herramientas propia (dentro del mismo bloque que otro control) no cuentan.
  const ok = (n: HTMLElement) => n !== node && !n.contains(node) && !n.querySelector('button, input, textarea, select, [role="switch"], [role="checkbox"], [role="combobox"]')
    && !n.closest('[role="toolbar"], button, [role="button"], [role="combobox"]') && !(n.tagName === 'LABEL' && n.getAttribute('for') && document.getElementById(n.getAttribute('for')!) && document.getElementById(n.getAttribute('for')!) !== node);
  for (let depth = 0; up && depth < 6; depth++, up = up.parentElement) {
    for (const selector of ['label', 'h3, h4, h5', 'p, span, div']) {
      const found = Array.from(up.querySelectorAll<HTMLElement>(selector)).filter(ok).map((n) => text(n)).find((x) => x.length >= 2 && x.length <= 60);
      if (found) return found;
    }
  }
  return '';
}

const SEARCH_RE = /\b(?:buscar|busca|search|filtrar|filter|find)\b/;

function classify(el: El, all: Element[]): UiControl | null {
  const tag = el.tagName;
  const role = attr(el, 'role');
  if (attr(el, 'data-voice-row') !== null || (tag === 'TR' && el.parentElement?.tagName === 'TBODY')) {
    const label = text(el);
    return label ? { kind: 'row', label, key: uiKey(label), element: el } : null;
  }
  if (role === 'switch' || role === 'checkbox' || (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio'))) {
    const label = ownLabel(el, all) || buttonLabel(el) || nearbyLabel(el);
    const checked = attr(el, 'aria-checked') === 'true' || attr(el, 'data-state') === 'checked' || (el as unknown as { checked?: boolean }).checked === true;
    return label ? { kind: 'toggle', label, key: uiKey(label), element: el, checked } : null;
  }
  // Opción de un grupo (RadioGroup, tarjetas a elegir): se elige diciendo su nombre.
  if (role === 'radio') {
    const label = buttonLabel(el) || ownLabel(el, all) || nearbyLabel(el);
    if (!label) return null;
    return { kind: 'button', label, key: uiKey(label), element: el, checked: attr(el, 'aria-checked') === 'true' || attr(el, 'data-state') === 'checked' };
  }
  if (role === 'combobox' && tag !== 'INPUT') {
    // En una barra de herramientas (la del editor: fuente, tamaño) se nombra por lo que muestra.
    const node = el as unknown as HTMLElement;
    const inToolbar = typeof node.closest === 'function' && ((node.parentElement?.parentElement?.querySelectorAll('button').length ?? 0) > 4 || !!node.closest('[role="toolbar"]'));
    const label = ownLabel(el, all) || (inToolbar ? text(el) : nearbyLabel(el));
    return label ? { kind: 'select', label, key: uiKey(label), element: el, value: text(el) } : null;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (el.type === 'hidden' || el.type === 'file' || attr(el, 'readonly') !== null) return null;
    // El texto de ejemplo («dd/mm/aaaa», «ej., Ibuprofeno») solo si no hay un nombre al lado.
    const label = ownLabel(el, all, false) || nearbyLabel(el) || (attr(el, 'placeholder') ?? '').trim();
    if (!label) return null;
    const search = el.type === 'search' || SEARCH_RE.test(normalizeSpeech(`${attr(el, 'placeholder') ?? ''} ${label}`));
    return { kind: search ? 'search' : 'field', label: label.replace(/[*:]/g, '').trim(), key: uiKey(label.replace(/[*:]/g, '')), element: el, value: el.value ?? '' };
  }
  // Editor de texto enriquecido (indicaciones, recetas, plantillas): un campo más, se le dicta.
  if (attr(el, 'contenteditable') === 'true') {
    const label = ownLabel(el, all, false) || nearbyLabel(el) || attr(el, 'data-placeholder') || '';
    return label ? { kind: 'field', label: label.replace(/[*:]/g, '').trim(), key: uiKey(label.replace(/[*:]/g, '')), element: el, value: text(el) } : null;
  }
  if (role === 'tab') {
    const label = buttonLabel(el);
    return label ? { kind: 'tab', label, key: uiKey(label), element: el, checked: attr(el, 'aria-selected') === 'true' } : null;
  }
  if (tag === 'BUTTON' || role === 'button' || role === 'menuitem' || role === 'option' || (tag === 'A' && attr(el, 'href'))) {
    const label = buttonLabel(el);
    if (!label || label.length < 2) return null;
    return { kind: tag === 'A' ? 'link' : 'button', label, key: uiKey(label), element: el };
  }
  return null;
}

/** Ventanas, paneles laterales y popovers abiertos (sin los avisos de la voz). */
function openOverlayRoots(): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))
    .filter((el) => attr(el, 'data-voice-card') === null && !el.closest?.('[data-voice-card]'));
}

/** La superficie de arriba con todo lo que se puede tocar en ella. */
export function readSurface(): UiSurface | null {
  if (typeof document === 'undefined') return null;
  const overlays = openOverlayRoots();
  const root = overlays[overlays.length - 1] ?? document.querySelector<HTMLElement>('main') ?? (document.body as HTMLElement | null);
  if (!root || typeof root.querySelectorAll !== 'function') return null;
  const all = Array.from(root.querySelectorAll<HTMLElement>('*'));
  const controls: UiControl[] = [];
  for (const el of all) {
    if (isDisabled(el as El)) continue;
    const control = classify(el as El, all);
    if (!control || isHidden(el)) continue;
    // Un botón dentro de una fila es de la fila (se pide «el de Juan» y después qué hacer).
    controls.push(control);
  }
  const title = overlays.length ? text(root.querySelector?.('h2, [id$="-title"]') ?? null) : '';
  // Capas: con el panel de detalle abierto, lo suyo va primero (la pestaña activa antes que el resto
  // del detalle) y la lista después; así un botón o una pestaña con el mismo nombre es la del detalle.
  if (!overlays.length && typeof (root as HTMLElement).querySelector === 'function') {
    const rank = (el: HTMLElement) => {
      if (typeof el.closest !== 'function') return 2;
      const detail = el.closest('[data-voice-panel="detail"]');
      if (!detail) return 2;
      const tab = el.closest('[role="tabpanel"]');
      return tab && (tab.getAttribute('data-state') === 'active' || tab.getAttribute('data-state') === null) ? 0 : 1;
    };
    const ranked = controls.map((c, i) => ({ c, i, r: rank(c.element) }));
    if (ranked.some((x) => x.r < 2)) {
      ranked.sort((a, b) => a.r - b.r || a.i - b.i);
      return { root, title, isOverlay: false, controls: ranked.map((x) => x.c) };
    }
  }
  return { root, title, isOverlay: overlays.length > 0, controls };
}

const CREATE_LABEL_RE = /^(?:\+\s*)?(?:crear|nuev[oa]|agregar|anadir|dar de alta|alta|create|new|add)\b/;

/** Los botones de alta que se ven («Crear», «Nueva sede», «Agregar etapa», «+ Nuevo»), los de arriba primero. */
export function createButtons(surface: UiSurface | null = readSurface()): UiControl[] {
  if (!surface) return [];
  return surface.controls.filter((c) => c.kind === 'button' && CREATE_LABEL_RE.test(normalizeSpeech(c.label)));
}

const MONTH_INDEX: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Un calendario a la vista (react-day-picker): su grilla de días. */
export function visibleDayGrid(): HTMLElement | null {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;
  try {
    const grids = Array.from(document.querySelectorAll<HTMLElement>('[role="grid"]')).filter((g) => !isHidden(g) && g.querySelector('button[name="day"], [role="gridcell"]'));
    return grids[grids.length - 1] ?? null;
  } catch {
    return null;
  }
}

/** El mes que muestra el calendario (por el título de la grilla: «diciembre 2026»). */
function shownMonth(grid: HTMLElement): { year: number; month: number } | null {
  const id = grid.getAttribute('aria-labelledby');
  const caption = (id && document.getElementById(id)?.textContent) || grid.parentElement?.textContent || '';
  const n = normalizeSpeech(caption);
  const m = n.match(/([a-z]+)\s+(?:de\s+)?(\d{4})/);
  if (!m || MONTH_INDEX[m[1]] === undefined) return null;
  return { year: Number(m[2]), month: MONTH_INDEX[m[1]] };
}

/**
 * Elige un día en el calendario a la vista: va de mes en mes (los botones de mes anterior y
 * siguiente) hasta el pedido y toca ese día. false si no pudo.
 */
export async function pickCalendarDay(iso: string, signal?: AbortSignal): Promise<boolean> {
  const [y, mo, d] = iso.split('-').map(Number);
  for (let step = 0; step < 36 && !signal?.aborted; step++) {
    const grid = visibleDayGrid();
    if (!grid) return false;
    const shown = shownMonth(grid);
    if (!shown) return false;
    const diff = (y - shown.year) * 12 + (mo - 1 - shown.month);
    if (diff === 0) {
      const day = Array.from(grid.querySelectorAll<HTMLElement>('button[name="day"], [role="gridcell"]'))
        .find((b) => (b.textContent ?? '').trim() === String(d) && !/day-outside|day_outside|outside/.test(b.className) && !(b as HTMLButtonElement).disabled);
      if (!day) return false;
      day.click();
      return true;
    }
    const root = grid.closest('.rdp, [class*="rdp"]') ?? grid.parentElement?.parentElement ?? document;
    const nav = root.querySelector<HTMLElement>(diff > 0 ? 'button[name="next-month"]' : 'button[name="previous-month"]');
    if (!nav) return false;
    nav.click();
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

/** Los controles de esos tipos. */
export const controlsOf = (surface: UiSurface, ...kinds: UiKind[]) => surface.controls.filter((c) => kinds.includes(c.kind));

/**
 * El control que nombra lo dicho: primero el que coincide entero (sin artículos, singular/plural,
 * «guardá» = «Guardar»); después, si `loose`, el que empieza con lo dicho o lo contiene. Si dos
 * quedan igual, el primero (el que se ve antes).
 */
export function findControl(said: string, controls: UiControl[], loose = false): UiControl | null {
  const key = uiKey(said);
  if (!key) return null;
  const exact = controls.find((c) => c.key === key);
  if (exact || !loose) return exact ?? null;
  const said2 = normalizeSpeech(said).split(' ').filter(Boolean).map(stemUi);
  const words = key.split(' ');
  // «tocá nuevo» → «Nuevo paciente»: lo dicho es una parte (también con palabras de relleno).
  const partial = controls.filter((c) => {
    const all = normalizeSpeech(c.label).split(' ').map(stemUi);
    return said2.length > 0 && said2.every((w) => all.includes(w));
  });
  const scored = controls
    .map((c) => {
      const cw = c.key.split(' ');
      const hits = words.filter((w) => cw.includes(w)).length;
      return { c, hits, extra: cw.length - hits };
    })
    .filter((s) => s.hits === words.length || (s.hits > 0 && s.hits === s.c.key.split(' ').length))
    .sort((a, b) => b.hits - a.hits || a.extra - b.extra);
  return scored[0]?.c ?? (partial.length === 1 ? partial[0] : null);
}

/** Escribe en el campo como si se tipeara (React se entera del cambio). */
export function typeInto(element: HTMLElement, value: string) {
  // Editor enriquecido: se reemplaza el contenido como si se escribiera (el editor se entera).
  if (element.getAttribute?.('contenteditable') === 'true') {
    element.focus?.();
    try {
      const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
      if (selection && typeof document !== 'undefined' && typeof document.createRange === 'function') {
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      const ok = typeof document !== 'undefined' && typeof document.execCommand === 'function' && document.execCommand('insertText', false, value);
      if (!ok) element.textContent = value;
    } catch {
      element.textContent = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const el = element as HTMLInputElement;
  const Ctor = el.tagName === 'TEXTAREA'
    ? (typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement : null)
    : (typeof HTMLInputElement !== 'undefined' ? HTMLInputElement : null);
  const setter = Ctor ? Object.getOwnPropertyDescriptor(Ctor.prototype, 'value')?.set : undefined;
  if (setter && el instanceof (Ctor as typeof HTMLElement)) setter.call(el, value); else (el as { value: string }).value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * La pantalla está cargando: esqueletos (animate-pulse), indicadores girando o aria-busy en el
 * contenido. Lo que se pide apenas se abre una página se lee recién con los datos puestos.
 */
export function isScreenLoading(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const main = document.querySelector<HTMLElement>('main');
    if (!main || typeof main.querySelectorAll !== 'function') return false;
    return Array.from(main.querySelectorAll<HTMLElement>('.animate-pulse, .animate-spin, [aria-busy="true"]')).some((el) => !isHidden(el));
  } catch {
    return false;
  }
}

/** Espera (como mucho `maxMs`) a que la pantalla termine de cargar. */
export async function waitScreenReady(signal?: AbortSignal, maxMs = 4000): Promise<void> {
  const start = Date.now();
  while (isScreenLoading() && Date.now() - start < maxMs && !signal?.aborted) {
    await new Promise((r) => setTimeout(r, 80));
  }
}

/**
 * Después de buscar o filtrar: espera a que la lista se actualice (la búsqueda suele esperar a que
 * se termine de escribir y después carga) y a que termine de cargar.
 */
export async function waitListUpdate(signal?: AbortSignal, debounceMs = 450, maxMs = 5000): Promise<void> {
  const start = Date.now();
  // Hasta que empiece a cargar (o pase el tiempo de espera de la búsqueda).
  while (!isScreenLoading() && Date.now() - start < debounceMs && !signal?.aborted) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await waitScreenReady(signal, maxMs);
  await new Promise((r) => setTimeout(r, 60));
}

/** El mismo campo si React lo volvió a montar (por name o data-help-id). */
function sameField(element: HTMLElement): HTMLElement {
  if (element.isConnected !== false || typeof document === 'undefined') return element;
  const name = element.getAttribute?.('name');
  const helpId = element.getAttribute?.('data-help-id');
  const found = (helpId && document.querySelector<HTMLElement>(`[data-help-id="${CSS.escape(helpId)}"]`))
    || (name && document.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`));
  return found || element;
}

/**
 * Escribe y se asegura de que quede: un formulario recién abierto suele resetearse (o volver a
 * montar el campo) justo después de aparecer y borra lo escrito. Devuelve el campo final.
 */
export async function fillField(element: HTMLElement, value: string, signal?: AbortSignal): Promise<HTMLElement> {
  let el = element;
  typeInto(el, value);
  for (let i = 0; i < 6 && !signal?.aborted; i++) {
    await new Promise((r) => setTimeout(r, 120));
    el = sameField(el);
    const editable = el.getAttribute?.('contenteditable') === 'true';
    const now = editable ? (el.textContent ?? '').trim() : (el as HTMLInputElement).value;
    if (editable ? now.includes(value.trim()) : now === value) {
      if (i >= 1) return el; // Se mantuvo dos vueltas: ya no lo borra el reset.
      continue;
    }
    typeInto(el, value);
  }
  return el;
}

/** Las opciones visibles de una lista desplegable abierta (Radix las pone en un portal). */
export function openOptions(): UiControl[] {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
    .filter((el) => !isDisabled(el as El) && !isHidden(el))
    .map((el) => ({ kind: 'button' as const, label: text(el), key: uiKey(text(el)), element: el }))
    .filter((o) => o.label);
}

/**
 * La caja de búsqueda de una lista abierta (selector de paciente, sede, doctor, servicio…: cmdk o un
 * buscador dentro del popover). null si la lista no tiene buscador.
 */
export function openListSearchBox(): HTMLInputElement | null {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;
  try {
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('[cmdk-input], [data-radix-popper-content-wrapper] input[type="text"], [data-radix-popper-content-wrapper] input:not([type])'));
    return boxes.reverse().find((el) => !isHidden(el)) ?? null;
  } catch {
    return null;
  }
}

/** Espera a que aparezcan las opciones después de abrir la lista. */
export async function waitForOptions(signal?: AbortSignal, timeoutMs = 1200): Promise<UiControl[]> {
  const start = Date.now();
  for (;;) {
    const options = openOptions();
    if (options.length || signal?.aborted || Date.now() - start > timeoutMs) return options;
    await new Promise((r) => setTimeout(r, 40));
  }
}
