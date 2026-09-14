'use client';

import * as React from 'react';

import { useEventStreamSubscription, useRegisterEventChannels } from '@/context/event-stream-context';
import type { EventHandler } from '@/lib/event-stream';

/** Canal global de citas: recibe cambios de cualquier calendario. */
const GLOBAL_CALENDAR_CHANNEL = 'appointments';
/**
 * Micro-lote: junta las ráfagas de mutaciones (varias seguidas / varios usuarios)
 * en un solo dispatch. A diferencia del debounce anterior NO descarta eventos
 * intermedios — todos se acumulan y se entregan juntos para aplicarlos en orden.
 */
const BATCH_FLUSH_MS = 120;

/** Nombre del evento DOM que transporta el lote de cambios a parchear. */
export const CALENDAR_PATCH_EVENT = 'clinic:calendar:patch';

/**
 * Fila cruda que viaja en un evento `calendar_changed`. El backend (n8n) reenvía
 * la fila de `appointments` (más `doctor_name` / `patient_name` / `services` en
 * las ramas que la traen enriquecida) junto con el discriminador `action`.
 * `appointments/page.tsx` la mapea con `mapApiAppointmentRow`.
 */
export interface CalendarChangePayload {
  event_type?: string;
  action?: string;
  appointment_id?: string | number;
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
 * una cita, y los reemite como un `CustomEvent('clinic:calendar:patch')` con el
 * lote de filas crudas. `appointments/page.tsx` aplica cada una como un patch
 * quirúrgico sobre su estado (upsert / merge / remove por id) en vez de recargar
 * todo el rango visible.
 *
 * @param calendarIds ids de los calendarios visibles. Se traducen a canales
 *   `calendar:<id>` para no recibir cambios de agendas que no se están mirando.
 *   Vacío ⇒ se escucha el canal global `appointments`.
 */
export function useCalendarLiveRefresh(calendarIds: string[] = []) {
  const key = React.useId();

  const channelsKey = calendarIds.filter(Boolean).sort().join(',');
  const channels = React.useMemo(
    () => {
      const ids = channelsKey ? channelsKey.split(',') : [];
      return ids.length > 0 ? ids.map((id) => `calendar:${id}`) : [GLOBAL_CALENDAR_CHANNEL];
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
  React.useEffect(() => () => clearTimeout(timerRef.current), []);

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
    const payload = (data ?? null) as CalendarChangePayload | null;
    if (!payload) return;
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
