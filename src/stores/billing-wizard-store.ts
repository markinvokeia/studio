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
};

export const useBillingWizard = create<BillingWizardStore>((set) => ({
  isOpen: false,
  context: null,
  onSuccess: undefined,
  open: (ctx, onSuccess) =>
    set({ isOpen: true, context: { isSales: true, ...ctx }, onSuccess }),
  close: () => set({ isOpen: false, context: null, onSuccess: undefined }),
}));
