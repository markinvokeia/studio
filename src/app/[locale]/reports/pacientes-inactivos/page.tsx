'use client';

import { UserX } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportPacientesInactivosResponse, ReportPacientesInactivosRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { format, subMonths } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
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

export default function PacientesInactivosPage() {
  const t = useTranslations('ReportPacientesInactivosPage');

  const [monthsInactive, setMonthsInactive] = useState('6');
  const [onlyAltaMedica, setOnlyAltaMedica] = useState(false);
  const [onlyDebtors, setOnlyDebtors]       = useState(false);

  const [data, setData] = useState<ReportPacientesInactivosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('print');
    const handler = (e: MediaQueryListEvent) => setPrintMode(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handlePrint = useCallback(async () => {
    setPrintMode(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const restore = () => {
      setPrintMode(false);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }, []);

  const handleOnlyAltaMedica = (val: boolean) => {
    setOnlyAltaMedica(val);
    if (val) setOnlyDebtors(false);
  };

  const handleOnlyDebtors = (val: boolean) => {
    setOnlyDebtors(val);
    if (val) setOnlyAltaMedica(false);
  };

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      const inactiveSince = format(subMonths(new Date(), parseInt(monthsInactive)), 'yyyy-MM-dd');
      const query: Record<string, string> = { inactive_since: inactiveSince };
      if (onlyAltaMedica) query.only_alta_medica = 'true';
      if (onlyDebtors)    query.only_debtors     = 'true';
      const res = await api.get(API_ROUTES.REPORTS.PACIENTES_INACTIVOS, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [monthsInactive, onlyAltaMedica, onlyDebtors]);

  const columns: ColumnDef<ReportPacientesInactivosRow>[] = [
    { accessorKey: 'patient_name', header: t('col_paciente'), size: printMode ? 260 : undefined },
    { accessorKey: 'phone_number', header: t('col_telefono'), size: 120 },
    {
      accessorKey: 'last_activity_date',
      header: t('col_ultima_actividad'),
      size: 130,
      cell: ({ row }) => {
        const date = row.original.inactivity_reason === 'alta_medica'
          ? row.original.alta_medica_date
          : row.original.last_activity_date;
        return date
          ? formatDate(date)
          : <span className="text-muted-foreground italic">{t('nunca')}</span>;
      },
    },
    {
      accessorKey: 'days_inactive',
      header: t('col_dias'),
      size: 100,
      cell: ({ row }) => {
        const d = row.original.days_inactive;
        if (d == null) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={cn('font-medium tabular-nums',
            d > 365 ? 'text-red-600' : d > 180 ? 'text-amber-500' : ''
          )}>
            {d}
          </span>
        );
      },
    },
    {
      accessorKey: 'inactivity_reason',
      header: t('col_razon'),
      size: printMode ? 130 : 200,
      cell: ({ row }) => {
        if (row.original.inactivity_reason === 'alta_medica') {
          return <span className="text-green-600 font-medium">{t('alta_medica')}</span>;
        }
        return <span className="text-amber-600 font-medium">{t('inactividad')}</span>;
      },
    },
    {
      id: 'debt',
      enableSorting: false,
      header: t('col_deuda'),
      size: printMode ? 90 : 130,
      cell: ({ row }) => {
        const uyu = Number(row.original.debt_uyu || 0);
        const usd = Number(row.original.debt_usd || 0);
        if (uyu === 0 && usd === 0) return '—';
        const parts: string[] = [];
        if (uyu > 0) parts.push(`${fmt(uyu)} UYU`);
        if (usd > 0) parts.push(`${fmt(usd)} USD`);
        return <span className="font-medium text-red-600 tabular-nums">{parts.join(' / ')}</span>;
      },
    },
  ];

  const ranges = [
    { label: '<90d',     min: 0,   max: 90   },
    { label: '90-180d',  min: 90,  max: 180  },
    { label: '180-365d', min: 180, max: 365  },
    { label: '+365d',    min: 365, max: Infinity },
  ];
  const chartData = ranges.map(({ label, min, max }) => {
    const inRange = (r: ReportPacientesInactivosRow) => {
      const d = r.days_inactive != null ? r.days_inactive : Infinity;
      return d > min && d <= max;
    };
    return {
      rango: label,
      alta_medica: (data?.rows ?? []).filter(r => inRange(r) && r.inactivity_reason === 'alta_medica').length,
      inactividad: (data?.rows ?? []).filter(r => inRange(r) && r.inactivity_reason === 'inactividad').length,
    };
  });

  const s = data?.summary;
  const inactividadRows = (data?.rows ?? []).filter(r => r.inactivity_reason === 'inactividad');

  // Description with applied filters in bold
  const filterParts: string[] = [
    `${monthsInactive} ${parseInt(monthsInactive) === 1 ? 'mes' : 'meses'} sin actividad`,
  ];
  if (onlyAltaMedica) filterParts.push(t('filter_alta_medica'));
  if (onlyDebtors)    filterParts.push(t('filter_deuda'));
  const description = (
    <span>
      {t('description')}{' — '}
      {filterParts.map((p, i) => (
        <span key={p}>
          {i > 0 && ' · '}
          <strong className="text-foreground font-semibold">{p}</strong>
        </span>
      ))}
    </span>
  );

  const filters = (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_meses')}</Label>
        <Select value={monthsInactive} onValueChange={setMonthsInactive}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 mes</SelectItem>
            <SelectItem value="3">3 meses</SelectItem>
            <SelectItem value="6">6 meses</SelectItem>
            <SelectItem value="12">12 meses</SelectItem>
            <SelectItem value="18">18 meses</SelectItem>
            <SelectItem value="24">24 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="only-alta-medica" checked={onlyAltaMedica} onCheckedChange={handleOnlyAltaMedica} />
        <Label htmlFor="only-alta-medica" className="text-xs">{t('filter_alta_medica')}</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="only-debtors" checked={onlyDebtors} onCheckedChange={handleOnlyDebtors} disabled={onlyAltaMedica} />
        <Label htmlFor="only-debtors" className={cn('text-xs', onlyAltaMedica && 'text-muted-foreground')}>
          {t('filter_deuda')}
        </Label>
      </div>
    </div>
  );

  return (
    <ReportShell
      icon={UserX}
            title={t('title')}
      description={description}
      filters={filters}
      onGenerate={handleGenerate}
      onPrint={handlePrint}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <>
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={t('kpi_inactivos')}   value={s!.total_inactivos} variant="warning" />
            <ReportKPICard title={t('kpi_alta_medica')} value={s!.alta_medica} />
            <ReportKPICard title={t('kpi_inactividad')} value={s!.inactividad} variant="warning" />
            <ReportKPICard title={t('kpi_con_deuda')}   value={s!.con_deuda}   variant="danger" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="rango" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="alta_medica"  name={t('alta_medica')}  fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="inactividad"  name={t('inactividad')}  fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('top_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inactividadRows.slice(0, 6).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium max-w-[160px]">{r.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{r.phone_number}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {r.days_inactive != null ? (
                          <p className={cn('text-xs font-medium', Number(r.days_inactive) > 365 ? 'text-red-600' : 'text-amber-500')}>
                            {r.days_inactive}d
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t('nunca')}</p>
                        )}
                        {Number(r.debt_uyu) > 0 && (
                          <p className="text-xs text-red-600">{fmt(Number(r.debt_uyu))} UYU</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <ReportDataTable columns={columns} data={data.rows} useGlobalFilter filterPlaceholder="Buscar..." printMode={printMode} />
        </>
      )}
    </ReportShell>
  );
}
