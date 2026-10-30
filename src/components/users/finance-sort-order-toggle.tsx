'use client';

import * as React from 'react';
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { FinanceSortOrder } from '@/lib/types';

interface FinanceSortOrderToggleProps {
  value: FinanceSortOrder;
  onChange: (order: FinanceSortOrder) => void;
  /** h-8 to sit next to the ledger's h-8 toolbar controls (default matches the DataTable toolbar's h-9). */
  compact?: boolean;
  className?: string;
}

/** Segmented control choosing whether the most recent finance document shows at the top or at the end. */
export function FinanceSortOrderToggle({ value, onChange, compact, className }: FinanceSortOrderToggleProps) {
  const t = useTranslations('FinanceSortOrder');
  const options: { order: FinanceSortOrder; icon: typeof ArrowUpToLine; label: string }[] = [
    { order: 'newest-first', icon: ArrowUpToLine, label: t('newestFirst') },
    { order: 'newest-last', icon: ArrowDownToLine, label: t('newestLast') },
  ];

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn('inline-flex shrink-0 items-center rounded-md border bg-muted/40 p-0.5', compact ? 'h-8' : 'h-9', className)}
    >
      {options.map(({ order, icon: Icon, label }) => (
        <button
          key={order}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={value === order}
          onClick={() => onChange(order)}
          className={cn(
            'inline-flex items-center justify-center rounded-[5px] transition-colors',
            compact ? 'h-7 w-7' : 'h-8 w-8',
            value === order
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      ))}
    </div>
  );
}
