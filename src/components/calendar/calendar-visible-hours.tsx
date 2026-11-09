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

/**
 * Lleva la franja a horas completas hacia afuera (8:10–19:40 => 8:00–20:00). La
 * columna de horas marca horas en punto: si el recorte empieza a las 8:10, la
 * línea y la etiqueta de las 8 quedan arriba del recorte y la primera hora no se
 * rotula. El tramo agregado se ve como "no disponible" con las bandas de siempre.
 */
export function snapVisibleHoursRange(range: VisibleHoursRange): VisibleHoursRange {
  return {
    startMin: Math.max(0, Math.floor(range.startMin / 60) * 60),
    endMin: Math.min(MINUTES_IN_DAY, Math.ceil(range.endMin / 60) * 60),
  };
}

/** Rango personalizado guardado; null si falta o no es válido (fin <= inicio). */
export function customVisibleHoursRange(start?: string | null, end?: string | null): VisibleHoursRange | null {
  const startMin = visibleHourToMinutes(start);
  const endMin = visibleHourToMinutes(end);
  if (startMin === null || endMin === null || endMin <= startMin) return null;
  return snapVisibleHoursRange({ startMin, endMin });
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
 * a la vista completa en vez de quedarse sin horas. Se redondea a horas completas
 * (`snapVisibleHoursRange`).
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
  return snapVisibleHoursRange({ startMin, endMin });
}

/** Amplía `range` (a horas completas) para que entre [startMin, endMin) (p. ej. el borrador inline). */
export function expandVisibleHoursRange(range: VisibleHoursRange, startMin: number, endMin: number): VisibleHoursRange {
  if (startMin >= range.startMin && endMin <= range.endMin) return range;
  return snapVisibleHoursRange({
    startMin: Math.min(range.startMin, startMin),
    endMin: Math.max(range.endMin, endMin),
  });
}

/**
 * Hora cuya línea queda justo en el borde superior de la franja (la franja empieza en
 * hora en punto), o 0 sin franja. La columna de horas le baja la etiqueta para que
 * el recorte no la corte.
 */
export function firstVisibleHour(range?: VisibleHoursRange | null): number {
  if (!range || range.startMin % 60 !== 0) return 0;
  return range.startMin / 60;
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

/** Hora (minutos desde medianoche) que queda arriba de todo y si se está en el tope. */
interface TimeGridScrollPosition {
  topMin: number;
  atTop: boolean;
}

/**
 * Scroll vertical de la rejilla: al montar va a las 08:00 (o al inicio de la
 * franja, si empieza después) y, al cambiar el alto de hora (zoom) o la franja,
 * conserva la hora que estaba arriba de todo. Con una franja activa, si se estaba
 * en el tope se sigue en el tope: si la franja se amplía hacia atrás (p. ej. pasa
 * de empezar a las 09:00 a las 08:00) se ve la nueva primera hora.
 *
 * La posición se registra en cada evento de scroll, con la geometría con la que se
 * midió, y no se relee `scrollTop` después del commit: para entonces el navegador
 * ya lo recortó al nuevo alto de la rejilla (o lo corrió el scroll anchoring) y la
 * hora calculada sale desplazada.
 */
export function useTimeGridScroll(
  scrollRef: React.RefObject<HTMLElement | null>,
  hourSlotHeight: number,
  range?: VisibleHoursRange | null,
) {
  const startMin = range?.startMin ?? 0;
  const hasRange = !!range;
  const positionRef = React.useRef<TimeGridScrollPosition | null>(null);
  const geometryRef = React.useRef({ hourSlotHeight, startMin });

  React.useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const onScroll = () => {
      const geometry = geometryRef.current;
      positionRef.current = {
        topMin: (c.scrollTop / geometry.hourSlotHeight) * 60 + geometry.startMin,
        atTop: c.scrollTop <= 1,
      };
    };
    c.addEventListener('scroll', onScroll, { passive: true });
    return () => c.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  React.useLayoutEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const prev = geometryRef.current;
    const position = positionRef.current;
    geometryRef.current = { hourSlotHeight, startMin };

    let targetMin: number;
    if (!position) {
      targetMin = Math.max(DEFAULT_SCROLL_HOUR * 60, startMin);
    } else if (prev.hourSlotHeight !== hourSlotHeight || prev.startMin !== startMin) {
      targetMin = hasRange && position.atTop ? startMin : Math.max(startMin, position.topMin);
    } else {
      return;
    }
    c.scrollTop = ((targetMin - startMin) / 60) * hourSlotHeight;
    positionRef.current = {
      topMin: (c.scrollTop / hourSlotHeight) * 60 + startMin,
      atTop: c.scrollTop <= 1,
    };
  }, [scrollRef, hourSlotHeight, startMin, hasRange]);
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
