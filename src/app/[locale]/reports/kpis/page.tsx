'use client';

import { Gauge } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportKPIsResponse } from '@/lib/types';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

export default function KPIsPage() {
  const t = useTranslations('ReportKPIsPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState('UYU');

  const [data, setData] = useState<ReportKPIsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
        currency,
      };
      const res = await api.get(API_ROUTES.REPORTS.KPIS, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency]);

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
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
  );

  const filterParts: string[] = [];
  if (dateRange?.from && dateRange?.to) {
    filterParts.push(`${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`);
  }
  filterParts.push(currency);
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
      icon={Gauge}
            title={t('title')}
      description={dateRangeDescription}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi_cobrado')} ({currency})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{currency} {fmt(Number(data.total_cobrado))}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi_nuevos_px')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{Number(data.nuevos_pacientes)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi_retencion')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{Number(data.tasa_retencion).toFixed(1)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi_ocupacion')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{Number(data.tasa_ocupacion).toFixed(1)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi_ticket')} ({currency})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{currency} {fmt(Number(data.ticket_promedio))}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi_gastos')} ({currency})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-red-600">{currency} {fmt(Number(data.total_gastos))}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportShell>
  );
}
