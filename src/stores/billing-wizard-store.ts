import * as React from 'react';
import { create } from 'zustand';
import type { Invoice, Quote } from '@/lib/types';

export type BillingTriggerContext = {
  quoteId?: string;
  invoiceId?: string;
  appointmentId?: string;
  appointmentDate?: string; // 'yyyy-MM-dd' — optional, narrows the fetch window
  sessionId?: string;
  sessionType?: 'clinica' | 'odontograma';
  patientId?: string;
  patientName?: string;
  isSales?: boolean;
  currency?: string;
  // Optional pre-loaded objects (skip extra fetches when caller already has them)
  quote?: Quote;
  invoice?: Invoice;
  /**
   * Runs right after the wizard creates an invoice, before the payment step, and the wizard waits
   * for it. For a caller that keeps its own link to the invoice; it handles its own errors.
   */
  onInvoiceCreated?: (invoiceId: string) => Promise<void>;
  preloadedItems?: Array<{
    tempId: string;
    service_id: string;
    service_name: string;
    unit_price: number;
    quantity: number;
    total: number;
  }>;
};

type BillingWizardStore = {
  isOpen: boolean;
  context: BillingTriggerContext | null;
  onSuccess?: () => void;
  open: (ctx: BillingTriggerContext, onSuccess?: () => void) => void;
  close: () => void;
  /**
   * Last invoice/payment the wizard saved, whoever opened it. `seq` grows on every change;
   * `patientId` is null when the patient isn't known (every listener refreshes then).
   */
  lastChange: { seq: number; patientId: string | null };
  notifyChange: (patientId: string | null) => void;
};

export const useBillingWizard = create<BillingWizardStore>((set) => ({
  isOpen: false,
  context: null,
  onSuccess: undefined,
  // Deferred: `open` is often called from a ContextMenuItem's onSelect. Radix's
  // menu and this dialog both lock document.body's pointer-events while
  // open/closing; opening the wizard in the same tick the menu starts its
  // (animated) unmount races that lock and can leave the dialog unclosable.
  // Letting the menu finish unwinding first (next tick) avoids the overlap.
  open: (ctx, onSuccess) =>
    setTimeout(() => set({ isOpen: true, context: { isSales: true, ...ctx }, onSuccess }), 0),
  close: () => set({ isOpen: false, context: null, onSuccess: undefined }),
  lastChange: { seq: 0, patientId: null },
  notifyChange: (patientId) =>
    set((state) => ({ lastChange: { seq: state.lastChange.seq + 1, patientId } })),
}));

/**
 * Grows each time the billing wizard saves an invoice or payment for `userId` (or for an
 * unknown patient). Add it to a view's refresh trigger so a patient's finances update after
 * a Cobro rápido opened from anywhere (header, patient actions menu…), not only from callers
 * that pass their own `onSuccess`.
 */
export function useBillingChangeVersion(userId?: string | null): number {
  const lastChange = useBillingWizard((s) => s.lastChange);
  const seenSeqRef = React.useRef(lastChange.seq);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    if (lastChange.seq === seenSeqRef.current) return;
    seenSeqRef.current = lastChange.seq;
    if (!lastChange.patientId || !userId || lastChange.patientId === userId) {
      setVersion((v) => v + 1);
    }
  }, [lastChange, userId]);
  return version;
}
