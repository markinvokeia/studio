'use client';

import * as React from 'react';

import { useEventStreamSubscription, useRegisterEventChannels } from '@/context/event-stream-context';
import type { EventHandler } from '@/lib/event-stream';

/** Canal global de citas: recibe cambios de cualquier calendario. */
const GLOBAL_CALENDAR_CHANNEL = 'appointments';
/**
 * Canal dedicado a la disponibilidad de la clínica (horarios semanales y
 * excepciones). Va aparte del canal global de citas para no duplicar el tráfico
 * de `calendar_changed` en quienes ya escuchan `calendar:<id>`.
 */
const AVAILABILITY_CHANNEL = 'clinic:availability';
/**
 * Micro-lote: junta las ráfagas de mutaciones (varias seguidas / varios usuarios)
 * en un solo dispatch. A diferencia del debounce anterior NO descarta eventos
 * intermedios — todos se acumulan y se entregan juntos para aplicarlos en orden.
 */
const BATCH_FLUSH_MS = 120;

/**
 * "Habilitar/Bloquear horario" guarda varias excepciones en llamadas seguidas
 * (crear/recortar/borrar). Se espera a que la ráfaga termine para recargar una
 * sola vez; 500 ms sigue siendo imperceptible para quien está mirando.
 */
const AVAILABILITY_FLUSH_MS = 500;

/** Nombre del evento DOM que transporta el lote de cambios a parchear. */
export const CALENDAR_PATCH_EVENT = 'clinic:calendar:patch';

/**
 * Evento DOM que avisa que cambió la DISPONIBILIDAD de la clínica (horarios
 * semanales o cierres/aperturas de `clinic_exceptions`), no una cita. Lo publica
 * n8n como `availability_changed` en el canal `clinic:availability` al guardar
 * `feriados/*` o `clinicschedules/*`; el calendario lo escucha para repintar las
 * bandas bloqueadas sin recargar la página.
 */
export const AVAILABILITY_CHANGED_EVENT = 'clinic:availability:changed';

/** Payload de `availability_changed`. Sólo el scope/acción son informativos. */
export interface AvailabilityChangePayload {
  event_type?: string;
  scope?: 'clinic_exception' | 'clinic_schedule' | string;
  action?: string;
  sede_id?: string | number | null;
}

/**
 * Fila cruda que viaja en un evento `calendar_changed`. El backend (n8n) reenvía
 * la fila de `appointments` (más `doctor_name` / `patient_name` / `services` en
 * las ramas que la traen enriquecida) junto con el discriminador `action`.
 * `appointments/page.tsx` la mapea con `mapApiAppointmentRow`.
 */
export interface CalendarChangePayload {
  event_type?: string;
  /** Discriminador de contenido: ausente/`'appointment'` = cita; `'reminder'` = nota o recordatorio (tabla `reminders`). */
  item_type?: 'appointment' | 'reminder';
  action?: string;
  appointment_id?: string | number;
  /** Sólo en eventos de nota/recordatorio (`item_type: 'reminder'`). */
  reminder_id?: string | number;
  id?: string | number;
  calendar_source_id?: string | number;
  /** En reagendamientos: id de la fila vieja que quedó `cancelled` sin evento propio. */
  original_appointment_id?: string | number;
  status?: string;
  updated_at?: string;
  start?: string;
  start_datetime?: string;
  [key: string]: unknown;
}

export interface CalendarPatchEventDetail {
  events: CalendarChangePayload[];
}

