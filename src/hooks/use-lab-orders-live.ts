'use client';

import * as React from 'react';

import { useEventStreamSubscription, useRegisterEventChannels } from '@/context/event-stream-context';
import type { EventHandler } from '@/lib/event-stream';

/** Canal en el que el flujo "Lab Orders" publica los cambios de órdenes y de etapas. */
export const LAB_ORDERS_CHANNEL = 'lab_orders';

export const LAB_ORDER_EVENTS = ['lab_order_changed', 'lab_stages_changed'] as const;

/** Junta ráfagas (varios usuarios moviendo a la vez, el eco del propio cambio) en una sola recarga. */
const DEBOUNCE_MS = 400;

/**
 * Llama a `onChange` cuando otro usuario (o el propio, por eco) crea, edita, mueve o elimina
 * una orden de laboratorio, o cambia la configuración de etapas. Quien lo usa recarga lo que
 * muestra; `stagesChanged` dice si además cambiaron las columnas.
 */
export function useLabOrdersLive(onChange: (info: { stagesChanged: boolean }) => void) {
  const key = React.useId();
  useRegisterEventChannels(key, [LAB_ORDERS_CHANNEL]);

  const onChangeRef = React.useRef(onChange);
  React.useLayoutEffect(() => { onChangeRef.current = onChange; });

  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const stagesChangedRef = React.useRef(false);
  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  const handler = React.useCallback<EventHandler>((eventType, data) => {
    const type = eventType && eventType !== 'message'
      ? eventType
      : (data as { event_type?: string } | null)?.event_type;
    if (type !== 'lab_order_changed' && type !== 'lab_stages_changed') return;
    if (type === 'lab_stages_changed') stagesChangedRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const stagesChanged = stagesChangedRef.current;
      stagesChangedRef.current = false;
      onChangeRef.current({ stagesChanged });
    }, DEBOUNCE_MS);
  }, []);
  useEventStreamSubscription(handler);
}
