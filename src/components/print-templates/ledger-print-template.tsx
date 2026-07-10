'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import type { LedgerRow } from '@/lib/patient-ledger';
import type { LedgerPrintData } from '@/stores/print-document-store';

interface LedgerPrintTemplateProps {
  data: LedgerPrintData;
}

// ── Formatting helpers (mirror the on-screen ledger in patient-ledger.tsx) ───────

function currencySymbol(currency: string): string {
  if (currency === 'UYU') return '$';
  if (currency === 'USD') return 'U$';
  return currency;
}

function money(amount: number): string {
  return (amount || 0).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Always shows a number (0 → "$0,00") — used for Debe/Haber. */
function fmtZero(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${money(amount)}`;
}

/** Dash for zero — used for the running/final balance. */
function fmtDash(amount: number, currency: string): string {
  return amount ? `${currencySymbol(currency)}${money(amount)}` : '—';
}

function statusLabel(row: LedgerRow, t: (key: string) => string): string {
  if (row.kind === 'balance') return '';
  if (row.kind === 'payment') return t('status.pago');
  if (row.status === 'notaCredito') return t('status.notaCredito');
  if (row.status === 'presupuestado') return t('statusControl.presupuesto');
  if (row.status === 'pagado') return t('statusControl.finalizado');
  return t('statusControl.enCurso');
}

function docNumbersLabel(row: LedgerRow, t: (key: string) => string): string | null {
  if (row.kind === 'balance') return null;
  if (row.kind === 'payment') return row.docNo ? `${t('docLine.payment')}: ${row.docNo}` : null;
  if (row.status === 'notaCredito') return row.docNo ? `${t('docLine.creditNote')}: ${row.docNo}` : null;
  if (row.status === 'presupuestado') return row.docNo ? `${t('docLine.quote')}: ${row.docNo}` : null;
  if (row.quoteDocNo) return `${t('docLine.quote')}: ${row.quoteDocNo} | ${t('docLine.treatment')}: ${row.docNo || '—'}`;
  return row.docNo ? `${t('docLine.treatment')}: ${row.docNo}` : null;
}

/** Light row tint matching the on-screen colour coding; forced to print. */
function rowTint(row: LedgerRow): React.CSSProperties {
  const base: React.CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };
  if (row.kind === 'balance') return { ...base, backgroundColor: '#f1f5f9' };
  if (row.kind === 'payment') return { ...base, backgroundColor: '#ecfdf5' };
  if (row.status === 'notaCredito') return { ...base, backgroundColor: '#fffbeb' };
  if (row.status === 'presupuestado') return { ...base, backgroundColor: '#ffe4e6' };
  return base;
}

function computeTotals(rows: LedgerRow[]) {
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    totalDebe: round2(rows.reduce((s, r) => s + (r.kind === 'balance' || r.status === 'presupuestado' ? 0 : r.debe), 0)),
    totalHaber: round2(rows.reduce((s, r) => s + (r.kind === 'balance' ? 0 : r.haber), 0)),
    finalBalance: rows.length > 0 ? rows[rows.length - 1].runningBalance : 0,
  };
}

export function LedgerPrintTemplate({ data }: LedgerPrintTemplateProps) {
  const t = useTranslations('PatientLedger');
  const tStatement = useTranslations('AccountStatement');
  const { patientName, rowsByCurrency, periodLabel } = data;
  const currencies = Object.keys(rowsByCurrency).sort((a, b) =>
    a === 'UYU' ? -1 : b === 'UYU' ? 1 : a.localeCompare(b),
  );

  return (
    <div>
      {/* Document title + patient — mirrors the sheet header, without any controls. */}
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-gray-300">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">{tStatement('title')}</h1>
          {periodLabel && <span className="text-xs text-gray-500">{periodLabel}</span>}
        </div>
        {patientName && <span className="text-sm font-medium text-gray-700">{patientName}</span>}
      </div>

      {currencies.map((currency) => {
        const rows = rowsByCurrency[currency] || [];
        const totals = computeTotals(rows);
        return (
          <section key={currency} className="mb-6">
            {currencies.length > 1 && (
              <h2 className="text-xs font-semibold text-gray-500 mb-1">{currency}</h2>
            )}
            <table className="ledger-print-table">
              <colgroup>
                <col style={{ width: '17%' }} />
                <col style={{ width: '38%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t('columns.date')}</th>
                  <th>{t('columns.treatment')}</th>
                  <th className="num">{t('columns.debit')}</th>
                  <th className="num">{t('columns.credit')}</th>
                  <th className="num">{t('columns.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const docLine = docNumbersLabel(row, t);
                  return (
                    <tr key={row.id} style={rowTint(row)}>
                      {/* Fecha column: date on top, status label underneath. */}
                      <td>
                        <div className="whitespace-nowrap">{formatDisplayDate(row.date)}</div>
                        <div className="status">{statusLabel(row, t)}</div>
                      </td>
                      <td>
                        <div className="font-medium">
                          {row.status === 'presupuestado' && (
                            <span
                              className="mr-1 inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-white"
                              style={{ backgroundColor: '#e11d48', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                            >
                              P
                            </span>
                          )}
                          {row.kind === 'balance' ? t('openingBalance.label') : row.label}
                        </div>
                        {row.kind === 'balance' ? (
                          <div className="notes">{t('openingBalance.hint')}</div>
                        ) : (
                          <>
                            {docLine && <div className="doc">{docLine}</div>}
                            {row.notes && <div className="notes">{row.notes}</div>}
                          </>
                        )}
                      </td>
                      <td className="num">
                        {fmtZero(row.debe, row.currency)}
                        {row.status === 'presupuestado' && (
                          <div className="notcounted">{t('footer.notCounted')}</div>
                        )}
                      </td>
                      <td className="num">{fmtZero(row.haber, row.currency)}</td>
                      <td className="num font-semibold">{fmtDash(row.runningBalance, row.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals — kept together and, as the last block, landing on the last page. */}
            <div className="ledger-print-totals" style={{ breakInside: 'avoid' }}>
              <div className="text-right">
                <div className="lbl">{t('footer.totalDebit')}</div>
                <div className="val">{fmtZero(totals.totalDebe, currency)}</div>
              </div>
              <div className="text-right">
                <div className="lbl">{t('footer.totalCredit')}</div>
                <div className="val">{fmtZero(totals.totalHaber, currency)}</div>
              </div>
              <div className="text-right">
                <div className="lbl">{t('footer.finalBalance')}</div>
                <div
                  className="val"
                  style={{
                    color: totals.finalBalance > 0.005 ? '#dc2626' : totals.finalBalance < -0.005 ? '#059669' : '#111827',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                >
                  {fmtZero(totals.finalBalance, currency)}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
