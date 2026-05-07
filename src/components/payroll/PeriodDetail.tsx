'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CierreWorkflow } from '@/components/payroll/CierreWorkflow';
import { PayrollEntryDetail } from '@/components/payroll/PayrollEntryDetail';
import { MOCK_ENTRIES, MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollEntry, PayrollPeriod, PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronDown, Lock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

interface Props {
  periodId: string;
  onClose?: () => void;
}

export function PeriodDetail({ periodId, onClose }: Props) {
  const t = useTranslations('PayrollPage.periodDetail');
  const tPeriods = useTranslations('PayrollPage.periods');

  const [period, setPeriod] = useState<PayrollPeriod | undefined>(
    MOCK_PERIODS.find((p) => p.id === periodId)
  );
  const [entries] = useState<PayrollEntry[]>(
    MOCK_ENTRIES.filter((e) => e.payroll_period_id === periodId)
  );
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [cierreOpen, setCierreOpen] = useState(false);

  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="text-muted-foreground">Período no encontrado.</p>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Volver a períodos
          </Button>
        )}
      </div>
    );
  }

  const canCalculate = period.status === 'draft' || period.status === 'calculated';
  const canApprove = period.status === 'calculated';
  const canMarkPaid = period.status === 'approved';
  const canCierre = true; // TODO: restrict to approved/paid once real API is wired
  const isReadonly = period.status === 'paid' || period.status === 'closed';

  function handleCalculate() {
    setPeriod((p) => p ? {
      ...p,
      status: 'calculated',
      total_gross: entries.reduce((s, e) => s + e.gross_salary, 0),
      total_net: entries.reduce((s, e) => s + e.net_salary, 0),
      total_employer_cost: entries.reduce((s, e) => s + e.total_employer_cost, 0),
      entries_count: entries.length,
      generated_at: new Date().toISOString(),
    } : p);
  }

  function handleApprove() {
    setPeriod((p) => p ? { ...p, status: 'approved', approved_at: new Date().toISOString() } : p);
  }

  function handleMarkPaid() {
    setPeriod((p) => p ? { ...p, status: 'paid', paid_at: new Date().toISOString() } : p);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold capitalize">
                {getMonthName(period.period_month)} {period.period_year}
              </h1>
              <Badge className={cn('text-xs', STATUS_COLORS[period.status])}>
                {tPeriods(`statusLabels.${period.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {entries.length} liquidaciones
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canCalculate && (
            <Button size="sm" variant="outline" onClick={handleCalculate}>
              {period.status === 'draft' ? t('calculate') : t('recalculate')}
            </Button>
          )}
          {canApprove && (
            <Button size="sm" onClick={handleApprove}>
              {t('approve')}
            </Button>
          )}
          {canMarkPaid && (
            <Button size="sm" onClick={handleMarkPaid}>
              {t('markPaid')}
            </Button>
          )}
          {canCierre && (
            <Button size="sm" variant="outline" onClick={() => setCierreOpen(true)}>
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              {t('cierre')}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-none"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Totals */}
      {period.total_gross && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{t('totalGross')}</p>
              <p className="text-lg font-bold">{formatCurrency(period.total_gross)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{t('totalNet')}</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatCurrency(period.total_net!)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{t('employerCost')}</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(period.total_employer_cost!)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">{t('noEntries')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Collapsible
              key={entry.id}
              open={expandedEntry === entry.id}
              onOpenChange={(open) => setExpandedEntry(open ? entry.id : null)}
            >
              <Card>
                <CardHeader className="p-0">
                  <CollapsibleTrigger className="w-full text-left">
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-7 items-center px-4 py-3 hover:bg-muted/20 rounded-t-lg gap-2">
                      <div className="col-span-2 font-medium text-sm">{entry.doctor_name}</div>
                      <div className="text-center text-sm text-muted-foreground">{entry.sessions_count} ses.</div>
                      <div className="text-right text-sm text-muted-foreground">{formatCurrency(entry.services_revenue_billed)}</div>
                      <div className="text-right text-sm font-medium">{formatCurrency(entry.gross_salary)}</div>
                      <div className="text-right text-sm font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(entry.net_salary)}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">{t('expand')}</span>
                        <ChevronDown className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform',
                          expandedEntry === entry.id && 'rotate-180'
                        )} />
                      </div>
                    </div>

                    {/* Mobile row */}
                    <div className="sm:hidden px-4 py-3 hover:bg-muted/20 rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{entry.doctor_name}</span>
                        <ChevronDown className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform',
                          expandedEntry === entry.id && 'rotate-180'
                        )} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Sesiones</p>
                          <p className="font-medium">{entry.sessions_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bruto</p>
                          <p className="font-medium">{formatCurrency(entry.gross_salary)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Neto</p>
                          <p className="font-medium text-green-600 dark:text-green-400">{formatCurrency(entry.net_salary)}</p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>

                <CollapsibleContent>
                  <div className="border-t">
                    <PayrollEntryDetail entry={entry} readonly={isReadonly} />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Cierre dialog */}
      <Dialog open={cierreOpen} onOpenChange={(v) => !v && setCierreOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {t('cierreTitle')}
            </DialogTitle>
          </DialogHeader>
          <CierreWorkflow period={period} onClose={() => setCierreOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
