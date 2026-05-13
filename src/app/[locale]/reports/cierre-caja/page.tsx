'use client';

import { Vault } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { CashPoint, PaymentMethod, ReportCierreCajaResponse, ReportCierreCajaRow } from '@/lib/types';
import { formatDateTime, cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

export default function CierreCajaPage() {
  const t = useTranslations('ReportCierreCajaPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState<string>('all');
  const [cashPointId, setCashPointId] = useState<string>('all');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('all');
  const [movementType, setMovementType] = useState<string>('all');

  const [cashPoints, setCashPoints] = useState<CashPoint[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [data, setData] = useState<ReportCierreCajaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get(API_ROUTES.CASHIER.CASH_POINTS_SEARCH).then((res) => {
      // Response: [{ data: [...], total: "N" }]
      const raw = Array.isArray(res) ? res[0]?.data : (res?.data ?? res);
      setCashPoints(Array.isArray(raw) ? raw : []);
    }).catch(() => {});
    api.get(API_ROUTES.CASHIER.PAYMENT_METHODS).then((res) => {
      // Response: flat array of payment methods
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      setPaymentMethods(list);
    }).catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
        currency: currency,
        cash_point_id: cashPointId !== 'all' ? cashPointId : '',
        payment_method_id: paymentMethodId !== 'all' ? paymentMethodId : '',
        movement_type: movementType,
      };

      const res = await api.get(API_ROUTES.REPORTS.CIERRE_CAJA, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency, cashPointId, paymentMethodId, movementType]);

  const columns: ColumnDef<ReportCierreCajaRow>[] = [
    { accessorKey: 'cashier_name',    header: t('col_cashier') },
    { accessorKey: 'cash_point_name', header: t('col_cash_point') },
    {
      accessorKey: 'opened_at',
      header: t('col_opened'),
      size: 130,
      cell: ({ row }) => formatDateTime(row.original.opened_at),
    },
    {
      accessorKey: 'closed_at',
      header: t('col_closed'),
      size: 130,
      cell: ({ row }) => row.original.closed_at ? formatDateTime(row.original.closed_at) : '—',
    },
    { accessorKey: 'payment_method', header: t('col_method'),   size: 110 },
    { accessorKey: 'currency',       header: t('col_currency'), size: 60  },
    {
      accessorKey: 'total_ingresos',
      header: t('col_ingresos'),
      size: 90,
      cell: ({ row }) => <span className="tabular-nums text-emerald-600">{fmt(Number(row.original.total_ingresos))}</span>,
    },
    {
      accessorKey: 'total_egresos',
      header: t('col_egresos'),
      size: 90,
      cell: ({ row }) => <span className="tabular-nums text-red-600">{fmt(Number(row.original.total_egresos))}</span>,
    },
    { accessorKey: 'num_movimientos', header: t('col_mov'), size: 60 },
    {
      accessorKey: 'status',
      header: t('col_status'),
      size: 80,
      cell: ({ row }) => (
        <span className={cn('font-medium', row.original.status === 'CLOSE' ? 'text-muted-foreground' : 'text-green-600')}>
          {row.original.status === 'CLOSE' ? 'Cerrada' : 'Abierta'}
        </span>
      ),
    },
  ];

  const selectedCashPoint = cashPoints.find((c) => String(c.id) === cashPointId);
  const selectedPaymentMethod = paymentMethods.find((p) => String(p.id) === paymentMethodId);

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <Select value={cashPointId} onValueChange={setCashPointId}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Caja" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las cajas</SelectItem>
          {cashPoints.map((cp) => (
            <SelectItem key={cp.id} value={String(cp.id)}>{cp.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Método de pago" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los métodos</SelectItem>
          {paymentMethods.map((pm) => (
            <SelectItem key={pm.id} value={String(pm.id)}>{pm.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="UYU">UYU</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>
      <Select value={movementType} onValueChange={setMovementType}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Ingresos y egresos</SelectItem>
          <SelectItem value="ingresos">Solo ingresos</SelectItem>
          <SelectItem value="egresos">Solo egresos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const s = data?.summary;

  // Compute per-currency totals from rows for multi-currency display
  const byCur = (data?.rows ?? []).reduce<Record<string, { ingresos: number; egresos: number }>>((acc, r) => {
    const c = r.currency ?? 'UYU';
    if (!acc[c]) acc[c] = { ingresos: 0, egresos: 0 };
    acc[c].ingresos += Number(r.total_ingresos ?? 0);
    acc[c].egresos  += Number(r.total_egresos  ?? 0);
    return acc;
  }, {});
  const activeCurrencies = Object.keys(byCur).sort();
  const showMultiCurrency = currency === 'all' && activeCurrencies.length > 1;

  const filterParts: string[] = [];
  if (dateRange?.from && dateRange?.to) {
    filterParts.push(`${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`);
  }
  if (selectedCashPoint) filterParts.push(selectedCashPoint.name);
  if (selectedPaymentMethod) filterParts.push(selectedPaymentMethod.name);
  if (currency !== 'all') filterParts.push(currency);
  if (movementType !== 'all') filterParts.push(movementType === 'ingresos' ? 'Solo ingresos' : 'Solo egresos');
  const dateRangeDescription = filterParts.length > 0 ? (
    <span>
      {t('description')}{' — '}
      {filterParts.map((p, i) => (
        <span key={p}>
          {i > 0 && ' · '}
          <strong className="text-foreground font-semibold">{p}</strong>
        </span>
      ))}
    </span>
  ) : t('description');

  return (
    <ReportShell
      icon={Vault}
            title={t('title')}
      description={dateRangeDescription}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <>
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            {(() => {
              const displayCur = currency !== 'all' ? currency : activeCurrencies[0] ?? '';
              const titleCur = displayCur ? ` (${displayCur})` : '';
              const ingresosVal = showMultiCurrency
                ? activeCurrencies.map((c) => `${fmt(byCur[c].ingresos)} (${c})`).join(' / ')
                : fmt(s!.total_ingresos);
              const egresosVal = showMultiCurrency
                ? activeCurrencies.map((c) => `${fmt(byCur[c].egresos)} (${c})`).join(' / ')
                : fmt(s!.total_egresos);
              const resultadoVal = showMultiCurrency
                ? activeCurrencies.map((c) => `${fmt(byCur[c].ingresos - byCur[c].egresos)} (${c})`).join(' / ')
                : fmt(s!.resultado);
              const resultadoNeg = showMultiCurrency
                ? activeCurrencies.some((c) => byCur[c].ingresos - byCur[c].egresos < 0)
                : s!.resultado < 0;
              return (
                <>
                  <ReportKPICard title={`${t('kpi_ingresos')}${titleCur}`} value={ingresosVal} variant="success" />
                  <ReportKPICard title={`${t('kpi_egresos')}${titleCur}`} value={egresosVal} variant="danger" />
                  <ReportKPICard title={`${t('kpi_resultado')}${titleCur}`} value={resultadoVal} variant={resultadoNeg ? 'danger' : 'success'} />
                  <ReportKPICard title={t('kpi_sesiones')} value={s!.num_sesiones} />
                </>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.by_method} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="payment_method" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    {movementType !== 'egresos' && <Bar dataKey="total_ingresos" name="Ingresos" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />}
                    {movementType !== 'ingresos' && <Bar dataKey="total_egresos"  name="Egresos"  fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {movementType === 'egresos' ? 'Top egresos por método' : 'Top ingresos por método'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...data.by_method]
                    .sort((a, b) =>
                      movementType === 'egresos'
                        ? Number(b.total_egresos) - Number(a.total_egresos)
                        : Number(b.total_ingresos) - Number(a.total_ingresos)
                    )
                    .slice(0, 6)
                    .map((m) => (
                      <div key={`${m.payment_method}-${m.currency}`} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[140px]">{m.payment_method}</span>
                        {movementType === 'egresos' ? (
                          <span className="font-medium tabular-nums text-red-600">{fmt(Number(m.total_egresos))}</span>
                        ) : (
                          <span className="font-medium tabular-nums text-emerald-600">{fmt(Number(m.total_ingresos))}</span>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <ReportDataTable
            columns={columns}
            data={data.rows}
            useGlobalFilter
            filterPlaceholder="Buscar..."
            columnTranslations={{
              cashier_name:    t('col_cashier'),
              cash_point_name: t('col_cash_point'),
              opened_at:       t('col_opened'),
              closed_at:       t('col_closed'),
              payment_method:  t('col_method'),
              currency:        t('col_currency'),
              total_ingresos:  t('col_ingresos'),
              total_egresos:   t('col_egresos'),
              num_movimientos: t('col_mov'),
              status:          t('col_status'),
            }}
          />
        </>
      )}
    </ReportShell>
  );
}
