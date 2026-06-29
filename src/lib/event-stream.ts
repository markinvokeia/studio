import { getClientId, getEventPusherKey } from '@/lib/runtime-config';

export type EventHandler = (eventType: string, data: unknown) => void;

export function connectEventStream(userId: string, onEvent: EventHandler): () => void {
  const clientId = getClientId();
  const apiKey = getEventPusherKey();

  if (!clientId || !apiKey) {
    console.warn('[event-stream] NEXT_PUBLIC_CLIENT_ID or NEXT_PUBLIC_EVENT_PUSHER_KEY not set — SSE disabled');
    return () => { };
  }

  const url = `/events/stream?client_id=${encodeURIComponent(clientId)}&user_ids=${encodeURIComponent(userId)}&api_key=${encodeURIComponent(apiKey)}`;
  const es = new EventSource(url);

  es.onmessage = (ev) => {
    if (!ev.data) return;
    try {
      onEvent(ev.type || 'message', JSON.parse(ev.data));
    } catch {
      // data malformado — ignorar
    }
  };

  // Los eventos con tipo específico (ej: "reminder") no disparan onmessage,
  // hay que escucharlos por separado. Usamos un proxy genérico vía dispatchEvent.
  const originalAddEventListener = es.addEventListener.bind(es);
  const knownTypes = ['reminder', 'new_appointment', 'appointment_status_change', 'session_completed'];
  knownTypes.forEach((type) => {
    originalAddEventListener(type, (ev: Event) => {
      const msgEv = ev as MessageEvent;
      if (!msgEv.data) return;
      try {
        onEvent(type, JSON.parse(msgEv.data));
      } catch {
        // data malformado — ignorar
      }
    });
  });

  es.onerror = (err) => {
    console.error('[event-stream] error', err);
    // EventSource reconecta automáticamente con backoff del browser
  };

  return () => {
    es.close();
  };
}
