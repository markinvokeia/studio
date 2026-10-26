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

const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';

function lastVisible(nodes: NodeListOf<Element>): HTMLElement | null {
  // El último visible es el de más arriba en el apilado (un diálogo abierto
  // sobre el panel de detalle que tiene los mismos campos). Si el mismo botón se
  // repite en varias filas (una acción por alerta o por cita), se prefiere uno
  // habilitado: señalar uno deshabilitado deja a la persona sin poder seguir.
  let found: HTMLElement | null = null;
  let enabled: HTMLElement | null = null;
  nodes.forEach((n) => {
    if (!isElementVisible(n)) return;
    found = n as HTMLElement;
    if (!isDisabled(n as HTMLElement)) enabled = n as HTMLElement;
  });
  return enabled ?? found;
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

/**
 * Pulsa como una persona: pointerdown → mousedown → pointerup → mouseup → click.
 * Los menús de Radix (DropdownMenu, ContextMenu) abren en pointerdown, no en click:
 * con un `.click()` solo, "Crear ▾" de la agenda no se abría y la guía se trababa.
 * Para el resto de los controles el resultado es el mismo que un clic.
 */
export function pressElement(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const mouse = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, buttons: 1 };
  const pointer = { ...mouse, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  el.dispatchEvent(new PointerEvent('pointerdown', pointer));
  el.dispatchEvent(new MouseEvent('mousedown', mouse));
  el.dispatchEvent(new PointerEvent('pointerup', { ...pointer, buttons: 0 }));
  el.dispatchEvent(new MouseEvent('mouseup', { ...mouse, buttons: 0 }));
  el.click();
}

const normalizeText = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Opciones a la vista sin tiempo de búsqueda: si no aparece la buscada, se escribe en el buscador. */
const OPTIONS_WAIT_MS = 1200;
/** Búsquedas en el servidor (pacientes): cuánto se espera el resultado después de escribir. */
const SEARCH_WAIT_MS = 8000;

/** El buscador de la lista abierta (cmdk o un input dentro del popover), si hay. */
function openListSearchInput(): HTMLInputElement | null {
  const candidates = document.querySelectorAll<HTMLInputElement>('[cmdk-input], [data-radix-popper-content-wrapper] input:not([type=hidden])');
  return Array.from(candidates).reverse().find(isElementVisible) ?? null;
}

/**
 * Cierra la lista sólo si sigue abierta. Un Escape de más le llega al diálogo o a la
 * tarjeta de la cita, que preguntan "¿Descartar cambios?".
 */
const closeOpenList = () => {
  const open = Array.from(document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper]')).reverse().find(isElementVisible);
  if (!open) return;
  const target = open.querySelector<HTMLElement>('[cmdk-input], input, [role="listbox"], [role="dialog"]') ?? open;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
};

/**
 * Select de Radix, combobox o popover con lista de cmdk: abre la lista y elige la
 * opción cuyo texto coincide con lo dictado ("Sede Centro"), porque el valor real es
 * un id. Si la opción no está a la vista y la lista tiene buscador (pacientes, que se
 * buscan en el servidor), escribe lo dictado y espera los resultados. En listas que
 * quedan abiertas tras elegir (servicios, varios a la vez) la cierra.
 * Radix abre y selecciona con `.click()` mientras no haya habido un pointerdown de mouse.
 */
async function pickOption(trigger: HTMLElement, value: string, signal?: AbortSignal): Promise<boolean> {
  trigger.click();
  const wanted = normalizeText(value);
  let typed = false;
  let deadline = Date.now() + OPTIONS_WAIT_MS;
  while (Date.now() < deadline) {
    const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).filter(isElementVisible);
    const scored = options
      .map((el) => ({ el, text: normalizeText(el.textContent ?? '') }))
      .map(({ el, text }) => ({ el, score: text === wanted ? 3 : text.startsWith(wanted) ? 2 : text.includes(wanted) ? 1 : 0 }))
      .filter((o) => o.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored[0]) {
      scored[0].el.click();
      await sleep(450, signal);
      // Lista de varios a la vez: sigue abierta, se cierra para mostrar el formulario.
      if (scored[0].el.isConnected && isElementVisible(scored[0].el)) closeOpenList();
      return true;
    }
    if (!typed) {
      const search = openListSearchInput();
      if (search) {
        typed = true;
        search.focus();
        setNativeValue(search, value);
        deadline = Date.now() + SEARCH_WAIT_MS;
      }
    }
    await sleep(POLL_MS, signal);
  }
  // No hay coincidencia: se cierra la lista para no dejarla abierta encima del formulario.
  closeOpenList();
  return false;
}

