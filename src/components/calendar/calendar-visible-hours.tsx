'use client';

import React from 'react';
import { format, isValid, parseISO } from 'date-fns';

import { ClinicException, ClinicSchedule } from '@/lib/types';

import { DEFAULT_SCROLL_HOUR, MAX_FIT_HOUR_SLOT_HEIGHT, MINUTES_IN_DAY } from './calendar-constants';
import { getAvailableIntervals } from './calendar-gaps';
import { visibleHourToMinutes } from './calendar-settings-utils';
import type { CalendarEvent } from './calendar-types';

/**
 * Franja horaria visible de la rejilla de horas (preferencia `visible_hours_mode`).
 *
 * La rejilla sigue midiendo 24 h y todo se sigue posicionando desde medianoche: la
 * franja solo recorta lo que se ve (`VisibleHoursClip`). Así el clic, el menú
 * contextual, el arrastre y el borrador inline, que traducen la posición en
 * pantalla a una hora con `getBoundingClientRect`, no necesitan saber que existe.
 */
export interface VisibleHoursRange {
  /** Minutos desde medianoche, [startMin, endMin). */
  startMin: number;
  endMin: number;
}

/** Rango personalizado guardado; null si falta o no es válido (fin <= inicio). */
export function customVisibleHoursRange(start?: string | null, end?: string | null): VisibleHoursRange | null {
  const startMin = visibleHourToMinutes(start);
  const endMin = visibleHourToMinutes(end);
  if (startMin === null || endMin === null || endMin <= startMin) return null;
  return { startMin, endMin };
}

/** Horarios y excepciones de una columna/sede a considerar. */
export interface ClinicHoursScope {
  schedules: ClinicSchedule[];
  exceptions: ClinicException[];
}

/**
 * Jornada de la clínica para los días en pantalla: desde la apertura más temprana
 * hasta el cierre más tardío de todos los días y sedes (con excepciones). La rejilla
 * es una sola para todos los días, así que un día con menos horas muestra el resto
 * como cerrado (bandas de "no disponible"). Null si ningún día abre: la agenda cae
 * a la vista completa en vez de quedarse sin horas.
 */
export function clinicVisibleHoursRange(days: Date[], scopes: ClinicHoursScope[]): VisibleHoursRange | null {
  let startMin = Infinity;
  let endMin = -Infinity;
  for (const day of days) {
    for (const scope of scopes) {
      if (scope.schedules.length === 0) continue;
      for (const interval of getAvailableIntervals(day, scope.schedules, scope.exceptions)) {
        startMin = Math.min(startMin, interval.startMin);
        endMin = Math.max(endMin, interval.endMin);
      }
    }
  }
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
  return { startMin: Math.max(0, startMin), endMin: Math.min(MINUTES_IN_DAY, endMin) };
}

/** Amplía `range` para que entre [startMin, endMin) (p. ej. el borrador inline). */
export function expandVisibleHoursRange(range: VisibleHoursRange, startMin: number, endMin: number): VisibleHoursRange {
  if (startMin >= range.startMin && endMin <= range.endMin) return range;
  return {
    startMin: Math.max(0, Math.min(range.startMin, startMin)),
    endMin: Math.min(MINUTES_IN_DAY, Math.max(range.endMin, endMin)),
  };
}

const toDate = (value: Date | string): Date => (typeof value === 'string' ? parseISO(value) : value);

/** Minutos desde medianoche de `date`, sobre el día `dayKey` (antes => 0, después => 1440). */
function minutesOnDay(date: Date, dayKey: string): number {
  const key = format(date, 'yyyy-MM-dd');
  if (key < dayKey) return 0;
  if (key > dayKey) return MINUTES_IN_DAY;
  return date.getHours() * 60 + date.getMinutes();
}

/** Si la cita queda entera fuera de la franja (antes del inicio o desde el fin). */
export function isOutsideVisibleHours(start: Date, end: Date, range: VisibleHoursRange): boolean {
  const dayKey = format(start, 'yyyy-MM-dd');
  const startMin = minutesOnDay(start, dayKey);
  // Una cita de duración 0 igual ocupa su minuto de inicio.
  const endMin = Math.max(startMin + 1, minutesOnDay(end, dayKey));
  return endMin <= range.startMin || startMin >= range.endMin;
}

/**
 * Cuenta las citas (no notas ni recordatorios) de los días visibles que quedan
 * enteras fuera de la franja: son las que el usuario dejaría de ver sin aviso.
 */
