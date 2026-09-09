'use client';

import * as React from 'react';

import {
  DRAG_AUTO_SCROLL_EDGE_PX,
  DRAG_AUTO_SCROLL_MAX_SPEED_PX,
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
  /** Contexto de columna del destino, para que la página resuelva la agenda. */
  buildContext?: (target: { groupValue?: string }) => CalendarSlotClickContext | undefined;
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
  buildContext,
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
  const optsRef = React.useRef({ resolve, canDrag, onCommit, onDragStart, buildContext, lockToSourceColumn, horizontalAutoScroll, enabled });
  React.useEffect(() => {
    optsRef.current = { resolve, canDrag, onCommit, onDragStart, buildContext, lockToSourceColumn, horizontalAutoScroll, enabled };
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

  // ── Limpieza ─────────────────────────────────────────────────────────────
  const cleanup = React.useCallback((didDrag: boolean) => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }

    const gesture = gestureRef.current;
    if (gesture) {
      try { gesture.element.releasePointerCapture(gesture.pointerId); } catch { /* ya liberado */ }
      delete gesture.element.dataset.dragging;
      gesture.element.style.touchAction = '';
    }
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.classList.remove('calendar-dragging');
      scroller.removeAttribute('data-drag-invalid');
    }
    document.body.style.userSelect = '';

    gestureRef.current = null;
    originRef.current = null;
    lastResolvedRef.current = null;
    publishPreview(null);

    dragStateRef.current = { phase: 'idle', didDrag };
    if (didDrag) {
      // Se libera en el tick siguiente: el `click` sintético ya se despachó, y los
      // handlers de clic que lo consultan corren antes que este timeout.
      if (didDragResetRef.current) clearTimeout(didDragResetRef.current);
      didDragResetRef.current = setTimeout(() => {
        dragStateRef.current.didDrag = false;
        didDragResetRef.current = null;
      }, 0);
    }
  }, [publishPreview, scrollRef]);

  // ── Confirmación del arrastre ────────────────────────────────────────────
  const beginDrag = React.useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture || dragStateRef.current.phase !== 'pending') return;
    dragStateRef.current = { phase: 'dragging', didDrag: true };

    try { gesture.element.setPointerCapture(gesture.pointerId); } catch { /* sin captura, seguimos */ }
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
      if (scroller) autoScrollStep(scroller, pointerRef.current);

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
  }, [autoScrollStep, publishPreview, scrollRef]);

  // ── Listeners globales del gesto ─────────────────────────────────────────
  React.useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      const origin = originRef.current;
      if (!gesture || !origin || e.pointerId !== gesture.pointerId) return;
      pointerRef.current = { x: e.clientX, y: e.clientY };

      if (dragStateRef.current.phase === 'dragging') {
        // Con touch-action:none el navegador ya no scrollea, pero en algunos
        // motores el pan solo se corta con un preventDefault explícito.
        if (e.cancelable) e.preventDefault();
        return;
      }
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

    // `pointermove` no pasivo: es el que puede cortar el pan táctil.
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
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