/**
 * Escucha los eventos `calendar_changed` que publica el backend cuando otro
 * usuario crea, edita, reprograma, reasigna, cambia de estado, de color o cancela
 * una cita —o crea, edita, mueve, completa o elimina una nota/recordatorio
 * (`item_type: 'reminder'`)—, y los reemite como un `CustomEvent('clinic:calendar:patch')`
 * con el lote de filas crudas. `appointments/page.tsx` aplica cada una como un patch
 * quirúrgico sobre su estado (upsert / merge / remove por id) en vez de recargar
 * todo el rango visible.
 *
 * También escucha `availability_changed` (horarios semanales y excepciones de la
 * clínica) y lo reemite como `CustomEvent('clinic:availability:changed')`; ese
 * evento no es una cita, así que el calendario sólo vuelve a leer sus horarios.
 *
 * @param calendarIds ids de los calendarios visibles. Se traducen a canales
 *   `calendar:<id>` para no recibir cambios de agendas que no se están mirando.
 *   Sin filtro se escucha el canal global `appointments`. En todos los casos se
 *   suma `clinic:availability`, por donde viajan los cambios de horarios/cierres
 *   (son de toda la clínica, no de un calendario concreto).
 */
export function useCalendarLiveRefresh(calendarIds: string[] = []) {
  const key = React.useId();

  const channelsKey = calendarIds.filter(Boolean).sort().join(',');
  const channels = React.useMemo(
    () => {
      const ids = channelsKey ? channelsKey.split(',') : [];
      const base = ids.length > 0 ? ids.map((id) => `calendar:${id}`) : [GLOBAL_CALENDAR_CHANNEL];
      return [...base, AVAILABILITY_CHANNEL];
    },
    [channelsKey],
  );
  useRegisterEventChannels(key, channels);

  // Set de agendas visibles, en un ref para que el handler lea siempre el valor
  // actual sin re-suscribirse en cada cambio de filtro.
  const visibleIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    visibleIdsRef.current = new Set(channelsKey ? channelsKey.split(',') : []);
  }, [channelsKey]);

  const bufferRef = React.useRef<CalendarChangePayload[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  // Timer propio para los cambios de disponibilidad: una sola escritura de
  // "Habilitar/Bloquear horario" hace VARIAS llamadas seguidas (crear/recortar/
  // borrar excepciones); se agrupan en un único aviso.
  const availabilityTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearTimeout(availabilityTimerRef.current);
  }, []);

  const flush = React.useCallback(() => {
    const events = bufferRef.current;
    bufferRef.current = [];
    if (events.length === 0 || typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent<CalendarPatchEventDetail>(CALENDAR_PATCH_EVENT, { detail: { events } }),
    );
  }, []);

  const onEvent = React.useCallback<EventHandler>((eventType, data) => {
    // El discriminador viaja tanto en el nombre del evento SSE como dentro del
    // payload (`event_type`), por si el servidor no propaga `ev.event`.
    const payload = (data ?? null) as (CalendarChangePayload & AvailabilityChangePayload) | null;
    if (!payload) return;

    // Cambio de horarios/cierres: no trae una cita para parchear, sólo avisa que
    // el calendario tiene que volver a leer la disponibilidad.
    if (eventType === 'availability_changed' || payload.event_type === 'availability_changed') {
      if (typeof window === 'undefined') return;
      clearTimeout(availabilityTimerRef.current);
      availabilityTimerRef.current = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent<AvailabilityChangePayload>(AVAILABILITY_CHANGED_EVENT, { detail: payload }),
        );
      }, AVAILABILITY_FLUSH_MS);
      return;
    }

    if (eventType !== 'calendar_changed' && payload.event_type !== 'calendar_changed') return;

    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem('debug:calendar-patch')) {
        console.debug('[calendar-patch] SSE calendar_changed', { eventType, payload });
      }
    } catch { /* localStorage no disponible */ }

    // El backend publica en `["appointments", "calendar:<id>"]`, así que un evento
    // de otra agenda podría llegar por el canal global. Si se está mirando un
    // conjunto concreto de agendas, sólo se procesa cuando el cambio es de una de
    // ellas; si no trae `calendar_source_id` o no hay filtro, se procesa igual.
    const changedCalendarId = payload.calendar_source_id;
    if (
      visibleIdsRef.current.size > 0 &&
      changedCalendarId != null &&
      !visibleIdsRef.current.has(String(changedCalendarId))
    ) {
      return;
    }

    bufferRef.current.push(payload);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, BATCH_FLUSH_MS);
  }, [flush]);
  useEventStreamSubscription(onEvent);
}
