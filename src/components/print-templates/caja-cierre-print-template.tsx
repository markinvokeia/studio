'use client';

import { useTranslations } from 'next-intl';
import { cn, formatDateTime } from '@/lib/utils';
import type { CajaCierrePrintData } from '@/stores/print-document-store';

interface CajaCierrePrintTemplateProps {
  data: CajaCierrePrintData;
}

function fmtAmt(value: number, currency: string) {
  return `${currency} ${Math.abs(Number(value ?? 0)).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CajaCierrePrintTemplate({ data }: CajaCierrePrintTemplateProps) {
  const t = useTranslations('PrintTemplates.cajaCierre');
  const { details } = data;
  const openingDetails = details.opening_details ?? {};
  const closingDetails = details.closing_details ?? {};
  const bankDepositDetails = details.bank_deposit_details ?? {};
  const currenciesData = details.currencies_data ?? [];
  const movements = details.movements_data ?? [];
  const currencies = ['UYU', 'USD'] as const;

  function renderMovementsTable(currency: string) {
    const currMovs = movements.filter((m) => m.currency === currency);
    if (currMovs.length === 0) return <p className="text-xs text-gray-400 text-center py-2">{t('noMovements', { currency })}</p>;

    const totalIngresos = currMovs.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const totalEgresos = currMovs.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);

    return (
      <table className="print-template-table w-full">
        <thead>
          <tr>
            <th className="text-left">{t('movementDate')}</th>
            <th className="text-left">{t('movementMethod')}</th>
            <th className="text-left">{t('movementDescription')}</th>
            <th className="text-left">{t('registeredBy')}</th>
            <th className="text-right">{t('movementAmount')}</th>
          </tr>
        </thead>
        <tbody>
          {currMovs.map((mov) => {
            const isEgreso = mov.amount < 0;
            return (
              <tr key={mov.movement_id}>
                <td className="text-xs whitespace-nowrap">{formatDateTime(mov.created_at)}</td>
                <td className="text-xs">{mov.payment_method_name || '—'}</td>
                <td className="text-xs whitespace-pre-line">{mov.description || '—'}</td>
                <td className="text-xs text-gray-500">{mov.registered_by_user || '—'}</td>
                <td className={cn('text-right text-xs font-medium', isEgreso ? 'text-red-600' : '')}>
                  {isEgreso ? '−' : ''}{fmtAmt(mov.amount, currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200">
            <td colSpan={4} className="text-right text-xs text-gray-500">{t('totalIncome')}</td>
            <td className="text-right text-xs font-semibold text-green-700">{fmtAmt(totalIngresos, currency)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right text-xs text-gray-500">{t('totalExpense')}</td>
            <td className="text-right text-xs font-semibold text-red-600">−{fmtAmt(totalEgresos, currency)}</td>
          </tr>
          <tr className="border-t border-gray-200">
            <td colSpan={4} className="text-right text-xs font-bold">{t('net')}</td>
            <td className="text-right text-xs font-bold">{fmtAmt(totalIngresos - totalEgresos, currency)}</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  function renderDenomTable(raw: Record<string, any> | undefined, currencyKey: string) {
    if (!raw || typeof raw !== 'object') return <p className="text-xs text-gray-400">Sin detalle.</p>;
    const entries = Object.entries(raw)
      .filter(([k, v]) => k !== 'total' && Number(v) > 0)
      .sort(([a], [b]) => Number(b) - Number(a));
    const total = Number(raw.total ?? 0);
    if (entries.length === 0 && total === 0) return <p className="text-xs text-gray-400">Sin denominaciones registradas.</p>;
    return (
      <table className="print-template-table w-full">
        <thead><tr><th className="text-left">Denominación</th><th className="text-center">Cantidad</th><th className="text-right">Subtotal</th></tr></thead>
        <tbody>
          {entries.map(([denom, qty]) => (
            <tr key={denom}>
              <td>{currencyKey} {Number(denom).toLocaleString()}</td>
              <td className="text-center">{String(qty)}</td>
              <td className="text-right">{fmtAmt(Number(denom) * Number(qty), currencyKey)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200">
            <td colSpan={2} className="text-right text-xs font-semibold">Total</td>
            <td className="text-right font-bold">{fmtAmt(total, currencyKey)}</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  function renderBankDeposit(currencyKey: string) {
    const raw = (bankDepositDetails as Record<string, any>)[currencyKey.toLowerCase()];
    if (!raw || typeof raw !== 'object') return <p className="text-xs text-gray-400">Sin depósito.</p>;
    const entries = Object.entries(raw).filter(([, v]) => v !== null && v !== undefined && String(v) !== '');
    if (entries.length === 0) return <p className="text-xs text-gray-400">Sin depósito registrado.</p>;
    return (
      <table className="print-template-table w-full">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}><td className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</td><td className="text-right font-medium">{String(v)}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      {/* Título */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Cierre de Caja</h1>
        <span className="text-sm text-gray-500 font-mono">#{String(details.id)}</span>
      </div>

      {/* Información general */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 pb-1 border-b border-gray-200">Información General</h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-6 text-sm print-template-section">
        <div><span className="text-gray-500">Cajero: </span><span className="font-medium">{details.user_name || '—'}</span></div>
        <div><span className="text-gray-500">Punto de caja: </span><span className="font-medium">{details.cash_point_name || '—'}</span></div>
        <div><span className="text-gray-500">Apertura: </span><span className="font-medium">{formatDateTime(details.opened_at)}</span></div>
        <div><span className="text-gray-500">Cierre: </span><span className="font-medium">{details.closed_at ? formatDateTime(details.closed_at) : '—'}</span></div>
        {(openingDetails as any).date_rate && (
          <div><span className="text-gray-500">Tipo de cambio: </span><span className="font-medium">1 USD = UYU {(openingDetails as any).date_rate}</span></div>
        )}
      </div>

      {/* Denominaciones de apertura */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 pb-1 border-b border-gray-200">Denominaciones de Apertura</h2>
      {currencies.map((cur) => {
        const raw = (openingDetails as Record<string, any>)[cur.toLowerCase()];
        return (
          <div key={cur} className="mb-4 print-template-section">
            <p className="text-xs font-medium text-gray-600 mb-1">{cur}</p>
            {renderDenomTable(raw, cur)}
          </div>
        );
      })}

      {/* Movimientos */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 pb-1 border-b border-gray-200">{t('movements')}</h2>
      {currencies.map((cur) => (
        <div key={cur} className="mb-4 print-template-section">
          <p className="text-xs font-medium text-gray-600 mb-1">{cur}</p>
          {renderMovementsTable(cur)}
        </div>
      ))}

      {/* Resumen de cierre por moneda */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 pb-1 border-b border-gray-200">Resumen de Cierre</h2>
      {currenciesData.map((cd) => {
        const variance = Number(cd.declared_cash) - Number(cd.calculated_cash);
        return (
          <div key={cd.currency} className="mb-4 print-template-section">
            <p className="text-xs font-medium text-gray-600 mb-1">{cd.currency}</p>
            <table className="print-template-table w-full">
              <tbody>
                <tr><td className="text-gray-500">Monto apertura</td><td className="text-right font-medium">{fmtAmt(cd.opening_amount, cd.currency)}</td></tr>
                <tr><td className="text-gray-500">Efectivo declarado</td><td className="text-right font-medium">{fmtAmt(cd.declared_cash, cd.currency)}</td></tr>
                <tr><td className="text-gray-500">Efectivo sistema</td><td className="text-right font-medium">{fmtAmt(cd.calculated_cash, cd.currency)}</td></tr>
                <tr>
                  <td className="text-gray-500">Diferencia efectivo</td>
                  <td className={cn('text-right font-semibold', variance < 0 ? 'text-red-600' : 'text-green-700')}>
                    {variance < 0 ? '−' : ''}{fmtAmt(variance, cd.currency)}
                  </td>
                </tr>
                <tr><td className="text-gray-500">Tarjeta (sistema)</td><td className="text-right font-medium">{fmtAmt(cd.calculated_card, cd.currency)}</td></tr>
                <tr><td className="text-gray-500">Transferencia (sistema)</td><td className="text-right font-medium">{fmtAmt(cd.calculated_transfer, cd.currency)}</td></tr>
                <tr><td className="text-gray-500">Otros (sistema)</td><td className="text-right font-medium">{fmtAmt(cd.calculated_other, cd.currency)}</td></tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Denominaciones de cierre */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 pb-1 border-b border-gray-200">Denominaciones de Cierre</h2>
      {currencies.map((cur) => {
        const raw = (closingDetails as Record<string, any>)[cur.toLowerCase()];
        return (
          <div key={cur} className="mb-4 print-template-section">
            <p className="text-xs font-medium text-gray-600 mb-1">{cur}</p>
            {renderDenomTable(raw, cur)}
          </div>
        );
      })}

      {/* Depósito bancario */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 pb-1 border-b border-gray-200">Depósito Bancario</h2>
      {currencies.map((cur) => (
        <div key={cur} className="mb-4 print-template-section">
          <p className="text-xs font-medium text-gray-600 mb-1">{cur}</p>
          {renderBankDeposit(cur)}
        </div>
      ))}

      {(details as any).closing_notes && (
        <div className="mt-4 print-template-section">
          <p className="text-xs font-medium text-gray-500 mb-1">Notas de cierre</p>
          <p className="text-sm">{(details as any).closing_notes}</p>
        </div>
      )}
    </div>
  );
}
