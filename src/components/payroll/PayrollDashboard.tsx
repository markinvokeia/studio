'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportExportActions } from '@/components/reports/report-export-actions';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollEntry, PayrollPeriod, PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, DollarSign, LayoutGrid, List, Search, Settings2, TrendingUp, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  draft:      'bg-muted text-muted-foreground',
  calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed:     'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

interface DashboardData {
  current_period?: PayrollPeriod;
  entries?: PayrollEntry[];
  active_employees?: number;
  pending_count?: number;
  total_gross?: number;
  total_net?: number;
  total_employer_cost?: number;
}

export function PayrollDashboard() {
  const t = useTranslations('PayrollPage.dashboard');
  const tPeriods = useTranslations('PayrollPage.periods');
  const router = useRouter();
  const locale = useLocale();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [isCardMode, setIsCardMode] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get(
        API_ROUTES.PAYROLL.DASHBOARD,
        { year: String(selectedYear), month: String(selectedMonth) }
      );
      setData((result as DashboardData) ?? {});
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const currentPeriod = data.current_period;
  const allEntries = data.entries ?? [];
  const activeDoctors = data.active_employees ?? 0;
  const pendingCount = data.pending_count ?? 0;

  const currentEntries = doctorSearch
    ? allEntries.filter((e) => (e.doctor_name ?? '').toLowerCase().includes(doctorSearch.toLowerCase()))
    : allEntries;

  const entryColumns = useMemo<ColumnDef<PayrollEntry>[]>(() => [
    {
      id: 'doctor',
      header: t('doctor'),
      accessorKey: 'doctor_name',
      cell: ({ row }) => <span className="font-medium">{row.original.doctor_name}</span>,
    },
    {
      id: 'sessions',
      header: t('sessions'),
      accessorKey: 'sessions_count',
      cell: ({ row }) => (
        <span className="text-right block text-muted-foreground tabular-nums">{row.original.sessions_count}</span>
      ),
    },
    {
      id: 'hours',
      header: t('hours'),
      accessorKey: 'hours_worked',
      cell: ({ row }) => (
        <span className="text-right block text-muted-foreground tabular-nums">{row.original.hours_worked}h</span>
      ),
    },
    {
      id: 'production',
      header: t('production'),
      accessorKey: 'services_revenue_billed',
      cell: ({ row }) => (
        <span className="text-right block text-muted-foreground font-mono tabular-nums">
          {formatCurrency(row.original.services_revenue_billed)}
        </span>
      ),
    },
    {
      id: 'gross',
      header: t('gross'),
      accessorKey: 'gross_salary',
      cell: ({ row }) => (
        <span className="text-right block font-medium font-mono tabular-nums">
          {formatCurrency(row.original.gross_salary)}
        </span>
      ),
    },
    {
      id: 'net',
      header: t('net'),
      accessorKey: 'net_salary',
      cell: ({ row }) => (
        <span className="text-right block font-medium text-green-600 dark:text-green-400 font-mono tabular-nums">
          {formatCurrency(row.original.net_salary)}
        </span>
      ),
    },
  ], [t]);

  function handleExportCSV() {
    if (!currentEntries.length) return;
    const header = 'Doctor,Sesiones,Horas,Producción,Bruto,Neto';
    const rows = currentEntries.map((e) =>
      [e.doctor_name, e.sessions_count, e.hours_worked, e.services_revenue_billed, e.gross_salary, e.net_salary].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina-${selectedYear}-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
    <div className="flex flex-col gap-6 pt-2 px-4 pb-4 sm:pt-4 sm:px-6 sm:pb-6 overflow-y-auto flex-1 border-0 lg:border shadow-none lg:shadow-sm rounded-none lg:rounded-xl bg-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2 items-center">
          <ReportExportActions
            disabled={currentEntries.length === 0}
            onExportCSV={handleExportCSV}
            onPrint={() => window.print()}
          />
          <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/payroll/periods`)}>
            <CalendarDays className="h-4 w-4 mr-1.5" />
            {t('currentPeriod')}
          </Button>
          <Button size="sm" onClick={() => router.push(`/${locale}/payroll/periods`)}>
            {t('generatePeriod')}
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-24 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(selectedMonth)}
          onValueChange={(v) => setSelectedMonth(Number(v))}
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)} className="capitalize">{getMonthName(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentPeriod && (
          <Badge className={cn('text-xs', STATUS_COLORS[currentPeriod.status])}>
            {tPeriods(`statusLabels.${currentPeriod.status}`)}
          </Badge>
        )}

        {/* Doctor filter */}
        <div className="relative ml-auto sm:w-48">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Filtrar doctor..."
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  {t('totalGross')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xl font-bold">
                  {currentPeriod?.total_gross
                    ? formatCurrency(currentPeriod.total_gross)
                    : (data.total_gross ? formatCurrency(data.total_gross) : '—')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  {t('totalNet')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {currentPeriod?.total_net
                    ? formatCurrency(currentPeriod.total_net)
                    : (data.total_net ? formatCurrency(data.total_net) : '—')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {t('totalEmployerCost')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {currentPeriod?.total_employer_cost
                    ? formatCurrency(currentPeriod.total_employer_cost)
                    : (data.total_employer_cost ? formatCurrency(data.total_employer_cost) : '—')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {t('activeDoctors')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xl font-bold">{activeDoctors}</p>
                {pendingCount > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">{pendingCount} {t('pendingApproval')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary table */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium">{t('sessions')}</CardTitle>
                <div className="flex items-center gap-1">
                  {doctorSearch && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {currentEntries.length} / {allEntries.length} doctores
                    </Badge>
                  )}
                  <Button variant={isCardMode ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"
                    onClick={() => setIsCardMode(true)} title="Vista en tarjetas">
                    <LayoutGrid className="h-3 w-3" />
                  </Button>
                  <Button variant={!isCardMode ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"
                    onClick={() => setIsCardMode(false)} title="Vista en tabla">
                    <List className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <DataTable
                columns={entryColumns}
                data={currentEntries}
                isNarrow={isCardMode}
                onRowClick={() => router.push(`/${locale}/payroll/periods`)}
                getRowClassName={() => 'cursor-pointer'}
                renderCard={(entry) => (
                  <DataCard
                    title={entry.doctor_name ?? '—'}
                    subtitle={`${entry.sessions_count} sesiones · ${entry.hours_worked}h`}
                    avatar={(entry.doctor_name ?? '??').slice(0, 2).toUpperCase()}
                    onClick={() => router.push(`/${locale}/payroll/periods`)}
                    actions={
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-mono font-medium">{formatCurrency(entry.gross_salary)}</span>
                        <span className="text-xs font-mono text-green-600 dark:text-green-400">{formatCurrency(entry.net_salary)}</span>
                      </div>
                    }
                  />
                )}
                customToolbar={(table, paginationNode) => (
                  <div className="flex items-center justify-end gap-1 px-4 pb-2">
                    {!isCardMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(table as any).getAllColumns()
                            .filter((col: any) => col.getCanHide())
                            .map((col: any) => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={col.getIsVisible()}
                                onCheckedChange={(val) => col.toggleVisibility(!!val)}
                              >
                                {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                              </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {paginationNode}
                  </div>
                )}
              />
              {/* Totals row */}
              {currentEntries.length > 0 && !isCardMode && (
                <div className="border-t bg-muted/30 grid grid-cols-6 text-sm font-semibold px-4 py-2.5">
                  <span>Total</span>
                  <span className="text-right tabular-nums">{currentEntries.reduce((s, e) => s + e.sessions_count, 0)}</span>
                  <span className="text-right tabular-nums">{currentEntries.reduce((s, e) => s + e.hours_worked, 0).toFixed(1)}h</span>
                  <span className="text-right font-mono tabular-nums">{formatCurrency(currentEntries.reduce((s, e) => s + e.services_revenue_billed, 0))}</span>
                  <span className="text-right font-mono tabular-nums">{formatCurrency(currentEntries.reduce((s, e) => s + e.gross_salary, 0))}</span>
                  <span className="text-right text-green-600 dark:text-green-400 font-mono tabular-nums">{formatCurrency(currentEntries.reduce((s, e) => s + e.net_salary, 0))}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </div>
  );
}
