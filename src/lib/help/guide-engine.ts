/**
 * Primitivas DOM del motor de guías. No conocen React ni el store: el runner
 * (guide-runner.ts) las encadena y el spotlight las usa para ubicar el elemento.
 *
 * Un help id puede estar en dos lugares: `data-help-id` en el control (input,
 * botón, tab) y `data-help-item` en el contenedor del campo (FormItem). Se
 * resalta el contenedor (label incluido) y se escribe en el control.
 */

import { getHelpFieldSetter } from '@/lib/help/field-registry';
import { HELP_ID_ATTR, HELP_ITEM_ATTR, helpSelector } from '@/lib/help/help-id';

import type { HelpElementKind, HelpVisibleTarget } from '@/lib/types';

export interface HelpTarget {
  /** Lo que se resalta. */
  highlight: HTMLElement;
  /** Lo que se llena o se pulsa. */
  control: HTMLElement;
}

const POLL_MS = 150;

export function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[aria-hidden="true"], [hidden], [data-help-ignore]')) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0;
}

function lastVisible(nodes: NodeListOf<Element>): HTMLElement | null {
  // El último visible es el de más arriba en el apilado (un diálogo abierto
  // sobre el panel de detalle que tiene los mismos campos).
  let found: HTMLElement | null = null;
  nodes.forEach((n) => { if (isElementVisible(n)) found = n as HTMLElement; });
  return found;
}

export function findHelpTarget(id: string): HelpTarget | null {
  const item = lastVisible(document.querySelectorAll(`[${HELP_ITEM_ATTR}="${id}"]`));
  const control = lastVisible(document.querySelectorAll(helpSelector(id)))
    // El control puede no reenviar atributos (componentes compuestos): se busca dentro del item.
    ?? (item?.querySelector<HTMLElement>('[id$="-form-item"]') ?? null);
  if (!control && !item) return null;
  return { highlight: item ?? control!, control: control ?? item! };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}
export { sleep as helpSleep };

/** Espera a que el elemento exista y sea visible (abre diálogos, carga de datos, cambio de tab). */
export async function waitForHelpTarget(id: string, { timeoutMs = 8000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<HelpTarget | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const found = findHelpTarget(id);
    if (found) return found;
    if (Date.now() > deadline) return null;
    await sleep(POLL_MS, signal);
  }
}

export async function waitForPath(path: string, stripPath: () => string, { timeoutMs = 8000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (stripPath() === path) return true;
    await sleep(POLL_MS, signal);
  }
  return stripPath() === path;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // React ignora `el.value = x`: hay que pasar por el setter del prototipo y disparar `input`.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const normalizeText = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Select de Radix / combobox de cmdk: abre la lista y elige la opción cuyo texto
 * coincide con lo dictado ("Sede Centro"), porque el valor real es un id. Radix
 * abre y selecciona con `.click()` mientras no haya habido un pointerdown de mouse.
 */
async function pickOption(trigger: HTMLElement, value: string, signal?: AbortSignal): Promise<boolean> {
  trigger.click();
  const wanted = normalizeText(value);
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).filter(isElementVisible);
    if (options.length) {
      const scored = options
        .map((el) => ({ el, text: normalizeText(el.textContent ?? '') }))
        .map(({ el, text }) => ({ el, score: text === wanted ? 3 : text.startsWith(wanted) ? 2 : text.includes(wanted) ? 1 : 0 }))
        .filter((o) => o.score > 0)
        .sort((a, b) => b.score - a.score);
      if (scored[0]) {
        scored[0].el.click();
        return true;
      }
      // No hay coincidencia: se cierra la lista para no dejarla abierta encima del formulario.
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }
    await sleep(POLL_MS, signal);
  }
  return false;
}

/** Completa un campo. Devuelve false si no sabe cómo (la guía pide hacerlo a mano). */
export async function fillHelpTarget(target: HelpTarget, value: unknown, signal?: AbortSignal, helpId?: string): Promise<boolean> {
  const { control } = target;
  const combobox = control.getAttribute('role') === 'combobox' ? control : control.querySelector<HTMLElement>('[role="combobox"]');
  if (combobox && typeof value === 'string' && combobox.tagName !== 'INPUT') {
    if (await pickOption(combobox, value, signal)) return true;
  }
  const setter = getHelpFieldSetter(control.id)
    ?? getHelpFieldSetter(control.querySelector('[id$="-form-item"]')?.id)
    ?? getHelpFieldSetter(helpId);
  if (setter) {
    setter(value);
    return true;
  }
  const input = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
    ? control
    : control.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]), textarea');
  if (input) {
    if (input instanceof HTMLInputElement && (input.type === 'checkbox' || input.type === 'radio')) {
      if (input.checked !== Boolean(value)) input.click();
    } else {
      setNativeValue(input, String(value ?? ''));
    }
    return true;
  }
  if (control.getAttribute('role') === 'checkbox' || control.getAttribute('role') === 'switch') {
    if ((control.getAttribute('aria-checked') === 'true') !== Boolean(value)) control.click();
    return true;
  }
  return false;
}

/**
 * Resuelve cuando la persona pulsa el elemento. Escucha en `document` (fase de
 * captura) para sobrevivir a re-renders que reemplazan el nodo.
 */
export function waitForHumanClick(id: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const selector = `${helpSelector(id)}, [${HELP_ITEM_ATTR}="${id}"]`;
    const onClick = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(selector)) { cleanup(); resolve(); }
    };
    const cleanup = () => document.removeEventListener('click', onClick, true);
    document.addEventListener('click', onClick, true);
    signal?.addEventListener('abort', () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

/** `{{values.name}}` → valor dictado. Un placeholder sin valor devuelve undefined. */
export function resolveStepValue(value: unknown, values: Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;
  const whole = value.match(/^\{\{\s*values\.([\w.-]+)\s*\}\}$/);
  if (whole) return values[whole[1]];
  if (!value.includes('{{')) return value;
  let missing = false;
  const out = value.replace(/\{\{\s*values\.([\w.-]+)\s*\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v === undefined || v === null || v === '') missing = true;
    return v === undefined || v === null ? '' : String(v);
  });
  return missing ? undefined : out;
}

function labelFor(el: HTMLElement): string | undefined {
  const item = el.closest(`[${HELP_ITEM_ATTR}]`);
  const label = item?.querySelector('label')?.textContent
    ?? el.getAttribute('aria-label')
    ?? el.getAttribute('placeholder')
    ?? el.textContent;
  const clean = label?.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, 80) : undefined;
}

const KINDS: HelpElementKind[] = ['field', 'btn', 'tab', 'filter', 'nav', 'section'];

function kindOf(id: string): HelpElementKind {
  if (id.startsWith('nav.')) return 'nav';
  const parts = id.split('.');
  return (parts.find((p) => KINDS.includes(p as HelpElementKind)) as HelpElementKind | undefined) ?? 'section';
}

/**
 * Elementos con help id visibles ahora mismo. Van como contexto al agente para
 * que una guía ad hoc sólo use lo que existe en pantalla. Se omite el menú (ya
 * está en el catálogo) para no gastar tokens.
 */
export function collectVisibleTargets(limit = 80): HelpVisibleTarget[] {
  const seen = new Set<string>();
  const out: HelpVisibleTarget[] = [];
  document.querySelectorAll<HTMLElement>(`[${HELP_ID_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(HELP_ID_ATTR);
    if (!id || seen.has(id) || id.startsWith('nav.') || out.length >= limit || !isElementVisible(el)) return;
    seen.add(id);
    out.push({ id, kind: kindOf(id), label: labelFor(el) });
  });
  return out;
}
