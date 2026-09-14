'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, getDaysInMonth, isSameDay, parseISO, startOfWeek } from 'date-fns';

import { Skeleton } from '@/components/ui/skeleton';

import type { CalendarDragMode, CalendarDragResolver, CalendarEvent, CalendarEventDropHandler, CalendarSlotClickHandler } from './calendar-types';
import { CalendarEventChip } from './calendar-event';
import { type Gap, gapKey } from './calendar-gaps';
import { CalendarDragChip } from './calendar-drag-ghost';
import { dateFromDayMinutes, dayFromKey } from './calendar-utils';
import { useCalendarDragDrop } from '@/hooks/use-calendar-drag-drop';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  dateLocale: Locale;
  isLoading?: boolean;
  onEventClick: (data: any) => void;
  onEventColorChange: (data: any, colorId: string) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
  onEventContextMenuOpen?: (data: any) => void;
  onSlotClick?: CalendarSlotClickHandler;
  gaps?: Gap[];
  selectedGapKey?: string;
  onGapClick?: (gap: Gap) => void;
  blockedFullDays?: Set<string>;
  enableEventDrag?: boolean;
  canDragEvent?: (event: CalendarEvent, mode: CalendarDragMode) => boolean;
  onEventDrop?: CalendarEventDropHandler;
  /** Pasar al mes anterior (-1) o siguiente (+1) sin cortar el arrastre, cuando el
   *  puntero se sostiene contra el borde izquierdo o derecho de la grilla. */
  onNavigatePeriod?: (direction: -1 | 1) => void;
}

