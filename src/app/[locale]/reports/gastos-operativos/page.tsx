'use client';

import { Receipt } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type {
  ReportGastosInvoiceRow,
  ReportGastosMiscRow,
  ReportGastosResponse,
} from '@/lib/types';
import { formatDate } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) : 0;

const CAT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#94a3b8',
];

const PAYMENT_STATE_COLORS: Record<string, string> = {
  paid:           '#22c55e',
  unpaid:         '#ef4444',
  partial:        '#f59e0b',
  partially_paid: '#f59e0b',
  overdue:        '#dc2626',
};

export default function GastosOperativosPage() {
  const t = useTranslations('ReportGastosOperativosPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to:   endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');

  // Client-side secondary filters (applied after data loads)
  const [supplierSearch, setSupplierSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [data,         setData]         = useState<ReportGastosResponse | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [appliedLabel, setAppliedLabel] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
      const dateTo   = format(dateRange.to,   'yyyy-MM-dd');
      const res = await api.get(API_ROUTES.REPORTS.GASTOS_OPERATIVOS, {
        date_from: dateFrom,
        date_to:   dateTo,
        currency,
      });
      setData(res?.data ?? null);
      setSupplierSearch('');
      setCategoryFilter('all');
      setAppliedLabel(
        `${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')} · ${currency}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency]);

  // Category options from loaded data
  const categories = useMemo(
    () =>
      [...new Set((data?.misc_rows ?? []).map(r => r.category_name).filter(Boolean))].sort() as string[],
    [data],
  );

  const filteredMiscRows = useMemo(() => {
    let rows = data?.misc_rows ?? [];
    if (categoryFilter !== 'all') rows = rows.filter(r => r.category_name === categoryFilter);
    return rows;
  }, [data, categoryFilter]);

  const filteredInvoiceRows = useMemo(() => {
    let rows = data?.invoice_rows ?? [];
    if (supplierSearch.trim()) {
      const q = supplierSearch.toLowerCase();
      rows = rows.filter(r => r.supplier_name?.toLowerCase().includes(q));
    }
    return rows;
  }, [data, supplierSearch]);

  const s = data?.summary;

  // ── Misc table columns ──────────────────────────────────────────────────────
  const miscColumns: ColumnDef<ReportGastosMiscRow>[] = [
    {
      accessorKey: 'date',
      header: t('col_fecha'),
      size: 110,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatDate(row.original.date)}</span>
      ),
    },
    { accessorKey: 'category_name',  header: t('col_categoria') },
    {
      accessorKey: 'entity_name',
      header: t('col_entidad'),
      size: 140,
    },
    { accessorKey: 'payment_method', header: t('col_metodo') },
    {
      accessorKey: 'amount',
      header: t('col_monto'),
      cell: ({ row }) => (
        <span className="font-medium text-red-600 tabular-nums">
          {fmt(Number(row.original.amount))} {row.original.currency}
        </span>
      ),
    },
    {
      accessorKey: 'notes',
      header: t('col_notas'),
      cell: ({ row }) => row.original.notes || '—',
    },
  ];

  // ── Invoice table columns ───────────────────────────────────────────────────
  const invoiceColumns: ColumnDef<ReportGastosInvoiceRow>[] = [
    {
      accessorKey: 'date',
      header: t('col_fecha'),
      size: 110,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatDate(row.original.date)}</span>
      ),
    },
    { accessorKey: 'doc_no',        header: t('col_doc') },
    { accessorKey: 'supplier_name', header: t('col_proveedor') },
    {
      accessorKey: 'total',
      header: t('col_total'),
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {fmt(Number(row.original.total))} {row.original.currency}
        </span>
      ),
    },
    {
      accessorKey: 'paid_amount',
      header: t('col_pagado'),
      cell: ({ row }) => (
        <span className="tabular-nums text-green-600">
          {fmt(Number(row.original.paid_amount))} {row.original.currency}
        </span>
      ),
    },
    {
      accessorKey: 'pending_amount',
      header: t('col_pendiente'),
      cell: ({ row }) => {
        const pending = Number(row.original.pending_amount);
        return (
          <span className={`tabular-nums font-medium ${pending > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
            {fmt(pending)} {row.original.currency}
          </span>
        );
      },
    },
    {
      accessorKey: 'payment_state',
      header: t('col_estado_pago'),
      cell: ({ row }) => {
        const state = row.original.payment_state;
        const color = PAYMENT_STATE_COLORS[state] ?? '#94a3b8';
        const label = (t as (k: string) => string)(`state_${state}`) || state;
        return (
          <span className="text-xs font-semibold" style={{ color }}>
            {label}
          </span>
        );
      },
    },
    {
      accessorKey: 'due_date',
      header: t('col_vencimiento'),
      cell: ({ row }) => (row.original.due_date ? formatDate(row.original.due_date) : '—'),
    },
    {
      accessorKey: 'top_service',
      header: t('col_servicio'),
      cell: ({ row }) => row.original.top_service || '—',
    },
  ];

  // ── Chart data ──────────────────────────────────────────────────────────────
  const periodData = (data?.by_period ?? []).map(p => ({
    ...p,
    label: p.periodo.substring(5, 10),
  }));
  const supplierData = (data?.by_supplier     ?? []).slice(0, 8);
  const debtData     = (data?.by_supplier_debt ?? []).slice(0, 8);
  const serviceData  = (data?.by_service       ?? []).slice(0, 8);
  const payStateData = (data?.by_payment_state ?? []).map(p => ({
    ...p,
    label: (t as (k: string) => string)(`state_${p.state}`) || p.state,
    fill:  PAYMENT_STATE_COLORS[p.state] ?? '#94a3b8',
  }));

  // ── Filters bar ─────────────────────────────────────────────────────────────
  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <Select value={currency} onValueChange={v => setCurrency(v as 'UYU' | 'USD')}>
        <SelectTrigger className="h-8 w-20 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="UYU">UYU</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  // ── Description with applied filters ────────────────────────────────────────
  const description = appliedLabel ? (
    <span>
      {t('description')}{' — '}
      <strong className="text-foreground font-semibold">{appliedLabel}</strong>
    </span>
  ) : t('description');

  return (
    <ReportShell
      icon={Receipt}
            title={t('title')}
      description={description}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <>
          {/* KPIs — 4 cols on print so all cards appear in one row */}
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-2">
            <ReportKPICard
              title={t('kpi_misc')}
              value={fmt(s!.total_misc)}
              subtitle={`${s!.num_misc} transacciones · ${s!.top_category}`}
              variant="danger"
              className="print:min-w-0 print:w-auto"
            />
            <ReportKPICard
              title={t('kpi_facturado')}
              value={fmt(s!.total_facturado)}
              subtitle={`${s!.num_invoices} facturas · ${s!.top_supplier}`}
              variant="danger"
              className="print:min-w-0 print:w-auto"
            />
            <ReportKPICard
              title={t('kpi_pagado')}
              value={fmt(s!.total_pagado)}
              subtitle={`${pct(s!.total_pagado, s!.total_facturado)}% de lo facturado`}
              variant="success"
              className="print:min-w-0 print:w-auto"
            />
            <ReportKPICard
              title={t('kpi_deuda')}
              value={s!.total_deuda > 0 ? fmt(s!.total_deuda) : '—'}
              subtitle={s!.top_debtor ? `Mayor deudor: ${s!.top_debtor}` : 'Sin deuda pendiente'}
              variant={s!.total_deuda > 0 ? 'warning' : 'default'}
              className="print:min-w-0 print:w-auto"
            />
          </div>

          {/* Row 1: Category pie + Period stacked bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_categoria')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.by_category}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ pct: p }: { pct: number }) => `${p.toFixed(0)}%`}
                    >
                      {data.by_category.map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 10, textAlign: 'center' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_periodo')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={periodData} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} width={60} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 10, textAlign: 'center' }} />
                    <Bar dataKey="misc"     name={t('legend_misc')}     stackId="a" fill="#ef4444" />
                    <Bar dataKey="facturas" name={t('legend_facturas')} stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Supplier totals + Supplier debt */}
          {(supplierData.length > 0 || debtData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
              {supplierData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('chart_proveedores')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(300, supplierData.length * 44)}>
                      <BarChart
                        data={supplierData}
                        layout="vertical"
                        margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                        <YAxis type="category" dataKey="supplier_name" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend wrapperStyle={{ fontSize: 10, textAlign: 'center' }} />
                        <Bar dataKey="total" name="Total facturado" fill="#3b82f6" />
                        <Bar dataKey="paid"  name="Pagado"          fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {debtData.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('chart_deuda_prov')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(300, debtData.length * 44)}>
                      <BarChart
                        data={debtData}
                        layout="vertical"
                        margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                        <YAxis type="category" dataKey="supplier_name" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend wrapperStyle={{ fontSize: 10, textAlign: 'center' }} />
                        <Bar dataKey="pending" name="Deuda pendiente" fill="#ef4444" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card className="flex items-center justify-center">
                  <p className="text-sm text-muted-foreground py-8">Sin deuda pendiente con proveedores</p>
                </Card>
              )}
            </div>
          )}

          {/* Row 3: Services + Payment state */}
          {(serviceData.length > 0 || payStateData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
              {serviceData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('chart_servicio')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(300, serviceData.length * 40)}>
                      <BarChart
                        data={serviceData}
                        layout="vertical"
                        margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                        <YAxis type="category" dataKey="service" tick={{ fontSize: 10 }} width={140} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="amount" name="Monto" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {payStateData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('chart_estado_pago')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={payStateData}
                          dataKey="total"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ label: lbl, percent }: { label: string; percent: number }) =>
                            `${lbl} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {payStateData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend wrapperStyle={{ fontSize: 10, textAlign: 'center' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Tables */}
          <div className="space-y-6">
            {/* Misc transactions */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold text-sm">{t('tab_misc')}</h3>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue placeholder={t('filter_categoria')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ReportDataTable columns={miscColumns} data={filteredMiscRows} useGlobalFilter />
            </div>

            {/* Supplier invoices */}
            {data.invoice_rows.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-sm">{t('tab_facturas')}</h3>
                  <Input
                    className="h-8 w-48 text-xs"
                    placeholder={t('filter_proveedor')}
                    value={supplierSearch}
                    onChange={e => setSupplierSearch(e.target.value)}
                  />
                </div>
                <ReportDataTable columns={invoiceColumns} data={filteredInvoiceRows} useGlobalFilter />
              </div>
            )}
          </div>
        </>
      )}
    </ReportShell>
  );
}
