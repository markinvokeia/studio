'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CierreWorkflow } from '@/components/payroll/CierreWorkflow';
import { PayrollEntryDetail } from '@/components/payroll/PayrollEntryDetail';
import { PeriodEntriesList } from '@/components/payroll/PeriodEntriesList';
import { ReportExportActions } from '@/components/reports/report-export-actions';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { exportPayrollPeriodCSV, exportPayrollPeriodExcel } from '@/components/payroll/payroll-period-export';
import { coerceNumericStrings, formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollEntry, PayrollPeriod, PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2, HelpCircle, Lock, Maximize2, Minimize2, RotateCcw, Wallet, Wand2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

const STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

// The backend may respond as a bare object, a bare array, or wrapped in
// { data } / { period } / { entries }. Normalize all shapes here.
function unwrapPeriod(raw: unknown): PayrollPeriod | undefined {
  const inner = (raw as { data?: unknown; period?: unknown })?.data
    ?? (raw as { period?: unknown })?.period
    ?? raw;
  const obj = Array.isArray(inner) ? inner[0] : inner;
  if (!obj || !(obj as PayrollPeriod).id) return undefined;
  return coerceNumericStrings(obj as Record<string, unknown>) as unknown as PayrollPeriod;
}

function unwrapEntries(raw: unknown): PayrollEntry[] {
  // Peel common wrappers: { data }, { data: { data } }, { entries }.
  let inner: unknown = raw;
  for (let i = 0; i < 3; i++) {
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const o = inner as Record<string, unknown>;
      if (Array.isArray(o.data) || Array.isArray(o.entries)) { inner = o.data ?? o.entries; break; }
      if (o.data !== undefined) { inner = o.data; continue; }
      if (o.entries !== undefined) { inner = o.entries; continue; }
    }
    break;
  }
  // Object keyed by index ({ "0": {...}, "1": {...} }) → values
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const values = Object.values(inner as Record<string, unknown>);
    if (values.length && values.every((v) => v && typeof v === 'object')) inner = values;
  }
  const arr = Array.isArray(inner) ? inner : [];
  return arr
    .map((e) => coerceNumericStrings(e as Record<string, unknown>) as unknown as PayrollEntry)
    .filter((e) => !!(e as PayrollEntry)?.id);
}

