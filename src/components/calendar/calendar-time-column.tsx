'use client';

import { cn } from '@/lib/utils';

import { formatTimeSlotLabel, generateTimeSlots } from './calendar-utils';

interface CalendarTimeColumnProps {
  /** Label for the timezone cell (e.g. "GMT-3") */
  timeZoneLabel?: string;
  /** Whether to render the timezone header cell */
  showTimeZoneLabel?: boolean;
  /** When false, the 60px track is kept (for alignment/GMT header) but the hour
   *  labels are hidden — each day column shows the hours in its own rail instead. */
  visible?: boolean;
  /** Primera hora que se ve arriba de la rejilla (con una franja visible que empieza
   *  en hora en punto). Su etiqueta va por debajo de la línea, como la de las 00:00:
   *  la normal se dibuja centrada sobre la línea y el recorte de la franja la corta. */
  firstHour?: number;
}

export function CalendarTimeColumn({ timeZoneLabel, showTimeZoneLabel = false, visible = true, firstHour = 0 }: CalendarTimeColumnProps) {
  const timeSlots = generateTimeSlots();

  return (
    <div className="time-column">
      {showTimeZoneLabel && (
        <div className="time-zone-label">{timeZoneLabel}</div>
      )}
      {visible && timeSlots.map((time, hour) => (
        <div key={time} className="time-slot">
          <span className={cn('time-slot-label', hour === firstHour && 'time-slot-label-first')}>
            {formatTimeSlotLabel(time)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Renders time slot dividers (no labels) for a day column */
export function TimeSlotDividers({ keyPrefix }: { keyPrefix?: string }) {
  const timeSlots = generateTimeSlots();
  return (
    <>
      {timeSlots.map((time) => (
        <div key={keyPrefix ? `${time}-${keyPrefix}` : time} className="time-slot time-slot-divider" />
      ))}
    </>
  );
}
