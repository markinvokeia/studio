'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import type { QuotePrintData } from '@/stores/print-document-store';

interface QuotePrintTemplateProps {
  data: QuotePrintData;
}

function fmtAmount(amount: number | undefined, currency: string) {
  return `${currency} ${Number(amount ?? 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function QuotePrintTemplate({ data }: QuotePrintTemplateProps) {
  const t = useTranslations('PrintTemplates');
  const { quote, items, invoices } = data;

  const docNo = quote.doc_no || quote.quote_doc_no || quote.id;
  const currency = quote.currency || 'UYU';
  const total = Number(quote.total || 0);
  const amountInvoiced = Number(quote.amount_invoiced ?? 0);
  const pendingInvoice = Number(quote.amount_pending_invoice ?? Math.max(total - amountInvoiced, 0));
  const amountPaid = Number(quote.amount_paid ?? 0);
  const pendingPayment = Number(quote.amount_pending_payment ?? Math.max(amountInvoiced - amountPaid, 0));

  return (
    <div>
      {/* Document title */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">{t('quote')}</h1>
        <span className="text-sm text-gray-600 font-mono">#{docNo}</span>
      </div>

      {/* Header metadata */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-8 text-sm print-template-section">
        <div>
          <span className="text-gray-500">{t('patient')}: </span>
          <span className="font-medium">{quote.user_name || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('date')}: </span>
          <span className="font-medium">{formatDisplayDate(quote.createdAt)}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('status')}: </span>
          <span className="font-medium">
            {t(`quoteStatus.${quote.status}` as any) || quote.status}
          </span>
        </div>
        <div>
          <span className="text-gray-500">{t('paymentStatus')}: </span>
          <span className="font-medium">
            {t(`paymentStatusLabels.${quote.payment_status}` as any) || quote.payment_status}
          </span>
        </div>
        <div>
          <span className="text-gray-500">{t('currency')}: </span>
          <span className="font-medium">{currency}</span>
        </div>
      </div>

      {/* Services table */}
      <div className="mb-6 print-template-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('services')}</h2>
        <table className="print-template-table w-full">
          <thead>
            <tr>
              <th className="text-left w-8">#</th>
              <th className="text-left">{t('service')}</th>
              <th className="text-center w-16">{t('tooth')}</th>
              <th className="text-center w-16">{t('qty')}</th>
              <th className="text-right w-28">{t('unitPrice')}</th>
              <th className="text-right w-28">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-2">{t('noItems')}</td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td>{item.service_name}</td>
                  <td className="text-center">{item.tooth_number ?? '—'}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{fmtAmount(item.unit_price, currency)}</td>
                  <td className="text-right">{fmtAmount(item.total, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Financial summary */}
      <div className="flex justify-end mb-8 print-template-section">
        <table className="print-template-table w-72">
          <tbody>
            <tr className="font-bold border-b border-gray-300">
              <td>{t('total')}</td>
              <td className="text-right">{fmtAmount(total, currency)}</td>
            </tr>
            <tr>
              <td className="text-gray-600">{t('amountInvoiced')}</td>
              <td className="text-right">{fmtAmount(amountInvoiced, currency)}</td>
            </tr>
            <tr>
              <td className="text-gray-600">{t('pendingInvoice')}</td>
              <td className="text-right">{fmtAmount(pendingInvoice, currency)}</td>
            </tr>
            <tr>
              <td className="text-gray-600">{t('amountPaid')}</td>
              <td className="text-right">{fmtAmount(amountPaid, currency)}</td>
            </tr>
            <tr className="font-bold">
              <td>{t('pendingPayment')}</td>
              <td className="text-right">{fmtAmount(pendingPayment, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Invoices section */}
      {invoices.length > 0 && (
        <div className="print-template-section">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('invoices')}</h2>
          {invoices.map((invoice) => {
            const invDocNo = invoice.doc_no || invoice.invoice_doc_no || invoice.invoice_ref || invoice.id;
            const invCurrency = invoice.currency || currency;
            const invTotal = Number(invoice.total || 0);
            const invPaid = Number(invoice.paid_amount || 0);
            const invPending = Math.max(invTotal - invPaid, 0);
            const isCredit = invoice.type?.toLowerCase().includes('credit');

            return (
              <div key={invoice.id} className="mb-6 pl-3 border-l-2 border-gray-200">
                {/* Invoice sub-header */}
                <div className="flex items-baseline justify-between mb-2 text-sm">
                  <span className="font-semibold">
                    {isCredit ? t('credit_note') : t('invoice')} #{invDocNo}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatDisplayDate(invoice.createdAt)}
                    {invoice.due_date ? ` — ${t('dueDate')}: ${formatDisplayDate(invoice.due_date)}` : ''}
                  </span>
                </div>

                {/* Invoice status row */}
                <div className="flex gap-6 text-xs text-gray-500 mb-2">
                  <span>
                    {t('status')}: <span className="text-gray-800 font-medium">
                      {t(`invoiceStatus.${invoice.status}` as any) || invoice.status}
                    </span>
                  </span>
                  <span>
                    {t('paymentStatus')}: <span className="text-gray-800 font-medium">
                      {t(`paymentStatusLabels.${invoice.payment_status}` as any) || invoice.payment_status}
                    </span>
                  </span>
                </div>

                {/* Invoice items */}
                {invoice.items.length > 0 && (
                  <table className="print-template-table w-full mb-2">
                    <thead>
                      <tr>
                        <th className="text-left">{t('service')}</th>
                        <th className="text-center w-16">{t('qty')}</th>
                        <th className="text-right w-28">{t('unitPrice')}</th>
                        <th className="text-right w-28">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.service_name}</td>
                          <td className="text-center">{item.quantity}</td>
                          <td className="text-right">{fmtAmount(item.unit_price, invCurrency)}</td>
                          <td className="text-right">{fmtAmount(item.total, invCurrency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 text-xs text-gray-500">
                        <td colSpan={3} className="text-right">{t('total')}</td>
                        <td className="text-right font-semibold">{fmtAmount(invTotal, invCurrency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}

                {/* Invoice payments */}
                {invoice.payments.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">{t('payments')}</p>
                    <table className="print-template-table w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left">{t('docNo')}</th>
                          <th className="text-left">{t('paymentDate')}</th>
                          <th className="text-left">{t('paymentMethod')}</th>
                          <th className="text-right">{t('amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.payments.map((pay) => (
                          <tr key={pay.id}>
                            <td className="font-mono">{pay.doc_no || pay.payment_doc_no || pay.id}</td>
                            <td>{formatDisplayDate(pay.payment_date)}</td>
                            <td>{pay.payment_method || pay.method}</td>
                            <td className="text-right">
                              {fmtAmount(pay.amount_applied, pay.source_currency || invCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 text-xs font-medium">
                          <td colSpan={3} className="text-right">{t('amountPaid')}</td>
                          <td className="text-right">{fmtAmount(invPaid, invCurrency)}</td>
                        </tr>
                        <tr className="text-xs font-semibold">
                          <td colSpan={3} className="text-right">{t('pendingPayment')}</td>
                          <td className="text-right">{fmtAmount(invPending, invCurrency)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Notes */}
      {quote.notes && (
        <div className="mt-6 text-sm print-template-section">
          <p className="text-gray-500 font-medium mb-1">{t('notes')}</p>
          <p className="text-gray-700">{quote.notes}</p>
        </div>
      )}
    </div>
  );
}
