import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getClientId, getEventPusherKey } from '@/lib/runtime-config';

export type EventHandler = (eventType: string, data: unknown) => void;

const RETRY_DELAYS = [2000, 5000, 15000, 30000];

export function connectEventStream(userId: string, onEvent: EventHandler): () => void {
  const clientId = getClientId();
  const apiKey = getEventPusherKey();

  if (!clientId || !apiKey) {
    console.warn('[event-stream] NEXT_PUBLIC_CLIENT_ID or NEXT_PUBLIC_EVENT_PUSHER_KEY not set — SSE disabled');
    return () => { };
  }

  const ctrl = new AbortController();
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    fetchEventSource(
      `/events/stream?client_id=${clientId}&user_ids=${encodeURIComponent(userId)}`,
      {
        headers: { 'X-Api-Key': apiKey },
        signal: ctrl.signal,

        onopen: async (response) => {
          if (response.ok) {
            retryCount = 0;
          }
        },

        onmessage(ev) {
          if (ev.event === 'heartbeat') return;
          try {
            onEvent(ev.event, JSON.parse(ev.data));
          } catch {
            // data malformado — ignorar
          }
        },

        onerror(err) {
          console.error('[event-stream] error', err);
          // throw detiene el retry automático de fetchEventSource;
          // lo manejamos manualmente con backoff
          throw err;
        },
      },
    ).catch(() => {
      if (ctrl.signal.aborted) return;
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      retryCount++;
      console.warn(`[event-stream] reconnecting in ${delay}ms (attempt ${retryCount})`);
      retryTimer = setTimeout(() => {
        if (!ctrl.signal.aborted) connect();
      }, delay);
    });
  }

  connect();

  return () => {
    ctrl.abort();
    if (retryTimer) clearTimeout(retryTimer);
  };
}
