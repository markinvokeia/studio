'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import { computeInvoiceTotals } from '@/components/print-templates/invoice-totals';
import type { InvoicePrintData } from '@/stores/print-document-store';

interface InvoicePrintTemplateProps {
  data: InvoicePrintData;
}

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function InvoicePrintTemplate({ data }: InvoicePrintTemplateProps) {
  const t = useTranslations('PrintTemplates');
  const { invoice, items, payments } = data;

  const docNo = invoice.doc_no || invoice.invoice_doc_no || invoice.invoice_ref || invoice.id;
  const currency = invoice.currency || 'UYU';
  const { total, paid, pending, paymentStatus } = computeInvoiceTotals(invoice, payments);

  const isCredit = invoice.type?.toLowerCase().includes('credit');

  return (
    <div>
      {/* Document title */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">
          {isCredit ? t('credit_note') : t('invoice')}
        </h1>
        <span className="text-sm text-gray-600 font-mono">#{docNo}</span>
      </div>

      {/* Header metadata */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-8 text-sm print-template-section">
        <div>
          <span className="text-gray-500">{t('patient')}: </span>
          <span className="font-medium">{invoice.user_name || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('date')}: </span>
          <span className="font-medium">{formatDisplayDate(invoice.createdAt)}</span>
        </div>
        {invoice.due_date && (
          <div>
            <span className="text-gray-500">{t('dueDate')}: </span>
            <span className="font-medium">{formatDisplayDate(invoice.due_date)}</span>
          </div>
        )}
        <div>
          <span className="text-gray-500">{t('status')}: </span>
          <span className="font-medium">
            {t(`invoiceStatus.${invoice.status}` as any) || invoice.status}
          </span>
        </div>
        <div>
          <span className="text-gray-500">{t('paymentStatus')}: </span>
          <span className="font-medium">
            {t(`paymentStatusLabels.${paymentStatus}` as any) || paymentStatus}
          </span>
        </div>
        <div>
          <span className="text-gray-500">{t('currency')}: </span>
          <span className="font-medium">{currency}</span>
        </div>
        {invoice.quote_doc_no && (
          <div>
            <span className="text-gray-500">{t('reference')}: </span>
            <span className="font-medium">{invoice.quote_doc_no}</span>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="mb-6 print-template-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('services')}</h2>
        <table className="print-template-table w-full">
          <thead>
            <tr>
              <th className="text-left w-8">#</th>
              <th className="text-left">{t('service')}</th>
              <th className="text-center w-16">{t('qty')}</th>
              <th className="text-right w-28">{t('unitPrice')}</th>
              <th className="text-right w-28">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-2">{t('noItems')}</td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td>{item.service_name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{fmtAmount(item.unit_price, currency)}</td>
                  <td className="text-right">{fmtAmount(item.total, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totals summary */}
      <div className="flex justify-end mb-8 print-template-section">
        <table className="print-template-table w-64">
          <tbody>
            <tr>
              <td className="text-gray-600">{t('subtotal')}</td>
              <td className="text-right font-medium">{fmtAmount(total, currency)}</td>
            </tr>
            <tr>
              <td className="text-gray-600">{t('amountPaid')}</td>
              <td className="text-right font-medium">{fmtAmount(paid, currency)}</td>
            </tr>
            <tr className="border-t border-gray-300 font-bold">
              <td>{t('pendingPayment')}</td>
              <td className="text-right">{fmtAmount(pending, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payments section */}
      <div className="print-template-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('payments')}</h2>
        <table className="print-template-table w-full">
          <thead>
            <tr>
              <th className="text-left">{t('docNo')}</th>
              <th className="text-left">{t('paymentDate')}</th>
              <th className="text-left">{t('paymentMethod')}</th>
              <th className="text-right">{t('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-2">{t('noPayments')}</td>
              </tr>
            ) : (
              payments.map((pay) => (
                <tr key={pay.id}>
                  <td className="font-mono text-xs">{pay.doc_no || pay.payment_doc_no || pay.id}</td>
                  <td>{formatDisplayDate(pay.payment_date)}</td>
                  <td>{pay.payment_method || pay.method}</td>
                  <td className="text-right">
                    {fmtAmount(pay.amount_applied, pay.source_currency || currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-6 text-sm print-template-section">
          <p className="text-gray-500 font-medium mb-1">{t('notes')}</p>
          <p className="text-gray-700">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