export function countEventsOutsideVisibleHours(
  events: CalendarEvent[],
  range: VisibleHoursRange,
  visibleDayKeys: Set<string>,
): number {
  let count = 0;
  for (const event of events) {
    if ((event.data as { kind?: string } | undefined)?.kind === 'reminder') continue;
    const start = toDate(event.start);
    const end = toDate(event.end);
    if (!isValid(start) || !isValid(end)) continue;
    if (!visibleDayKeys.has(format(start, 'yyyy-MM-dd'))) continue;
    if (isOutsideVisibleHours(start, end, range)) count += 1;
  }
  return count;
}

interface VisibleHoursClipProps {
  range?: VisibleHoursRange | null;
  hourSlotHeight: number;
  children: React.ReactNode;
}

/**
 * Recorta la rejilla de 24 h a la franja visible. `overflow: clip` (no `hidden`)
 * porque no crea un contenedor de scroll: la columna de horas sigue pegada con
 * `position: sticky` al scroll horizontal de la vista.
 */
export function VisibleHoursClip({ range, hourSlotHeight, children }: VisibleHoursClipProps) {
  if (!range) return <>{children}</>;
  const pxPerMin = hourSlotHeight / 60;
  return (
    <div
      className="visible-hours-clip"
      style={{ height: `${(range.endMin - range.startMin) * pxPerMin}px` }}
    >
      <div style={{ marginTop: `${-range.startMin * pxPerMin}px` }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Scroll vertical de la rejilla: al montar va a las 08:00 (o al inicio de la
 * franja, si empieza después) y, al cambiar el alto de hora (zoom) o la franja,
 * conserva la hora que estaba arriba de todo.
 */
export function useTimeGridScroll(
  scrollRef: React.RefObject<HTMLElement | null>,
  hourSlotHeight: number,
  startMin = 0,
) {
  const didInitialScrollRef = React.useRef(false);
  const prevHourRef = React.useRef(hourSlotHeight);
  const prevStartRef = React.useRef(startMin);
  React.useLayoutEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    if (!didInitialScrollRef.current) {
      c.scrollTop = (Math.max(0, DEFAULT_SCROLL_HOUR * 60 - startMin) / 60) * hourSlotHeight;
      didInitialScrollRef.current = true;
    } else if (prevHourRef.current && (prevHourRef.current !== hourSlotHeight || prevStartRef.current !== startMin)) {
      const topTimeMin = (c.scrollTop / prevHourRef.current) * 60 + prevStartRef.current;
      c.scrollTop = (Math.max(0, topTimeMin - startMin) / 60) * hourSlotHeight;
    }
    prevHourRef.current = hourSlotHeight;
    prevStartRef.current = startMin;
  }, [scrollRef, hourSlotHeight, startMin]);
}

interface FittedHourSlotHeightOptions {
  /** Contenedor con scroll de la rejilla (`.day-view-container` o el scroller mobile). */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Cabecera sticky dentro del contenedor, si la hay (escritorio). Su alto no es
   *  alto útil: el recorte empieza debajo. */
  headerRef?: React.RefObject<HTMLElement | null>;
  /** Alto de hora base: preferencia del usuario × zoom. */
  hourSlotHeight: number;
  /** Franja visible activa; null = día completo (no se ajusta). */
  range?: VisibleHoursRange | null;
}

/**
 * Alto de hora que hace que la franja visible llene el alto disponible ("fit").
 *
 * Solo estira (`max`), nunca encoge: si la franja ya es más alta que el contenedor
 * se conserva el alto configurado y aparece scroll vertical, igual que sin franja.
 * Con una franja activa, entonces, el zoom puede ampliar pero no reducir por debajo
 * del fit; el resultado nunca pasa de `MAX_FIT_HOUR_SLOT_HEIGHT`. Sin franja
 * (`range` null) devuelve el alto base sin tocar nada.
 */
export function useFittedHourSlotHeight({
  scrollRef,
  headerRef,
  hourSlotHeight,
  range,
}: FittedHourSlotHeightOptions): number {
  const [availablePx, setAvailablePx] = React.useState(0);

  React.useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const measure = () => {
      setAvailablePx(scrollEl.clientHeight - (headerRef?.current?.offsetHeight ?? 0));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // Cambia el contenedor al redimensionar la ventana/paneles y la cabecera cuando
    // aparece la banda de todo el día o cambia una etiqueta.
    const observer = new ResizeObserver(measure);
    observer.observe(scrollEl);
    if (headerRef?.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [scrollRef, headerRef]);

  if (!range || range.endMin <= range.startMin || availablePx <= 0) return hourSlotHeight;
  const rangeMinutes = range.endMin - range.startMin;
  // `floor` para que la franja entre entera y no nazca un scroll de 1 px.
  const fitted = Math.floor((availablePx * 60) / rangeMinutes);
  return Math.max(hourSlotHeight, Math.min(fitted, MAX_FIT_HOUR_SLOT_HEIGHT));
}
