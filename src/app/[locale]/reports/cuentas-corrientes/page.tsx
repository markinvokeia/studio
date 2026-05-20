'use client';

import { AlertTriangle } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportCuentasCorrientesResponse, ReportCuentasCorrientesRow } from '@/lib/types';
import { cn, fmtMoney } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

export default function CuentasCorrientesPage() {
  const t = useTranslations('ReportCuentasCorrientesPage');

  const [currency, setCurrency] = useState('UYU');
  const [estado, setEstado]     = useState('all');

  const [data, setData]         = useState<ReportCuentasCorrientesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get(API_ROUTES.REPORTS.CUENTAS_CORRIENTES, { currency, estado });
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [currency, estado]);

  const s = data?.summary;

  const chartData = data?.rows.slice(0, 10).map((r) => ({
    name: r.patient_name.split(' ').slice(0, 2).join(' '),
    saldo: Number(r.saldo),
  })) ?? [];

  const columns: ColumnDef<ReportCuentasCorrientesRow>[] = [
    { accessorKey: 'patient_name', header: t('col_paciente'), size: 180 },
    { accessorKey: 'phone_number', header: t('col_telefono'), size: 140 },
    {
      accessorKey: 'total_invoiced',
      header: t('col_facturado'),
      size: 95,
      cell: ({ row }) => <span className="tabular-nums">{fmt(Number(row.original.total_invoiced))}</span>,
    },
    {
      accessorKey: 'total_paid',
      header: t('col_cobrado'),
      size: 95,
      cell: ({ row }) => <span className="tabular-nums text-green-600">{fmt(Number(row.original.total_paid))}</span>,
    },
    {
      accessorKey: 'saldo',
      header: t('col_saldo'),
      size: 85,
      cell: ({ row }) => {
        const v = Number(row.original.saldo);
        return (
          <span className={cn('tabular-nums font-semibold', v > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {fmt(v)}
          </span>
        );
      },
    },
  ];

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_moneda')}</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UYU">UYU</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_estado')}</Label>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter_estado_all')}</SelectItem>
            <SelectItem value="con_deuda">{t('filter_estado_deuda')}</SelectItem>
            <SelectItem value="al_dia">{t('filter_estado_al_dia')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <ReportShell
      icon={AlertTriangle}
            title={t('title')}
      description={t('description')}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && s && (
        <>
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={t('kpi_facturado')}  value={fmtMoney(s.total_facturado, currency)} />
            <ReportKPICard title={t('kpi_cobrado')}    value={fmtMoney(s.total_cobrado,   currency)} variant="success" />
            <ReportKPICard title={t('kpi_saldo')}      value={fmtMoney(s.saldo_neto,      currency)} variant="danger" />
            <ReportKPICard title={t('kpi_con_deuda')}  value={s.num_con_deuda} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_title')} (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="saldo" name={t('col_saldo')} radius={[0, 3, 3, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.saldo > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--chart-2))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('top5_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.rows.slice(0, 5).map((r) => {
                    const saldo = Number(r.saldo);
                    const pct = r.total_invoiced > 0
                      ? Math.round((r.total_paid / r.total_invoiced) * 100)
                      : 100;
                    return (
                      <div key={r.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[140px]">{r.patient_name}</span>
                          <span className={cn('font-semibold tabular-nums text-xs', saldo > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                            {saldo > 0 ? `−${fmt(saldo)}` : t('al_dia')}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-chart-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{pct}% {t('cobrado_label')}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <ReportDataTable columns={columns} data={data.rows} useGlobalFilter />
        </>
      )}
    </ReportShell>
  );
}
