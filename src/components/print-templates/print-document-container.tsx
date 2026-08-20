'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePrintDocumentStore } from '@/stores/print-document-store';
import type {
  QuotePrintData,
  InvoicePrintData,
  PaymentPrintData,
  CreditNotePrintData,
  PrepaymentPrintData,
  FinancialSummaryPrintData,
  LedgerPrintData,
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
import { LedgerPrintTemplate } from './ledger-print-template';
import { CajaAperturaPrintTemplate } from './caja-apertura-print-template';
import { CajaCierrePrintTemplate } from './caja-cierre-print-template';
import { CajaSesionPrintTemplate } from './caja-sesion-print-template';
import { CustomTemplateRenderer } from './custom-template-renderer';

/**
 * Always in the DOM (rendered from the root layout).
 * Hidden on screen; only visible when the browser print dialog is active.
 *
 * - Custom templates (saved in DB): rendered directly — they include their
 *   own clinic header via {{tokens}}.
 * - React fallback templates: wrapped in PrintDocumentLayout which adds
 *   PrintReportHeader.
 */
export function PrintDocumentContainer() {
  const { isActive, type, data, customTemplates } = usePrintDocumentStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // When printing, add a class to <html> so CSS can hide the rest of the app.
  useEffect(() => {
    if (!isActive) return;
    document.documentElement.classList.add('printing-multipage');
    return () => document.documentElement.classList.remove('printing-multipage');
  }, [isActive]);

  if (!isActive || !data || !type || !mounted) return null;

  const customHtml = customTemplates[type];

  // Portal to <body> so the print CSS can `display:none` every *other* body child
  // and let only this document flow — otherwise the app layout behind it, though
  // hidden, still occupies its full height and prints as many blank pages.
  return createPortal(
    <div data-print-container className="hidden print:block w-full bg-white p-8">
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
          {type === 'ledger'            && <LedgerPrintTemplate            data={data as LedgerPrintData} />}
          {type === 'caja_apertura'     && <CajaAperturaPrintTemplate      data={data as CajaAperturaPrintData} />}
          {type === 'caja_cierre'       && <CajaCierrePrintTemplate        data={data as CajaCierrePrintData} />}
          {type === 'caja_sesion'       && <CajaSesionPrintTemplate        data={data as CajaSesionPrintData} />}
        </PrintDocumentLayout>
      )}
    </div>,
    document.body,
  );
}
