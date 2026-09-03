import { create } from 'zustand';
import type { Quote, QuoteItem, Invoice, InvoiceItem, CreditNote, Payment, DocPrintTemplate, FinancialSummaryReport, CajaSessionDetails, PatientSession } from '@/lib/types';
import type { LedgerRow } from '@/lib/patient-ledger';
import type {
  AllergyItem,
  FamilyHistoryItem,
  MedicationItem,
  PatientHabits,
  PersonalHistoryItem,
} from '@/hooks/useClinicHistory';
import type { ClinicHistoryPatientInfo } from '@/services/clinic-history-print-data';

export type PrintDocumentType = 'quote' | 'invoice' | 'payment' | 'credit_note' | 'prepayment' | 'financial_summary' | 'ledger' | 'caja_apertura' | 'caja_cierre' | 'caja_sesion' | 'clinic_history';

export type PrintInvoiceRow = Invoice & { items: InvoiceItem[]; payments: Payment[] };

export type QuotePrintData = {
  quote: Quote;
  items: QuoteItem[];
  invoices: PrintInvoiceRow[];
  isSales: boolean;
};

export type InvoicePrintData = {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
  creditNotes: CreditNote[];
  isSales: boolean;
};

export type PaymentPrintData = {
  payment: Payment;
  isSales: boolean;
};

export type CreditNotePrintData = {
  creditNote: CreditNote;
  items: InvoiceItem[];
  originalInvoice?: Invoice;
  isSales: boolean;
};

export type PrepaymentPrintData = {
  prepayment: Payment;
  isSales: boolean;
};

export type FinancialSummaryPrintData = {
  report: FinancialSummaryReport;
  dateRange?: { from?: string; to?: string };
};

/** The "Clásico" (unified) patient ledger, printed exactly as shown on screen — the
 *  same rows `buildPatientLedger` produces, grouped by currency. */
export type LedgerPrintData = {
  patientName?: string;
  rowsByCurrency: Record<string, LedgerRow[]>;
  /** Human-readable active period (e.g. "01/07/2026 – 31/07/2026"), shown in the print
   *  header so it's clear the table isn't the full historical account. */
  periodLabel?: string;
};

export type CajaAperturaPrintData = {
  details: CajaSessionDetails;
};

export type CajaCierrePrintData = {
  details: CajaSessionDetails;
};

export type CajaSesionPrintData = {
  details: CajaSessionDetails;
};

/** Full printable clinic history: patient demographics, anamnesis and every clinical session. */
export type ClinicHistoryPrintData = {
  patient: ClinicHistoryPatientInfo;
  personalHistory: PersonalHistoryItem[];
  familyHistory: FamilyHistoryItem[];
  allergies: AllergyItem[];
  medications: MedicationItem[];
  habits: PatientHabits | null;
  sessions: PatientSession[];
  /** ISO timestamp the document was generated at, shown in the header. */
  emittedAt: string;
};

export type PrintData =
  | QuotePrintData
  | InvoicePrintData
  | PaymentPrintData
  | CreditNotePrintData
  | PrepaymentPrintData
  | FinancialSummaryPrintData
  | LedgerPrintData
  | CajaAperturaPrintData
  | CajaCierrePrintData
  | CajaSesionPrintData
  | ClinicHistoryPrintData;

interface PrintDocumentStore {
  isActive: boolean;
  type: PrintDocumentType | null;
  data: PrintData | null;
  activate: (type: PrintDocumentType, data: PrintData) => void;
  deactivate: () => void;
  customTemplates: Partial<Record<PrintDocumentType, string>>;
  customTemplatesLoaded: boolean;
  setCustomTemplates: (templates: DocPrintTemplate[]) => void;
}

export const usePrintDocumentStore = create<PrintDocumentStore>((set) => ({
  isActive: false,
  type: null,
  data: null,
  activate: (type, data) => set({ isActive: true, type, data }),
  deactivate: () => set({ isActive: false, type: null, data: null }),
  customTemplates: {},
  customTemplatesLoaded: false,
  setCustomTemplates: (templates) =>
    set({
      customTemplatesLoaded: true,
      customTemplates: Object.fromEntries(
        templates.filter((t) => t.is_active).map((t) => [t.template_type, t.template_html]),
      ),
    }),
}));
