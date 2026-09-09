'use client';

import * as React from 'react';
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
