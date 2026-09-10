'use client';

import * as React from 'react';

import { useEventStreamSubscription, useRegisterEventChannels } from '@/context/event-stream-context';
import type { EventHandler } from '@/lib/event-stream';

/** Canal global de citas: recibe cambios de cualquier calendario. */
const GLOBAL_CALENDAR_CHANNEL = 'appointments';
/** Coalesce de ráfagas (varias mutaciones seguidas / varios usuarios). */
const REFRESH_DEBOUNCE_MS = 400;

/**
 * Escucha los eventos `calendar_changed` que publica el backend cuando otro
 * usuario crea, edita, reprograma, reasigna, cambia de estado o cancela una
 * cita, y dispara un refresco silencioso del calendario reutilizando el evento
 * DOM `clinic:calendar:refresh` (el mismo que ya consume `appointments/page.tsx`
 * y las acciones del panel de notificaciones).
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

  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  const onEvent = React.useCallback<EventHandler>((eventType, data) => {
    // El discriminador viaja tanto en el nombre del evento SSE como dentro del
    // payload (`event_type`), por si el servidor no propaga `ev.event`.
    const payloadType = (data as { event_type?: string } | null)?.event_type;
    if (eventType !== 'calendar_changed' && payloadType !== 'calendar_changed') return;

    // El backend publica en `["appointments", "calendar:<id>"]`, así que un evento
    // de otra agenda podría llegar por el canal global. Si se está mirando un
    // conjunto concreto de agendas, sólo se refresca cuando el cambio es de una
    // de ellas; si no trae `calendar_source_id` o no hay filtro, se refresca igual.
    const changedCalendarId = (data as { calendar_source_id?: string | number } | null)?.calendar_source_id;
    if (
      visibleIdsRef.current.size > 0 &&
      changedCalendarId != null &&
      !visibleIdsRef.current.has(String(changedCalendarId))
    ) {
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('clinic:calendar:refresh'));
      }
    }, REFRESH_DEBOUNCE_MS);
  }, []);
  useEventStreamSubscription(onEvent);
}