/** `2026-10-27` → `27/10/2026` para los campos de fecha con máscara dd/mm/aaaa. */
function toDisplayDate(input: HTMLInputElement, value: string): string {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso || input.type === 'date' || !/dd/i.test(input.placeholder)) return value;
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

/** Completa un campo. Devuelve false si no sabe cómo (la guía pide hacerlo a mano). */
export async function fillHelpTarget(target: HelpTarget, value: unknown, signal?: AbortSignal, helpId?: string): Promise<boolean> {
  const { control } = target;
  // Combobox, Select o botón que abre un popover con la lista (profesional, consultorio, servicios).
  // Si el campo tiene donde escribir (fecha dd/mm/aaaa con su botón de calendario), se escribe
  // ahí: el botón que abre un popover sólo se usa cuando no hay input.
  const isPicker = (el: Element) => el.getAttribute('role') === 'combobox' || (el.tagName === 'BUTTON' && el.hasAttribute('aria-haspopup'));
  const typeable = control.querySelector('input:not([type=hidden]):not([readonly]):not([type=checkbox]):not([type=radio]), textarea');
  const combobox = isPicker(control)
    ? control
    : control.querySelector<HTMLElement>('[role="combobox"]') ?? (typeable ? null : control.querySelector<HTMLElement>('button[aria-haspopup]'));
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
      setNativeValue(input, input instanceof HTMLInputElement ? toDisplayDate(input, String(value ?? '')) : String(value ?? ''));
      // Algunos campos confirman el valor al salir (fecha dd/mm/aaaa).
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('blur'));
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

/**
 * "Firma" de lo que el campo muestra elegido o escrito: valores de inputs,
 * checks y el texto del contenedor (el trigger de un select o combobox muestra
 * la opción elegida). Abrir un desplegable no la cambia; elegir una opción sí.
 */
export function readTargetValue(target: HelpTarget): string {
  const root = target.highlight;
  const parts: string[] = [];
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) parts.push(String(el.checked));
    else parts.push(el.value);
  });
  root.querySelectorAll('[aria-checked]').forEach((el) => parts.push(el.getAttribute('aria-checked') ?? ''));
  parts.push((root.textContent ?? '').replace(/\s+/g, ' ').trim());
  return parts.join('|');
}

/** La persona está escribiendo en este campo (se espera a que haga una pausa). */
export function isTypingIn(target: HelpTarget): boolean {
  const active = document.activeElement;
  return !!active && target.highlight.contains(active)
    && (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && !['checkbox', 'radio', 'button'].includes(active.type)));
}

/**
 * ¿El campo señalado está mal o falta y es obligatorio? (el borde pasa a rojo).
 * Mal: `aria-invalid` o el mensaje de error de FormMessage. Falta: obligatorio y
 * vacío (inputs de texto sin valor, o un Select de Radix con su placeholder).
 */
export function isMissingOrInvalid(target: HelpTarget, required: boolean): boolean {
  const root = target.highlight;
  if (root.getAttribute('aria-invalid') === 'true' || root.querySelector('[aria-invalid="true"], [id$="-form-item-message"]')) return true;
  if (!required) return false;
  if (root.querySelector('[data-placeholder]')) return true;
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea'));
  return inputs.length > 0 && inputs.every((el) => el.value.trim() === '');
}
