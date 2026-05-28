'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import type { CreditNotePrintData } from '@/stores/print-document-store';

interface CreditNotePrintTemplateProps {
  data: CreditNotePrintData;
}

export function CreditNotePrintTemplate({ data }: CreditNotePrintTemplateProps) {
  const t = useTranslations('PrintTemplates');
  const { creditNote, items, originalInvoice } = data;

  const docNo = creditNote.doc_no || creditNote.invoice_doc_no || creditNote.id;
  const currency = creditNote.currency || 'UYU';
  const total = Number(creditNote.total || 0);

  return (
    <div>
      {/* Document title */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">{t('credit_note')}</h1>
        <span className="text-sm text-gray-600 font-mono">#{docNo}</span>
      </div>

      {/* Header metadata */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-8 text-sm print-template-section">
        <div>
          <span className="text-gray-500">{t('patient')}: </span>
          <span className="font-medium">{creditNote.user_name || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('date')}: </span>
          <span className="font-medium">{formatDisplayDate(creditNote.createdAt)}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('currency')}: </span>
          <span className="font-medium">{currency}</span>
        </div>
        {originalInvoice && (
          <div>
            <span className="text-gray-500">{t('originalInvoice')}: </span>
            <span className="font-medium">
              {originalInvoice.doc_no || originalInvoice.invoice_doc_no || originalInvoice.invoice_ref}
            </span>
          </div>
        )}
        {creditNote.quote_doc_no && (
          <div>
            <span className="text-gray-500">{t('reference')}: </span>
            <span className="font-medium">{creditNote.quote_doc_no}</span>
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
              <th className="text-right w-24">{t('unitPrice')}</th>
              <th className="text-right w-24">{t('total')}</th>
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
                  <td className="text-right">
                    {currency} {Number(item.unit_price).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right">
                    {currency} {Number(item.total).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td colSpan={4} className="text-right font-bold">{t('creditedAmount')}</td>
              <td className="text-right font-bold">
                {currency} {total.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {creditNote.notes && (
        <div className="mt-4 text-sm print-template-section">
          <p className="text-gray-500 font-medium mb-1">{t('notes')}</p>
          <p className="text-gray-700">{creditNote.notes}</p>
        </div>
      )}
    </div>
  );
}
