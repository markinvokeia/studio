/**
 * Desplazar la pantalla por voz («bajá», «subí un poco», «hasta abajo», «a la derecha»). Se mueve lo
 * que la persona está viendo: dentro de la ventana o panel lateral de arriba si hay uno abierto; si
 * no, el área desplazable más grande de la página (la grilla de la agenda, una lista, la página).
 */

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';
export type ScrollAmount = 'little' | 'normal' | 'more' | 'edge';

const FACTOR: Record<Exclude<ScrollAmount, 'edge'>, number> = { little: 0.25, normal: 0.6, more: 1 };

function isScrollable(el: Element, axis: 'x' | 'y'): boolean {
  const e = el as HTMLElement;
  const overflow = typeof getComputedStyle === 'function' ? getComputedStyle(e)[axis === 'y' ? 'overflowY' : 'overflowX'] : 'auto';
  const room = axis === 'y' ? e.scrollHeight - e.clientHeight : e.scrollWidth - e.clientWidth;
  return room > 8 && /auto|scroll|overlay/.test(overflow);
}

/** Dónde desplazar: lo más grande que se pueda mover dentro de lo de arriba. */
function scrollTarget(axis: 'x' | 'y'): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const overlays = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))
    .filter((el) => !el.closest?.('[data-voice-card]'));
  const root: ParentNode = overlays.length ? overlays[overlays.length - 1] : document;
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => !el.closest?.('[data-voice-card]') && isScrollable(el, axis));
  if (!candidates.length) {
    const page = document.scrollingElement as HTMLElement | null;
    return page && isScrollable(page, axis) ? page : (page ?? null);
  }
  return candidates.reduce((best, el) => (el.clientWidth * el.clientHeight > best.clientWidth * best.clientHeight ? el : best));
}

/** Desplaza; false si no había nada que mover en esa dirección. */
export function scrollScreen(direction: ScrollDirection, amount: ScrollAmount = 'normal'): boolean {
  const axis = direction === 'up' || direction === 'down' ? 'y' : 'x';
  const target = scrollTarget(axis);
  if (!target) return false;
  const sign = direction === 'up' || direction === 'left' ? -1 : 1;
  if (amount === 'edge') {
    const edge = sign < 0 ? 0 : axis === 'y' ? target.scrollHeight : target.scrollWidth;
    target.scrollTo({ [axis === 'y' ? 'top' : 'left']: edge, behavior: 'smooth' });
    return true;
  }
  const size = axis === 'y' ? target.clientHeight : target.clientWidth;
  const delta = Math.max(60, Math.round(size * FACTOR[amount])) * sign;
  target.scrollBy({ [axis === 'y' ? 'top' : 'left']: delta, behavior: 'smooth' });
  return true;
}
