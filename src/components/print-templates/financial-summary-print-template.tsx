'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import { buildMovementConcept } from '@/lib/financial-summary';
import type { FinancialSummaryPrintData } from '@/stores/print-document-store';

interface FinancialSummaryPrintTemplateProps {
  data: FinancialSummaryPrintData;
}

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${Math.abs(amount).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtBalance(balance: number, currency: string) {
  const sign = balance < 0 ? '−' : '';
  return `${sign}${currency} ${Math.abs(balance).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function FinancialSummaryPrintTemplate({ data }: FinancialSummaryPrintTemplateProps) {
  const t = useTranslations('PrintTemplates');
  const tStatement = useTranslations('AccountStatement');
  const { report, dateRange } = data;
  const currencies = Object.keys(report.history_by_currency).sort((a, b) =>
    a === 'UYU' ? -1 : b === 'UYU' ? 1 : a.localeCompare(b)
  );

  const dateFrom = report.report_start_date ?? dateRange?.from ?? null;
  const dateTo   = report.report_end_date   ?? dateRange?.to   ?? null;

  return (
    <div className="account-statement-print">
      {/* Document title — same title as the unified ledger print, so both
          "estado de cuenta" outputs read as one report regardless of finance_view. */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">{tStatement('title')}</h1>
        {(dateFrom || dateTo) && (
          <span className="text-base text-gray-500">
            {dateFrom ? formatDisplayDate(dateFrom) : '—'}
            {' '}{t('financialSummary.to')}{' '}
            {dateTo ? formatDisplayDate(dateTo) : '—'}
          </span>
        )}
      </div>

      {/* Patient info */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-8 text-base print-template-section">
        <div>
          <span className="text-gray-500">{t('patient')}: </span>
          <span className="font-medium">{report.name}</span>
        </div>
        {report.identity_document && (
          <div>
            <span className="text-gray-500">{t('financialSummary.id')}: </span>
            <span className="font-medium">{report.identity_document}</span>
          </div>
        )}
        {report.email && (
          <div>
            <span className="text-gray-500">{t('financialSummary.email')}: </span>
            <span className="font-medium">{report.email}</span>
          </div>
        )}
        {report.phone_number && (
          <div>
            <span className="text-gray-500">{t('financialSummary.phone')}: </span>
            <span className="font-medium">{report.phone_number}</span>
          </div>
        )}
      </div>

      {/* One section per currency */}
      {currencies.map((currency) => {
        const section = report.history_by_currency[currency];
        if (!section) return null;

        const totalCharged = section.movements
          .filter((mov) => mov.amount > 0)
          .reduce((sum, mov) => sum + mov.amount, 0);
        const totalPaid = section.movements
          .filter((mov) => mov.amount < 0)
          .reduce((sum, mov) => sum + Math.abs(mov.amount), 0);

        return (
          <div key={currency} className="mb-8">
            <h2 className="text-base font-semibold uppercase tracking-wide text-gray-600 mb-2">
              {t('currency')}: {currency}
            </h2>

            <div className="border border-gray-200 rounded">
              <table className="print-template-table w-full">
                <thead>
                  <tr>
                    <th className="text-left w-24">{t('date')}</th>
                    <th className="text-left w-36">{t('docNo')}</th>
                    <th className="text-left">{t('financialSummary.concept')}</th>
                    <th className="text-right w-28">{t('amount')}</th>
                    <th className="text-right w-28">{t('financialSummary.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {section.movements.map((mov, idx) => {
                    const isDebit = mov.amount > 0;
                    const concept = buildMovementConcept(mov, t('financialSummary.paysInvoice'));

                    return (
                      <tr key={`${currency}-${idx}`}>
                        <td className="whitespace-nowrap">{formatDisplayDate(mov.created_at)}</td>
                        <td className="font-mono text-xs">{mov.doc_no}</td>
                        <td>
                          {concept}
                          {mov.metadata.notes && (
                            <span className="text-gray-400"> · {mov.metadata.notes}</span>
                          )}
                        </td>
                        <td className={`text-right font-mono font-semibold ${isDebit ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isDebit ? '' : '−'}{fmtAmount(mov.amount, currency)}
                        </td>
                        <td className="text-right font-mono">
                          {fmtBalance(mov.running_balance, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals — same layout/labels as the unified ledger print, so both
                "estado de cuenta" reports look and read the same. */}
            <div className="ledger-print-totals" style={{ breakInside: 'avoid' }}>
              <div className="text-right">
                <div className="lbl">{tStatement('totalCharged')}</div>
                <div className="val">{fmtAmount(totalCharged, currency)}</div>
              </div>
              <div className="text-right">
                <div className="lbl">{tStatement('totalPaid')}</div>
                <div className="val">{fmtAmount(totalPaid, currency)}</div>
              </div>
              <div className="text-right">
                <div className="lbl">{tStatement('pendingBalance')}</div>
                <div
                  className="val"
                  style={{
                    color: section.final_balance > 0.005 ? '#dc2626' : section.final_balance < -0.005 ? '#059669' : '#111827',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                >
                  {fmtBalance(section.final_balance, currency)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
