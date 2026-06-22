'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { coerceNumericStrings, formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import { exportPayrollPeriodCSV, exportPayrollPeriodExcel } from '@/components/payroll/payroll-period-export';
import {
  PAYROLL_REPORT_DEFS, buildDataBlob, downloadBlob, rowsFrom, rowsToMatrix,
  type ReportCategory, type ReportDef, type ReportFormat,
} from '@/lib/payroll-report-formatters';
import type { PayrollDocument, PayrollEntry, PayrollPeriod, PayrollReceiptRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Download, FileText, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const CATEGORY_ORDER: ReportCategory[] = ['interno', 'bps', 'dgi', 'bank', 'otros'];

function unwrapEntries(raw: unknown): PayrollEntry[] {
  const inner = (raw as { data?: unknown; entries?: unknown })?.data
    ?? (raw as { entries?: unknown })?.entries ?? raw;
  return Array.isArray(inner) ? (inner as PayrollEntry[]) : [];
}

export function ReportsPanel() {
  const t = useTranslations('PayrollPage.reports');
  const tPrint = useTranslations('PrintTemplates.payrollPeriod');
  const tStatus = useTranslations('PayrollPage.periods.statusLabels');
  const { toast } = useToast();
  const { printPayrollPeriod, printPayrollReceipts, printPayrollReport } = usePrintDocument();
  const printLabel = (k: string) => tPrint(k as Parameters<typeof tPrint>[0]);

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [docs, setDocs] = useState<Record<string, PayrollDocument>>({});
  const [busyTipo, setBusyTipo] = useState<string | null>(null);

  useEffect(() => {
    api.get(API_ROUTES.PAYROLL.PERIODS, undefined).then((data) => {
      const all: PayrollPeriod[] = Array.isArray(data) ? data : ((data as { data?: PayrollPeriod[]; periods?: PayrollPeriod[] })?.data ?? (data as { periods?: PayrollPeriod[] })?.periods ?? []);
      const usable = all.filter((p) => p && p.id && p.status !== 'draft');
      setPeriods(usable);
      if (usable[0]) setSelectedYear(String(usable[0].period_year));
    }).catch(() => setPeriods([])).finally(() => setLoadingPeriods(false));
  }, []);

  // Years available (desc), and the periods of the selected year.
  const years = useMemo(
    () => [...new Set(periods.map((p) => p.period_year))].sort((a, b) => b - a).map(String),
    [periods],
  );
  const yearPeriods = useMemo(
    () => periods.filter((p) => String(p.period_year) === selectedYear)
      .sort((a, b) => b.period_month - a.period_month),
    [periods, selectedYear],
  );

  // When the year changes, select the first period of that year.
  useEffect(() => {
    if (!selectedYear) return;
    if (!yearPeriods.some((p) => p.id === selectedPeriod)) {
      setSelectedPeriod(yearPeriods[0]?.id ?? '');
    }
  }, [selectedYear, yearPeriods, selectedPeriod]);

  const period = periods.find((p) => p.id === selectedPeriod);

  const loadDocs = useCallback(async (periodId: string) => {
    if (!periodId) { setDocs({}); return; }
    try {
      const res = await api.get(API_ROUTES.PAYROLL.DOCUMENTS_BY_PERIOD, { period_id: periodId });
      const rows = rowsFrom(res) as unknown as PayrollDocument[];
      setDocs(Object.fromEntries(rows.map((d) => [d.tipo, d])));
    } catch { setDocs({}); }
  }, []);

  useEffect(() => { loadDocs(selectedPeriod); }, [selectedPeriod, loadDocs]);

  function isStale(doc?: PayrollDocument): boolean {
    const periodAt = (period as { generated_at?: string } | undefined)?.generated_at;
    return !!(doc?.generated_at && periodAt && doc.generated_at < periodAt);
  }

  function statusFor(def: ReportDef): { estado: string; tone: string } {
    if (!def.available) return { estado: 'no_procede', tone: 'bg-muted text-muted-foreground' };
    const doc = docs[def.tipo];
    if (doc?.estado === 'generado' && isStale(doc)) return { estado: 'desactualizado', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    const e = doc?.estado ?? 'pendiente';
    const tone = e === 'generado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : e === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    return { estado: e, tone };
  }

  async function recordStatus(def: ReportDef, estado: PayrollDocument['estado'], error?: string) {
    try {
      await api.post(API_ROUTES.PAYROLL.DOCUMENTS_UPSERT, {
        period_id: selectedPeriod, clinic_id: (period as { clinic_id?: number } | undefined)?.clinic_id,
        tipo: def.tipo, estado, formato: def.formats.join('/'), error_message: error ?? '',
      });
      await loadDocs(selectedPeriod);
    } catch { /* best-effort */ }
  }

  function baseName(def: ReportDef): string {
    if (def.annual) return `${def.tipo}-${selectedYear}`;
    return `${def.tipo}-${period ? `${period.period_year}_${String(period.period_month).padStart(2, '0')}` : selectedPeriod}`;
  }

  async function handleDownload(def: ReportDef, format: ReportFormat) {
    if (!def.available || busyTipo) return;
    if (!def.annual && !selectedPeriod) return;
    setBusyTipo(def.tipo);
    try {
      if (def.source === 'period') {
        const entries = unwrapEntries(await api.get(API_ROUTES.PAYROLL.ENTRIES_BY_PERIOD, { period_id: selectedPeriod }));
        if (!period) throw new Error('no_period');
        const statusText = tStatus(`${period.status}` as Parameters<typeof tStatus>[0]);
        if (format === 'pdf') await printPayrollPeriod(period, entries);
        else if (format === 'excel') await exportPayrollPeriodExcel(period, entries, printLabel, statusText);
        else exportPayrollPeriodCSV(period, entries, printLabel, statusText);
      } else if (def.source === 'receipts') {
        if (!period) throw new Error('no_period');
        const rows = rowsFrom(await api.get(API_ROUTES.PAYROLL.REPORTS_RECEIPTS, { period_id: selectedPeriod }))
          .map((r) => coerceNumericStrings(r as Record<string, unknown>) as unknown as PayrollReceiptRow);
        await printPayrollReceipts(period, rows);
      } else if (def.source === 'data') {
        const query: Record<string, string> = def.annual ? { year: selectedYear } : { period_id: selectedPeriod };
        const rows = rowsFrom(await api.get(def.endpoint!, query));
        if (format === 'pdf') {
          const { columns, matrix } = rowsToMatrix(rows);
          const subtitle = def.annual ? selectedYear : (period ? `${getMonthName(period.period_month)} ${period.period_year}` : '');
          await printPayrollReport({ title: reportLabel(def), subtitle, columns, rows: matrix });
        } else {
          const { blob, filename } = await buildDataBlob(rows, format, baseName(def));
          downloadBlob(blob, filename);
        }
      }
      await recordStatus(def, 'generado');
    } catch {
      toast({ title: t('errorTitle'), description: t('errorDesc'), variant: 'destructive' });
      await recordStatus(def, 'error', 'generation_failed');
    } finally {
      setBusyTipo(null);
    }
  }

  const reportLabel = (def: ReportDef) => {
    const k = `types.${def.tipo}.label` as Parameters<typeof t>[0];
    return t.has(k) ? t(k) : def.tipo;
  };
  const reportDesc = (def: ReportDef) => {
    const k = `types.${def.tipo}.desc` as Parameters<typeof t>[0];
    return t.has(k) ? t(k) : '';
  };
  const statusLabel = (e: string) => {
    const k = `status.${e}` as Parameters<typeof t>[0];
    return t.has(k) ? t(k) : e;
  };
  const formatLabel = (f: ReportFormat) => t(`formats.${f}` as Parameters<typeof t>[0]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filters: year first, then period of that year (single row, also on mobile) */}
      <div className="flex flex-col gap-3 p-4 border-b shrink-0">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
            <p className="text-sm text-muted-foreground shrink-0">{t('year')}:</p>
            {loadingPeriods ? <Skeleton className="h-9 w-full sm:w-28" /> : (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-28"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
            <p className="text-sm text-muted-foreground shrink-0">{t('period')}:</p>
            {loadingPeriods ? <Skeleton className="h-9 w-full sm:w-40" /> : (
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!yearPeriods.length}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder={t('selectPeriod')} /></SelectTrigger>
                <SelectContent>
                  {yearPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="capitalize">{getMonthName(p.period_month)} {p.period_year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {period && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground items-center w-full sm:w-auto sm:ml-auto">
              <span>{t('gross')}: <strong>{formatCurrency(period.total_gross ?? 0)}</strong></span>
              <span>{t('net')}: <strong>{formatCurrency(period.total_net ?? 0)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Grouped list (scrolls; rows stack on mobile) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {CATEGORY_ORDER.map((cat) => {
          const defs = PAYROLL_REPORT_DEFS.filter((d) => d.category === cat);
          if (!defs.length) return null;
          return (
            <Card key={cat} className="shrink-0">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium">{t(`categories.${cat}` as Parameters<typeof t>[0])}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-2">
                {defs.map((def) => {
                  const st = statusFor(def);
                  const doc = docs[def.tipo];
                  const isBusy = busyTipo === def.tipo;
                  return (
                    <div key={def.tipo} className="flex flex-col gap-2 py-3 border-b last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{reportLabel(def)}</p>
                          <p className="text-xs text-muted-foreground">{reportDesc(def)}</p>
                          {doc?.estado === 'error' && doc.error_message && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{doc.error_message}</p>
                          )}
                          {doc?.generated_at && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                              {t('lastGenerated')}: {new Date(doc.generated_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Badge className={cn('text-[10px]', st.tone)}>{statusLabel(st.estado)}</Badge>
                        {!def.available ? (
                          <Button size="sm" variant="outline" disabled>{t('unavailable')}</Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" disabled={isBusy || (!def.annual && !selectedPeriod)}>
                                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 sm:mr-1.5" />}
                                <span className="hidden sm:inline">{t('download')}</span>
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {def.formats.map((f) => (
                                <DropdownMenuItem key={f} onClick={() => handleDownload(def, f)}>
                                  {formatLabel(f)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
