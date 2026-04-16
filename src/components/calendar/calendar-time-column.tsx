'use client';

import { cn } from '@/lib/utils';

import { formatTimeSlotLabel, generateTimeSlots } from './calendar-utils';

interface CalendarTimeColumnProps {
  /** Label for the timezone cell (e.g. "GMT-3") */
  timeZoneLabel?: string;
  /** Whether to render the timezone header cell */
  showTimeZoneLabel?: boolean;
}

export function CalendarTimeColumn({ timeZoneLabel, showTimeZoneLabel = false }: CalendarTimeColumnProps) {
  const timeSlots = generateTimeSlots();

  return (
    <div className="time-column">
      {showTimeZoneLabel && (
        <div className="time-zone-label">{timeZoneLabel}</div>
      )}
      {timeSlots.map((time) => (
        <div key={time} className="time-slot">
          <span className={cn('time-slot-label', time === '00:00' && 'time-slot-label-first')}>
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
        <div key={keyPrefix ? `${time}-${keyPrefix}` : time} className="time-slot" />
      ))}
    </>
  );
}
