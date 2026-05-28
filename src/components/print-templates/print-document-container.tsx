'use client';

import { usePrintDocumentStore } from '@/stores/print-document-store';
import type {
  QuotePrintData,
  InvoicePrintData,
  PaymentPrintData,
  CreditNotePrintData,
  PrepaymentPrintData,
} from '@/stores/print-document-store';
import { PrintDocumentLayout } from './print-document-layout';
import { QuotePrintTemplate } from './quote-print-template';
import { InvoicePrintTemplate } from './invoice-print-template';
import { PaymentPrintTemplate } from './payment-print-template';
import { CreditNotePrintTemplate } from './credit-note-print-template';
import { PrepaymentPrintTemplate } from './prepayment-print-template';
import { CustomTemplateRenderer } from './custom-template-renderer';

/**
 * Always in the DOM (rendered from the root layout).
 * Hidden on screen; only visible when the browser print dialog is active.
 *
 * - Custom templates (saved in DB): rendered directly — they include their
 *   own clinic header + InvokeIA footer via {{tokens}}.
 * - React fallback templates: wrapped in PrintDocumentLayout which adds
 *   PrintReportHeader + PrintReportFooter.
 */
export function PrintDocumentContainer() {
  const { isActive, type, data, customTemplates } = usePrintDocumentStore();

  if (!isActive || !data || !type) return null;

  const customHtml = customTemplates[type];

  return (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8">
      {customHtml ? (
        <CustomTemplateRenderer html={customHtml} data={data} type={type} />
      ) : (
        <PrintDocumentLayout>
          {type === 'quote'       && <QuotePrintTemplate       data={data as QuotePrintData} />}
          {type === 'invoice'     && <InvoicePrintTemplate     data={data as InvoicePrintData} />}
          {type === 'payment'     && <PaymentPrintTemplate     data={data as PaymentPrintData} />}
          {type === 'credit_note' && <CreditNotePrintTemplate  data={data as CreditNotePrintData} />}
          {type === 'prepayment'  && <PrepaymentPrintTemplate  data={data as PrepaymentPrintData} />}
        </PrintDocumentLayout>
      )}
    </div>
  );
}
