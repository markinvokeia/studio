'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import type { PrepaymentPrintData } from '@/stores/print-document-store';

interface PrepaymentPrintTemplateProps {
  data: PrepaymentPrintData;
}

export function PrepaymentPrintTemplate({ data }: PrepaymentPrintTemplateProps) {
  const t = useTranslations('PrintTemplates');
  const { prepayment } = data;

  const docNo = prepayment.doc_no || prepayment.payment_doc_no || prepayment.id;
  const currency = prepayment.source_currency || prepayment.currency || 'UYU';
  const amount = Number(prepayment.source_amount || prepayment.amount_applied || 0);

  return (
    <div>
      {/* Document title */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">{t('prepayment')}</h1>
        <span className="text-sm text-gray-600 font-mono">#{docNo}</span>
      </div>

      {/* Header metadata */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-8 text-sm print-template-section">
        <div>
          <span className="text-gray-500">{t('patient')}: </span>
          <span className="font-medium">{prepayment.user_name || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('date')}: </span>
          <span className="font-medium">{formatDisplayDate(prepayment.payment_date)}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('paymentMethod')}: </span>
          <span className="font-medium">{prepayment.payment_method || prepayment.method || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('currency')}: </span>
          <span className="font-medium">{currency}</span>
        </div>
        {prepayment.exchange_rate && prepayment.exchange_rate !== 1 && (
          <div>
            <span className="text-gray-500">{t('exchangeRate')}: </span>
            <span className="font-medium">{prepayment.exchange_rate}</span>
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
              <td>{prepayment.payment_method || prepayment.method || '—'}</td>
              <td className="text-center">{currency}</td>
              <td className="text-right font-semibold">
                {currency} {amount.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300">
              <td colSpan={2} className="text-right font-semibold">{t('total')}</td>
              <td className="text-right font-bold">
                {currency} {amount.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Available as credit note */}
      <div className="mt-4 p-3 border border-gray-200 rounded text-sm text-gray-600 print-template-section">
        {t('availableCredit')}
      </div>

      {/* Notes */}
      {prepayment.notes && (
        <div className="mt-4 text-sm print-template-section">
          <p className="text-gray-500 font-medium mb-1">{t('notes')}</p>
          <p className="text-gray-700">{prepayment.notes}</p>
        </div>
      )}
    </div>
  );
}
