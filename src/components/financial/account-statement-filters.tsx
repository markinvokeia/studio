'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { DateRange } from 'react-day-picker';

import { DateRangePresets } from '@/components/reports/date-range-presets';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export type DocTypeFilter = 'all' | 'invoice' | 'payment' | 'credit_note';

interface AccountStatementFiltersProps {
  dateRange: DateRange | undefined;
  onDateRange: (range: DateRange | undefined) => void;
  onlyUnpaid: boolean;
  onOnlyUnpaid: (value: boolean) => void;
  docType: DocTypeFilter;
  onDocType: (value: DocTypeFilter) => void;
}

export function AccountStatementFilters({
  dateRange,
  onDateRange,
  onlyUnpaid,
  onOnlyUnpaid,
  docType,
  onDocType,
}: AccountStatementFiltersProps) {
  const t = useTranslations('AccountStatement');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePresets value={dateRange} onChange={onDateRange} allowAllTime />

      <Select value={docType} onValueChange={(v) => onDocType(v as DocTypeFilter)}>
        <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">{t('docTypeAll')}</SelectItem>
          <SelectItem value="invoice" className="text-xs">{t('docTypeInvoices')}</SelectItem>
          <SelectItem value="payment" className="text-xs">{t('docTypePayments')}</SelectItem>
          <SelectItem value="credit_note" className="text-xs">{t('docTypeCreditNotes')}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1">
        <Switch id="only-unpaid" checked={onlyUnpaid} onCheckedChange={onOnlyUnpaid} className="scale-90" />
        <Label htmlFor="only-unpaid" className="cursor-pointer text-xs font-medium">{t('filterOnlyUnpaid')}</Label>
      </div>
    </div>
  );
}
