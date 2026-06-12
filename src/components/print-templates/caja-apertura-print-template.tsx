'use client';

import { formatDateTime } from '@/lib/utils';
import type { CajaAperturaPrintData } from '@/stores/print-document-store';

interface CajaAperturaPrintTemplateProps {
  data: CajaAperturaPrintData;
}

function fmtAmt(value: number, currency: string) {
  return `${currency} ${Number(value ?? 0).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CajaAperturaPrintTemplate({ data }: CajaAperturaPrintTemplateProps) {
  const { details } = data;
  const openingDetails = details.opening_details ?? {};
  const currenciesData = details.currencies_data ?? [];

  function renderDenominationTable(currencyKey: string) {
    const raw = (openingDetails as Record<string, any>)[currencyKey.toLowerCase()];
    if (!raw || typeof raw !== 'object') return null;
    const entries = Object.entries(raw)
      .filter(([k, v]) => k !== 'total' && Number(v) > 0)
      .sort(([a], [b]) => Number(b) - Number(a));
    const total = Number(raw.total ?? 0);
    if (entries.length === 0 && total === 0) return null;

    return (
      <div className="mb-4 print-template-section">
        <p className="text-xs font-medium text-gray-600 mb-1">{currencyKey}</p>
        <table className="print-template-table w-full">
          <thead>
            <tr>
              <th className="text-left">Denominación</th>
              <th className="text-center">Cantidad</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
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
      </div>
    );
  }

  return (
    <div>
      {/* Título */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Apertura de Caja</h1>
        <span className="text-sm text-gray-500 font-mono">#{String(details.id)}</span>
      </div>

      {/* Información general */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-6 text-sm print-template-section">
        <div>
          <span className="text-gray-500">Cajero: </span>
          <span className="font-medium">{details.user_name || (openingDetails as any).opened_by || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Fecha apertura: </span>
          <span className="font-medium">{formatDateTime(details.opened_at)}</span>
        </div>
        {details.cash_point_name && (
          <div>
            <span className="text-gray-500">Punto de caja: </span>
            <span className="font-medium">{details.cash_point_name}</span>
          </div>
        )}
        {(openingDetails as any).date_rate && (
          <div>
            <span className="text-gray-500">Tipo de cambio: </span>
            <span className="font-medium">1 USD = UYU {(openingDetails as any).date_rate}</span>
          </div>
        )}
      </div>

      {/* Saldo inicial por moneda */}
      {currenciesData.length > 0 && (
        <div className="mb-6 print-template-section">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Saldo Inicial</h2>
          <table className="print-template-table w-full">
            <thead>
              <tr>
                <th className="text-left">Moneda</th>
                <th className="text-right">Monto apertura</th>
              </tr>
            </thead>
            <tbody>
              {currenciesData.map((cd) => (
                <tr key={cd.currency}>
                  <td className="font-medium">{cd.currency}</td>
                  <td className="text-right font-semibold">{fmtAmt(cd.opening_amount, cd.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Denominaciones de apertura */}
      <div className="print-template-section">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Denominaciones de Apertura</h2>
        {renderDenominationTable('UYU')}
        {renderDenominationTable('USD')}
      </div>
    </div>
  );
}
