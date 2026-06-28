'use client';

import * as React from 'react';
import { Banknote, FileMinus, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDisplayDate } from '@/lib/utils';
import type { CobrarLineState, StatementEntry } from '@/lib/types';

const SHARED = '__shared__';

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${Math.abs(amount).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtBalance(balance: number, currency: string) {
  return `${balance < 0 ? '−' : ''}${fmtAmount(balance, currency)}`;
}

interface AccountStatementTimelineProps {
  entries: StatementEntry[];
  /** When true, only collectable invoice rows are shown and rows are selectable. */
  cobrarMode: boolean;
  selected: Record<string, CobrarLineState>;
  onToggle: (entry: StatementEntry) => void;
  onLineChange: (invoiceId: string, patch: Partial<CobrarLineState>) => void;
  paymentMethods: { id: string; name: string }[];
}

const ICON_BY_KIND = {
  invoice: FileText,
  payment: Banknote,
  credit_note: FileMinus,
} as const;

const ICON_TINT = {
  invoice: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  payment: 'bg-red-500/10 text-red-600 dark:text-red-400',
  credit_note: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const;

/** i18n key for the amount-column label, by entry kind. */
const AMOUNT_LABEL_KEY = {
  invoice: 'invoiced',
  payment: 'paid',
  credit_note: 'docTypeCreditNotes',
} as const;

export function AccountStatementTimeline({
  entries,
  cobrarMode,
  selected,
  onToggle,
  onLineChange,
  paymentMethods,
}: AccountStatementTimelineProps) {
  const t = useTranslations('AccountStatement');

  const visible = cobrarMode
    ? entries.filter((e) => e.kind === 'invoice' && (e.pending ?? 0) > 0 && e.invoiceId)
    : entries;

  if (visible.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{t('noEntriesMatch')}</p>;
  }

  return (
    <ol className="flex flex-col">
      {visible.map((entry, idx) => {
        const Icon = ICON_BY_KIND[entry.kind];
        const isCandidate = entry.kind === 'invoice' && (entry.pending ?? 0) > 0 && !!entry.invoiceId;
        const line = entry.invoiceId ? selected[entry.invoiceId] : undefined;
        const isSelected = !!line;
        const isLast = idx === visible.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-3">
            {/* Timeline rail: icon + connector */}
            <div className="flex shrink-0 flex-col items-center">
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', ICON_TINT[entry.kind])}>
                <Icon className="h-4 w-4" />
              </span>
              {!isLast && <span className="my-1 w-px flex-1 bg-border" />}
            </div>

            {/* Card */}
            <div className="min-w-0 flex-1 pb-3">
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">{formatDisplayDate(entry.date)}</div>
              <div
                className={cn(
                  'rounded-lg border bg-card p-2.5 transition-colors',
                  isSelected && 'border-primary ring-1 ring-primary',
                  cobrarMode && isCandidate && !isSelected && 'hover:border-primary/50',
                )}
              >
                <div
                  className={cn('flex items-start justify-between gap-3', cobrarMode && isCandidate && 'cursor-pointer')}
                  onClick={cobrarMode && isCandidate ? () => onToggle(entry) : undefined}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {cobrarMode && isCandidate && <Checkbox checked={isSelected} className="mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{entry.docNo}</span>
                        {(entry.pending ?? 0) > 0 && (
                          <Badge variant="outline" className="border-amber-500/40 px-1.5 py-0 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            {t('pending')}: {fmtAmount(entry.pending!, entry.currency)}
                          </Badge>
                        )}
                      </div>
                      <div className="break-words text-xs text-muted-foreground">
                        {entry.concept}
                        {entry.notes && <span className="opacity-70"> · {entry.notes}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Two aligned columns (fixed min-width so all amounts/balances line
                      up across cards, even for 7-digit numbers). */}
                  <div className="flex shrink-0 gap-3 text-right tabular-nums">
                    <div className="min-w-[7.5rem]">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{AMOUNT_LABEL_KEY[entry.kind] ? t(AMOUNT_LABEL_KEY[entry.kind]) : ''}</div>
                      <div
                        className={cn(
                          'text-sm font-semibold',
                          entry.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {entry.amount > 0 ? '' : '−'}
                        {fmtAmount(entry.amount, entry.currency)}
                      </div>
                    </div>
                    <div className="min-w-[7.5rem]">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('balance')}</div>
                      <div className="text-sm font-semibold text-foreground">{fmtBalance(entry.runningBalance, entry.currency)}</div>
                    </div>
                  </div>
                </div>

                {/* Inline collect column for the selected line */}
                {isSelected && line && (
                  <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-dashed pt-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('amountToCollect')}</span>
                      <Input
                        type="number"
                        min={0}
                        max={line.pending}
                        step="0.01"
                        value={line.amount || ''}
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value) || 0;
                          const clamped = Math.min(line.pending, Math.max(0, Math.round(raw * 100) / 100));
                          onLineChange(line.invoiceId, { amount: clamped });
                        }}
                        className="h-8 w-28 text-xs"
                      />
                    </label>
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('paymentMethod')}</span>
                      <Select
                        value={line.methodId ?? SHARED}
                        onValueChange={(v) => onLineChange(line.invoiceId, { methodId: v === SHARED ? undefined : v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SHARED} className="text-xs">{t('sharedMethod')}</SelectItem>
                          {paymentMethods.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
