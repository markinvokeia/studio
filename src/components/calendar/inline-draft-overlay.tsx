'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders the inline appointment-creation card centered on the screen (via a
 * portal to `document.body`) with a light backdrop. Centering avoids the card
 * being clipped when a slot near the bottom of the viewport is clicked. The
 * backdrop absorbs clicks so the calendar behind can't be interacted with while
 * the draft is open (closing is handled by the card's actions / Esc).
 */
export function CalendarInlineDraftOverlay({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
      <div
        className="w-[340px] max-w-[calc(100vw-2rem)]"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
