'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import type { PaymentPrintData } from '@/stores/print-document-store';

interface PaymentPrintTemplateProps {
  data: PaymentPrintData;
}

export function PaymentPrintTemplate({ data }: PaymentPrintTemplateProps) {
  const t = useTranslations('PrintTemplates');
  const { payment } = data;

  const docNo = payment.doc_no || payment.payment_doc_no || payment.id;
  const currency = payment.source_currency || payment.currency || 'UYU';

  return (
    <div>
      {/* Document title */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">{t('payment')}</h1>
        <span className="text-sm text-gray-600 font-mono">#{docNo}</span>
      </div>

      {/* Header metadata */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-8 text-sm print-template-section">
        <div>
          <span className="text-gray-500">{t('patient')}: </span>
          <span className="font-medium">{payment.user_name || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('date')}: </span>
          <span className="font-medium">{formatDisplayDate(payment.payment_date)}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('paymentMethod')}: </span>
          <span className="font-medium">{payment.payment_method || payment.method || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('status')}: </span>
          <span className="font-medium">
            {t(`transactionType.${payment.transaction_type}` as any) || payment.transaction_type}
          </span>
        </div>
        {payment.invoice_doc_no && (
          <div>
            <span className="text-gray-500">{t('reference')}: </span>
            <span className="font-medium">{payment.invoice_doc_no}</span>
          </div>
        )}
        {payment.exchange_rate && payment.exchange_rate !== 1 && (
          <div>
            <span className="text-gray-500">{t('exchangeRate')}: </span>
            <span className="font-medium">{payment.exchange_rate}</span>
          </div>
        )}
      </div>

      {/* Amount block */}
      <div className="border border-gray-200 rounded mb-6 print-template-section">
        <table className="print-template-table w-full">
          <thead>
            <tr>
              <th className="text-left">{t('amount')}</th>
              <th className="text-center">{t('currency')}</th>
              <th className="text-right">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{payment.payment_method || payment.method || '—'}</td>
              <td className="text-center">{currency}</td>
              <td className="text-right font-semibold">
                {currency} {Number(payment.source_amount || payment.amount_applied || 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {payment.notes && (
        <div className="mt-4 text-sm print-template-section">
          <p className="text-gray-500 font-medium mb-1">{t('notes')}</p>
          <p className="text-gray-700">{payment.notes}</p>
        </div>
      )}
    </div>
  );
}
