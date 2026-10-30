'use client';

import * as React from 'react';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';

import { DRAG_GHOST_Z_INDEX } from './calendar-constants';
import type { CalendarDraftPreview } from './calendar-types';
import { offsetFromTime } from './calendar-utils';

/**
 * Preview de la tarjeta inline. Viaja por contexto y no por props para no tener que
 * pasarlo por cada vista ni invalidar las cards memoizadas de la rejilla: solo lo
 * leen las bandas de preview de cada columna.
 */
const CalendarDraftPreviewContext = React.createContext<CalendarDraftPreview | null>(null);

export const CalendarDraftPreviewProvider = CalendarDraftPreviewContext.Provider;

interface CalendarDraftPreviewBandProps {
  /** Día de la columna que lo monta (`yyyy-MM-dd`). */
  dayKey: string;
  /** Valor de la columna de agrupación, si la vista agrupa. */
  groupValue?: string;
  hourSlotHeight: number;
}

/**
 * Banda translúcida con la cita que se está cargando en la tarjeta inline.
 *
 * Mismo esquema que `CalendarDragGhost`: cada `.day-column-content` monta la suya y
 * solo se dibuja la de la columna destino, así nada cruza el `overflow: hidden` de
 * `.day-block`. Va encima de las citas existentes (no se reparte el ancho con ellas)
 * para que se vea de un vistazo si entra en el hueco o si pisa otra cita. No captura
 * el puntero: un clic sobre ella llega a la columna y mueve el borrador ahí.
 */
export function CalendarDraftPreviewBand({ dayKey, groupValue, hourSlotHeight }: CalendarDraftPreviewBandProps) {
  const preview = React.useContext(CalendarDraftPreviewContext);

  if (!preview) return null;
  if (format(preview.start, 'yyyy-MM-dd') !== dayKey) return null;
  if ((preview.groupValue ?? '') !== (groupValue ?? '')) return null;

  const top = offsetFromTime(preview.start, hourSlotHeight);
  const minutes = Math.max(0, (preview.end.getTime() - preview.start.getTime()) / 60000);
  const height = Math.max(4, (minutes / 60) * hourSlotHeight);
  const isShort = height < 34;

  return (
    <div
      data-testid="calendar-draft-preview"
      data-draft-preview="true"
      data-conflict={preview.conflict ? 'true' : undefined}
      className={cn('calendar-draft-preview', preview.conflict && 'calendar-draft-preview--conflict', isShort && 'calendar-draft-preview--short')}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        zIndex: DRAG_GHOST_Z_INDEX,
        ...(preview.color && !preview.conflict ? { '--draft-preview-color': preview.color } : {}),
      } as React.CSSProperties}
      aria-hidden
    >
      <span className="calendar-draft-preview__time">
        {format(preview.start, 'HH:mm')} – {format(preview.end, 'HH:mm')}
        {isShort && preview.title ? <span className="calendar-draft-preview__title"> · {preview.title}</span> : null}
      </span>
      {!isShort && preview.title && <span className="calendar-draft-preview__title">{preview.title}</span>}
      {!isShort && preview.subtitle && <span className="calendar-draft-preview__subtitle">{preview.subtitle}</span>}
    </div>
  );
}
