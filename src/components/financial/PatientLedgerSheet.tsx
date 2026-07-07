'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { PatientLedger } from '@/components/users/patient-ledger';
import { usePatientLedgerSheet } from '@/stores/patient-ledger-sheet-store';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';

/**
 * Global host for the "view account statement" shortcut used throughout the app
 * (appointment panel, appointment form, inline draft, classic finance tabs).
 * Always shows the unified ledger — the whole point of this shortcut is giving a
 * consolidated timeline even to patients whose finance_view preference is 'tabs'.
 */
export function PatientLedgerSheet() {
  const { isOpen, userId, userName, close } = usePatientLedgerSheet();
  const t = useTranslations('AccountStatement');
  const { printFinancialSummary } = usePrintDocument();
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrint = React.useCallback(async () => {
    if (!userId || isPrinting) return;
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
  }, [userId, isPrinting, printFinancialSummary, toast, t]);

  return (
    <ResizableSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) close(); }}
      defaultWidth={860}
      minWidth={520}
      maxWidth={1200}
      storageKey="patient-ledger-sheet-width"
    >
      <div className="flex h-full flex-col overflow-hidden bg-card">
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4 pr-20">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-foreground">{t('title')}</SheetTitle>
            <SheetDescription className="truncate text-sm text-muted-foreground">{userName || ''}</SheetDescription>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {userId && <PatientLedger userId={userId} onPrintSummary={handlePrint} />}
        </div>
      </div>
    </ResizableSheet>
  );
}
