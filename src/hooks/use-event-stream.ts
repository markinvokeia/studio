import { useEffect } from 'react';

import { connectEventStream, type EventHandler } from '@/lib/event-stream';

export function useEventStream(userId: string | null, onEvent: EventHandler, channels: string[] = []) {
  useEffect(() => {
    if (!userId) return;
    return connectEventStream(userId, onEvent, channels);
    // onEvent is intentionally omitted: the SSE connection must not reconnect on every render.
    // Callers are responsible for passing a stable reference (useCallback).
    // channels is joined to a stable string below so array identity churn doesn't reconnect the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, channels.join(',')]);
}
