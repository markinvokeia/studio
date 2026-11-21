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

function ownLabel(el: El, all: Element[]): string {
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
  return (attr(el, 'placeholder') ?? attr(el, 'title') ?? '').trim();
}

function buttonLabel(el: El): string {
  const own = text(el);
  if (own) return own;
  const aria = attr(el, 'aria-label') ?? attr(el, 'title');
  if (aria) return aria.trim();
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
    const label = ownLabel(el, all) || buttonLabel(el);
    const checked = attr(el, 'aria-checked') === 'true' || attr(el, 'data-state') === 'checked' || (el as unknown as { checked?: boolean }).checked === true;
    return label ? { kind: 'toggle', label, key: uiKey(label), element: el, checked } : null;
  }
  if (role === 'combobox' && tag !== 'INPUT') {
    const label = ownLabel(el, all);
    return label ? { kind: 'select', label, key: uiKey(label), element: el, value: text(el) } : null;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (el.type === 'hidden' || attr(el, 'readonly') !== null) return null;
    const label = ownLabel(el, all);
    if (!label) return null;
    const search = el.type === 'search' || SEARCH_RE.test(normalizeSpeech(`${attr(el, 'placeholder') ?? ''} ${label}`));
    return { kind: search ? 'search' : 'field', label: label.replace(/[*:]/g, '').trim(), key: uiKey(label.replace(/[*:]/g, '')), element: el, value: el.value ?? '' };
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
  return { root, title, isOverlay: overlays.length > 0, controls };
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
  const el = element as HTMLInputElement;
  const Ctor = el.tagName === 'TEXTAREA'
    ? (typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement : null)
    : (typeof HTMLInputElement !== 'undefined' ? HTMLInputElement : null);
  const setter = Ctor ? Object.getOwnPropertyDescriptor(Ctor.prototype, 'value')?.set : undefined;
  if (setter && el instanceof (Ctor as typeof HTMLElement)) setter.call(el, value); else (el as { value: string }).value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Las opciones visibles de una lista desplegable abierta (Radix las pone en un portal). */
export function openOptions(): UiControl[] {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
    .filter((el) => !isDisabled(el as El) && !isHidden(el))
    .map((el) => ({ kind: 'button' as const, label: text(el), key: uiKey(text(el)), element: el }))
    .filter((o) => o.label);
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
