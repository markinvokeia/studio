'use client';

import { AlertCircle } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportAgingResponse, ReportAgingRow } from '@/lib/types';
import { cn, fmtMoney } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
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

export default function DeudoresPage() {
  const t = useTranslations('ReportDeudoresPage');

  const [currency, setCurrency] = useState('UYU');
  const [minAmount, setMinAmount] = useState('');
  const [bucket, setBucket]     = useState('all');

  const [data, setData]         = useState<ReportAgingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      const query: Record<string, string> = { currency, bucket };
      if (minAmount) query.min_amount = minAmount;
      const res = await api.get(API_ROUTES.REPORTS.DEUDORES, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [currency, minAmount, bucket]);

  const chartData = data?.rows.slice(0, 10).map((r) => ({
    name: r.patient_name.split(' ').slice(0, 2).join(' '),
    '0-30':  Number(r.bucket_0_30),
    '31-60': Number(r.bucket_31_60),
    '61-90': Number(r.bucket_61_90),
    '+90':   Number(r.bucket_90_plus),
  })) ?? [];

  const columns: ColumnDef<ReportAgingRow>[] = [
    { accessorKey: 'patient_name', header: t('col_paciente') },
    { accessorKey: 'phone_number', header: t('col_telefono'), size: 90 },
    {
      accessorKey: 'total_debt',
      header: t('col_total'),
      size: 90,
      cell: ({ row }) => <span className="font-semibold text-red-600 tabular-nums">{fmt(Number(row.original.total_debt))}</span>,
    },
    {
      accessorKey: 'bucket_0_30',
      header: '0–30d',
      size: 68,
      cell: ({ row }) => <span className="text-emerald-600 tabular-nums">{fmt(Number(row.original.bucket_0_30))}</span>,
    },
    {
      accessorKey: 'bucket_31_60',
      header: '31–60d',
      size: 68,
      cell: ({ row }) => <span className="text-amber-500 tabular-nums">{fmt(Number(row.original.bucket_31_60))}</span>,
    },
    {
      accessorKey: 'bucket_61_90',
      header: '61–90d',
      size: 68,
      cell: ({ row }) => <span className={cn('tabular-nums', 'text-orange-500')}>{fmt(Number(row.original.bucket_61_90))}</span>,
    },
    {
      accessorKey: 'bucket_90_plus',
      header: '+90d',
      size: 68,
      cell: ({ row }) => <span className="text-red-600 tabular-nums font-semibold">{fmt(Number(row.original.bucket_90_plus))}</span>,
    },
  ];

  const s = data?.summary;

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
        <Label className="text-xs whitespace-nowrap">{t('filter_bucket')}</Label>
        <Select value={bucket} onValueChange={setBucket}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter_bucket_all')}</SelectItem>
            <SelectItem value="0-30">0–30 días</SelectItem>
            <SelectItem value="31-60">31–60 días</SelectItem>
            <SelectItem value="61-90">61–90 días</SelectItem>
            <SelectItem value="+90">+90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_min')}</Label>
        <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" className="h-8 w-28 text-xs" />
      </div>
    </div>
  );

  return (
    <ReportShell
      icon={AlertCircle}
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
            <ReportKPICard title={t('kpi_total_deuda')} value={fmtMoney(s.total_deuda,    currency)} variant="danger" />
            <ReportKPICard title={t('kpi_deudores')}    value={s.num_deudores} />
            <ReportKPICard title={t('kpi_vencida')}     value={fmtMoney(s.bucket_90_plus, currency)} variant="danger" />
            <ReportKPICard title={t('kpi_corriente')}   value={fmtMoney(s.bucket_0_30,   currency)} variant="warning" />
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
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="0-30"  stackId="a" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="31-60" stackId="a" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="61-90" stackId="a" fill="hsl(var(--chart-5))" />
                    <Bar dataKey="+90"   stackId="a" fill="hsl(var(--destructive))" radius={[0, 3, 3, 0]} />
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
                  {data.rows.slice(0, 5).map((r) => (
                    <div key={r.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[140px]">{r.patient_name}</span>
                        <span className="font-semibold text-red-600 tabular-nums text-xs">{fmt(Number(r.total_debt))}</span>
                      </div>
                      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                        {Number(r.bucket_0_30)   > 0 && <div className="bg-emerald-500" style={{ flex: r.bucket_0_30 }} />}
                        {Number(r.bucket_31_60)  > 0 && <div className="bg-amber-400"   style={{ flex: r.bucket_31_60 }} />}
                        {Number(r.bucket_61_90)  > 0 && <div className="bg-orange-500"  style={{ flex: r.bucket_61_90 }} />}
                        {Number(r.bucket_90_plus) > 0 && <div className="bg-red-600"    style={{ flex: r.bucket_90_plus }} />}
                      </div>
                      <p className="text-xs text-muted-foreground">{r.phone_number}</p>
                    </div>
                  ))}
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
