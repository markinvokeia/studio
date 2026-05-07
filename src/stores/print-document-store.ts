import { create } from 'zustand';
import type { Quote, QuoteItem, Invoice, InvoiceItem, CreditNote, Payment, DocPrintTemplate, FinancialSummaryReport, CajaSessionDetails, PayrollPeriod, PayrollEntry } from '@/lib/types';

export type PrintDocumentType = 'quote' | 'invoice' | 'payment' | 'credit_note' | 'prepayment' | 'financial_summary' | 'caja_apertura' | 'caja_cierre' | 'caja_sesion' | 'payroll_period' | 'payroll_receipt' | 'payroll_report';

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

export type PayrollPeriodPrintData = {
  period: PayrollPeriod;
  entries: PayrollEntry[];
};

export type PayrollReceiptPrintData = {
  period: PayrollPeriod;
  entries: PayrollEntry[];
};

/** Generic tabular report (used to print any data report as PDF). */
export type PayrollReportPrintData = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
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
  | CajaSesionPrintData
  | PayrollPeriodPrintData
  | PayrollReceiptPrintData
  | PayrollReportPrintData;

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
