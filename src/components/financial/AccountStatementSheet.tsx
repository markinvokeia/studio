'use client';

import * as React from 'react';
import { FileText, Loader2, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { FinancialSummaryPrintTemplate } from '@/components/print-templates/financial-summary-print-template';
import { useAccountStatement } from '@/stores/account-statement-store';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { FinancialSummaryReport } from '@/lib/types';

/**
 * Global, on-screen "estado de cuenta" panel. Reuses the same report and
 * template that the financial print button produces, but renders it on screen
 * and adds a Print action. Open it anywhere via useAccountStatement.open(userId).
 */
export function AccountStatementSheet() {
  const { isOpen, userId, userName, close } = useAccountStatement();
  const t = useTranslations('AccountStatement');
  const { printFinancialSummary } = usePrintDocument();
  const { toast } = useToast();

  const [report, setReport] = React.useState<FinancialSummaryReport | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [isPrinting, setIsPrinting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !userId) return;
    let active = true;
    setStatus('loading');
    setReport(null);
    api
      .get(API_ROUTES.USER_FINANCIAL_SUMMARY_PRINT, { user_id: userId })
      .then((raw: any) => {
        if (!active) return;
        const data = (Array.isArray(raw) ? raw[0] : raw) as FinancialSummaryReport | undefined;
        if (!data?.history_by_currency || Object.keys(data.history_by_currency).length === 0) {
          setStatus('empty');
          return;
        }
        setReport(data);
        setStatus('idle');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [isOpen, userId]);

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

  const heading = report?.name || userName || t('title');

  return (
    <ResizableSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) close(); }}
      defaultWidth={840}
      minWidth={520}
      maxWidth={1200}
      storageKey="account-statement-width"
    >
      <div className="flex h-full flex-col overflow-hidden bg-card">
        {/* Header — pr-12 leaves room for the sheet's built-in close button */}
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4 pr-12">
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
            {t('print')}
          </Button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 sm:p-6">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          )}
          {status === 'empty' && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 opacity-40" />
              {t('noData')}
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-destructive">
              {t('error')}
            </div>
          )}
          {status === 'idle' && report && (
            <div className="account-statement-doc mx-auto max-w-3xl rounded-lg bg-white p-6 text-gray-900 shadow-sm sm:p-8">
              <FinancialSummaryPrintTemplate data={{ report }} />
            </div>
          )}
        </div>
      </div>
    </ResizableSheet>
  );
}
