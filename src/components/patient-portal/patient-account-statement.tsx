'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import {
  computeTotals,
  docNumbersLabel,
  fmtDash,
  fmtZero,
  statusLabel,
} from '@/components/print-templates/ledger-print-template';

import { buildPatientLedger } from '@/lib/patient-ledger';
import type { LedgerRow } from '@/lib/patient-ledger';
import { cn, formatDisplayDate } from '@/lib/utils';
import { fetchPatientLedgerData } from '@/services/patient-ledger-data';

interface PatientAccountStatementProps {
  userId: string;
  patientName?: string;
}

/** Anchos compartidos por la tabla fija y la scrolleable, para que las columnas alineen. */
const COLUMNS = ['20%', '36%', '15%', '15%', '14%'];

function ColGroup() {
  return (
    <colgroup>
      {COLUMNS.map((width) => (
        <col key={width} style={{ width }} />
      ))}
    </colgroup>
  );
}

/**
 * Estado de cuenta del portal del paciente.
 *
 * Muestra el mismo contenido que la hoja impresa —reutiliza sus helpers de
 * formato y de totales, así los números nunca divergen— pero con el layout que
 * necesita una pantalla: cabecera y totales fijos arriba, y los movimientos
 * scrolleando por debajo. En papel los totales van al final; acá tienen que
 * estar siempre a la vista, que es lo que el paciente viene a mirar.
 *
 * Se deja el color sólo en los importes: rojo lo que se debe, verde lo pagado.
 */
export function PatientAccountStatement({ userId, patientName }: PatientAccountStatementProps) {
  const t = useTranslations('PatientLedger');
  const tStatement = useTranslations('AccountStatement');
  const tPortal = useTranslations('PatientPortal.finance');

  const [rowsByCurrency, setRowsByCurrency] = React.useState<Record<string, LedgerRow[]> | null>(null);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setRowsByCurrency(null);
    setHasError(false);

    (async () => {
      try {
        const data = await fetchPatientLedgerData(userId, { forceRefresh: false });
        if (!cancelled) setRowsByCurrency(buildPatientLedger(data));
      } catch (error) {
        console.error('Failed to load the account statement:', error);
        if (!cancelled) setHasError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (hasError) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{tPortal('loadError')}</p>;
  }

  if (!rowsByCurrency) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const currencies = Object.keys(rowsByCurrency)
    .filter((c) => (rowsByCurrency[c] || []).length > 0)
    .sort((a, b) => (a === 'UYU' ? -1 : b === 'UYU' ? 1 : a.localeCompare(b)));

  if (currencies.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {tPortal('empty')}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {currencies.map((currency) => {
        const rows = rowsByCurrency[currency] || [];
        const totals = computeTotals(rows);

        return (
          <section key={currency} className="overflow-hidden rounded-xl border">
            {/* ── Bloque fijo: cabecera y totales ─────────────────────── */}
            <div className="border-b bg-muted/40">
              {currencies.length > 1 && (
                <p className="px-3 pt-2 text-xs font-semibold text-muted-foreground">{currency}</p>
              )}
              <table className="w-full table-fixed text-sm">
                <ColGroup />
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">{t('columns.date')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('columns.treatment')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('columns.debit')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('columns.credit')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('columns.balance')}</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* ── Movimientos: ocupan el ancho y scrollean ────────────── */}
            <div className="max-h-[26rem] overflow-y-auto [scrollbar-gutter:stable]">
              <table className="w-full table-fixed text-sm">
                <ColGroup />
                <tbody>
                  {rows.map((row) => {
                    const docLine = docNumbersLabel(row, t);
                    return (
                      <tr key={row.id} className="border-b last:border-b-0 align-top">
                        <td className="px-3 py-2">
                          <div className="whitespace-nowrap">{formatDisplayDate(row.date)}</div>
                          <div className="text-xs text-muted-foreground">{statusLabel(row, t)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {row.kind === 'balance' ? t('openingBalance.label') : row.label}
                          </div>
                          {row.kind === 'balance' ? (
                            <div className="text-xs text-muted-foreground">{t('openingBalance.hint')}</div>
                          ) : (
                            <>
                              {docLine && <div className="text-xs text-muted-foreground">{docLine}</div>}
                              {row.notes && <div className="text-xs text-muted-foreground">{row.notes}</div>}
                            </>
                          )}
                        </td>
                        {/* El color va sólo en los importes: rojo lo que se debe
                            (tratamiento/factura), verde lo pagado. */}
                        <td
                          className={cn(
                            'px-3 py-2 text-right tabular-nums',
                            row.debe > 0 ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-muted-foreground',
                          )}
                        >
                          {fmtZero(row.debe, row.currency)}
                          {row.status === 'presupuestado' && (
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {t('footer.notCounted')}
                            </div>
                          )}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right tabular-nums',
                            row.haber > 0
                              ? 'font-medium text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground',
                          )}
                        >
                          {fmtZero(row.haber, row.currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {fmtDash(row.runningBalance, row.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totales al pie, cada uno alineado bajo su columna: facturado bajo
                Debe, pagado bajo Haber, pendiente bajo Saldo. Queda fuera del
                scroll para que se lea siempre, aunque la lista sea larga. */}
            <table className="w-full table-fixed border-t bg-muted/40 text-sm">
              <ColGroup />
              <tbody>
                <tr>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    {tStatement('title')}
                  </td>
                  <TotalCell label={tStatement('totalCharged')} value={fmtZero(totals.totalDebe, currency)} />
                  <TotalCell label={tStatement('totalPaid')} value={fmtZero(totals.totalHaber, currency)} />
                  <TotalCell
                    label={tStatement('pendingBalance')}
                    value={fmtDash(totals.finalBalance, currency)}
                    emphasis
                  />
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      {patientName && <p className="text-right text-xs text-muted-foreground">{patientName}</p>}
    </div>
  );
}

function TotalCell({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <td className="px-3 py-2 text-right">
      <div className="text-[10px] uppercase leading-tight text-muted-foreground">{label}</div>
      <div className={cn('tabular-nums', emphasis ? 'text-base font-bold' : 'font-semibold')}>{value}</div>
    </td>
  );
}
