'use client';

import * as React from 'react';

import {
  DRAG_AUTO_SCROLL_EDGE_PX,
  DRAG_AUTO_SCROLL_MAX_SPEED_PX,
  DRAG_EDGE_NAV_DELAY_MS,
  DRAG_EDGE_NAV_PX,
  DRAG_EDGE_NAV_REPEAT_MS,
  DRAG_LONG_PRESS_MS,
  DRAG_THRESHOLD_PX,
  DRAG_TOUCH_SLOP_PX,
} from '@/components/calendar/calendar-constants';
import type {
  CalendarDragGesture,
  CalendarDragMode,
  CalendarDragPhase,
  CalendarDragPreview,
  CalendarDragResolver,
  CalendarDragResult,
  CalendarDragStore,
  CalendarEvent,
  CalendarSlotClickContext,
} from '@/components/calendar/calendar-types';

/**
 * Motor de arrastre y redimensionado del calendario.
 *
 * Regla que ordena todo el diseño: **cero `setState` por frame**. Las cards de la
 * rejilla están memoizadas pero su memo no llega a dispararse (las props cambian de
 * identidad en cada render del padre), y cada una monta un ContextMenu de Radix
 * completo; con ~10 citas por columna y hasta 45 en el peor día, una semana son
 * decenas o cientos de subárboles. Un `setState` por `pointermove` sería inusable.
 *
 * En su lugar: el estado del gesto vive en refs, el feedback sobre los nodos ya
 * montados se hace con `classList`/`dataset`, y lo único que se suscribe a React es
 * el fantasma, mediante un store externo que notifica **solo cuando cambia el snap**
 * —unas pocas veces por segundo, no 60—. El único `setState` es el del drop, que lo
 * hace la página.
 */

export interface UseCalendarDragDropOptions {
  enabled: boolean;
  /** Contenedor con scroll sobre el que opera el auto-scroll de borde. */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Traduce la posición del puntero a un candidato. Específico de cada vista. */
  resolve: CalendarDragResolver;
  /** Veto por evento y modo. */
  canDrag?: (event: CalendarEvent, mode: CalendarDragMode) => boolean;
  /** Se llama una vez al soltar, con el resultado final (válido o bloqueado). */
  onCommit: (result: CalendarDragResult) => void;
  /** Se llama al confirmarse el arrastre, para cerrar popovers y demás. */
  onDragStart?: () => void;
  /** Se llama al terminar un arrastre que llegó a confirmarse. */
  onDragEnd?: () => void;
  /** Contexto de columna del destino, para que la página resuelva la agenda. */
  buildContext?: (target: { groupValue?: string }) => CalendarSlotClickContext | undefined;
  /** Cambiar de período sin soltar: se llama cuando el puntero se sostiene contra
   *  el borde izquierdo (-1) o derecho (+1) del contenedor y ya no queda scroll
   *  horizontal que consumir. Sin esto, mover una cita a otra semana obliga a
   *  soltarla, navegar y volver a arrastrarla. */
  onEdgeNavigate?: (direction: -1 | 1) => void;
  threshold?: number;
  /** `null` deshabilita el arrastre táctil (solo mouse). */
  longPressMs?: number | null;
  /** El destino no puede salirse de la columna donde empezó el gesto. */
  lockToSourceColumn?: boolean;
  horizontalAutoScroll?: boolean;
  /** Selector de la card arrastrable. La rejilla usa `.event-in-day-view`; el mes,
   *  `.event`. Es desde donde se mide el offset de agarre. */
  cardSelector?: string;
  /** Selector del contenedor que representa un destino (columna del día en la
   *  rejilla, celda del día en el mes). Tiene que llevar `data-day`. */
  containerSelector?: string;
}

export interface CalendarDragState {
  phase: CalendarDragPhase;
  /** True desde que se cruza el umbral hasta el tick siguiente al pointerup. Lo
   *  consultan los handlers de clic para no actuar sobre el final de un arrastre. */
  didDrag: boolean;
}

