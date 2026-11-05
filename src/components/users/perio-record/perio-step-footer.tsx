'use client';

import React from 'react';
import { createPortal } from 'react-dom';

// The sheet keeps one bar at the bottom, outside the scroll; each step puts its navigation there,
// so "back" and the main action are always in the same place whatever the step's length.

export const PerioFooterSlotContext = React.createContext<HTMLElement | null>(null);

export function PerioStepFooter({ children }: { children: React.ReactNode }) {
  const slot = React.useContext(PerioFooterSlotContext);
  if (!slot) return null;
  return createPortal(<div className="flex flex-wrap items-center gap-x-3 gap-y-2">{children}</div>, slot);
}

/** Space between what the step says (left) and its buttons (right) */
export const FooterSpacer = () => <span className="flex-1" aria-hidden />;
