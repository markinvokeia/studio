'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { differenceInDays, format as formatDate, parseISO, startOfMonth } from 'date-fns';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export type GridExportFormat = 'csv' | 'excel';

interface GridExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: GridExportFormat, dateFrom: Date, dateTo: Date) => Promise<void>;
  isExporting?: boolean;
  title?: string;
}

const MAX_DAYS = 92; // ~3 months

export function GridExportDialog({
  open,
  onOpenChange,
  onExport,
  isExporting = false,
  title,
}: GridExportDialogProps) {
  const t = useTranslations('GridExportDialog');
  const [format, setFormat] = React.useState<GridExportFormat>('excel');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Reset state when dialog opens, pre-fill with current month range
  React.useEffect(() => {
    if (open) {
      const today = new Date();
      setFormat('excel');
      setDateFrom(formatDate(startOfMonth(today), 'yyyy-MM-dd'));
      setDateTo(formatDate(today, 'yyyy-MM-dd'));
      setError(null);
    }
  }, [open]);

  const validate = (): string | null => {
    if (!dateFrom) return t('dateFromRequired');
    if (!dateTo) return t('dateToRequired');
    const from = parseISO(dateFrom);
    const to = parseISO(dateTo);
    if (to < from) return t('dateToBeforeFrom');
    if (differenceInDays(to, from) > MAX_DAYS) return t('periodTooLong');
    return null;
  };

  const handleExport = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    await onExport(format, parseISO(dateFrom), parseISO(dateTo));
  };

  const isDisabled = isExporting || !dateFrom || !dateTo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title ?? t('title')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5 py-4 px-6">
          {/* Format selector */}
          <div className="space-y-2">
            <Label>{t('format')}</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as GridExportFormat)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="excel" id="fmt-excel" />
                <Label htmlFor="fmt-excel" className="flex items-center gap-1.5 cursor-pointer font-normal">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  {t('excel')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="csv" id="fmt-csv" />
                <Label htmlFor="fmt-csv" className="flex items-center gap-1.5 cursor-pointer font-normal">
                  <FileText className="h-4 w-4 text-blue-600" />
                  {t('csv')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-date-from">{t('dateFrom')}</Label>
              <DatePickerInput
                value={dateFrom}
                onChange={(v) => { setDateFrom(v); setError(null); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-date-to">{t('dateTo')}</Label>
              <DatePickerInput
                value={dateTo}
                onChange={(v) => { setDateTo(v); setError(null); }}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            {t('cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isDisabled}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('export')}
              </>
            ) : (
              t('export')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
