import { useEffect } from 'react';

import { connectEventStream, type EventHandler } from '@/lib/event-stream';

export function useEventStream(userId: string | null, onEvent: EventHandler) {
  useEffect(() => {
    if (!userId) return;
    return connectEventStream(userId, onEvent);
    // onEvent is intentionally omitted: the SSE connection must not reconnect on every render.
    // Callers are responsible for passing a stable reference (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
