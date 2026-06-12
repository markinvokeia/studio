'use client';

import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { CajaSesionPrintData } from '@/stores/print-document-store';

interface CajaSesionPrintTemplateProps {
  data: CajaSesionPrintData;
}

function fmtAmt(value: number, currency: string) {
  return `${currency} ${Math.abs(value).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 mt-6 pb-1 border-b border-gray-200">
      {children}
    </h2>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );
}

export function CajaSesionPrintTemplate({ data }: CajaSesionPrintTemplateProps) {
  const { details } = data;
  const movements = details.movements_data ?? [];
  const openingDetails = details.opening_details ?? {};
  const closingDetails = details.closing_details ?? {};
  const bankDepositDetails = details.bank_deposit_details ?? {};
  const currenciesData = details.currencies_data ?? [];

  const currencies = ['UYU', 'USD'] as const;

  // Opening denominations
  function renderDenominationTable(currencyKey: string, label: string) {
    const raw = (openingDetails as Record<string, any>)[currencyKey.toLowerCase()];
    if (!raw) return null;
    const entries = Object.entries(raw)
      .filter(([k, v]) => k !== 'total' && Number(v) > 0)
      .sort(([a], [b]) => Number(b) - Number(a));
    const total = Number(raw.total ?? 0);
    if (entries.length === 0 && total === 0) return null;

    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
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
              <td colSpan={2} className="text-right font-semibold text-xs">Total</td>
              <td className="text-right font-bold">{fmtAmt(total, currencyKey)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // Movements table per currency
  function renderMovementsTable(currency: string) {
    const currMovs = movements.filter((m) => m.currency === currency);
    if (currMovs.length === 0) return (
      <p className="text-xs text-gray-400 text-center py-2">Sin movimientos en {currency}.</p>
    );

    const totalIngresos = currMovs.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const totalEgresos = currMovs.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);

    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{currency}</p>
        <table className="print-template-table w-full">
          <thead>
            <tr>
              <th className="text-left">Fecha</th>
              <th className="text-left">Método</th>
              <th className="text-left">Descripción</th>
              <th className="text-left">Registrado por</th>
              <th className="text-right">Monto</th>
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
              <td colSpan={4} className="text-right text-xs text-gray-500">Total ingresos</td>
              <td className="text-right text-xs font-semibold text-green-700">{fmtAmt(totalIngresos, currency)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right text-xs text-gray-500">Total egresos</td>
              <td className="text-right text-xs font-semibold text-red-600">−{fmtAmt(totalEgresos, currency)}</td>
            </tr>
            <tr className="border-t border-gray-200">
              <td colSpan={4} className="text-right text-xs font-bold">Neto</td>
              <td className="text-right text-xs font-bold">{fmtAmt(totalIngresos - totalEgresos, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // Closing details per currency (currencies_data)
  function renderClosingDetails(currency: string) {
    const cd = currenciesData.find((c) => c.currency === currency);
    if (!cd) return null;
    const variance = Number(cd.declared_cash) - Number(cd.calculated_cash);
    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{currency}</p>
        <table className="print-template-table w-full">
          <tbody>
            <tr><td className="text-gray-500">Monto apertura</td><td className="text-right font-medium">{fmtAmt(cd.opening_amount, currency)}</td></tr>
            <tr><td className="text-gray-500">Efectivo declarado</td><td className="text-right font-medium">{fmtAmt(cd.declared_cash, currency)}</td></tr>
            <tr><td className="text-gray-500">Efectivo sistema</td><td className="text-right font-medium">{fmtAmt(cd.calculated_cash, currency)}</td></tr>
            <tr>
              <td className="text-gray-500">Diferencia efectivo</td>
              <td className={cn('text-right font-semibold', variance < 0 ? 'text-red-600' : 'text-green-700')}>
                {variance < 0 ? '−' : ''}{fmtAmt(variance, currency)}
              </td>
            </tr>
            <tr><td className="text-gray-500">Tarjeta (sistema)</td><td className="text-right font-medium">{fmtAmt(cd.calculated_card, currency)}</td></tr>
            <tr><td className="text-gray-500">Transferencia (sistema)</td><td className="text-right font-medium">{fmtAmt(cd.calculated_transfer, currency)}</td></tr>
            <tr><td className="text-gray-500">Otros (sistema)</td><td className="text-right font-medium">{fmtAmt(cd.calculated_other, currency)}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Closing denomination tables (closing_details)
  function renderClosingDenomTable(currencyKey: string) {
    const raw = (closingDetails as Record<string, any>)[currencyKey.toLowerCase()];
    if (!raw) return null;
    const entries = Object.entries(raw).filter(([k, v]) => k !== 'total' && Number(v) > 0).sort(([a], [b]) => Number(b) - Number(a));
    const total = Number(raw.total ?? 0);
    if (entries.length === 0 && total === 0) return (
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{currencyKey}</p>
        <p className="text-xs text-gray-400">Sin detalle de denominaciones.</p>
      </div>
    );
    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{currencyKey}</p>
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
              <td colSpan={2} className="text-right font-semibold text-xs">Total</td>
              <td className="text-right font-bold">{fmtAmt(total, currencyKey)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // Bank deposit details
  function renderBankDeposit(currencyKey: string) {
    const raw = (bankDepositDetails as Record<string, any>)[currencyKey.toLowerCase()];
    if (!raw) return null;
    const entries = Object.entries(raw).filter(([, v]) => v !== null && v !== undefined && String(v) !== '');
    if (entries.length === 0) return (
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{currencyKey}</p>
        <p className="text-xs text-gray-400">Sin depósito registrado.</p>
      </div>
    );
    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{currencyKey}</p>
        <table className="print-template-table w-full">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</td>
                <td className="text-right font-medium">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Reporte de Sesión de Caja</h1>
        <span className="text-sm text-gray-500 font-mono">#{String(details.id)}</span>
      </div>

      {/* Información general */}
      <SectionTitle>Información General</SectionTitle>
      <InfoGrid>
        <InfoRow label="Cajero" value={details.user_name} />
        <InfoRow label="Punto de caja" value={details.cash_point_name} />
        <InfoRow label="Fecha apertura" value={formatDateTime(details.opened_at)} />
        <InfoRow label="Fecha cierre" value={details.closed_at ? formatDateTime(details.closed_at) : 'Sesión abierta'} />
        <InfoRow label="Estado" value={details.status === 'CLOSE' ? 'Cerrada' : 'Abierta'} />
        {(openingDetails as any).date_rate && (
          <InfoRow label="Tipo de cambio" value={`1 USD = UYU ${(openingDetails as any).date_rate}`} />
        )}
      </InfoGrid>

      {/* Detalles de apertura */}
      <SectionTitle>Detalles de Apertura</SectionTitle>
      {currencies.map((cur) => renderDenominationTable(cur, cur))}

      {/* Movimientos */}
      <SectionTitle>Movimientos</SectionTitle>
      {currencies.map((cur) => renderMovementsTable(cur))}

      {/* Detalles de cierre */}
      <SectionTitle>Detalles de Cierre</SectionTitle>
      {currencies.map((cur) => renderClosingDetails(cur))}

      {/* Denominaciones de cierre */}
      <SectionTitle>Denominaciones de Cierre</SectionTitle>
      {currencies.map((cur) => renderClosingDenomTable(cur))}

      {/* Resumen por moneda */}
      <SectionTitle>Resumen por Moneda</SectionTitle>
      <div className="border border-gray-200 rounded mb-4">
        <table className="print-template-table w-full">
          <thead>
            <tr>
              <th className="text-left">Moneda</th>
              <th className="text-right">Apertura</th>
              <th className="text-right">Efectivo sistema</th>
              <th className="text-right">Efectivo declarado</th>
              <th className="text-right">Diferencia</th>
              <th className="text-right">Tarjeta</th>
              <th className="text-right">Transferencia</th>
            </tr>
          </thead>
          <tbody>
            {currenciesData.map((cd) => {
              const variance = Number(cd.declared_cash) - Number(cd.calculated_cash);
              return (
                <tr key={cd.currency}>
                  <td className="font-medium">{cd.currency}</td>
                  <td className="text-right">{fmtAmt(cd.opening_amount, cd.currency)}</td>
                  <td className="text-right">{fmtAmt(cd.calculated_cash, cd.currency)}</td>
                  <td className="text-right">{fmtAmt(cd.declared_cash, cd.currency)}</td>
                  <td className={cn('text-right font-semibold', variance < 0 ? 'text-red-600' : 'text-green-700')}>
                    {variance < 0 ? '−' : ''}{fmtAmt(variance, cd.currency)}
                  </td>
                  <td className="text-right">{fmtAmt(cd.calculated_card, cd.currency)}</td>
                  <td className="text-right">{fmtAmt(cd.calculated_transfer, cd.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Depósito bancario */}
      <SectionTitle>Depósito Bancario</SectionTitle>
      {currencies.map((cur) => renderBankDeposit(cur))}
    </div>
  );
}