export function CalendarMonthView({
  currentDate,
  events,
  dateLocale,
  isLoading = false,
  onEventClick,
  onEventColorChange,
  onEventContextMenu,
  onEventContextMenuOpen,
  onSlotClick,
  gaps,
  selectedGapKey,
  onGapClick,
  blockedFullDays,
  enableEventDrag = false,
  canDragEvent,
  onEventDrop,
  onNavigatePeriod,
}: CalendarMonthViewProps) {
  // ── Arrastre de fecha ───────────────────────────────────────────────────
  // En el mes no hay eje de horas: mover conserva la hora del día y la duración,
  // y solo cambia la fecha. Es la misma fórmula que usa el date picker del panel
  // de detalle. No hay resize.
  const gridRef = React.useRef<HTMLDivElement>(null);

  const resolveDrag = React.useCallback<CalendarDragResolver>((gesture, pointer) => {
    const hit = document.elementFromPoint(pointer.x, pointer.y) as HTMLElement | null;
    const cell = hit?.closest<HTMLElement>('.calendar-day[data-day]');
    if (!cell || !gridRef.current?.contains(cell)) return null;
    const dayKey = cell.dataset.day;
    if (!dayKey) return null;

    const day = dayFromKey(dayKey);
    const startMin = gesture.originalStart.getHours() * 60 + gesture.originalStart.getMinutes();
    const durationMin = (gesture.originalEnd.getTime() - gesture.originalStart.getTime()) / 60000;
    const start = dateFromDayMinutes(day, startMin);
    const end = dateFromDayMinutes(day, startMin + durationMin);
    return {
      target: { dayKey, day, element: cell, rect: cell.getBoundingClientRect() },
      candidate: { start, end, invalid: cell.dataset.blocked === 'true' },
    };
  }, []);

  const handleDragCommit = React.useCallback((result: Parameters<CalendarEventDropHandler>[0]) => {
    onEventDrop?.(result);
  }, [onEventDrop]);

  // Un arrastre en curso tiene que poder sobrevivir al refetch que dispara cambiar
  // de mes, y para eso la grilla no puede desaparecer debajo del gesto (ver el
  // esqueleto de carga más abajo). Es el único motivo por el que el arrastre asoma
  // como estado: un re-render al empezar y otro al terminar.
  const [isDraggingEvent, setIsDraggingEvent] = React.useState(false);
  const handleDragStart = React.useCallback(() => setIsDraggingEvent(true), []);
  const handleDragEnd = React.useCallback(() => setIsDraggingEvent(false), []);

  const { onDragPointerDown, dragStateRef, store: dragStore, isDraggable } = useCalendarDragDrop({
    enabled: enableEventDrag && !!onEventDrop,
    scrollRef: gridRef,
    resolve: resolveDrag,
    canDrag: canDragEvent,
    onCommit: handleDragCommit,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    cardSelector: '.event',
    containerSelector: '.calendar-day',
    // Sostener el arrastre contra un costado pasa al mes anterior/siguiente. Acá no
    // hay scroll horizontal que agotar primero —el mes entra entero—, así que el
    // borde queda armado apenas se entra en la banda y manda la espera de
    // `DRAG_EDGE_NAV_DELAY_MS`: rozar la primera o la última columna de camino a una
    // celda no cambia de mes.
    onEdgeNavigate: onNavigatePeriod,
  });

  // El destino se resalta por estado y no imperativamente: el snapshot solo cambia
  // al cruzar de celda —unas pocas veces por arrastre—, no por frame. Lo que sí va
  // a 60 fps es el chip, que se mueve solo y no re-renderiza esta vista.
  const dragPreview = React.useSyncExternalStore(
    dragStore.subscribe,
    dragStore.getSnapshot,
    dragStore.getServerSnapshot,
  );
  const dropTargetDayKey = dragPreview?.dayKey;
  const dropTargetInvalid = dragPreview?.invalid ?? false;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfWeek = 1; // Monday
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const dayOffset = (firstDayOfMonth - firstDayOfWeek + 7) % 7;
  const daysInMonth = getDaysInMonth(currentDate);

  const dayNames = Array.from({ length: 7 }, (_, i) =>
    format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEE', { locale: dateLocale })
  );

  const renderDays = () => {
    const dayElements = [];

    for (let i = 0; i < dayOffset; i++) {
      dayElements.push(<div key={`empty-prev-${i}`} className="calendar-day other-month" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = events
        .filter((e) => {
          if (!e.start) return false;
          try {
            return isSameDay(typeof e.start === 'string' ? parseISO(e.start) : e.start, date);
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const startA = (typeof a.start === 'string' ? parseISO(a.start) : a.start).getTime();
          const startB = (typeof b.start === 'string' ? parseISO(b.start) : b.start).getTime();
          return startA - startB;
        });

      const dayKey = format(date, 'yyyy-MM-dd');
      const maxGap = gaps?.find((g) => g.dayKey === dayKey && g.isMax);
      const isBlocked = blockedFullDays?.has(dayKey) ?? false;

      dayElements.push(
        <div
          key={day}
          data-day={dayKey}
          data-blocked={isBlocked ? 'true' : undefined}
          className={cn(
            'calendar-day',
            isBlocked && 'calendar-day--blocked',
            dropTargetDayKey === dayKey && 'calendar-day--drop-target',
            dropTargetDayKey === dayKey && dropTargetInvalid && 'calendar-day--drop-invalid',
          )}
          onClick={(e) => {
            if (e.button !== 0) return;
            // Ignore synthetic clicks that bubbled from portalled children.
            if (!e.currentTarget.contains(e.target as Node)) return;
            // Este click cierra un arrastre: sin la guarda, soltar la cita en otra
            // celda abriría además la creación en ese día.
            if (dragStateRef.current.didDrag) return;
            if (isBlocked) return; // closed day — not bookable
            if (onSlotClick) {
              e.stopPropagation();
              onSlotClick(date);
            }
          }}
        >
          <span
            className={cn(
              'font-semibold w-6 h-6 flex items-center justify-center rounded-full',
              isSameDay(date, new Date()) && 'current-day-month-view'
            )}
          >
            {day}
          </span>
          {maxGap && (
            <button
              type="button"
              className={cn('calendar-gap-badge', selectedGapKey === gapKey(maxGap) && 'calendar-gap-badge--selected')}
              onClick={(e) => { e.stopPropagation(); onGapClick?.(maxGap); }}
              title={`${format(maxGap.start, 'HH:mm')} – ${format(maxGap.end, 'HH:mm')}`}
            >
              {format(maxGap.start, 'HH:mm')}–{format(maxGap.end, 'HH:mm')}
            </button>
          )}
          <div className="mt-1 space-y-1">
            {dayEvents.map((event, index) => (
              <CalendarEventChip
                key={`${event.id}-${index}`}
                event={event}
                dateLocale={dateLocale}
                onEventClick={onEventClick}
                onEventColorChange={onEventColorChange}
                onEventContextMenu={onEventContextMenu}
                onEventContextMenuOpen={onEventContextMenuOpen}
                onDragPointerDown={onDragPointerDown}
                dragStateRef={dragStateRef}
                draggable={isDraggable(event)}
              />
            ))}
          </div>
        </div>
      );
    }

    const totalCells = dayElements.length > 35 ? 42 : 35;
    while (dayElements.length < totalCells) {
      dayElements.push(<div key={`empty-next-${dayElements.length}`} className="calendar-day other-month" />);
    }

    return dayElements;
  };

  // El esqueleto es para la carga inicial. Cambiar de mes sin soltar la cita también
  // dispara un refetch, y ahí tapar la grilla dejaría el gesto sin celdas con
  // `data-day`: sin destino que resolver, sin resalte y sin nada donde soltar.
  if (isLoading && !isDraggingEvent) {
    const skeletonDays = Array.from({ length: 42 }).map((_, i) => (
      <div key={`skel-${i}`} className="calendar-day">
        <Skeleton className="h-4 w-6 mb-2" />
        <Skeleton className="h-5 w-full mt-2" />
        <Skeleton className="h-5 w-full mt-1" />
      </div>
    ));
    return (
      <>
        <div className="calendar-day-name-grid">
          {dayNames.map((name) => <div key={name}>{name}</div>)}
        </div>
        <div className="calendar-grid month-view">{skeletonDays}</div>
      </>
    );
  }

  return (
    <>
      <div className="calendar-day-name-grid">
        {dayNames.map((name) => <div key={name}>{name}</div>)}
      </div>
      <div ref={gridRef} className="calendar-grid month-view">{renderDays()}</div>
      <CalendarDragChip store={dragStore} />
    </>
  );
}
