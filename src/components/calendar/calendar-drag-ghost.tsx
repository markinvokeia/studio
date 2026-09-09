'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';

import { DRAG_GHOST_Z_INDEX } from './calendar-constants';
import type { CalendarDragStore } from './calendar-types';
import { offsetFromTime } from './calendar-utils';

interface CalendarDragGhostProps {
  /** Día de la columna que monta este fantasma (`yyyy-MM-dd`). */
  dayKey: string;
  /** Valor de la columna de agrupación, si la vista agrupa. */
  groupValue?: string;
  hourSlotHeight: number;
  store: CalendarDragStore;
}

/**
 * Banda que muestra dónde va a caer la cita que se está arrastrando.
 *
 * **Cada `.day-column-content` monta el suyo**, y todos devuelven `null` menos el
 * de la columna destino. Podría parecer más simple un único fantasma flotante que
 * siga al puntero, pero eso no funciona acá: `.day-block` tiene `overflow: hidden`,
 * así que un elemento que cruzara de columna se cortaría, y `.day-column-content`
 * declara `isolation: isolate` con la invariante escrita de que nada `position:
 * fixed` viva adentro. Con un fantasma por columna nada cruza un borde, la
 * invariante se cumple literal, y el coste es N hojas que salen en O(1) — en modo
 * custom con vista de día, exactamente una.
 */
export function CalendarDragGhost({ dayKey, groupValue, hourSlotHeight, store }: CalendarDragGhostProps) {
  const preview = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  if (!preview) return null;
  if (preview.dayKey !== dayKey) return null;
  if ((preview.groupValue ?? '') !== (groupValue ?? '')) return null;

  const top = offsetFromTime(preview.start, hourSlotHeight);
  const minutes = Math.max(0, (preview.end.getTime() - preview.start.getTime()) / 60000);
  const height = Math.max(2, (minutes / 60) * hourSlotHeight);

  return (
    <div
      data-testid="calendar-drag-ghost"
      data-invalid={preview.invalid ? 'true' : undefined}
      className={cn('calendar-drag-ghost', preview.invalid && 'calendar-drag-ghost--invalid')}
      style={{ top: `${top}px`, height: `${height}px`, zIndex: DRAG_GHOST_Z_INDEX }}
      aria-hidden
    >
      <span className="calendar-drag-ghost__time">
        {format(preview.start, 'HH:mm')} – {format(preview.end, 'HH:mm')}
      </span>
    </div>
  );
}

interface CalendarDragChipProps {
  store: CalendarDragStore;
  /** Texto a mostrar. Lo resuelve la vista, que es la que conoce el evento. */
  label?: string;
}

/**
 * Chip flotante que sigue al puntero mientras se arrastra en la vista de mes.
 *
 * A diferencia del fantasma de la rejilla, este SÍ va portalado a `body` con
 * `position: fixed`: en el mes no hay ningún contexto de apilamiento aislado que
 * respetar, y en cambio las celdas tienen `overflow-y: auto`, así que un elemento
 * dentro de la celda quedaría recortado apenas saliera de ella.
 *
 * La posición no pasa por el store: el snapshot solo cambia al cruzar de celda, y
 * el chip tiene que seguir al puntero de forma continua. Se mueve escribiendo el
 * `transform` directamente desde un listener propio, sin re-render.
 */
export function CalendarDragChip({ store, label }: CalendarDragChipProps) {
  const preview = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const nodeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!preview) return;
    const move = (e: PointerEvent) => {
      const node = nodeRef.current;
      if (node) node.style.transform = `translate3d(${e.clientX + 12}px, ${e.clientY + 12}px, 0)`;
    };
    document.addEventListener('pointermove', move);
    return () => document.removeEventListener('pointermove', move);
  }, [preview]);

  if (!preview || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={nodeRef}
      data-testid="calendar-drag-chip"
      data-invalid={preview.invalid ? 'true' : undefined}
      className={cn('calendar-drag-chip', preview.invalid && 'calendar-drag-chip--invalid')}
      style={{ transform: `translate3d(${preview.pointer.x + 12}px, ${preview.pointer.y + 12}px, 0)` }}
      aria-hidden
    >
      {format(preview.start, 'dd/MM')} · {format(preview.start, 'HH:mm')}
      {label ? ` · ${label}` : ''}
    </div>,
    document.body,
  );
}
