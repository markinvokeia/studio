import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getClientId, getEventPusherKey } from '@/lib/runtime-config';

export type EventHandler = (eventType: string, data: unknown) => void;

const RETRY_DELAYS = [2_000, 5_000, 15_000, 30_000];

export function connectEventStream(userId: string, onEvent: EventHandler, channels: string[] = []): () => void {
  const clientId = getClientId();
  const apiKey = getEventPusherKey();

  if (!clientId || !apiKey) {
    console.warn('[event-stream] NEXT_PUBLIC_CLIENT_ID or NEXT_PUBLIC_EVENT_PUSHER_KEY not set — SSE disabled');
    return () => {};
  }

  const ctrl = new AbortController();
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const channelsParam = channels.map((channel) => `&channels=${encodeURIComponent(channel)}`).join('');

  function connect() {
    fetchEventSource(
      `/events/stream?client_id=${encodeURIComponent(clientId)}&user_ids=${encodeURIComponent(userId)}${channelsParam}`,
      {
        headers: { 'X-Api-Key': apiKey },
        signal: ctrl.signal,
        openWhenHidden: true,

        onopen: async (response) => {
          if (!response.ok || !response.headers.get('content-type')?.startsWith('text/event-stream')) {
            throw new Error(`[event-stream] unexpected open response: ${response.status}`);
          }
          retryCount = 0;
        },

        onmessage(ev) {
          if (ev.event === 'heartbeat' || !ev.data) return;
          try {
            onEvent(ev.event || 'message', JSON.parse(ev.data));
          } catch {
            // data malformado — ignorar
          }
        },

        onerror(err) {
          console.error('[event-stream] error', err);
          // Lanzar detiene el retry automático de fetchEventSource;
          // manejamos reconexión manualmente con backoff exponencial.
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
