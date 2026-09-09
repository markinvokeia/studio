'use client';

import * as React from 'react';

import { useAuth } from '@/context/AuthContext';
import { usePatientPortal } from '@/hooks/usePatientPortal';
import { connectEventStream, type EventHandler } from '@/lib/event-stream';

interface EventStreamContextValue {
  /** Registra un handler para TODOS los eventos SSE entrantes. Devuelve la función de baja. */
  subscribe: (handler: EventHandler) => () => void;
  /** Suma/actualiza el set de canales de una clave. La unión de todas las claves define los `channels` del stream. */
  registerChannels: (key: string, channels: string[]) => void;
  /** Quita el set de canales de una clave. */
  unregisterChannels: (key: string) => void;
}

const EventStreamContext = React.createContext<EventStreamContextValue | null>(null);

/**
 * Única conexión SSE del dashboard.
 *
 * Antes cada consumidor abría su propio `connectEventStream` (sólo lo hacía
 * `notifications-context`). Centralizarlo acá evita multiplicar `EventSource`
 * (el navegador corta a ~6 por dominio) y permite que varias pantallas
 * —notificaciones, calendario en vivo— compartan un mismo stream.
 *
 * - `subscribe(handler)` recibe todos los eventos; el set de handlers puede
 *   cambiar sin reconectar.
 * - `registerChannels(key, [...])` suma canales; la conexión sólo se reabre
 *   cuando cambia la unión de canales o el usuario.
 */
export function EventStreamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isPatientOnly } = usePatientPortal();
  // Mismo criterio que notifications-context: un paciente "puro" no se suscribe a nada.
  const userId = user?.id && !isPatientOnly ? String(user.id) : null;

  const handlersRef = React.useRef<Set<EventHandler>>(new Set());
  const channelMapRef = React.useRef<Map<string, string[]>>(new Map());
  const [channelsKey, setChannelsKey] = React.useState('');

  const recomputeChannels = React.useCallback(() => {
    const union = new Set<string>();
    for (const list of channelMapRef.current.values()) {
      for (const channel of list) if (channel) union.add(channel);
    }
    const next = [...union].sort().join(',');
    setChannelsKey((prev) => (prev === next ? prev : next));
  }, []);

  const registerChannels = React.useCallback((key: string, channels: string[]) => {
    channelMapRef.current.set(key, channels);
    recomputeChannels();
  }, [recomputeChannels]);

  const unregisterChannels = React.useCallback((key: string) => {
    if (channelMapRef.current.delete(key)) recomputeChannels();
  }, [recomputeChannels]);

  const subscribe = React.useCallback((handler: EventHandler) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  const dispatch = React.useCallback<EventHandler>((eventType, data) => {
    handlersRef.current.forEach((handler) => {
      try {
        handler(eventType, data);
      } catch (err) {
        console.error('[event-stream] handler error', err);
      }
    });
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    const channels = channelsKey ? channelsKey.split(',') : [];
    return connectEventStream(userId, dispatch, channels);
  }, [userId, channelsKey, dispatch]);

  const value = React.useMemo<EventStreamContextValue>(
    () => ({ subscribe, registerChannels, unregisterChannels }),
    [subscribe, registerChannels, unregisterChannels],
  );

  return <EventStreamContext.Provider value={value}>{children}</EventStreamContext.Provider>;
}

function useEventStreamContext(): EventStreamContextValue {
  const ctx = React.useContext(EventStreamContext);
  if (!ctx) {
    throw new Error('useEventStreamSubscription / useRegisterEventChannels must be used within <EventStreamProvider>');
  }
  return ctx;
}

/**
 * Suscribe un handler a todos los eventos SSE mientras el componente esté montado.
 * El handler debe ser estable (envolver en `useCallback`).
 */
export function useEventStreamSubscription(handler: EventHandler) {
  const { subscribe } = useEventStreamContext();
  React.useEffect(() => subscribe(handler), [subscribe, handler]);
}

/**
 * Suma un set de canales a la suscripción del stream mientras el componente esté
 * montado. `key` debe ser único por instancia (usar `React.useId()`).
 */
export function useRegisterEventChannels(key: string, channels: string[]) {
  const { registerChannels, unregisterChannels } = useEventStreamContext();
  const channelsKey = channels.join(',');
  React.useEffect(() => {
    registerChannels(key, channelsKey ? channelsKey.split(',') : []);
    return () => unregisterChannels(key);
  }, [key, channelsKey, registerChannels, unregisterChannels]);
}