export interface UseCalendarDragDropResult {
  /** Una única función estable para todas las cards: pasarle un binding distinto a
   *  cada una recrearía la prop en cada render y anularía su `React.memo`. */
  onDragPointerDown: (
    event: CalendarEvent,
    mode: CalendarDragMode,
    e: React.PointerEvent<HTMLElement>,
  ) => void;
  dragStateRef: React.MutableRefObject<CalendarDragState>;
  store: CalendarDragStore;
  isDraggable: (event: CalendarEvent) => boolean;
}

const samePreview = (a: CalendarDragPreview | null, b: CalendarDragPreview | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.eventId === b.eventId &&
    a.mode === b.mode &&
    a.dayKey === b.dayKey &&
    (a.groupValue ?? '') === (b.groupValue ?? '') &&
    a.start.getTime() === b.start.getTime() &&
    a.end.getTime() === b.end.getTime() &&
    a.invalid === b.invalid
  );
};

export function useCalendarDragDrop({
  enabled,
  scrollRef,
  resolve,
  canDrag,
  onCommit,
  onDragStart,
  onDragEnd,
  buildContext,
  onEdgeNavigate,
  threshold = DRAG_THRESHOLD_PX,
  longPressMs = DRAG_LONG_PRESS_MS,
  lockToSourceColumn = false,
  horizontalAutoScroll = false,
  cardSelector = '.event-in-day-view',
  containerSelector = '.day-column-content',
}: UseCalendarDragDropOptions): UseCalendarDragDropResult {
  const dragStateRef = React.useRef<CalendarDragState>({ phase: 'idle', didDrag: false });
  const gestureRef = React.useRef<CalendarDragGesture | null>(null);
  const originRef = React.useRef<{ x: number; y: number } | null>(null);
  const pointerRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = React.useRef<number | null>(null);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDragResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Quién tiene la captura del puntero. Empieza en la card y se muda al contenedor
   *  en cuanto el gesto cambia de período, porque ahí la card se desmonta. */
  const captureTargetRef = React.useRef<HTMLElement | null>(null);
  /** Permanencia contra un borde: hacia qué lado, desde cuándo y cuándo saltó por
   *  última vez. `dir: 0` es "el puntero no está en ninguna banda". */
  const edgeNavRef = React.useRef<{ dir: -1 | 0 | 1; enteredAt: number; firedAt: number }>({ dir: 0, enteredAt: 0, firedAt: 0 });
  /** `scrollLeft` del frame anterior: si no se movió, el auto-scroll ya no tiene
   *  hacia dónde seguir y el borde pasa a significar "cambiar de período". */
  const edgeScrollRef = React.useRef(0);
  /** Última resolución válida, que es la que se commitea al soltar. */
  const lastResolvedRef = React.useRef<{
    target: { dayKey: string; groupValue?: string };
    start: Date;
    end: Date;
    invalid: boolean;
  } | null>(null);

  // Las opciones se leen por ref dentro de los listeners nativos y del loop del
  // gesto, para que el arrastre no dependa de la identidad de los callbacks y los
  // handlers no se reinstalen a mitad del movimiento. Se sincroniza en un efecto y
  // no en el cuerpo del render: escribir un ref durante el render es justamente lo
  // que la regla `react-hooks/refs` señala. Todos sus lectores (event handlers y
  // rAF) corren después de que los efectos se aplicaron.
  const optsRef = React.useRef({ resolve, canDrag, onCommit, onDragStart, onDragEnd, buildContext, onEdgeNavigate, lockToSourceColumn, horizontalAutoScroll, enabled });
  React.useEffect(() => {
    optsRef.current = { resolve, canDrag, onCommit, onDragStart, onDragEnd, buildContext, onEdgeNavigate, lockToSourceColumn, horizontalAutoScroll, enabled };
  });

  // ── Store del preview ────────────────────────────────────────────────────
  const previewRef = React.useRef<CalendarDragPreview | null>(null);
  const listenersRef = React.useRef(new Set<() => void>());

  const store = React.useMemo<CalendarDragStore>(() => ({
    subscribe: (fn: () => void) => {
      listenersRef.current.add(fn);
      return () => { listenersRef.current.delete(fn); };
    },
    // Devuelve la misma referencia mientras el snap no cambie: crear un objeto
    // nuevo por llamada haría que useSyncExternalStore entre en loop.
    getSnapshot: () => previewRef.current,
    getServerSnapshot: () => null,
  }), []);

  const publishPreview = React.useCallback((next: CalendarDragPreview | null) => {
    if (samePreview(previewRef.current, next)) return;
    previewRef.current = next;
    listenersRef.current.forEach((fn) => fn());
  }, []);

  // ── Supresión del clic sintético posterior al arrastre ───────────────────
  // Si el pointerdown empieza en la card y el pointerup cae fuera, el `click` se
  // dispara en el ancestro común: `.day-column-content`, cuyo onClick abre la
  // creación inline. Sin esto, cada arrastre terminaría abriendo el overlay de
  // "nueva cita". Los listeners van en CAPTURA sobre `document`, que está por
  // encima del contenedor donde React 18 delega, así que cortan a la vez el clic
  // de la card y el de la columna sin tocar ninguno de los dos handlers.
  const swallowNextClick = React.useCallback(() => {
    const swallow = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const remove = () => {
      document.removeEventListener('click', swallow, true);
      document.removeEventListener('dblclick', swallow, true);
      document.removeEventListener('contextmenu', swallow, true);
    };
    document.addEventListener('click', swallow, true);
    document.addEventListener('dblclick', swallow, true);
    document.addEventListener('contextmenu', swallow, true);
    // El click sintético se despacha antes que este timeout, así que para cuando
    // corre ya cumplió su función.
    setTimeout(remove, 0);
  }, []);

  // ── Auto-scroll de borde ─────────────────────────────────────────────────
  const autoScrollStep = React.useCallback((el: HTMLElement, p: { x: number; y: number }) => {
    const r = el.getBoundingClientRect();
    const speedFor = (distance: number) =>
      DRAG_AUTO_SCROLL_MAX_SPEED_PX * (1 - Math.max(0, distance) / DRAG_AUTO_SCROLL_EDGE_PX);

    const fromTop = p.y - r.top;
    const fromBottom = r.bottom - p.y;
    if (fromTop < DRAG_AUTO_SCROLL_EDGE_PX) el.scrollTop -= speedFor(fromTop);
    else if (fromBottom < DRAG_AUTO_SCROLL_EDGE_PX) el.scrollTop += speedFor(fromBottom);

    if (optsRef.current.horizontalAutoScroll) {
      const fromLeft = p.x - r.left;
      const fromRight = r.right - p.x;
      if (fromLeft < DRAG_AUTO_SCROLL_EDGE_PX) el.scrollLeft -= speedFor(fromLeft);
      else if (fromRight < DRAG_AUTO_SCROLL_EDGE_PX) el.scrollLeft += speedFor(fromRight);
    }
  }, []);

  // ── Pista visual del borde ───────────────────────────────────────────────
  /**
   * El resplandor que avisa "sostené acá y cambio de período" vive en `body`, no en
   * el contenedor del calendario.
   *
   * Sobre el contenedor no se puede: un `box-shadow: inset` lo tapan los fondos
   * opacos de las columnas (`.day-block`), y cualquier hijo absoluto se iría con el
   * scroll. Desde `body` es un `position: fixed` que se pinta sobre todo; la
   * geometría del contenedor viaja en variables CSS, que se escriben solo al armar
   * el borde —dos o tres veces por arrastre—, no por frame.
   */
  const showEdgeHint = React.useCallback((dir: -1 | 1, r: DOMRect) => {
    const { style } = document.body;
    style.setProperty('--calendar-edge-nav-top', `${r.top}px`);
    style.setProperty('--calendar-edge-nav-height', `${r.height}px`);
    style.setProperty('--calendar-edge-nav-x', `${dir === -1 ? r.left : r.right}px`);
    document.body.dataset.calendarDragEdge = dir === -1 ? 'left' : 'right';
  }, []);

  const hideEdgeHint = React.useCallback(() => {
    delete document.body.dataset.calendarDragEdge;
    const { style } = document.body;
    style.removeProperty('--calendar-edge-nav-top');
    style.removeProperty('--calendar-edge-nav-height');
    style.removeProperty('--calendar-edge-nav-x');
  }, []);

  // ── Cambio de período por borde ──────────────────────────────────────────
  /**
   * Sostener el arrastre contra el borde izquierdo o derecho pasa al período
   * anterior/siguiente sin soltar la cita.
   *
   * El borde solo navega una vez agotado el scroll horizontal de la vista: en una
   * semana más ancha que la pantalla, empujar a la derecha primero termina de
   * mostrarla —eso lo hace `autoScrollStep`— y recién cuando no queda nada que
   * correr el mismo gesto pasa a la semana siguiente. Así el borde nunca le roba
   * el destino a una columna que todavía no se había llegado a ver.
   */
  const edgeNavigationStep = React.useCallback((
    el: HTMLElement,
    p: { x: number; y: number },
    gesture: CalendarDragGesture,
  ) => {
    const navigate = optsRef.current.onEdgeNavigate;
    // Un resize mueve un borde dentro de su propio día; cambiarle el período
    // debajo dejaría el gesto sin la columna a la que se aplica.
    if (!navigate || gesture.mode !== 'move') return;

    const r = el.getBoundingClientRect();
    // Se admite que el puntero se pase de largo del contenedor (arrastrando se
    // sobrepasa siempre), pero no que se vaya por arriba o por abajo: ahí ya está
    // en la cabecera o fuera del calendario y no está pidiendo cambiar de semana.
    const withinBand =
      p.y >= r.top && p.y <= r.bottom &&
      p.x > r.left - DRAG_EDGE_NAV_PX * 2 && p.x < r.right + DRAG_EDGE_NAV_PX * 2;

    // "Ya no queda scroll" se mide por el hecho, no por la cuenta: `scrollWidth -
    // clientWidth` sobra hasta el ancho de la barra vertical (medido: 951 contra un
    // tope real de 936), así que comparar contra ese número dejaba el borde armado
    // para siempre en "todavía queda semana". Como esta banda (28 px) está dentro de
    // la del auto-scroll (48 px), si el contenedor no se corrió en el frame anterior
    // es porque no tiene hacia dónde.
    const scrollLeft = el.scrollLeft;
    const stalled = Math.abs(scrollLeft - edgeScrollRef.current) < 0.5;
    edgeScrollRef.current = scrollLeft;

    let dir: -1 | 0 | 1 = 0;
    if (withinBand && stalled) {
      if (p.x < r.left + DRAG_EDGE_NAV_PX) dir = -1;
      else if (p.x > r.right - DRAG_EDGE_NAV_PX) dir = 1;
    }

    const state = edgeNavRef.current;
    if (dir === 0) {
      if (state.dir !== 0) {
        edgeNavRef.current = { dir: 0, enteredAt: 0, firedAt: 0 };
        hideEdgeHint();
      }
      return;
    }

    const now = performance.now();
    if (dir !== state.dir) {
      // Recién entra en la banda: arranca la espera y se prende la pista visual.
      edgeNavRef.current = { dir, enteredAt: now, firedAt: 0 };
      showEdgeHint(dir, r);
      return;
    }

    const since = state.firedAt || state.enteredAt;
    const wait = state.firedAt ? DRAG_EDGE_NAV_REPEAT_MS : DRAG_EDGE_NAV_DELAY_MS;
    if (now - since < wait) return;
    state.firedAt = now;

    // Al cambiar el período, el día de origen sale de la vista y React desmonta la
    // card: con la captura del puntero en un nodo desmontado el gesto se corta a la
    // mitad. Se muda al `body`, que es el único nodo que sobrevive con seguridad a
    // cualquier vista — en el mes, un refetch llega a remontar la grilla entera.
    const persistentCapture = document.body;
    if (captureTargetRef.current !== persistentCapture) {
      try { captureTargetRef.current?.releasePointerCapture(gesture.pointerId); } catch { /* ya liberado */ }
      try { persistentCapture.setPointerCapture(gesture.pointerId); captureTargetRef.current = persistentCapture; } catch { /* sin captura, seguimos */ }
    }
    // El destino que había quedado apuntaba a un día que ya no está en pantalla.
    // Se descarta: si el usuario suelta justo acá —fuera de toda columna, que es de
    // donde no se resuelve nada— el arrastre no hace nada, en vez de mandar la cita
    // a un día del período que se acaba de dejar atrás. En cuanto el puntero vuelva
    // a caer sobre una columna, el propio loop lo repuebla en el frame siguiente.
    lastResolvedRef.current = null;
    publishPreview(null);
    navigate(dir);
    // Se entra al período nuevo por el lado contrario al que se salió: cruzando
    // por la derecha se aterriza en sus primeros días, no otra vez en los últimos.
    // En vistas más anchas que la pantalla el auto-scroll horizontal retoma desde
    // ahí, así que sostener el puntero contra el borde recorre la línea de tiempo
    // de corrido —pasa el resto de la semana y recién después salta a la siguiente—
    // en lugar de saltar de período en período cada 900 ms.
    el.scrollLeft = dir === 1 ? 0 : Math.max(0, el.scrollWidth - el.clientWidth);
  }, [hideEdgeHint, publishPreview, showEdgeHint]);

  // ── Limpieza ─────────────────────────────────────────────────────────────
  const cleanup = React.useCallback((didDrag: boolean) => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }

    const gesture = gestureRef.current;
    if (gesture) {
      // La captura pudo haberse mudado al contenedor al cambiar de período, así que
      // se libera desde donde esté y no desde la card (que para entonces puede estar
      // desmontada). Lo demás sobre un nodo suelto es inofensivo.
      try { (captureTargetRef.current ?? gesture.element).releasePointerCapture(gesture.pointerId); } catch { /* ya liberado */ }
      delete gesture.element.dataset.dragging;
      gesture.element.style.touchAction = '';
    }
    captureTargetRef.current = null;
    edgeNavRef.current = { dir: 0, enteredAt: 0, firedAt: 0 };
    edgeScrollRef.current = 0;
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.classList.remove('calendar-dragging');
      scroller.removeAttribute('data-drag-invalid');
    }
    hideEdgeHint();
    document.body.style.userSelect = '';

    gestureRef.current = null;
    originRef.current = null;
    lastResolvedRef.current = null;
    publishPreview(null);

    dragStateRef.current = { phase: 'idle', didDrag };
    if (didDrag) optsRef.current.onDragEnd?.();
    if (didDrag) {
      // Se libera en el tick siguiente: el `click` sintético ya se despachó, y los
      // handlers de clic que lo consultan corren antes que este timeout.
      if (didDragResetRef.current) clearTimeout(didDragResetRef.current);
      didDragResetRef.current = setTimeout(() => {
        dragStateRef.current.didDrag = false;
        didDragResetRef.current = null;
      }, 0);
    }
  }, [hideEdgeHint, publishPreview, scrollRef]);

  // ── Confirmación del arrastre ────────────────────────────────────────────
  const beginDrag = React.useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture || dragStateRef.current.phase !== 'pending') return;
    dragStateRef.current = { phase: 'dragging', didDrag: true };

    try { gesture.element.setPointerCapture(gesture.pointerId); captureTargetRef.current = gesture.element; } catch { /* sin captura, seguimos */ }
    gesture.element.dataset.dragging = 'true';
    // Recién acá: puesto en el pointerdown mataría el scroll táctil que empieza
    // sobre una card, que en un día ocupado es casi toda la columna.
    gesture.element.style.touchAction = 'none';
    scrollRef.current?.classList.add('calendar-dragging');
    document.body.style.userSelect = 'none';
    if (gesture.pointerType !== 'mouse') navigator.vibrate?.(10);
    optsRef.current.onDragStart?.();

    const tick = () => {
      if (dragStateRef.current.phase !== 'dragging') return;
      const scroller = scrollRef.current;
      if (scroller) {
        autoScrollStep(scroller, pointerRef.current);
        edgeNavigationStep(scroller, pointerRef.current, gesture);
      }

      // Se re-resuelve en cada frame y no solo en pointermove: con el puntero
      // quieto en el borde, el auto-scroll mueve el contenido debajo y el slot
      // destino cambia igual.
      const resolved = optsRef.current.resolve(gesture, pointerRef.current);
      if (resolved) {
        const sameColumn =
          resolved.target.dayKey === gesture.sourceTarget.dayKey &&
          (resolved.target.groupValue ?? '') === (gesture.sourceTarget.groupValue ?? '');
        if (!optsRef.current.lockToSourceColumn || sameColumn) {
          lastResolvedRef.current = {
            target: { dayKey: resolved.target.dayKey, groupValue: resolved.target.groupValue },
            start: resolved.candidate.start,
            end: resolved.candidate.end,
            invalid: resolved.candidate.invalid,
          };
          publishPreview({
            eventId: gesture.event.id,
            mode: gesture.mode,
            dayKey: resolved.target.dayKey,
            groupValue: resolved.target.groupValue,
            start: resolved.candidate.start,
            end: resolved.candidate.end,
            invalid: resolved.candidate.invalid,
            pointer: pointerRef.current,
          });
          if (scroller) {
            if (resolved.candidate.invalid) scroller.setAttribute('data-drag-invalid', 'true');
            else scroller.removeAttribute('data-drag-invalid');
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [autoScrollStep, edgeNavigationStep, publishPreview, scrollRef]);

  // ── Listeners globales del gesto ─────────────────────────────────────────
  React.useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      const origin = originRef.current;
      if (!gesture || !origin || e.pointerId !== gesture.pointerId) return;
      pointerRef.current = { x: e.clientX, y: e.clientY };

      if (dragStateRef.current.phase === 'dragging') return;
      if (dragStateRef.current.phase !== 'pending') return;

      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      const distance = Math.hypot(dx, dy);

      if (gesture.pointerType === 'mouse') {
        if (distance > threshold) beginDrag();
        return;
      }
      // Táctil: si el dedo se mueve antes de que venza el hold, gana el scroll.
      if (longPressTimerRef.current) {
        if (distance > DRAG_TOUCH_SLOP_PX) cleanup(false);
        return;
      }
      // Hold vencido: hace falta movimiento para confirmar. Quedarse quieto deja
      // que gane el long-press de 700 ms del menú contextual de Radix.
      if (distance > DRAG_TOUCH_SLOP_PX) beginDrag();
    };

    const onPointerUp = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      const wasDragging = dragStateRef.current.phase === 'dragging';
      const resolved = lastResolvedRef.current;
      const buildCtx = optsRef.current.buildContext;
      const commit = optsRef.current.onCommit;

      if (wasDragging) swallowNextClick();
      cleanup(wasDragging);

      if (!wasDragging || !resolved) return;
      const unchanged =
        resolved.start.getTime() === gesture.originalStart.getTime() &&
        resolved.end.getTime() === gesture.originalEnd.getTime();
      if (unchanged) return;

      commit({
        data: gesture.event.data,
        eventId: gesture.event.id,
        mode: gesture.mode,
        start: resolved.start,
        end: resolved.end,
        originalStart: gesture.originalStart,
        originalEnd: gesture.originalEnd,
        context: buildCtx?.({ groupValue: resolved.target.groupValue }),
        blocked: resolved.invalid,
      });
    };

    const onPointerCancel = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      cleanup(dragStateRef.current.phase === 'dragging');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !gestureRef.current) return;
      e.stopPropagation();
      cleanup(dragStateRef.current.phase === 'dragging');
    };

    // El scroll táctil NO se corta con preventDefault sobre `pointermove` (la
    // especificación no lo hace cancelable para eso) ni cambiando `touch-action` a
    // mitad del gesto (Chrome lo fija al empezar). El único punto que funciona es
    // un `touchmove` no pasivo. Como el arrastre táctil exige primero mantener
    // apretado 300 ms casi sin moverse, para cuando esto entra en juego el
    // navegador todavía no empezó a scrollear.
    const onTouchMove = (e: TouchEvent) => {
      if (dragStateRef.current.phase !== 'dragging') return;
      if (e.cancelable) e.preventDefault();
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [beginDrag, cleanup, swallowNextClick, threshold]);

  // Limpieza al desmontar: un arrastre en curso no puede dejar el body sin
  // selección ni timers vivos.
  React.useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (didDragResetRef.current) clearTimeout(didDragResetRef.current);
    document.body.style.userSelect = '';
  }, []);

  // A diferencia del resto, esta se llama DURANTE el render (la vista la usa para
  // decidir si la card lleva tiradores), así que lee del closure y no del ref: con
  // el ref devolvería el valor del render anterior.
  const isDraggable = React.useCallback((event: CalendarEvent): boolean => {
    if (!enabled || event.locked) return false;
    return canDrag?.(event, 'move') ?? true;
  }, [enabled, canDrag]);

  const onDragPointerDown = React.useCallback((
    event: CalendarEvent,
    mode: CalendarDragMode,
    e: React.PointerEvent<HTMLElement>,
  ) => {
    if (!optsRef.current.enabled || event.locked) return;
    if (e.button !== 0) return;
    // `longPressMs: null` significa "solo mouse". Sin este corte no se armaría el
    // timer y cualquier movimiento del dedo arrancaría un arrastre inmediato, que
    // es justo lo contrario de lo que pide la opción.
    if (e.pointerType !== 'mouse' && longPressMs === null) return;
    if (optsRef.current.canDrag && !optsRef.current.canDrag(event, mode)) return;
    if (gestureRef.current) return;

    const element = e.currentTarget.closest<HTMLElement>(cardSelector) ?? e.currentTarget;
    const rect = element.getBoundingClientRect();
    const sourceTarget = element.closest<HTMLElement>(containerSelector);
    if (!sourceTarget?.dataset.day) return;

    const start = typeof event.start === 'string' ? new Date(event.start) : event.start;
    const end = typeof event.end === 'string' ? new Date(event.end) : event.end;

    gestureRef.current = {
      event,
      mode,
      originalStart: start,
      originalEnd: end,
      grabOffsetY: e.clientY - rect.top,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      element,
      sourceTarget: {
        dayKey: sourceTarget.dataset.day,
        day: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
        groupValue: sourceTarget.dataset.groupCol || undefined,
        element: sourceTarget,
        rect: sourceTarget.getBoundingClientRect(),
      },
    };
    originRef.current = { x: e.clientX, y: e.clientY };
    pointerRef.current = { x: e.clientX, y: e.clientY };
    dragStateRef.current = { phase: 'pending', didDrag: false };

    if (e.pointerType !== 'mouse' && longPressMs !== null) {
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
      }, longPressMs);
    }
  }, [longPressMs, cardSelector, containerSelector]);

  return { onDragPointerDown, dragStateRef, store, isDraggable };
}
