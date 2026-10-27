/**
 * Geometría del spotlight: dónde va la mascota y dónde la barra de pasos para
 * que ninguno tape al elemento ni se tapen entre sí.
 * Todo en coordenadas de viewport (position: fixed): nada de esto altera el
 * layout de la página ni de los diálogos.
 */

export interface Rect { top: number; left: number; width: number; height: number }

export const VIEWPORT_MARGIN = 8;
/** Tamaño de la mascota en px (MascotHost la monta con este tamaño). */
export const MASCOT_SIZE = 88;

export function intersects(a: Rect, b: Rect, gap = 0): boolean {
  return a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
    && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;
}

export function fitsViewport(r: Rect): boolean {
  return r.left >= VIEWPORT_MARGIN && r.top >= VIEWPORT_MARGIN
    && r.left + r.width <= window.innerWidth - VIEWPORT_MARGIN
    && r.top + r.height <= window.innerHeight - VIEWPORT_MARGIN;
}

export function clampToViewport(r: Rect): Rect {
  return {
    ...r,
    left: Math.max(VIEWPORT_MARGIN, Math.min(window.innerWidth - r.width - VIEWPORT_MARGIN, r.left)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(window.innerHeight - r.height - VIEWPORT_MARGIN, r.top)),
  };
}

/**
 * Primer candidato que entra en pantalla y no pisa ningún obstáculo; si
 * ninguno cumple, el primero que entra en pantalla; si tampoco, el primero
 * recortado a la pantalla.
 */
export function pickPlacement<T extends { rect: Rect }>(candidates: T[], obstacles: Rect[]): T {
  const free = candidates.find((c) => fitsViewport(c.rect) && obstacles.every((o) => !intersects(c.rect, o, 4)));
  if (free) return free;
  const inside = candidates.find((c) => fitsViewport(c.rect));
  if (inside) return inside;
  return { ...candidates[0], rect: clampToViewport(candidates[0].rect) };
}

export function toRect(r: DOMRect): Rect {
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Muestra el elemento desplazando sólo los contenedores realmente
 * desplazables (overflow auto/scroll). `scrollIntoView` también corre los
 * contenedores con overflow hidden — el propio diálogo — y eso desarmaba
 * banner y footer de los popups.
 */
export function revealElement(el: HTMLElement) {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const scrollable = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    if (scrollable) {
      const container = node.getBoundingClientRect();
      const target = el.getBoundingClientRect();
      if (target.top < container.top + 8 || target.bottom > container.bottom - 8) {
        const delta = target.top - container.top - Math.max(8, (container.height - target.height) / 2);
        node.scrollTop += delta;
      }
    }
    // Tablas anchas: las acciones de la fila suelen quedar en la última columna, fuera de la vista.
    const scrollableX = /(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
    if (scrollableX) {
      const container = node.getBoundingClientRect();
      const target = el.getBoundingClientRect();
      if (target.left < container.left + 8 || target.right > container.right - 8) {
        const delta = target.left - container.left - Math.max(8, (container.width - target.width) / 2);
        node.scrollLeft += delta;
      }
    }
    node = node.parentElement;
  }
}

/** Rectángulo de un elemento del asistente por selector (barra de pasos). */
export function rectOf(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? toRect(r) : null;
}

/**
 * Dónde se para la mascota para señalar un elemento durante una guía (centro,
 * en px del viewport): arriba señalando hacia abajo si hay lugar; si no, a un
 * costado; si no, abajo. Hacia el extremo derecho del elemento (el texto de los
 * campos está a la izquierda) y sin pisar la barra de pasos.
 */
/**
 * Menú o lista que contiene al elemento (una opción de un menú contextual, de un
 * select): la mascota, la barra y la lista de pasos se ubican alrededor del menú
 * entero para no tapar las otras opciones.
 */
export function menuRectOf(el: Element): Rect | null {
  const menu = el.closest('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]');
  if (!menu) return null;
  const r = menu.getBoundingClientRect();
  return r.height > el.getBoundingClientRect().height + 4 ? toRect(r) : null;
}

/** Dónde se para la mascota para señalar una opción de un menú: al costado del menú, a la altura de la opción. */
export function placeGuideMascotBesideMenu(target: DOMRect | Rect, menu: Rect, size: number, obstacles: Rect[] = []): { x: number; y: number } {
  const midY = target.top + target.height / 2 - size / 2;
  const gap = 4;
  const { rect } = pickPlacement([
    { rect: { width: size, height: size, top: midY, left: menu.left + menu.width + gap } },
    { rect: { width: size, height: size, top: midY, left: menu.left - size - gap } },
    { rect: { width: size, height: size, top: menu.top - size - gap, left: menu.left + menu.width - size } },
  ], obstacles);
  return { x: rect.left + size / 2, y: rect.top + size / 2 };
}

export function placeGuideMascot(
  target: DOMRect | Rect,
  size: number,
  obstacles: Rect[] = [rectOf('[data-help-bubble]'), rectOf('[data-help-steps]')].filter((r): r is Rect => !!r),
): { x: number; y: number } {
  const box = { top: target.top, left: target.left, width: target.width, height: target.height };
  // La caja de la mascota tiene aire alrededor del cuerpo: se acerca un poco para que la mano llegue.
  const gap = -Math.round(size * 0.18);
  const anchorX = box.width > size * 2 ? box.left + box.width - size - 12 : box.left + box.width / 2 - size / 2;
  const midY = box.top + box.height / 2 - size / 2;
  // Lo señalado ocupa casi toda la pantalla (el contenido de una página): afuera no hay
  // lugar, así que la mascota se pone adentro, abajo a la derecha, y el globo se ve.
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 720 : window.innerHeight;
  const huge = box.width * box.height > vw * vh * 0.45;
  const inside = {
    width: size,
    height: size,
    top: Math.min(box.top + box.height, vh) - size - 24,
    left: Math.min(box.left + box.width, vw) - size - 24,
  };
  const candidates = [
    ...(huge ? [{ rect: inside }] : []),
    { rect: { width: size, height: size, top: box.top - size - gap, left: anchorX } },
    { rect: { width: size, height: size, top: midY, left: box.left + box.width + gap } },
    { rect: { width: size, height: size, top: midY, left: box.left - size - gap } },
    { rect: { width: size, height: size, top: box.top + box.height + gap, left: anchorX } },
  ];
  const { rect } = pickPlacement(candidates, obstacles);
  return { x: rect.left + size / 2, y: rect.top + size / 2 };
}
