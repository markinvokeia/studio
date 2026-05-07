'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_ENTRIES, MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CalendarDays, DollarSign, TrendingUp, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useState } from 'react';

const STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export function PayrollDashboard() {
  const t = useTranslations('PayrollPage.dashboard');
  const tPeriods = useTranslations('PayrollPage.periods');
  const router = useRouter();
  const locale = useLocale();

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(4);

  const currentPeriod = MOCK_PERIODS.find(
    (p) => p.period_year === selectedYear && p.period_month === selectedMonth
  );
  const currentEntries = currentPeriod
    ? MOCK_ENTRIES.filter((e) => e.payroll_period_id === currentPeriod.id)
    : [];

  const activeDoctors = new Set(MOCK_ENTRIES.map((e) => e.doctor_id)).size;
  const pendingCount = MOCK_PERIODS.filter((p) => p.status === 'calculated').length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/payroll/periods`)}>
            <CalendarDays className="h-4 w-4 mr-1.5" />
            {t('currentPeriod')}
          </Button>
          <Button size="sm" onClick={() => router.push(`/${locale}/payroll/periods`)}>
            {t('generatePeriod')}
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm capitalize"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{getMonthName(m)}</option>
          ))}
        </select>
        {currentPeriod && (
          <Badge className={cn('text-xs', STATUS_COLORS[currentPeriod.status])}>
            {tPeriods(`statusLabels.${currentPeriod.status}`)}
          </Badge>
        )}
      </div>

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
              {currentPeriod?.total_gross ? formatCurrency(currentPeriod.total_gross) : '—'}
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
              {currentPeriod?.total_net ? formatCurrency(currentPeriod.total_net) : '—'}
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
              {currentPeriod?.total_employer_cost ? formatCurrency(currentPeriod.total_employer_cost) : '—'}
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
          <CardTitle className="text-sm font-medium">{t('entries' as 'sessions')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {currentEntries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t('noCurrentPeriod')}</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('doctor')}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('sessions')}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('hours')}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('production')}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('gross')}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('net')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                        onClick={() => currentPeriod && router.push(`/${locale}/payroll/periods`)}
                      >
                        <td className="px-4 py-2.5 font-medium">{entry.doctor_name}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{entry.sessions_count}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{entry.hours_worked}h</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(entry.services_revenue_billed)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(entry.gross_salary)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(entry.net_salary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-2 sm:hidden px-4 pb-4">
                {currentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-muted/20"
                    onClick={() => currentPeriod && router.push(`/${locale}/payroll/periods`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{entry.doctor_name}</span>
                      <span className="text-xs text-muted-foreground">{entry.sessions_count} {t('sessions')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">{t('production')}</p>
                        <p className="font-medium">{formatCurrency(entry.services_revenue_billed)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('gross')}</p>
                        <p className="font-medium">{formatCurrency(entry.gross_salary)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('net')}</p>
                        <p className="font-medium text-green-600 dark:text-green-400">{formatCurrency(entry.net_salary)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
