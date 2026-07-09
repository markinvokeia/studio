'use client';

import * as React from 'react';
import { FileText, Printer, RefreshCw, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { PatientLedger, type PatientLedgerHandle } from '@/components/users/patient-ledger';
import { usePatientLedgerSheet } from '@/stores/patient-ledger-sheet-store';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';

/**
 * Global host for the "view account statement" shortcut used throughout the app
 * (appointment panel, appointment form, inline draft, classic finance tabs).
 * Always shows the unified ledger — the whole point of this shortcut is giving a
 * consolidated timeline even to patients whose finance_view preference is 'tabs'.
 *
 * Creating quotes/treatments/payments now happens inline in the ledger's own floating
 * action bar, so this host no longer wires up the create dialogs — only the header
 * Print/Refresh controls and the reload plumbing.
 */
export function PatientLedgerSheet() {
  const { isOpen, userId, userName, close } = usePatientLedgerSheet();
  const t = useTranslations('AccountStatement');
  const { printFinancialSummary } = usePrintDocument();
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const ledgerRef = React.useRef<PatientLedgerHandle>(null);

  React.useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  // Reset the search box whenever the sheet re-targets a different patient.
  React.useEffect(() => { setSearchTerm(''); setSearchOpen(false); }, [userId]);

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
      defaultFullscreen
    >
      <div className="flex h-full flex-col overflow-hidden bg-card">
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4 pr-28">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-foreground">{t('title')}</SheetTitle>
            <SheetDescription className="truncate text-sm text-muted-foreground">{userName || ''}</SheetDescription>
          </div>
          {/* Search + Print + Refresh sit before the sheet's own Fullscreen (right-12) /
              Close (right-4) controls, which the pr-28 above reserves room for. All icons
              share the same h-8 w-8 button / h-4 w-4 icon sizing. */}
          <div className="flex shrink-0 items-center gap-1">
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={() => { if (!searchTerm) setSearchOpen(false); }}
              placeholder={t('search')}
              className={cn(
                'h-8 text-xs transition-all duration-200',
                searchOpen ? 'w-40 opacity-100' : 'w-0 border-0 p-0 opacity-0',
              )}
              tabIndex={searchOpen ? 0 : -1}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => { if (searchOpen && searchTerm) setSearchTerm(''); setSearchOpen((v) => !v); }}
              disabled={!userId}
              title={t('search')}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handlePrint}
              disabled={isPrinting || !userId}
              title={t('print')}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => ledgerRef.current?.refresh()}
              disabled={!userId}
              title={t('refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {userId && (
            <PatientLedger
              ref={ledgerRef}
              userId={userId}
              patientName={userName}
              hideToolbarActions
              searchTerm={searchTerm}
            />
          )}
        </div>
      </div>
    </ResizableSheet>
  );
}
