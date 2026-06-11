'use client';

import { useEffect } from 'react';
import { usePrintDocumentStore } from '@/stores/print-document-store';
import type {
  QuotePrintData,
  InvoicePrintData,
  PaymentPrintData,
  CreditNotePrintData,
  PrepaymentPrintData,
  FinancialSummaryPrintData,
  CajaAperturaPrintData,
  CajaCierrePrintData,
  CajaSesionPrintData,
} from '@/stores/print-document-store';
import { PrintDocumentLayout } from './print-document-layout';
import { QuotePrintTemplate } from './quote-print-template';
import { InvoicePrintTemplate } from './invoice-print-template';
import { PaymentPrintTemplate } from './payment-print-template';
import { CreditNotePrintTemplate } from './credit-note-print-template';
import { PrepaymentPrintTemplate } from './prepayment-print-template';
import { FinancialSummaryPrintTemplate } from './financial-summary-print-template';
import { CajaAperturaPrintTemplate } from './caja-apertura-print-template';
import { CajaCierrePrintTemplate } from './caja-cierre-print-template';
import { CajaSesionPrintTemplate } from './caja-sesion-print-template';
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

  // All documents must not use `fixed inset-0` because that clips content
  // to a single viewport-sized box. The printing-multipage CSS class handles
  // background isolation instead.
  const isMultiPage = isActive;

  // When printing multi-page, add a class to <html> so CSS can hide the rest
  // of the app and avoid the gray-shadow effect.
  useEffect(() => {
    if (!isMultiPage) return;
    document.documentElement.classList.add('printing-multipage');
    return () => document.documentElement.classList.remove('printing-multipage');
  }, [isMultiPage]);

  if (!isActive || !data || !type) return null;

  const customHtml = customTemplates[type];

  return (
    <div
      data-print-container
      className={`hidden print:block bg-white z-[9999] p-8${isMultiPage ? ' w-full' : ' fixed inset-0'}`}
    >
      {customHtml ? (
        <CustomTemplateRenderer html={customHtml} data={data} type={type} />
      ) : (
        <PrintDocumentLayout>
          {type === 'quote'             && <QuotePrintTemplate             data={data as QuotePrintData} />}
          {type === 'invoice'           && <InvoicePrintTemplate           data={data as InvoicePrintData} />}
          {type === 'payment'           && <PaymentPrintTemplate           data={data as PaymentPrintData} />}
          {type === 'credit_note'       && <CreditNotePrintTemplate        data={data as CreditNotePrintData} />}
          {type === 'prepayment'        && <PrepaymentPrintTemplate        data={data as PrepaymentPrintData} />}
          {type === 'financial_summary' && <FinancialSummaryPrintTemplate  data={data as FinancialSummaryPrintData} />}
          {type === 'caja_apertura'     && <CajaAperturaPrintTemplate      data={data as CajaAperturaPrintData} />}
          {type === 'caja_cierre'       && <CajaCierrePrintTemplate        data={data as CajaCierrePrintData} />}
          {type === 'caja_sesion'       && <CajaSesionPrintTemplate        data={data as CajaSesionPrintData} />}
        </PrintDocumentLayout>
      )}
    </div>
  );
}