interface Props {
  periodId: string;
  onClose?: () => void;
  onPeriodUpdate?: (period: PayrollPeriod) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function PeriodDetail({ periodId, onClose, onPeriodUpdate, isExpanded, onToggleExpand }: Props) {
  const t = useTranslations('PayrollPage.periodDetail');
  const tPeriods = useTranslations('PayrollPage.periods');
  const tPrint = useTranslations('PrintTemplates.payrollPeriod');
  const { toast } = useToast();
  const { printPayrollPeriod } = usePrintDocument();
  // Loosely-typed wrapper so the export util can read PrintTemplates labels.
  const printLabel = (k: string) => tPrint(k as Parameters<typeof tPrint>[0]);

  const [period, setPeriod] = useState<PayrollPeriod | undefined>();
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [cierreOpen, setCierreOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [periodData, entriesData] = await Promise.all([
        api.get(API_ROUTES.PAYROLL.PERIODS_DETAIL, { id: periodId }),
        api.get(API_ROUTES.PAYROLL.ENTRIES_BY_PERIOD, { period_id: periodId }),
      ]);
      const p = unwrapPeriod(periodData);
      const e = unwrapEntries(entriesData);
      if (e.length === 0 && (p?.entries_count ?? 0) > 0) {
        // Period says it has entries but by-period returned none: surface the raw shape.
        console.warn('[PeriodDetail] entries empty but entries_count > 0. Raw response:', entriesData);
      }
      setPeriod(p);
      setEntries(e);
    } catch {
      setPeriod(undefined);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep the open slide-in entry in sync with refreshed data (e.g. after a manual edit).
  useEffect(() => {
    setSelectedEntry((prev) => (prev ? entries.find((e) => e.id === prev.id) ?? prev : prev));
  }, [entries]);

  async function handleAction(
    endpoint: string,
    body: Record<string, unknown>,
    optimisticStatus?: PayrollPeriodStatus
  ) {
    try {
      setActionLoading(true);
      const updated = await api.post(endpoint, body);
      const next: PayrollPeriod = unwrapPeriod(updated)
        ?? (optimisticStatus && period ? { ...period, status: optimisticStatus } : period) as PayrollPeriod;
      setPeriod(next);
      onPeriodUpdate?.(next);
      if (optimisticStatus === 'calculated') {
        const entriesData = await api.get(API_ROUTES.PAYROLL.ENTRIES_BY_PERIOD, { period_id: periodId });
        setEntries(unwrapEntries(entriesData));
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo completar la acción.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-3/4" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    );
  }

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
  const hasEntries = entries.length > 0;
  const canApprove = period.status === 'calculated';
  const canMarkPaid = period.status === 'approved';
  const canCierre = true;
  const canReopen = period.status === 'closed';
  const isReadonly = period.status === 'paid' || period.status === 'closed';

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* Content region — anchors the slide-in so the totals footer stays visible */}
      <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Header (fixed) */}
      <div className="payroll-panel-header flex flex-col gap-2 p-4 sm:p-5 border-b shrink-0">
          {/* Row 1: title + status badge (left), controls (right) */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold capitalize whitespace-nowrap">
              {getMonthName(period.period_month)} {period.period_year}
            </h1>
            <Badge className={cn('text-xs flex-none', STATUS_COLORS[period.status])}>
              {tPeriods(`statusLabels.${period.status}`)}
            </Badge>
            <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline">
              {entries.length} {t('liquidations')}
            </span>
            <div className="flex items-center gap-1 ml-auto flex-none">
              {onToggleExpand && (
                <button
                  type="button"
                  title={isExpanded ? 'Restaurar' : 'Expandir'}
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={onToggleExpand}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              )}
              {onClose && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {/* Row 2: action buttons on their own line (icons keep showing when narrow) */}
          <div className="flex flex-wrap items-center gap-2">
            {canCalculate && (
              <Button size="sm" disabled={actionLoading} onClick={() =>
                handleAction(API_ROUTES.PAYROLL.PERIODS_CALCULATE, { id: periodId }, 'calculated')
              }>
                {hasEntries ? <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5" /> : <Wand2 className="h-3.5 w-3.5 sm:mr-1.5" />}
                <span className="payroll-panel-header__label">{hasEntries ? t('recalculate') : t('calculate')}</span>
              </Button>
            )}
            {canApprove && (
              <Button size="sm" disabled={actionLoading} onClick={() =>
                handleAction(API_ROUTES.PAYROLL.PERIODS_APPROVE, { id: periodId }, 'approved')
              }>
                <CheckCircle2 className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="payroll-panel-header__label">{t('approve')}</span>
              </Button>
            )}
            {canMarkPaid && (
              <Button size="sm" disabled={actionLoading} onClick={() =>
                handleAction(API_ROUTES.PAYROLL.PERIODS_MARK_PAID, { id: periodId }, 'paid')
              }>
                <Wallet className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="payroll-panel-header__label">{t('markPaid')}</span>
              </Button>
            )}
            {canCierre && !canReopen && (
              <Button size="sm" variant="outline" onClick={() => setCierreOpen(true)}>
                <Lock className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="payroll-panel-header__label">{t('cierre')}</span>
              </Button>
            )}
            {canReopen && (
              <Button size="sm" variant="outline" disabled={actionLoading} onClick={() =>
                handleAction(API_ROUTES.PAYROLL.PERIODS_REOPEN, { id: periodId }, 'approved')
              }>
                <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="payroll-panel-header__label">{t('reopen')}</span>
              </Button>
            )}
            {/* Print / export — available in any status */}
            <div className="ml-auto">
              <ReportExportActions
                disabled={entries.length === 0}
                onPrint={() => printPayrollPeriod(period, entries)}
                onExportExcel={() => exportPayrollPeriodExcel(period, entries, printLabel, tPeriods(`statusLabels.${period.status}`))}
                onExportCSV={() => exportPayrollPeriodCSV(period, entries, printLabel, tPeriods(`statusLabels.${period.status}`))}
              />
            </div>
          </div>
      </div>

      {/* Entries grid (search / filter / view modes / pagination, like the employee tabs) */}
      <div className="flex-1 min-h-0 flex flex-col">
        {entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">{t('noEntries')}</p>
        ) : (
          <PeriodEntriesList
            entries={entries}
            selectedId={selectedEntry?.id}
            onSelect={setSelectedEntry}
          />
        )}
      </div>

      {/* Slide-in entry detail panel (covers header+entries; totals stay visible below) */}
      {selectedEntry && (
        <div className="absolute inset-0 z-20 bg-background flex flex-col panel-enter">
          <div className="payroll-panel-header flex items-center gap-2 px-3 py-2.5 border-b shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-none"
              onClick={() => setSelectedEntry(null)}
              aria-label={t('back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {onToggleExpand && (
              <button
                type="button"
                title={isExpanded ? 'Restaurar' : 'Expandir'}
                className="flex items-center justify-center h-8 w-8 flex-none rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={onToggleExpand}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
            <h2 className="text-base font-semibold whitespace-nowrap truncate">{selectedEntry.doctor_name}</h2>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PayrollEntryDetail entry={selectedEntry} period={period} readonly={isReadonly} onEntryChanged={fetchData} />
          </div>
        </div>
      )}
      </div>{/* end content region */}

      {/* Totals — always-visible summary footer */}
      {period.total_gross != null && (
        <div className="flex-none border-t bg-background px-4 py-3 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">{t('totalGross')}<FooterHelp text={t('totalGrossHelp')} /></p>
            <p className="text-sm font-bold">{formatCurrency(period.total_gross)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">{t('totalNet')}<FooterHelp text={t('totalNetHelp')} /></p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(period.total_net!)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">{t('employerCost')}<FooterHelp text={t('employerCostHelp')} /></p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(period.total_employer_cost!)}</p>
          </div>
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
          <div className="flex-1 overflow-y-auto">
            <CierreWorkflow period={period} onClose={() => {
              setCierreOpen(false);
              fetchData();
            }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FooterHelp({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="?">
          <HelpCircle className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-60 text-xs leading-relaxed">{text}</PopoverContent>
    </Popover>
  );
}
