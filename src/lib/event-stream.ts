import { fetchEventSource } from '@microsoft/fetch-event-source';

export type EventHandler = (eventType: string, data: unknown) => void;

export function connectEventStream(userId: string, onEvent: EventHandler): () => void {
  const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_EVENT_PUSHER_KEY;

  if (!clientId || !apiKey) {
    console.warn('[event-stream] NEXT_PUBLIC_CLIENT_ID or NEXT_PUBLIC_EVENT_PUSHER_KEY not set — SSE disabled');
    return () => {};
  }

  const ctrl = new AbortController();

  fetchEventSource(
    `/events/stream?client_id=${clientId}&user_ids=${encodeURIComponent(userId)}`,
    {
      headers: { 'X-Api-Key': apiKey },
      signal: ctrl.signal,

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
      },
    },
  );

  return () => ctrl.abort();
}
