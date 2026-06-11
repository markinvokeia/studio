import { create } from 'zustand';
import type { Quote, QuoteItem, Invoice, InvoiceItem, CreditNote, Payment, DocPrintTemplate, FinancialSummaryReport, CajaSessionDetails } from '@/lib/types';

export type PrintDocumentType = 'quote' | 'invoice' | 'payment' | 'credit_note' | 'prepayment' | 'financial_summary' | 'caja_apertura' | 'caja_cierre' | 'caja_sesion';

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

export type CajaAperturaPrintData = {
  details: CajaSessionDetails;
};

export type CajaCierrePrintData = {
  details: CajaSessionDetails;
};

export type CajaSesionPrintData = {
  details: CajaSessionDetails;
};

export type PrintData =
  | QuotePrintData
  | InvoicePrintData
  | PaymentPrintData
  | CreditNotePrintData
  | PrepaymentPrintData
  | FinancialSummaryPrintData
  | CajaAperturaPrintData
  | CajaCierrePrintData
  | CajaSesionPrintData;

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
