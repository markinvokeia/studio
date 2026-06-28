'use client';

import * as React from 'react';
import { endOfDay, startOfDay } from 'date-fns';
import { CheckCircle2, FileText, HandCoins, Loader2, Plus, Printer, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DateRange } from 'react-day-picker';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountStatementFilters, type DocTypeFilter } from '@/components/financial/account-statement-filters';
import { AccountStatementTimeline } from '@/components/financial/account-statement-timeline';
import { useAccountStatementData } from '@/components/financial/use-account-statement-data';
import { useCobrarFlow } from '@/components/financial/account-statement-cobrar';
import { useAccountStatement } from '@/stores/account-statement-store';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { StatementEntry } from '@/lib/types';

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${Math.abs(amount).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtBalance(balance: number, currency: string) {
  return `${balance < 0 ? '−' : ''}${fmtAmount(balance, currency)}`;
}

function sortCurrencies(currencies: string[]) {
  return [...currencies].sort((a, b) => (a === 'UYU' ? -1 : b === 'UYU' ? 1 : a.localeCompare(b)));
}

/**
 * Interactive "estado de cuenta" panel: a per-currency timeline of invoices and
 * payments (with running balance) where the user can quickly add a debt or collect
 * one/several unpaid invoices, plus the original print action.
 */
export function AccountStatementSheet() {
  const { isOpen, userId, userName, onMutate, close } = useAccountStatement();
  const t = useTranslations('AccountStatement');
  const { printFinancialSummary } = usePrintDocument();
  const { toast } = useToast();
  const { open: openBillingWizard } = useBillingWizard();

  const { status, report, entriesByCurrency, refresh } = useAccountStatementData(userId, isOpen);

  const [isPrinting, setIsPrinting] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedCurrency, setSelectedCurrency] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Filters
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [onlyUnpaid, setOnlyUnpaid] = React.useState(false);
  const [docType, setDocType] = React.useState<DocTypeFilter>('all');

  const currencies = React.useMemo(() => sortCurrencies(Object.keys(entriesByCurrency)), [entriesByCurrency]);

  // Reset filters when switching patient.
  React.useEffect(() => {
    setDateRange(undefined);
    setOnlyUnpaid(false);
    setDocType('all');
  }, [userId]);

  // Default the currency selector to UYU (or the first available).
  React.useEffect(() => {
    if (currencies.length === 0) { setSelectedCurrency(null); return; }
    setSelectedCurrency((prev) =>
      prev && currencies.includes(prev) ? prev : currencies.includes('UYU') ? 'UYU' : currencies[0],
    );
  }, [currencies]);

  // Payment methods for the collect flow.
  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api
      .get(API_ROUTES.PAYMENT_METHODS)
      .then((data: any) => {
        if (!active) return;
        const raw = Array.isArray(data) ? data : data.payment_methods || data.data || [];
        setPaymentMethods(raw.map((m: any) => ({ id: String(m.id), name: m.name })));
      })
      .catch(() => { if (active) setPaymentMethods([]); });
    return () => { active = false; };
  }, [isOpen]);

  const handleMutated = React.useCallback(() => {
    void refresh();
    onMutate?.();
  }, [refresh, onMutate]);

  const cobrar = useCobrarFlow(paymentMethods, handleMutated);

  // Show "only unpaid" while collecting (so the user sees the filtered candidates),
  // then restore the previous value once the collect ends (cancel or save).
  const onlyUnpaidBeforeCobrarRef = React.useRef(false);
  const prevActiveCurrencyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const prev = prevActiveCurrencyRef.current;
    prevActiveCurrencyRef.current = cobrar.activeCurrency;
    if (prev !== null && cobrar.activeCurrency === null && !onlyUnpaidBeforeCobrarRef.current) {
      setOnlyUnpaid(false);
    }
  }, [cobrar.activeCurrency]);

  const startCobrar = (currency: string) => {
    onlyUnpaidBeforeCobrarRef.current = onlyUnpaid;
    setOnlyUnpaid(true);
    cobrar.start(currency);
  };

  const handlePrint = async () => {
    if (!userId) return;
    setIsPrinting(true);
    try {
      await printFinancialSummary(userId);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('printError'),
        description: error?.message === 'no_data' ? t('noData') : t('printErrorGeneric'),
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleAddDebt = () => {
    if (!userId) return;
    openBillingWizard({ patientId: userId, patientName: userName, isSales: true }, handleMutated);
  };

  const selectCurrency = (currency: string) => {
    if (currency === selectedCurrency) return;
    cobrar.cancel();
    setSelectedCurrency(currency);
  };

  const applyFilters = React.useCallback((entries: StatementEntry[]) => {
    const from = dateRange?.from ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to ? endOfDay(dateRange.to) : null;
    return entries.filter((e) => {
      if (docType !== 'all' && e.kind !== docType) return false;
      if (onlyUnpaid && !(e.kind === 'invoice' && (e.pending ?? 0) > 0)) return false;
      const d = new Date(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [dateRange, onlyUnpaid, docType]);

  const heading = report?.name || userName || t('title');

  // Selected-currency derived data
  const allEntries = selectedCurrency ? entriesByCurrency[selectedCurrency] ?? [] : [];
  const inCobrar = !!selectedCurrency && cobrar.activeCurrency === selectedCurrency;
  const invoiced = allEntries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const paid = allEntries.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const balance = (selectedCurrency && report?.history_by_currency[selectedCurrency]?.final_balance) || 0;
  const currencyHasDebt = allEntries.some((e) => e.kind === 'invoice' && (e.pending ?? 0) > 0 && e.invoiceId);

  return (
    <ResizableSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) { cobrar.cancel(); close(); } }}
      defaultWidth={860}
      minWidth={520}
      maxWidth={1200}
      storageKey="account-statement-width"
    >
      <div className="flex h-full flex-col overflow-hidden bg-card">
        {/* Header — pr-20 leaves room for the sheet's close + fullscreen buttons */}
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4 pr-20">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-foreground">{t('title')}</SheetTitle>
            <SheetDescription className="truncate text-sm text-muted-foreground">{heading}</SheetDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handlePrint}
            disabled={isPrinting || status !== 'idle'}
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            <span className="hidden sm:inline">{t('print')}</span>
          </Button>
        </div>

        {/* Currency switch + filters */}
        {status === 'idle' && (
          <div className="flex flex-none flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-5 py-2.5">
            {currencies.length > 1 && (
              <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
                {currencies.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectCurrency(c)}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                      selectedCurrency === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <AccountStatementFilters
              dateRange={dateRange}
              onDateRange={setDateRange}
              onlyUnpaid={onlyUnpaid}
              onOnlyUnpaid={setOnlyUnpaid}
              docType={docType}
              onDocType={setDocType}
            />
          </div>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 sm:p-5">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          )}
          {status === 'empty' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 opacity-40" />
              {t('noData')}
              <Button variant="outline" size="sm" className="gap-2" onClick={handleAddDebt} disabled={!userId}>
                <Plus className="h-4 w-4" />
                {t('addDebt')}
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-destructive">
              {t('error')}
            </div>
          )}

          {status === 'idle' && selectedCurrency && (
            <>
              {inCobrar && <p className="mb-2 text-xs text-muted-foreground">{t('selectInvoicesToCollect')}</p>}
              <AccountStatementTimeline
                entries={inCobrar ? allEntries : applyFilters(allEntries)}
                cobrarMode={inCobrar}
                selected={cobrar.selected}
                onToggle={cobrar.toggle}
                onLineChange={cobrar.updateLine}
                paymentMethods={paymentMethods}
              />
            </>
          )}
        </div>

        {/* Footer — summary (always) or the collect card (in cobrar mode). Light
            violet background so it stands out, more so while collecting. */}
        {status === 'idle' && selectedCurrency && (
          <div className={cn(
            'flex-none border-t px-5 py-3',
            inCobrar ? 'border-primary/30 bg-primary/10' : 'border-primary/20 bg-primary/5',
          )}>
            {inCobrar ? (
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                {/* Column 1 (left): default payment method */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('defaultPaymentMethod')}</span>
                  <Select value={cobrar.sharedMethodId} onValueChange={cobrar.setSharedMethodId}>
                    <SelectTrigger className="h-9 w-52 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Columns 2 & 3 (right): total to pay + count/buttons */}
                <div className="flex items-end gap-8">
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('totalToPay')}</span>
                    <span className="text-base font-bold tabular-nums text-foreground">{fmtBalance(cobrar.totalToCollect, selectedCurrency)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">{t('selectedCount', { count: cobrar.lines.length })}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={cobrar.cancel}>
                        <X className="h-4 w-4" />
                        {t('cancel')}
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 gap-1.5"
                        disabled={cobrar.isSaving || cobrar.lines.length === 0}
                        onClick={() => setConfirmOpen(true)}
                      >
                        {cobrar.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {cobrar.progress
                          ? t('saving', { current: cobrar.progress.current, total: cobrar.progress.total })
                          : t('collect')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('invoiced')}</div>
                    <div className="text-sm font-semibold tabular-nums text-foreground">{fmtAmount(invoiced, selectedCurrency)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('paid')}</div>
                    <div className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtAmount(paid, selectedCurrency)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('balance')}</div>
                    <div className={cn('text-sm font-bold tabular-nums', balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                      {fmtBalance(balance, selectedCurrency)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleAddDebt}>
                    <Plus className="h-4 w-4" />
                    {t('addDebt')}
                  </Button>
                  {currencyHasDebt && (
                    <Button size="sm" className="h-9 gap-1.5" onClick={() => startCobrar(selectedCurrency)}>
                      <HandCoins className="h-4 w-4" />
                      {t('collect')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collect confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              {t('confirmCollectTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmCollectBody', {
                count: cobrar.lines.length,
                total: fmtAmount(cobrar.totalToCollect, selectedCurrency ?? ''),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                if (userId) cobrar.save({ userId, userName, email: report?.email });
              }}
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResizableSheet>
  );
}
