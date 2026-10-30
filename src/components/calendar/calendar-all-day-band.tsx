'use client';

import * as React from 'react';
import { isSameDay } from 'date-fns';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { filterEventsByDayAndGroup } from './calendar-utils';
import type { CalendarEvent, CalendarGroupBy, CalendarGroupingColumn } from './calendar-types';

interface CalendarAllDayBandProps {
  /** Los días que muestra la vista, en el mismo orden que las columnas de la rejilla. */
  days: Date[];
  /** Solo los ítems de todo el día. La página ya los separó del array de la rejilla. */
  events: CalendarEvent[];
  /** Mismo `grid-template-columns` que la fila de fechas, para que las celdas
   *  caigan exactamente bajo su día. Lo calcula la vista, que es la que conoce
   *  el ancho del gutter y de cada columna. */
  gridTemplateColumns: string;
  /** Si `gridTemplateColumns` arranca con la pista del gutter (la de la columna de
   *  horas). Tiene que coincidir con la fila de fechas: cuando la vista esconde el
   *  gutter, esa pista no existe y una celda de más correría todos los días un lugar. */
  showGutter?: boolean;
  /** Columnas de agrupación (consultorios, doctores). Con ellas, cada día se subdivide
   *  igual que en la rejilla y cada ítem cae bajo su consultorio. Sin ellas, el día
   *  es una sola celda. */
  columns?: CalendarGroupingColumn[];
  /** `grid-template-columns` del bloque interno de cada día. Tiene que ser el mismo
   *  que usa `.day-view-group-block` o las celdas no coinciden con las de la rejilla. */
  columnsTemplate?: string;
  groupBy?: CalendarGroupBy;
  /** Mismo contrato que las cards de la rejilla: recibe `event.data` y el rect de la
   *  card, para que en modo custom la ventana flotante se ancle al chip. */
  onEventClick?: (data: any, anchorRect?: DOMRect) => void;
}

/**
 * Banda fija de ítems de todo el día: una fila más, justo debajo de las líneas del día y
 * del consultorio, como la de Google Calendar.
 *
 * Vive dentro de `.day-view-header-wrapper`, que ya es `position: sticky`, así que hereda
 * gratis el quedarse fija al scrollear la rejilla. Replica la estructura de columnas de la
 * rejilla —día, y dentro de cada día un bloque por consultorio— para que cada ítem quede
 * bajo la misma columna en la que estaría si tuviera horario.
 *
 * No dibuja nada si no hay ítems: una banda vacía le robaría alto a la rejilla todos los
 * días del año.
 */
export function CalendarAllDayBand({
  days,
  events,
  gridTemplateColumns,
  showGutter = true,
  columns,
  columnsTemplate,
  groupBy = 'none',
  onEventClick,
}: CalendarAllDayBandProps) {
  const t = useTranslations('Reminders');
  const isGrouped = groupBy !== 'none' && !!columns?.length;

  const renderChip = (event: CalendarEvent) => (
    <button
      key={event.id}
      type="button"
      className="all-day-band-chip"
      style={{ backgroundColor: event.color }}
      title={event.title}
      onClick={(domEvent) => onEventClick?.(
        event.data,
        domEvent.currentTarget.getBoundingClientRect(),
      )}
    >
      <span className="all-day-band-chip-text">{event.title}</span>
    </button>
  );

  // Un ítem de todo el día abarca un solo día por diseño (ver el CHECK
  // reminders_all_day_range_check), así que alcanza con comparar contra `start`.
  const cells = React.useMemo(() => days.map((day) => (
    isGrouped
      ? columns!.map((col) => filterEventsByDayAndGroup(events, day, groupBy, col.value))
      : [events.filter((event) => isSameDay(new Date(event.start), day))]
  )), [days, events, columns, groupBy, isGrouped]);

  if (events.length === 0) return null;

  return (
    <div className="all-day-band" style={{ gridTemplateColumns }} data-testid="calendar-all-day-band">
      {showGutter && (
        <div className="all-day-band-gutter">
          <span className="all-day-band-label">{t('allDayBandLabel')}</span>
        </div>
      )}
      {days.map((day, dayIndex) => (
        isGrouped ? (
          <div
            key={day.toISOString()}
            className="all-day-band-block"
            style={{ gridTemplateColumns: columnsTemplate }}
          >
            {columns!.map((col, colIndex) => (
              <div key={`${day.toISOString()}-${col.id}`} className="all-day-band-cell">
                {cells[dayIndex][colIndex].map(renderChip)}
              </div>
            ))}
          </div>
        ) : (
          <div key={day.toISOString()} className={cn('all-day-band-cell', 'all-day-band-cell--day')}>
            {cells[dayIndex][0].map(renderChip)}
          </div>
        )
      ))}
    </div>
  );
}
